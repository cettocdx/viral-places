import { useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { CATEGORY_META } from '@viral-places/domain';
import { useT } from '@/hooks/use-t';
import { VenueMarker } from './venue-marker';
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

function zoomFromRegion(r: Region): number {
  return Math.round(Math.log2(360 / r.longitudeDelta));
}

/**
 * Gerçek Google Maps SDK yüzeyi (react-native-maps, PROVIDER_GOOGLE iki platformda). Yalnız anahtar
 * yapılandırılmışsa render edilir; bu oturumda anahtar olmadığından cihazda DOĞRULANMADI (BLOCKED).
 */
export function GoogleVenueMap({ items, selectedId, onSelect, initialCamera, onViewportSettled, bottomInset, topInset = 0, userLocation }: VenueMapProps) {
  const { t } = useT();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRegion: Region = {
    latitude: initialCamera.center.lat,
    longitude: initialCamera.center.lng,
    latitudeDelta: 0.09,
    longitudeDelta: 0.09,
  };

  const onRegionChangeComplete = (region: Region) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onViewportSettled(
        {
          west: region.longitude - region.longitudeDelta / 2,
          east: region.longitude + region.longitudeDelta / 2,
          south: region.latitude - region.latitudeDelta / 2,
          north: region.latitude + region.latitudeDelta / 2,
        },
        zoomFromRegion(region),
      );
    }, 350);
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={LIGHT_STYLE}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={(e) => {
          // Google iOS'ta marker dokunuşu map onPress'i de tetikleyebilir; yalnız boş harita dokunuşunda seçim kalkar.
          if (e.nativeEvent.action !== 'marker-press') onSelect(null);
        }}
        onMarkerPress={(e) => onSelect(e.nativeEvent.id)}
        showsUserLocation={userLocation !== null}
        showsMyLocationButton={false}
        mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
        accessibilityLabel={t('explore.mapView')}
      >
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Marker
              key={item.id}
              identifier={item.id}
              coordinate={{ latitude: item.location.lat, longitude: item.location.lng }}
              onPress={() => onSelect(item.id)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={selected}
              accessibilityLabel={t('explore.pinA11y', {
                name: item.name,
                category: t(CATEGORY_META[item.category].labelKey),
                score: item.trend.score !== null ? t('viral.scoreA11y', { score: item.trend.score }) : t('viral.insufficientA11y'),
              })}
            >
              <VenueMarker category={item.category} score={item.trend.score} trending={item.trend.trending} selected={selected} showLabel={selected} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}
