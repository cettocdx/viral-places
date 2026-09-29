import { appConfig } from '@/lib/config';
import { Platform } from 'react-native';
import { DemoVenueMap } from './demo-venue-map';
import { NativeVenueMap } from './native-venue-map';
import type { VenueMapProps } from './map-types';

/** iOS'ta Apple Haritalar (MapKit), Android'de Google Maps; Android'de anahtar yoksa DEMO yüzey (ADR-014 güncellendi 20.09.2026). */
export function VenueMap(props: VenueMapProps) {
  // iOS'ta Apple Haritalar anahtar istemez; Android'de Google anahtarı yoksa DEMO yüzeye düşülür (ADR-014).
  const nativeAvailable = Platform.OS === 'ios' || appConfig.googleMapsConfigured;
  return nativeAvailable ? <NativeVenueMap {...props} /> : <DemoVenueMap {...props} />;
}
