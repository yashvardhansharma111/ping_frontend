import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  AppState,
  ScrollView,
  type AppStateStatus,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '@/hooks/useLocation';
import { activitiesApi, type Activity } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';
import PingMarker from '@/components/PingMarker';
import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import CreatePingModal from '@/components/CreatePingModal';

const { height: SCREEN_H } = Dimensions.get('window');

const DEFAULT_REGION = {
  latitude: 23.2599,
  longitude: 77.4126,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const DARK_TILES = 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const hasFlownRef = useRef(false);
  const lastFlownCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const insets = useSafeAreaInsets();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  const { coords, granted, loading: locLoading } = useLocation();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPingCount, setNewPingCount] = useState(0);
  const [apiError, setApiError] = useState(false);
  const [apiErrMsg, setApiErrMsg] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [lastLoad, setLastLoad] = useState<Date | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const { user } = useAuthStore();

  const FILTER_TYPES = [
    { key: '', label: 'All' },
    { key: 'sport', label: '🏋️ Sport' },
    { key: 'food', label: '🍔 Food' },
    { key: 'music', label: '🎵 Music' },
    { key: 'study', label: '📚 Study' },
    { key: 'outdoor', label: '🌿 Outdoor' },
    { key: 'gaming', label: '🎮 Gaming' },
    { key: 'meetup', label: '🤝 Meetup' },
  ] as const;

  useEffect(() => {
    console.log(`[Location] granted=${granted} loading=${locLoading} lat=${coords.latitude.toFixed(5)} lng=${coords.longitude.toFixed(5)}`);
    if (!granted || locLoading) return;

    const prev = lastFlownCoordsRef.current;
    const distMoved = prev
      ? Math.abs(coords.latitude - prev.lat) * 111_000 + Math.abs(coords.longitude - prev.lng) * 111_000
      : Infinity;

    // Fly on first fix, or if fresh GPS moved us >300m from last-known snap
    if (!hasFlownRef.current || distMoved > 300) {
      hasFlownRef.current = true;
      lastFlownCoordsRef.current = { lat: coords.latitude, lng: coords.longitude };
      console.log(`[Map] Flying to ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (moved ${distMoved < Infinity ? distMoved.toFixed(0) + 'm' : 'first fix'})`);
      mapRef.current?.animateToRegion(
        { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        900,
      );
    }
  }, [granted, locLoading, coords.latitude, coords.longitude]);

  function showBanner(count: number) {
    setNewPingCount(count);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setNewPingCount(0));
  }

  async function loadNearby(silent = false) {
    const lat = coords.latitude;
    const lng = coords.longitude;
    console.log(`[Map] loadNearby  lat=${lat.toFixed(5)} lng=${lng.toFixed(5)}  silent=${silent}`);
    try {
      if (!silent) setRefreshing(true);
      const res = await activitiesApi.nearby(lat, lng);
      const fresh = res.activities ?? [];

      console.log(`[Map] API OK — ${fresh.length} activities`);

      // Clear any pending retry loop on success
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
      retryCountRef.current = 0;

      setApiError(false);
      setApiErrMsg('');
      setLoaded(true);
      setLastLoad(new Date());

      if (knownIdsRef.current.size > 0) {
        const newOnes = fresh.filter((a) => !knownIdsRef.current.has(a._id));
        if (newOnes.length > 0) showBanner(newOnes.length);
      }
      knownIdsRef.current = new Set(fresh.map((a) => a._id));

      setActivities(fresh);
      setSelected((prev) => prev ? fresh.find((a) => a._id === prev._id) ?? prev : null);
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      console.error(`[Map] API ERROR — ${msg}`);
      setApiError(true);
      setApiErrMsg(msg);
      setLoaded(true);

      // Auto-retry up to 5 times with 6s interval
      if (!retryRef.current) {
        retryRef.current = setInterval(() => {
          retryCountRef.current += 1;
          console.log(`[Map] Auto-retry attempt ${retryCountRef.current}`);
          loadNearby(true);
          if (retryCountRef.current >= 5) {
            clearInterval(retryRef.current!);
            retryRef.current = null;
          }
        }, 6_000);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  // Reload when app comes back to foreground
  useEffect(() => {
    function handleAppState(next: AppStateStatus) {
      if (next === 'active' && !locLoading) {
        console.log('[Map] App foregrounded — refreshing');
        loadNearby(true);
      }
    }
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locLoading]);

  useFocusEffect(useCallback(() => {
    // Skip loading with placeholder coords — wait for real GPS fix
    if (locLoading) {
      console.log('[Map] Skipping loadNearby — waiting for real location');
      return;
    }
    loadNearby();
    pollRef.current = setInterval(() => loadNearby(true), 30_000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
    };
  }, [coords.latitude, coords.longitude, locLoading]));

  const filteredActivities = typeFilter
    ? activities.filter((a) => a.type === typeFilter)
    : activities;

  function recenter() {
    mapRef.current?.animateToRegion(
      { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600,
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        mapType="none"
        initialRegion={DEFAULT_REGION}
        onPress={() => setSelected(null)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
      >
        <UrlTile urlTemplate={DARK_TILES} maximumZ={19} flipY={false} tileSize={256} />

        {granted && (
          <Marker
            coordinate={{ latitude: coords.latitude, longitude: coords.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges={false}
          >
            <UserDot />
          </Marker>
        )}

        {filteredActivities.map((a) => {
          const isSelected = selected?._id === a._id;
          const mLat = a.location?.coordinates?.[1];
          const mLng = a.location?.coordinates?.[0];
          if (!mLat || !mLng) return null;
          return (
            <Marker
              key={a._id}
              coordinate={{ latitude: mLat, longitude: mLng }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => setSelected((prev) => (prev?._id === a._id ? null : a))}
              tracksViewChanges={true}
            >
              <PingMarker
                type={a.type}
                selected={isSelected}
                count={a.participants?.length ?? 0}
                creatorName={a.creator?.displayName ?? a.creator?.username}
                title={a.title}
                genderFilter={a.genderFilter}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* ── Top bar ── */}
      <View style={styles.topBar} pointerEvents="box-none">
        {/* Left: greeting */}
        <View style={styles.greetChip}>
          <View style={styles.greetDot} />
          <Text style={styles.greetText}>
            {user?.displayName?.split(' ')[0] ?? 'Hey'}
          </Text>
        </View>

        {/* Right: count + chat */}
        <View style={styles.topRight}>
          <View style={styles.countChip}>
            {refreshing ? (
              <ActivityIndicator size="small" color={Ping.purpleLight} style={{ width: 16 }} />
            ) : (
              <>
                <View style={styles.liveDot} />
                <Text style={styles.countText}>{filteredActivities.length} pings</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.iconChip}
            onPress={() => router.push('/chat')}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubbles-outline" size={18} color="#F1F0FF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips row */}
      <View style={styles.filterRow} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          pointerEvents="box-none"
        >
          {FILTER_TYPES.map(({ key, label }) => {
            const active = typeFilter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setTypeFilter(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Attribution */}
      <Text style={styles.attribution} pointerEvents="none">
        © OpenStreetMap · CartoDB
      </Text>

      {/* API error banner */}
      {apiError && (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#EF4444" />
          <Text style={styles.errorText}>
            {retryRef.current ? 'Reconnecting...' : "Can't reach server · tap to retry"}
          </Text>
          <TouchableOpacity onPress={() => { if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; } loadNearby(); }} hitSlop={10}>
            <Ionicons name="refresh" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state — no pings nearby */}
      {loaded && !apiError && activities.length === 0 && !selected && (
        <View style={styles.emptyHint} pointerEvents="none">
          <View style={styles.emptyHintInner}>
            <Text style={styles.emptyHintEmoji}>📍</Text>
            <Text style={styles.emptyHintText}>No pings near you yet</Text>
            <Text style={styles.emptyHintSub}>Be the first — tap + to drop one</Text>
          </View>
        </View>
      )}

      {/* New pings banner */}
      {newPingCount > 0 && (
        <Animated.View
          style={[
            styles.newPingBanner,
            {
              opacity: bannerAnim,
              transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.newPingBannerInner}
            onPress={() => { loadNearby(); setNewPingCount(0); }}
            activeOpacity={0.85}
          >
            <View style={styles.bannerDot} />
            <Text style={styles.bannerText}>
              {newPingCount} new ping{newPingCount > 1 ? 's' : ''} nearby!
            </Text>
            <Ionicons name="refresh" size={13} color={Ping.purpleLight} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Selected activity bottom sheet */}
      {selected && (
        <View style={[styles.sheet, { maxHeight: SCREEN_H * 0.58, paddingBottom: insets.bottom + 80 }]}>
          {/* Drag handle + dismiss */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSelected(null)}
            style={styles.sheetHandleArea}
          >
            <View style={styles.sheetHandle} />
          </TouchableOpacity>

          <ActivityDetailSheet
            activity={selected}
            onRefresh={() => loadNearby()}
            onDismiss={() => setSelected(null)}
          />
        </View>
      )}

      {/* Recenter button */}
      {!selected && (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: insets.bottom + 90 }]}
          onPress={recenter}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={20} color={Ping.purpleLight} />
        </TouchableOpacity>
      )}

      {/* Create ping FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: selected ? SCREEN_H * 0.52 : insets.bottom + 90 }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      <CreatePingModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadNearby}
        lat={coords.latitude}
        lng={coords.longitude}
      />

      {/* ── DEBUG PANEL (tap header to collapse) ── */}
      {showDebug && (
        <TouchableOpacity
          style={[styles.debugPanel, { bottom: insets.bottom + 88 }]}
          onPress={() => setShowDebug(false)}
          activeOpacity={0.9}
        >
          {/* Location row */}
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, { backgroundColor: granted ? '#22C55E' : '#EF4444' }]} />
            <Text style={styles.debugLabel}>LOC</Text>
            <Text style={styles.debugVal}>
              {locLoading
                ? 'requesting…'
                : granted
                  ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                  : 'DENIED'}
            </Text>
          </View>

          {/* API row */}
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, { backgroundColor: apiError ? '#EF4444' : loaded ? '#22C55E' : '#F59E0B' }]} />
            <Text style={styles.debugLabel}>API</Text>
            <Text style={[styles.debugVal, apiError && { color: '#EF4444' }]} numberOfLines={1}>
              {!loaded ? 'loading…' : apiError ? apiErrMsg || 'error' : `${activities.length} pings  ✓`}
            </Text>
          </View>

          {/* Last load */}
          {lastLoad && (
            <View style={styles.debugRow}>
              <View style={[styles.debugDot, { backgroundColor: '#A78BFA' }]} />
              <Text style={styles.debugLabel}>LAST</Text>
              <Text style={styles.debugVal}>
                {lastLoad.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
          )}

          {/* User */}
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, { backgroundColor: user ? '#22C55E' : '#EF4444' }]} />
            <Text style={styles.debugLabel}>USER</Text>
            <Text style={styles.debugVal}>
              {user ? `${user.displayName ?? user.phone ?? '?'}  (…${(user._id ?? '').slice(-6)})` : 'not logged in'}
            </Text>
          </View>

          <Text style={styles.debugClose}>tap to hide</Text>
        </TouchableOpacity>
      )}

      {/* Show debug again */}
      {!showDebug && (
        <TouchableOpacity
          style={[styles.debugToggle, { bottom: insets.bottom + 88 }]}
          onPress={() => setShowDebug(true)}
        >
          <Ionicons name="bug-outline" size={14} color="#A78BFA" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060612' },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 38,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  greetChip: {
    backgroundColor: 'rgba(8,8,21,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  greetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Ping.green,
    shadowColor: Ping.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  greetText: {
    ...Typography.bodySm,
    fontSize: 14,
    color: '#F1F0FF',
    fontWeight: '700',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countChip: {
    backgroundColor: 'rgba(8,8,21,0.88)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Ping.green,
    shadowColor: Ping.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  countText: {
    ...Typography.caption,
    fontSize: 13,
    color: '#F1F0FF',
    fontWeight: '700',
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(8,8,21,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 108 : 90,
    left: 0,
    right: 0,
    zIndex: 9,
  },
  filterScroll: {
    paddingHorizontal: Spacing.md,
    gap: 7,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(8,8,21,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  filterChipActive: {
    backgroundColor: Ping.purple,
    borderColor: Ping.purple,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(241,240,255,0.7)',
  },
  filterChipTextActive: {
    color: '#FFF',
  },

  // ── Attribution ───────────────────────────────────────────────────────────
  attribution: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    backgroundColor: 'rgba(8,8,21,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 30,
  },
  sheetHandleArea: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.35)',
  },

  // ── Floating buttons ──────────────────────────────────────────────────────
  recenterBtn: {
    position: 'absolute',
    right: Spacing.md,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15,15,36,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 14,
  },

  // ── New-ping banner ───────────────────────────────────────────────────────
  newPingBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 94,
    alignSelf: 'center',
    zIndex: 20,
  },
  newPingBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,8,21,0.95)',
    borderWidth: 1,
    borderColor: `${Ping.purple}55`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Ping.green,
  },
  bannerText: {
    ...Typography.caption,
    fontSize: 12,
    color: '#F1F0FF',
    fontWeight: '700',
  },

  // ── Debug panel ───────────────────────────────────────────────────────────
  debugPanel: {
    position: 'absolute',
    left: 10,
    backgroundColor: 'rgba(4,4,12,0.93)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 10,
    padding: 10,
    gap: 5,
    maxWidth: 270,
    zIndex: 99,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  debugDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  debugLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 0.6,
    width: 32,
  },
  debugVal: {
    fontSize: 10,
    color: '#E2E0FF',
    fontWeight: '500',
    flexShrink: 1,
  },
  debugClose: {
    fontSize: 9,
    color: 'rgba(167,139,250,0.5)',
    textAlign: 'right',
    marginTop: 2,
  },
  debugToggle: {
    position: 'absolute',
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(4,4,12,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },

  // ── API error banner ──────────────────────────────────────────────────────
  errorBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 94,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,10,10,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    zIndex: 20,
  },
  errorText: {
    ...Typography.caption,
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyHint: {
    position: 'absolute',
    bottom: '38%',
    alignSelf: 'center',
    zIndex: 5,
  },
  emptyHintInner: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8,8,21,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Radius.xl,
  },
  emptyHintEmoji: { fontSize: 28, marginBottom: 2 },
  emptyHintText: {
    ...Typography.bodyMed,
    color: '#F1F0FF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyHintSub: {
    ...Typography.caption,
    color: '#9490C0',
    fontSize: 12,
  },
});

// ── User location dot ─────────────────────────────────────────────────────────
function UserDot() {
  return (
    <View pointerEvents="none">
      <View style={dot.halo} />
      <View style={dot.center} />
    </View>
  );
}

const dot = StyleSheet.create({
  halo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124,58,237,0.15)',
    top: -14,
    left: -14,
  },
  center: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Ping.purpleLight,
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
});
