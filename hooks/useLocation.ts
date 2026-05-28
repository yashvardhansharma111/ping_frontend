import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { usersApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// Bhopal — only used if device has absolutely no last-known location
const DEFAULT_COORDS: Coords = { latitude: 23.2599, longitude: 77.4126 };

export function useLocation() {
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      console.log('[Location] Requesting foreground permission…');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log(`[Location] Permission status: ${status}`);
      if (!mounted) return;

      if (status !== 'granted') {
        console.warn('[Location] Permission DENIED — using default coords');
        setGranted(false);
        setLoading(false);
        return;
      }
      setGranted(true);

      // Use last-known position for an instant first render (no Bhopal flash)
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
        if (last && mounted) {
          const c = { latitude: last.coords.latitude, longitude: last.coords.longitude, accuracy: last.coords.accuracy ?? undefined };
          console.log(`[Location] Last known  lat=${c.latitude.toFixed(5)} lng=${c.longitude.toFixed(5)} acc=${c.accuracy?.toFixed(0)}m`);
          setCoords(c);
          setLoading(false); // unblock map with last-known
        }
      } catch {
        // ignore — will resolve with fresh fix below
      }

      // Always follow up with a fresh GPS fix
      console.log('[Location] Getting fresh position…');
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!mounted) return;
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined };
        console.log(`[Location] Fresh fix  lat=${c.latitude.toFixed(5)} lng=${c.longitude.toFixed(5)} acc=${c.accuracy?.toFixed(0)}m`);
        setCoords(c);
        setLoading(false);

        if (user) {
          usersApi.updateLocation(c.latitude, c.longitude)
            .then(() => console.log('[Location] Backend location updated'))
            .catch(() => {});
        }
      } catch (err: any) {
        console.warn('[Location] Fresh fix failed:', err?.message);
        // setLoading(false) already called above via last-known, or set it now as fallback
        if (mounted) setLoading(false);
      }

      // Watch for updates (low-power, ~50m threshold)
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
        (loc) => {
          if (!mounted) return;
          console.log(`[Location] Watch update  lat=${loc.coords.latitude.toFixed(5)} lng=${loc.coords.longitude.toFixed(5)}`);
          setCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
          });
        },
      );
    })();

    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, []);

  return { coords, granted, loading };
}
