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
import { Map as MapLibreMap, Camera, Marker, type MapRef, type CameraRef } from '@maplibre/maplibre-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocation } from '@/hooks/useLocation';
import { activitiesApi, adsApi, type Activity, type Ad } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';
import PingMarker from '@/components/PingMarker';
import AdMapMarker from '@/components/AdMapMarker';
import AdDetailSheet from '@/components/AdDetailSheet';
import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import CreatePingModal from '@/components/CreatePingModal';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const POPUP_W = 290;   // max width of popup card
const PIN_VISUAL_H = 75; // approx height of pin marker (50 head + 16 tip + 5 shadow + 4 glow)

// ── Type config (matches PingMarker) ─────────────────────────────────────────
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const TYPE_CFG: Record<string, { icon: MCIName; color: string; label: string }> = {
  sport:   { icon: 'dumbbell',           color: '#EF4444', label: 'Sport' },
  food:    { icon: 'food-fork-drink',    color: '#F97316', label: 'Food' },
  music:   { icon: 'music',             color: '#8B5CF6', label: 'Music' },
  study:   { icon: 'book-open-variant', color: '#3B82F6', label: 'Study' },
  outdoor: { icon: 'walk',              color: '#10B981', label: 'Outdoor' },
  gaming:  { icon: 'gamepad-variant',   color: '#EC4899', label: 'Gaming' },
  meetup:  { icon: 'account-group',     color: '#7C3AED', label: 'Meetup' },
  default: { icon: 'map-marker',        color: '#6B7280', label: 'Ping' },
};

// ── Suggestions shown when the map is empty ───────────────────────────────────
const SUGGESTIONS: { type: string; title: string; desc: string; icon: MCIName; color: string }[] = [
  { type: 'sport',   title: 'Gym Session',    desc: 'Work out together',  icon: 'dumbbell',           color: '#EF4444' },
  { type: 'food',    title: 'Food Meetup',    desc: 'Grab a bite',        icon: 'food-fork-drink',    color: '#F97316' },
  { type: 'music',   title: 'Jam Session',    desc: 'Make music',         icon: 'music',              color: '#8B5CF6' },
  { type: 'study',   title: 'Study Group',    desc: 'Learn together',     icon: 'book-open-variant',  color: '#3B82F6' },
  { type: 'outdoor', title: 'Outdoor Walk',   desc: 'Explore around',     icon: 'walk',               color: '#10B981' },
  { type: 'gaming',  title: 'Gaming Night',   desc: 'Play together',      icon: 'gamepad-variant',    color: '#EC4899' },
  { type: 'meetup',  title: 'Chill Hangout',  desc: 'Meet new people',    icon: 'account-group',      color: '#7C3AED' },
];

// ── Popup card (floats above the map as a RN overlay, NOT inside Callout) ────
function PopupCard({
  activity,
  onOpen,
  onClose,
}: {
  activity: Activity;
  onOpen: () => void;
  onClose: () => void;
}) {
  const cfg = TYPE_CFG[activity.type] ?? TYPE_CFG.default;
  const timeStr = (() => {
    const d = new Date(activity.startsAt);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return 'Live now';
    if (diff < 60 * 60_000) return `in ${Math.round(diff / 60_000)}m`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  })();

  return (
    <View style={pc.wrap}>
      <TouchableOpacity style={pc.card} onPress={onOpen} activeOpacity={0.88}>
        <View style={[pc.iconWrap, { backgroundColor: `${cfg.color}22` }]}>
          <MaterialCommunityIcons name={cfg.icon} size={17} color={cfg.color} />
        </View>
        <View style={pc.body}>
          <Text style={pc.title} numberOfLines={1}>{activity.title}</Text>
          <Text style={pc.sub}>{cfg.label} · {timeStr}</Text>
        </View>
        <TouchableOpacity
          style={pc.closeHit}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={15} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
      {/* Downward caret pointing toward the selected pin */}
      <View style={pc.caret} />
    </View>
  );
}

const pc = StyleSheet.create({
  wrap: { alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#18181E',
    borderRadius: 14,
    paddingVertical: 11,
    paddingLeft: 11,
    paddingRight: 9,
    minWidth: 210,
    maxWidth: 290,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  caret: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#18181E',
    alignSelf: 'center',
    marginTop: -1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#F3F4F6' },
  sub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  closeHit: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

// ── User dot (pulsing) ────────────────────────────────────────────────────────
function UserDot() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.8] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.9, 0.4, 0] });

  return (
    <View style={ud.outer}>
      <Animated.View style={[ud.pulse, { transform: [{ scale }], opacity }]} />
      <View style={ud.ring} />
      <View style={ud.dot} />
    </View>
  );
}

const ud = StyleSheet.create({
  outer: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
  },
  ring: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    borderWidth: 2.5,
    borderColor: '#FFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 5,
  },
});

// OpenFreeMap Liberty — beautiful OSM vector tiles, completely free, no API key
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER: [number, number] = [77.4126, 23.2599]; // [lng, lat] — GeoJSON order
const DEFAULT_ZOOM = 12;

export default function MapScreen() {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const hasFlownRef = useRef(false);
  const lastFlownCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const insets = useSafeAreaInsets();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const popupAnim = useRef(new Animated.Value(0)).current;
  const popupScaleAnim = useRef(new Animated.Value(0.88)).current;
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);

  const { coords, granted, loading: locLoading } = useLocation();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [selected, setSelected] = useState<Activity | null>(null); // marker with open callout
  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null); // full detail sheet
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ type: string; title: string } | null>(null);
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
      cameraRef.current?.flyTo({
        center: [coords.longitude, coords.latitude],
        zoom: 14,
        duration: 900,
      });
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
      const [res, adsRes] = await Promise.all([
        activitiesApi.nearby(lat, lng),
        adsApi.feed(lat, lng).catch(() => ({ ads: [] as Ad[] })),
      ]);
      setAds(adsRes.ads ?? []);
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
      setSheetActivity((prev) => prev ? fresh.find((a) => a._id === prev._id) ?? prev : null);
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

  // Resolve pin screen coords and animate popup in/out
  useEffect(() => {
    if (selected) {
      const lat = selected.location?.coordinates?.[1];
      const lng = selected.location?.coordinates?.[0];
      if (lat && lng && mapRef.current) {
        // getPointInView converts geo coord → screen [x, y]
        mapRef.current
          .project([lng, lat])
          .then((screenXY: [number, number]) => {
            setPopupPos({ x: screenXY[0], y: screenXY[1] });
            Animated.parallel([
              Animated.spring(popupAnim, { toValue: 1, damping: 16, stiffness: 260, useNativeDriver: true }),
              Animated.spring(popupScaleAnim, { toValue: 1, damping: 16, stiffness: 260, useNativeDriver: true }),
            ]).start();
          })
          .catch(() => setPopupPos(null));
      }
    } else {
      Animated.parallel([
        Animated.timing(popupAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(popupScaleAnim, { toValue: 0.88, duration: 150, useNativeDriver: true }),
      ]).start(() => setPopupPos(null));
    }
  }, [selected?._id]);

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
    cameraRef.current?.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: 15,
      duration: 600,
    });
  }

  function clearSelection() {
    setSelected(null);
    setSheetActivity(null);
    setSelectedAd(null);
  }

  return (
    <View style={styles.root}>
      <MapLibreMap
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        mapStyle={STYLE_URL}
        onPress={() => { console.log('[Map] background tapped → clearSelection'); clearSelection(); }}
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        attribution={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />

        {/* User location dot */}
        {granted && (
          <Marker
            lngLat={[coords.longitude, coords.latitude]}
            anchor="center"
          >
            <UserDot />
          </Marker>
        )}

        {/* Activity ping markers */}
        {filteredActivities.map((a) => {
          const isSelected = selected?._id === a._id;
          const mLat = a.location?.coordinates?.[1];
          const mLng = a.location?.coordinates?.[0];
          if (!mLat || !mLng) {
            console.warn(`[Marker] SKIP ping ${a._id} — missing coords (lat=${mLat} lng=${mLng})`);
            return null;
          }
          console.log(`[Marker] Render ping ${a._id} type=${a.type} lngLat=[${mLng.toFixed(5)},${mLat.toFixed(5)}]`);
          return (
            <Marker
              key={a._id}
              lngLat={[mLng, mLat]}
              anchor="bottom"
              onPress={() => {
                console.log(`[Marker] onPress FIRED ping ${a._id} type=${a.type}`);
                setSelectedAd(null);
                setSelected((prev) => prev?._id === a._id ? null : a);
              }}
            >
              <PingMarker
                type={a.type}
                selected={isSelected}
                count={a.participants?.length ?? 0}
                genderFilter={a.genderFilter}
              />
            </Marker>
          );
        })}

        {/* Micro Ad markers */}
        {ads.map((ad) => {
          const aLat = ad.location?.coordinates?.[1];
          const aLng = ad.location?.coordinates?.[0];
          if (!aLat || !aLng) {
            console.warn(`[Marker] SKIP ad ${ad._id} — missing coords`);
            return null;
          }
          console.log(`[Marker] Render ad ${ad._id} lngLat=[${aLng.toFixed(5)},${aLat.toFixed(5)}]`);
          return (
            <Marker
              key={`ad-${ad._id}`}
              lngLat={[aLng, aLat]}
              anchor="bottom"
              onPress={() => {
                console.log(`[Marker] onPress FIRED ad ${ad._id}`);
                setSelected(null); setSheetActivity(null); setSelectedAd(ad);
              }}
            >
              <AdMapMarker ad={ad} selected={selectedAd?._id === ad._id} />
            </Marker>
          );
        })}
      </MapLibreMap>

      {/* ── Popup card — rendered in RN layer above the map, positioned over the pin ── */}
      {selected && popupPos && (
        <Animated.View
          style={[
            styles.popupOverlay,
            {
              // Centre horizontally on the pin, clamp to screen edges
              left: Math.max(12, Math.min(SCREEN_W - POPUP_W - 12, popupPos.x - POPUP_W / 2)),
              // Sit just above the pin tip (anchor is at the bottom of the pin)
              top: popupPos.y - PIN_VISUAL_H - 70,
              opacity: popupAnim,
              transform: [
                { scale: popupScaleAnim },
                {
                  translateY: popupAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <PopupCard
            activity={selected}
            onOpen={() => setSheetActivity(selected)}
            onClose={clearSelection}
          />
        </Animated.View>
      )}

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
        © OpenStreetMap contributors · OpenFreeMap
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

      {/* Suggestion panel — shown when no pings are nearby */}
      {loaded && !apiError && activities.length === 0 && !selected && !showCreate && (
        <View style={[styles.suggestionPanel, { bottom: insets.bottom + 98 }]}>
          {/* Header */}
          <View style={styles.suggestionHeader}>
            <View style={styles.suggestionHeaderLeft}>
              <View style={styles.suggestionLiveDot} />
              <Text style={styles.suggestionHeading}>No pings nearby · Start one!</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setCreateDefaults(null); setShowCreate(true); }}
              hitSlop={10}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#A78BFA" />
            </TouchableOpacity>
          </View>

          {/* Horizontally scrollable suggestion cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionScroll}
          >
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s.type}
                style={[styles.suggestionCard, { borderColor: `${s.color}40` }]}
                onPress={() => {
                  setCreateDefaults({ type: s.type, title: s.title });
                  setShowCreate(true);
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.suggestionIconWrap, { backgroundColor: `${s.color}1E` }]}>
                  <MaterialCommunityIcons name={s.icon} size={24} color={s.color} />
                </View>
                <Text style={styles.suggestionCardTitle}>{s.title}</Text>
                <Text style={styles.suggestionCardDesc}>{s.desc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

      {/* Ad detail sheet */}
      {selectedAd && (
        <View style={[styles.sheet, { maxHeight: SCREEN_H * 0.62, paddingBottom: insets.bottom + 80 }]}>
          <AdDetailSheet ad={selectedAd} onClose={() => setSelectedAd(null)} />
        </View>
      )}

      {/* Full detail bottom sheet (opens when popup is tapped) */}
      {sheetActivity && (
        <View style={[styles.sheet, { maxHeight: SCREEN_H * 0.62, paddingBottom: insets.bottom + 80 }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={clearSelection}
            style={styles.sheetHandleArea}
          >
            <View style={styles.sheetHandle} />
          </TouchableOpacity>
          <ActivityDetailSheet
            activity={sheetActivity}
            onRefresh={() => loadNearby()}
            onDismiss={clearSelection}
          />
        </View>
      )}

      {/* Recenter button */}
      {!sheetActivity && (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: insets.bottom + 90 }]}
          onPress={recenter}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={20} color="#3B82F6" />
        </TouchableOpacity>
      )}

      {/* Create ping FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: sheetActivity ? SCREEN_H * 0.56 : insets.bottom + 90 }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      <CreatePingModal
        visible={showCreate}
        onClose={() => { setShowCreate(false); setCreateDefaults(null); }}
        onCreated={loadNearby}
        lat={coords.latitude}
        lng={coords.longitude}
        defaultType={createDefaults?.type}
        defaultTitle={createDefaults?.title}
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
  root: { flex: 1, backgroundColor: '#E8E8E8' },

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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFF',
  },

  // ── Attribution ───────────────────────────────────────────────────────────
  attribution: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    fontSize: 9,
    color: 'rgba(0,0,0,0.35)',
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandleArea: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
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

  // ── Popup card overlay ────────────────────────────────────────────────────
  popupOverlay: {
    position: 'absolute',
    zIndex: 50,
  },

  // ── Suggestion panel ─────────────────────────────────────────────────────
  suggestionPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(10,10,28,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.15)',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  suggestionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  suggestionLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  suggestionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E0FF',
  },
  suggestionScroll: {
    paddingHorizontal: Spacing.md,
    gap: 10,
    paddingBottom: 2,
  },
  suggestionCard: {
    width: 118,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 11,
    gap: 5,
    alignItems: 'flex-start',
  },
  suggestionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  suggestionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F0FF',
  },
  suggestionCardDesc: {
    fontSize: 10,
    color: '#7B78A8',
    fontWeight: '500',
  },
});

