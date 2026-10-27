import { currentColorScheme } from '@viral-places/design-tokens';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import type { MapClusterItemDto, MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { useT } from '@/hooks/use-t';
import { categoryColor, mapTheme } from '@/theme';
import { clusterPlaces, isSameSpot, shouldShowScoreLabels, type ClusterNode } from '@/lib/map-cluster';
import { ClusterMarker, VenueMarker, markerAnchor } from './venue-marker';
import type { VenueMapProps } from './map-types';

/** Açık gri taban stil; Google attribution ve logo gizlenmez (§21.1). */
/**
 * Tek harita stil iskeleti; yalnız renk tablosu şemaya göre değişir. Önceden açık tema 9, karanlık 20 kural
 * içeriyordu ve iki modda görsel yoğunluk farklıydı. Google attribution hiçbir kuralla gizlenmez (§21.1).
 */
const MAP_PALETTE = {
  light: { geometry: '#F1F3F5', labelFill: '#667085', labelStroke: '#FFFFFF', natural: '#EDF1F3', manMade: '#F4F6F8', park: '#E6F0E8', road: '#FFFFFF', highway: '#FFFFFF', roadLabel: '#7A8494', transit: '#EAEDF0', border: '#DFE3E8', water: '#CFE3F6', waterLabel: '#6A8CAE' },
  dark: { geometry: '#151A21', labelFill: '#9AA4B2', labelStroke: '#0B0F14', natural: '#161D23', manMade: '#171C23', park: '#17241E', road: '#242B34', highway: '#2C3440', roadLabel: '#7D8796', transit: '#1B2129', border: '#2A313B', water: '#0B1726', waterLabel: '#4A6A8A' },
} as const;

function mapStyle(scheme: 'light' | 'dark', immersive = false) {
  const c = immersive ? { ...MAP_PALETTE.dark, geometry: mapTheme.background, natural: mapTheme.land, manMade: mapTheme.land, park: mapTheme.park, road: mapTheme.road, highway: mapTheme.highway, water: mapTheme.water, labelFill: mapTheme.label, labelStroke: mapTheme.labelStroke } : MAP_PALETTE[scheme];
  return [
    { elementType: 'geometry', stylers: [{ color: c.geometry }] },
    { elementType: 'labels.text.fill', stylers: [{ color: c.labelFill }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: c.labelStroke }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: c.natural }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: c.manMade }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: c.park }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: c.road }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: c.highway }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: c.roadLabel }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: c.transit }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: c.border }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: c.water }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: c.waterLabel }] },
  ];
}

const INITIAL_DELTA = 0.045;
/** Kümeleme için kesirli zoom; API sorgusu için yuvarlanır. */
function zoomFromDelta(longitudeDelta: number): number {
  return Math.log2(360 / longitudeDelta);
}
const MAX_ZOOM = 20;
/**
 * Kümeleme katmanı eşiği (histerezisli): altında sunucu kümeleri ("yakınlaş"), üstünde istemci kümeleme
 * ("listele"). İkisi aynı anda çizilince aynı görünen iki şey farklı davranıyordu.
 */
const SERVER_CLUSTER_ENTER_ZOOM = 13.5;
const SERVER_CLUSTER_EXIT_ZOOM = 13;
/** fitToCoordinates kenar payı (pt); mapPadding'e eklenir. */
const FIT_PADDING = 48;

type PlaceCluster = Extract<ClusterNode<MapPlaceItemDto>, { type: 'cluster' }>;

/** Küme rengi: üyelerin en az üçte ikisi aynı kategoriyse o kategorinin pin rengi; karışıksa nötr (undefined). */
function dominantTint(items: MapPlaceItemDto[]): string | undefined {
  const counts = new Map<MapPlaceItemDto['category'], number>();
  for (const it of items) counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  let best: MapPlaceItemDto['category'] | null = null;
  let bestN = 0;
  for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
  return best && bestN * 3 >= items.length * 2 ? categoryColor(best) : undefined;
}

/**
 * Platformun kendi harita yüzeyi: iOS'ta Apple Haritalar (MapKit), Android'de Google Maps.
 * iOS'ta anahtar gerekmez ve Google logosu yerine sistemin kendi sessiz atıfı görünür (ürün sahibi, 20.09.2026).
 * Pinler ekran uzayında kümelenir (§7.2); küme dokunuşu üyelere yakınlaşır, aynı noktadaki mekanlar için seçim listesi açılır.
 */
export function NativeVenueMap({ appearance = 'system', items, serverClusters = [], selectedId, onSelect, onClusterSelect, initialCamera, onViewportSettled, bottomInset, topInset = 0, userLocation }: VenueMapProps) {
  const { t } = useT();
  const mapRef = useRef<MapView>(null);
  const markerRefs = useRef(new Map<string, ComponentRef<typeof Marker>>());
  const focusedSelection = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const scheme = appearance === 'immersive' ? 'dark' : currentColorScheme();
  const redrawArtwork = useCallback((id: string) => {
    // Image loading can finish after tracksViewChanges has frozen the marker snapshot.
    requestAnimationFrame(() => markerRefs.current.get(id)?.redraw());
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zoom, setZoom] = useState(zoomFromDelta(INITIAL_DELTA));
  useEffect(() => {
    if (!selectedId) { focusedSelection.current = null; return; }
    const focusKey = `${selectedId}:${Math.round(topInset)}:${Math.round(bottomInset)}`;
    if (focusedSelection.current === focusKey) return;
    const place = items.find((item) => item.id === selectedId);
    if (!place) return;
    focusedSelection.current = focusKey;
    // Fit the neighbourhood into the unobscured map area, including after Dynamic Type grows the card.
    // A two-point neighbourhood avoids the extreme zoom of fitting a single coordinate.
    mapRef.current?.fitToCoordinates([
      { latitude: place.location.lat - 0.003, longitude: place.location.lng - 0.003 },
      { latitude: place.location.lat + 0.003, longitude: place.location.lng + 0.003 },
    ], { edgePadding: { top: FIT_PADDING, right: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING }, animated: !reducedMotion });
  }, [selectedId, items, reducedMotion, topInset, bottomInset]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const initialRegion: Region = {
    latitude: initialCamera.center.lat,
    longitude: initialCamera.center.lng,
    latitudeDelta: INITIAL_DELTA,
    longitudeDelta: INITIAL_DELTA,
  };

  const [serverLayer, setServerLayer] = useState(true);
  useEffect(() => {
    setServerLayer((prev) => (prev ? zoom < SERVER_CLUSTER_ENTER_ZOOM : zoom < SERVER_CLUSTER_EXIT_ZOOM));
  }, [zoom]);
  const useServerClusters = serverLayer && serverClusters.length > 0 && !selectedId;
  const nodes = useMemo<ClusterNode<MapPlaceItemDto>[]>(() => {
    if (useServerClusters) return [];
    // The chosen venue stays visible above a cluster, including venues sharing one building.
    const selected = items.find((item) => item.id === selectedId);
    const clustered = clusterPlaces(selected ? items.filter((item) => item.id !== selected.id) : items, zoom, mapTheme.marker.clusterRadius);
    return selected ? [...clustered, { type: 'place', item: selected }] : clustered;
  }, [items, zoom, useServerClusters, selectedId]);
  const clusters = useMemo(() => nodes.filter((n): n is PlaceCluster => n.type === 'cluster'), [nodes]);
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c] as const)), [clusters]);
  const serverClusterById = useMemo(() => new Map(serverClusters.map((c) => [c.id, c] as const)), [serverClusters]);
  const placeCount = nodes.length - clusters.length;
  const showLabels = shouldShowScoreLabels({ zoom, placeCount });

  /**
   * Pin görünümü değişince (seçim, rozet) native snapshot kısa süre yeniden çizilir. Önceden key değiştirilerek
   * annotation yeniden kuruluyordu; yoğun bölgede pinler her seçimde yanıp sönüyordu.
   */
  const [redrawing, setRedrawing] = useState(false);
  // Zoom değişince kümeler yeniden hesaplanır ve YENİ işaretçiler oluşur. tracksViewChanges=false iken yeni işaretçi
  // görünümü çizilmeden dondurulup boş kalıyordu: uzaklaşınca/yakınlaşınca pinler ve kümeler "kayboluyordu" (02.10.2026).
  // Görünen işaretçi kümesi değişince de kısa bir yeniden çizim penceresi açılır.
  const nodesKey = useMemo(() => nodes.map((n) => (n.type === 'cluster' ? n.id : n.item.id)).join(','), [nodes]);
  useEffect(() => {
    setRedrawing(true);
    const id = setTimeout(() => setRedrawing(false), 600);
    return () => clearTimeout(id);
  }, [selectedId, showLabels, nodesKey]);


  const onRegionChangeComplete = (region: Region) => {
    // Yarım zoom bandı: kesirli zoom her kare değişip tüm kümelemeyi yeniden hesaplatıyordu.
    setZoom((prev) => {
      const next = Math.round(zoomFromDelta(region.longitudeDelta) * 2) / 2;
      return next === prev ? prev : next;
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onViewportSettled(
        {
          west: region.longitude - region.longitudeDelta / 2,
          east: region.longitude + region.longitudeDelta / 2,
          south: region.latitude - region.latitudeDelta / 2,
          north: region.latitude + region.latitudeDelta / 2,
        },
        Math.round(zoomFromDelta(region.longitudeDelta)),
      );
    }, 350);
  };

  const pressCluster = useCallback(
    (cluster: PlaceCluster) => {
      const points = cluster.items.map((i) => i.location);
      if (isSameSpot(points)) {
        onClusterSelect?.(cluster.items);
        return;
      }
      onSelect(null);
      // mapPadding başlık/sheet alanını zaten ayırır; burada yalnız pinlerin kenara yapışmaması için pay verilir.
      mapRef.current?.fitToCoordinates(
        points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: FIT_PADDING, right: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING }, animated: true },
      );
    },
    [onClusterSelect, onSelect],
  );

  const pressServerCluster = useCallback(
    (cluster: MapClusterItemDto) => {
      onSelect(null);
      mapRef.current?.animateCamera({ center: { latitude: cluster.location.lat, longitude: cluster.location.lng }, zoom: Math.min(Math.round(zoom) + 2, MAX_ZOOM) }, { duration: 300 });
    },
    [onSelect, zoom],
  );

  /** Google iOS'ta Marker.onPress güvenilir gelmiyor; identifier ile MapView düzeyinde yönlendirilir. */
  const onMarkerPress = (id: string) => {
    const cluster = clusterById.get(id);
    if (cluster) return pressCluster(cluster);
    const server = serverClusterById.get(id);
    if (server) return pressServerCluster(server);
    onSelect(id);
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        mapType={appearance === 'immersive' && Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        onMapReady={() => mapRef.current?.animateToRegion(initialRegion, 0)}
        // customMapStyle yalnız Google yüzeyinde geçerli; Apple Haritalar sistem görünümünü kendi uygular.
        {...(Platform.OS === 'ios'
          ? { showsPointsOfInterests: false, pointsOfInterestFilter: [], showsScale: false, userInterfaceStyle: scheme }
          : { customMapStyle: mapStyle(scheme, appearance === 'immersive') })}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={(e) => {
          // Google iOS'ta marker dokunuşu map onPress'i de tetikleyebilir; yalnız boş harita dokunuşunda seçim kalkar.
          if (e.nativeEvent.action !== 'marker-press') onSelect(null);
        }}
        onMarkerPress={(e) => onMarkerPress(e.nativeEvent.id)}
        showsUserLocation={userLocation !== null}
        showsMyLocationButton={false}
        showsBuildings
        showsCompass={false}
        showsIndoors={false}
        toolbarEnabled={false}
        pitchEnabled
        rotateEnabled
        zoomEnabled
        scrollEnabled
        moveOnMarkerPress={false}
        mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
        accessibilityLabel={t('explore.mapView')}
      >
        {nodes.map((node) => {
          if (node.type === 'cluster') {
            const sameSpot = isSameSpot(node.items.map((i) => i.location));
            const label = t(sameSpot ? 'explore.clusterSameSpotA11y' : 'explore.clusterA11y', { count: node.items.length });
            const selectedInside = selectedId !== null && node.items.some((i) => i.id === selectedId);
            return (
              <Marker
                key={node.id}
                ref={(ref) => { if (ref) markerRefs.current.set(node.id, ref); else markerRefs.current.delete(node.id); }}
                identifier={node.id}
                coordinate={{ latitude: node.center.lat, longitude: node.center.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={redrawing}
                stopPropagation
                onPress={() => pressCluster(node)}
                zIndex={selectedInside ? 3 : 2}
                accessibilityLabel={label}
              >
                <ClusterMarker count={node.items.length} accessibilityLabel={label} selected={selectedInside} tint={dominantTint(node.items)} thumbnailUrl={node.items[0]?.media.mode !== 'unavailable' ? node.items[0]?.media.thumbnailUrl : null} category={node.items[0]?.category} onArtworkLoad={() => redrawArtwork(node.id)} />
              </Marker>
            );
          }
          const item = node.item;
          const selected = item.id === selectedId;
          const showLabel = selected || showLabels;
          return (
            <Marker
              key={item.id}
              ref={(ref) => { if (ref) markerRefs.current.set(item.id, ref); else markerRefs.current.delete(item.id); }}
              identifier={item.id}
              coordinate={{ latitude: item.location.lat, longitude: item.location.lng }}
              anchor={markerAnchor(selected)}
              tracksViewChanges={redrawing}
              stopPropagation
              onPress={() => onSelect(item.id)}
              zIndex={selected ? 3 : 1}
              accessibilityLabel={t('explore.pinA11y', {
                name: item.name,
                category: t(CATEGORY_META[item.category].labelKey),
                score: item.trend.score !== null ? t('viral.scoreA11y', { score: item.trend.score }) : t('viral.insufficientA11y'),
              })}
            >
              <VenueMarker category={item.category} thumbnailUrl={item.media.mode !== 'unavailable' ? item.media.thumbnailUrl : null} score={item.trend.score} trending={item.trend.trending} selected={selected} showLabel={showLabel} onArtworkLoad={() => redrawArtwork(item.id)} />
            </Marker>
          );
        })}
        {(useServerClusters ? serverClusters : []).map((cluster) => {
          const label = t('explore.clusterA11y', { count: cluster.count });
          return (
            <Marker
              key={cluster.id}
              identifier={cluster.id}
              coordinate={{ latitude: cluster.location.lat, longitude: cluster.location.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={redrawing}
              stopPropagation
              onPress={() => pressServerCluster(cluster)}
              zIndex={2}
              accessibilityLabel={label}
            >
              <ClusterMarker count={cluster.count} accessibilityLabel={label} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}
