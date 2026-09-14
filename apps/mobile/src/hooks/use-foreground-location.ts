import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export type LocationState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'granted'; coords: { lat: number; lng: number; accuracyMeters: number | null } }
  | { status: 'error'; message: string };

/**
 * Yalnız kullanıcı "Yakınımdakiler" seçtiğinde izin istenir; foreground yeterli (§21.2).
 * Koordinat log/analitik olaylarına yazılmaz.
 */
export function useForegroundLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' });

  const request = useCallback(async () => {
    setState({ status: 'requesting' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setState({ status: 'denied', canAskAgain: perm.canAskAgain });
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyMeters: pos.coords.accuracy ?? null };
      setState({ status: 'granted', coords });
      return coords;
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'location_error' });
      return null;
    }
  }, []);

  return { state, request };
}
