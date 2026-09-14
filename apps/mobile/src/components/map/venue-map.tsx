import { appConfig } from '@/lib/config';
import { DemoVenueMap } from './demo-venue-map';
import { GoogleVenueMap } from './google-venue-map';
import type { VenueMapProps } from './map-types';

/** Anahtar varsa gerçek SDK, yoksa DEMO yüzey. Apple Maps'e sessiz düşüş yok (ADR-014). */
export function VenueMap(props: VenueMapProps) {
  return appConfig.googleMapsConfigured ? <GoogleVenueMap {...props} /> : <DemoVenueMap {...props} />;
}
