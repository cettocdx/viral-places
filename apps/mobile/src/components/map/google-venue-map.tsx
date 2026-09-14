import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import type { MapClusterItemDto, MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { useT } from '@/hooks/use-t';
import { clusterPlaces, isSameSpot, shouldShowScoreLabels, type ClusterNode } from '@/lib/map-cluster';
import { ClusterMarker, VenueMarker, markerAnchor } from './venue-marker';
import type { VenueMapProps } from './map-types';

/** Açık gri taban stil; Google attribution ve logo gizlenmez (§21.1). */
const LIGHT_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F1F3F5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#667085' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3F6' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E6EEE4' }] },
];

const INITIAL_DELTA = 0.09;
/** Kümeleme için kesirli zoom; API sorgusu için yuvarlanır. */
function zoomFromDelta(longitudeDelta: number): number {
  return Math.log2(360 / longitudeDelta);
}
const MAX_ZOOM = 20;
/** fitToCoordinates kenar payı (pt); mapPadding'e eklenir. */
const FIT_PADDING = 48;

type PlaceCluster = Extract<ClusterNode<MapPlaceItemDto>, { type: 'cluster' }>;

/**
 * Gerçek Google Maps SDK yüzeyi (react-native-maps, PROVIDER_GOOGLE iki platformda). Yalnız anahtar
 * yapılandırılmışsa render edilir. Pinler ekran uzayında kümelenir (§7.2); küme dokunuşu üyelere
 * yakınlaşır, aynı noktadaki mekanlar için seçim listesi açılır.
 */
export function GoogleVenueMap({ items, serverClusters = [], selectedId, onSelect, onClusterSelect, initialCamera, onViewportSettled, bottomInset, topInset = 0, userLocation }: VenueMapProps) {
  const { t } = useT();
  const mapRef = useRef<MapView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zoom, setZoom] = useState(zoomFromDelta(INITIAL_DELTA));
  const initialRegion: Region = {
    latitude: initialCamera.center.lat,
    longitude: initialCamera.center.lng,
    latitudeDelta: INITIAL_DELTA,
    longitudeDelta: INITIAL_DELTA,
  };

  const nodes = useMemo(() => clusterPlaces(items, zoom), [items, zoom]);
  const clusters = useMemo(() => nodes.filter((n): n is PlaceCluster => n.type === 'cluster'), [nodes]);
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c] as const)), [clusters]);
  const serverClusterById = useMemo(() => new Map(serverClusters.map((c) => [c.id, c] as const)), [serverClusters]);
  const placeCount = nodes.length - clusters.length;
  const showLabels = shouldShowScoreLabels({ zoom, placeCount });

  const onRegionChangeComplete = (region: Region) => {
    setZoom(zoomFromDelta(region.longitudeDelta));
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
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={LIGHT_STYLE}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={(e) => {
          // Google iOS'ta marker dokunuşu map onPress'i de tetikleyebilir; yalnız boş harita dokunuşunda seçim kalkar.
          if (e.nativeEvent.action !== 'marker-press') onSelect(null);
        }}
        onMarkerPress={(e) => onMarkerPress(e.nativeEvent.id)}
        showsUserLocation={userLocation !== null}
        showsMyLocationButton={false}
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
                key={`${node.id}|${selectedInside ? 's' : 'n'}`}
                identifier={node.id}
                coordinate={{ latitude: node.center.lat, longitude: node.center.lng }}
                onPress={() => pressCluster(node)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={selectedInside ? 3 : 2}
                accessibilityLabel={label}
              >
                <ClusterMarker count={node.items.length} accessibilityLabel={label} selected={selectedInside} />
              </Marker>
            );
          }
          const item = node.item;
          const selected = item.id === selectedId;
          const showLabel = selected || showLabels;
          return (
            <Marker
              // Rozet açılıp kapanınca görünüm değişir; Google snapshot'ı yenilemek için key değişir.
              key={`${item.id}|${showLabel ? 'l' : 'n'}`}
              identifier={item.id}
              coordinate={{ latitude: item.location.lat, longitude: item.location.lng }}
              onPress={() => onSelect(item.id)}
              anchor={markerAnchor(selected)}
              tracksViewChanges={selected}
              zIndex={selected ? 3 : 1}
              accessibilityLabel={t('explore.pinA11y', {
                name: item.name,
                category: t(CATEGORY_META[item.category].labelKey),
                score: item.trend.score !== null ? t('viral.scoreA11y', { score: item.trend.score }) : t('viral.insufficientA11y'),
              })}
            >
              <VenueMarker category={item.category} score={item.trend.score} trending={item.trend.trending} selected={selected} showLabel={showLabel} />
            </Marker>
          );
        })}
        {serverClusters.map((cluster) => {
          const label = t('explore.clusterA11y', { count: cluster.count });
          return (
            <Marker
              key={cluster.id}
              identifier={cluster.id}
              coordinate={{ latitude: cluster.location.lat, longitude: cluster.location.lng }}
              onPress={() => pressServerCluster(cluster)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
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
