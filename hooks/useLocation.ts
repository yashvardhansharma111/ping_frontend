import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { usersApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// ── Module-level cache ────────────────────────────────────────────────────────
// Survives hook remounts (auth state changes, component re-mounts) within the
// same JS session. This prevents reverting to the fallback city on every
// re-render after the user's real position was obtained.
let _cachedCoords: Coords | null = null;
let _cachedGranted = false;

// Fallback used only on the very first launch — generic India center, not a
// specific city that would confuse users about their location.
const INDIA_CENTER: Coords = { latitude: 20.5937, longitude: 78.9629 };

// Only cache positions with GPS-grade accuracy (< 300 m). Cell/WiFi positions
// can be several km off and should not be cached or used to unblock the map.
const CACHE_ACCURACY_THRESHOLD = 300;

export function useLocation() {
  const [coords, setCoords] = useState<Coords>(_cachedCoords ?? INDIA_CENTER);
  const [granted, setGranted] = useState(_cachedGranted);
  // If we already have a cached real position, don't show loading state.
  const [loading, setLoading] = useState(_cachedCoords === null);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  // Keep a ref to the latest user without making it an effect dependency,
  // so user login/logout doesn't restart the location effect.
  const userRef = useRef(useAuthStore.getState().user);

  useEffect(() => {
    const unsub = useAuthStore.subscribe((s) => { userRef.current = s.user; });
    return unsub;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // ── Step 1: permission ────────────────────────────────────────────────
      // Check existing status first — no OS prompt if already granted.
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      if (!mounted) return;

      if (existing === 'granted') {
        _cachedGranted = true;
        setGranted(true);
      } else {
        console.log('[Location] Requesting foreground permission…');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          console.warn('[Location] Permission denied — location unavailable');
          setLoading(false);
          return;
        }
        _cachedGranted = true;
        setGranted(true);
      }

      // ── Step 2: use cache for instant render if available ─────────────────
      if (_cachedCoords) {
        setCoords(_cachedCoords);
        setLoading(false);
        // Still get a fresh fix below, but the map is already at the right place.
      }

      // ── Step 3: fresh GPS fix ─────────────────────────────────────────────
      // Skip getLastKnownPositionAsync — it returns cell/WiFi locations that
      // can be 50–150 km off. Go straight to getCurrentPositionAsync which
      // uses GPS and is accurate to ~20 m on modern Android devices.
      console.log('[Location] Getting fresh GPS fix…');
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!mounted) return;

        const c: Coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        };
        console.log(
          `[Location] GPS fix  lat=${c.latitude.toFixed(5)} lng=${c.longitude.toFixed(5)}` +
          ` acc=${(c.accuracy ?? 0).toFixed(0)}m`,
        );

        // Cache only GPS-accurate positions
        if (!c.accuracy || c.accuracy < CACHE_ACCURACY_THRESHOLD) {
          _cachedCoords = c;
        }

        setCoords(c);
        setLoading(false);

        if (userRef.current) {
          usersApi.updateLocation(c.latitude, c.longitude).catch(() => {});
        }
      } catch (err: any) {
        console.warn('[Location] GPS fix failed:', err?.message);
        if (mounted) setLoading(false);
      }

      // ── Step 4: watch for movement ────────────────────────────────────────
      if (!mounted) return;
      try {
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 80, // update every 80 m of movement
            timeInterval: 30_000,  // or every 30 s, whichever comes first
          },
          (loc) => {
            if (!mounted) return;
            const c: Coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
            };
            if (!c.accuracy || c.accuracy < CACHE_ACCURACY_THRESHOLD) {
              _cachedCoords = c;
            }
            setCoords(c);
          },
        );
      } catch {
        // Watch failed — silent, fresh fix above is already set
      }
    })();

    return () => {
      mounted = false;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, []); // empty deps — never re-run; cache handles remount correctness

  return { coords, granted, loading };
}
