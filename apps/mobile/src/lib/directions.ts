/** Google Maps URL ile dış yol tarifi (§21.3, [S18]); kendi navigasyon motoru yok. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
