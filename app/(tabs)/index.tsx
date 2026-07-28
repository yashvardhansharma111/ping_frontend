import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  TextInput,
  Image,
  FlatList,
  PanResponder,
  type AppStateStatus,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Map as MapLibreMap, Camera, Marker, type MapRef, type CameraRef } from '@maplibre/maplibre-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocation } from '@/hooks/useLocation';
import { activitiesApi, /*adsApi,*/ usersApi, chatApi, friendsApi, type Activity, /*type Ad,*/ type User } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import PingMarker from '@/components/PingMarker';
// import AdMapMarker from '@/components/AdMapMarker';
// import AdDetailSheet from '@/components/AdDetailSheet';
import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import CreatePingModal from '@/components/CreatePingModal';
import SuccessToast from '@/components/SuccessToast';
import PingDropAnimation from '@/components/PingDropAnimation';
import PlacePoiMarker from '@/components/PlacePoiMarker';
import { fetchMapPois, type MapPoi } from '@/lib/placesApi';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const POPUP_W = 290;   // max width of popup card
const PIN_VISUAL_H = 75; // approx height of pin marker (50 head + 16 tip + 5 shadow + 4 glow)

// ── Type config (matches PingMarker) ─────────────────────────────────────────
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const TYPE_CFG: Record<string, { icon: MCIName; color: string; label: string }> = {
  sport:   { icon: 'dumbbell',           color: '#6545D9', label: 'Sport' },
  food:    { icon: 'food-fork-drink',    color: '#8F63F4', label: 'Food' },
  music:   { icon: 'music',             color: '#BB92FF', label: 'Music' },
  study:   { icon: 'book-open-variant', color: '#7B5CFF', label: 'Study' },
  outdoor: { icon: 'walk',              color: '#9B7AFF', label: 'Outdoor' },
  gaming:  { icon: 'gamepad-variant',   color: '#C8A8FF', label: 'Gaming' },
  meetup:  { icon: 'account-group',     color: '#6545D9', label: 'Meetup' },
  default: { icon: 'map-marker',        color: '#8F63F4', label: 'Ping' },
};

// ── Filter chips ──────────────────────────────────────────────────────────────
const FILTER_TYPES: { key: string; label: string; icon: MCIName; color: string }[] = [
  { key: '',        label: 'All',     icon: 'view-grid',          color: '#BB92FF' },
  { key: 'sport',   label: 'Sport',   icon: 'dumbbell',           color: '#6545D9' },
  { key: 'food',    label: 'Food',    icon: 'food-fork-drink',    color: '#8F63F4' },
  { key: 'music',   label: 'Music',   icon: 'music-note',         color: '#BB92FF' },
  { key: 'study',   label: 'Study',   icon: 'book-open-variant',  color: '#7B5CFF' },
  { key: 'outdoor', label: 'Outdoor', icon: 'hiking',             color: '#9B7AFF' },
  { key: 'gaming',  label: 'Gaming',  icon: 'gamepad-variant',    color: '#C8A8FF' },
  { key: 'meetup',  label: 'Meetup',  icon: 'account-group',      color: '#6545D9' },
];

// ── Advanced filter options ───────────────────────────────────────────────────
const DISTANCE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any',   value: 0 },
  { label: '500 m', value: 500 },
  { label: '1 km',  value: 1000 },
  { label: '2 km',  value: 2000 },
  { label: '5 km',  value: 5000 },
];

const VIBE_FILTER: { key: string; icon: MCIName; label: string; color: string }[] = [
  { key: 'cozy',       icon: 'coffee-outline',  label: 'Cozy',    color: '#C8A8FF' },
  { key: 'fun',        icon: 'party-popper',    label: 'Fun',     color: '#8F63F4' },
  { key: 'exciting',   icon: 'lightning-bolt',  label: 'Exciting',color: '#7B5CFF' },
  { key: 'chill',      icon: 'leaf',            label: 'Chill',   color: '#BB92FF' },
  { key: 'networking', icon: 'handshake',       label: 'Network', color: '#6545D9' },
  { key: 'fitness',    icon: 'arm-flex',        label: 'Fitness', color: '#9B7AFF' },
];

const TIME_OPTIONS: { key: string; label: string }[] = [
  { key: 'now',   label: 'Live now'   },
  { key: 'today', label: 'Today'      },
  { key: 'later', label: 'Scheduled'  },
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
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const pc = useMemo(() => makePcStyles(isDark), [isDark]);
  const cfg = TYPE_CFG[activity.type] ?? TYPE_CFG.default;

  const now = new Date();
  const startsAt = new Date(activity.startsAt);
  const expiresAt = new Date(activity.expiresAt);
  const diff = startsAt.getTime() - now.getTime();
  const isLive = diff <= 0;
  const timeLabel = isLive
    ? 'Live now'
    : diff < 60 * 60_000
    ? `in ${Math.round(diff / 60_000)}m`
    : diff < 24 * 60 * 60_000
    ? startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : startsAt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

  const durationMin = Math.round((expiresAt.getTime() - startsAt.getTime()) / 60_000);
  const durationLabel = durationMin >= 60 ? `${Math.round(durationMin / 60)}h` : `${durationMin}m`;

  const joined = activity.participants?.length ?? 0;
  const maxP = activity.maxParticipants;
  const spotsLabel = maxP ? `${joined}/${maxP} going` : `${joined} going`;

  const distText = activity.distance != null
    ? activity.distance < 1000
      ? `${Math.round(activity.distance)} m away`
      : `${(activity.distance / 1000).toFixed(1)} km away`
    : null;

  const creatorName = activity.creator?.displayName ?? 'Someone';
  const creatorAvatar = activity.creator?.avatarUrl;
  const bannerUri = activity.imageUrl || creatorAvatar || null;

  return (
    <View style={pc.wrap}>
      <TouchableOpacity style={pc.card} onPress={onOpen} activeOpacity={0.94}>

        {/* ── Banner ── */}
        <View style={pc.banner}>
          {activity.imageUrl ? (
            <Image source={{ uri: activity.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1C1C30' : '#F3F0FF' }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: cfg.color, opacity: 0.09 }]} />
              <MaterialCommunityIcons
                name={cfg.icon}
                size={120}
                color={cfg.color}
                style={{ opacity: 0.10, position: 'absolute', right: -16, bottom: -20 }}
              />
              {creatorAvatar ? (
                <Image source={{ uri: creatorAvatar }} style={pc.bannerAvatar} resizeMode="cover" />
              ) : (
                <View style={[pc.bannerAvatarFallback, { backgroundColor: `${cfg.color}28`, borderColor: `${cfg.color}55` }]}>
                  <Text style={[pc.bannerAvatarInitial, { color: cfg.color }]}>
                    {creatorName[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Close — top right */}
          <TouchableOpacity
            style={pc.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={14} color="#FFF" />
          </TouchableOpacity>

          {/* live-only green dot — top left */}
          {isLive && <View style={pc.liveDotBanner} />}
        </View>

        {/* ── Body ── */}
        <View style={pc.body}>
          {/* Type chip + spots row */}
          <View style={pc.typeRow}>
            <View style={[pc.typeChip, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}45` }]}>
              <MaterialCommunityIcons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={[pc.typeChipText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={pc.spotsInline}>
              <Ionicons name="people" size={11} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text style={pc.statText}>{spotsLabel}</Text>
            </View>
          </View>

          {/* Title + time */}
          <View style={pc.titleRow}>
            <Text style={[pc.title, { flex: 1 }]} numberOfLines={1}>{activity.title}</Text>
            <Text style={pc.timeInline}>{timeLabel}</Text>
          </View>

          {/* Location row */}
          {(activity.placeName || distText) && (
            <View style={pc.locationRow}>
              <Ionicons name="location" size={13} color={cfg.color} />
              <Text style={pc.locationText} numberOfLines={1}>
                {[activity.placeName, distText].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          )}

          {/* Stats row */}
          <View style={pc.statsRow}>
            <View style={pc.statItem}>
              <Ionicons name="time-outline" size={11} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text style={pc.statText}>{durationLabel}</Text>
            </View>
            {activity.vibe ? (
              <>
                <View style={pc.statSep} />
                <View style={pc.statItem}>
                  <Text style={[pc.statText, { color: cfg.color, textTransform: 'capitalize' }]}>{activity.vibe}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={pc.footer}>
          <View style={pc.creatorRow}>
            {creatorAvatar ? (
              <Image source={{ uri: creatorAvatar }} style={pc.avatar} />
            ) : (
              <View style={[pc.avatarFallback, { backgroundColor: `${cfg.color}30` }]}>
                <Text style={[pc.avatarInitial, { color: cfg.color }]}>
                  {creatorName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <Text style={pc.creatorName} numberOfLines={1}>{creatorName}</Text>
          </View>

          {/* White pill CTA */}
          <TouchableOpacity style={[pc.joinBtn, { backgroundColor: cfg.color }]} onPress={onOpen} activeOpacity={0.85}>
            <Text style={[pc.joinBtnText, { color: '#FFF' }]}>View ping</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

      </TouchableOpacity>

      {/* Downward caret */}
      <View style={[pc.caret, { borderTopColor: isDark ? '#18182A' : '#FFFFFF' }]} />
    </View>
  );
}

function makePcStyles(isDark: boolean) {
  const CARD_BG = isDark ? '#18182A' : '#FFFFFF';
  return StyleSheet.create({
    wrap: { alignItems: 'center', width: POPUP_W },
    card: {
      width: POPUP_W,
      backgroundColor: CARD_BG,
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.72,
      shadowRadius: 28,
      elevation: 30,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },

    // ── Banner ──────────────────────────────────────────────────────────
    banner: {
      height: 158,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerAvatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.75)',
    },
    bannerAvatarFallback: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerAvatarInitial: {
      fontSize: 30,
      fontWeight: '800',
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
    },
    typeChipText: {
      fontSize: 10.5,
      fontWeight: '700',
    },
    spotsInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    closeBtn: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 20,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.42)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    liveDotBanner: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#22C55E',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.6)',
      zIndex: 20,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeInline: {
      fontSize: 10.5,
      fontWeight: '700',
      color: isDark ? '#9CA3AF' : '#6B7280',
      flexShrink: 0,
    },

    // ── Body ──────────────────────────────────────────────────────────────
    body: {
      paddingHorizontal: 14,
      paddingTop: 13,
      paddingBottom: 11,
      gap: 6,
    },
    title: {
      fontSize: 15.5,
      fontWeight: '800',
      color: isDark ? '#F3F4F6' : '#1A1730',
      lineHeight: 21,
      letterSpacing: -0.3,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationText: {
      fontSize: 11.5,
      color: isDark ? '#9CA3AF' : '#6B7280',
      flex: 1,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '600',
    },
    statSep: {
      width: 1,
      height: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    },

    // ── Footer ────────────────────────────────────────────────────────────
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    },
    creatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flex: 1,
      overflow: 'hidden',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    avatarFallback: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 12,
      fontWeight: '800',
    },
    creatorName: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : '#6B6080',
      flex: 1,
    },
    // Colored CTA pill
    joinBtn: {
      backgroundColor: isDark ? '#FFFFFF' : '#1A1730',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    joinBtnText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: isDark ? '#1A1730' : '#FFFFFF',
      letterSpacing: 0.1,
    },

    // ── Caret ─────────────────────────────────────────────────────────────
    caret: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      alignSelf: 'center',
      marginTop: -1,
    },
  });
}

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

// ── Search overlay ────────────────────────────────────────────────────────────

function UserResultCard({ user, onPress }: { user: User; onPress: () => void }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const so = useMemo(() => makeSoStyles(isDark), [isDark]);
  const initials = (user.displayName ?? '?')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const [reqState, setReqState] = useState<'none' | 'sending' | 'sent'>('none');

  async function handleConnect(e: any) {
    e.stopPropagation?.();
    if (reqState !== 'none') return;
    setReqState('sending');
    try {
      await friendsApi.send(user._id);
      setReqState('sent');
    } catch {
      setReqState('none');
    }
  }

  return (
    <TouchableOpacity style={so.userRow} onPress={onPress} activeOpacity={0.75}>
      <View style={so.userAvatarWrap}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={so.userAvatar} />
        ) : (
          <View style={[so.userAvatar, so.userAvatarFallback]}>
            <Text style={so.userAvatarText}>{initials}</Text>
          </View>
        )}
        {user.status === 'active' && <View style={so.onlineDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={so.userNameRow}>
          <Text style={so.userName} numberOfLines={1}>{user.displayName ?? 'User'}</Text>
          {user.trustRate !== undefined && user.trustRate >= 80 && (
            <Ionicons name="shield-checkmark" size={13} color="#BB92FF" />
          )}
        </View>
        {user.username ? <Text style={so.userHandle}>@{user.username}</Text> : null}
        {user.bio ? <Text style={so.userBio} numberOfLines={1}>{user.bio}</Text> : null}
      </View>
      <TouchableOpacity
        style={[so.connectBtn, reqState === 'sent' && so.connectBtnSent]}
        onPress={handleConnect}
        disabled={reqState !== 'none'}
        activeOpacity={0.8}
        hitSlop={8}
      >
        {reqState === 'sending' ? (
          <ActivityIndicator size="small" color={Ping.purpleLight} />
        ) : reqState === 'sent' ? (
          <Ionicons name="checkmark" size={14} color={Ping.green} />
        ) : (
          <Ionicons name="person-add-outline" size={14} color={Ping.purpleLight} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function SearchOverlay({
  visible,
  onClose,
  coords: userCoords,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  coords: { latitude: number; longitude: number };
  insets: { top: number };
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const so = useMemo(() => makeSoStyles(isDark), [isDark]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'people' | 'nearby'>('people');
  const [results, setResults] = useState<User[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
    if (visible) setTimeout(() => inputRef.current?.focus(), 260);
    else { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    if (!visible || tab !== 'nearby') return;
    setNearbyLoading(true);
    usersApi.nearby(userCoords.latitude, userCoords.longitude)
      .then((r) => setNearbyUsers(r.users))
      .catch(() => {})
      .finally(() => setNearbyLoading(false));
  }, [visible, tab]);

  useEffect(() => {
    if (tab !== 'people') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await usersApi.search(query.trim());
        setResults(r.users);
      } catch {}
      finally { setLoading(false); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, tab]);

  const displayList = tab === 'nearby' ? nearbyUsers : results;
  const isLoading = tab === 'nearby' ? nearbyLoading : loading;

  if (!visible) return null;

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const opacity = slideAnim;

  return (
    <Animated.View style={[so.overlay, { opacity, transform: [{ translateY }] }]}>
      {/* Header */}
      <View style={[so.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={so.backBtn}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#F1F0FF' : '#1C1040'} />
        </TouchableOpacity>
        <View style={so.inputWrap}>
          <Ionicons name="search" size={17} color="#6B7280" />
          <TextInput
            ref={inputRef}
            style={so.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search people by name…"
            placeholderTextColor="#6B7280"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={so.tabs}>
        {(['people', 'nearby'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[so.tab, tab === t && so.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={t === 'people' ? 'search' : 'location'}
              size={14}
              color={tab === t ? Ping.purpleLight : '#6B7280'}
            />
            <Text style={[so.tabText, tab === t && so.tabTextActive]}>
              {t === 'people' ? 'People' : 'Near Me'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {isLoading ? (
        <ActivityIndicator color={Ping.purpleLight} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <UserResultCard
              user={item}
              onPress={() => { onClose(); router.push(`/user/${item._id}` as any); }}
            />
          )}
          ListEmptyComponent={
            <View style={so.empty}>
              <Ionicons
                name={tab === 'people' ? 'search-outline' : 'people-outline'}
                size={40}
                color="#4B4B6E"
              />
              <Text style={so.emptyTitle}>
                {tab === 'people'
                  ? query.length < 2 ? 'Start typing to search…' : 'No users found'
                  : 'No users spotted nearby'}
              </Text>
              {tab === 'people' && query.length < 2 && (
                <Text style={so.emptyHint}>Enter at least 2 characters</Text>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </Animated.View>
  );
}

function makeSoStyles(isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: isDark ? '#080815' : '#FFFFFF',
      zIndex: 200,
    },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(187,146,255,0.15)' : 'rgba(143,99,244,0.1)',
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(187,146,255,0.12)',
    },
    inputWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: isDark ? '#13132A' : '#F8F5FF',
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: isDark ? 'rgba(187,146,255,0.2)' : 'rgba(143,99,244,0.1)',
      paddingHorizontal: 14, height: 44,
    },
    input: { flex: 1, color: isDark ? '#F1F0FF' : '#1A1730', fontSize: 15, fontWeight: '500' },
    tabs: {
      flexDirection: 'row', gap: 8,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
    },
    tab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: Radius.full,
      backgroundColor: 'rgba(187,146,255,0.08)',
      borderWidth: 1, borderColor: 'rgba(187,146,255,0.12)',
    },
    tabActive: {
      backgroundColor: `${Ping.purple}22`,
      borderColor: Ping.purpleLight,
    },
    tabText: { fontSize: 13, fontWeight: '600', color: isDark ? '#6B7280' : '#6B6080' },
    tabTextActive: { color: Ping.purpleLight },
    userRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: Spacing.lg, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(187,146,255,0.08)' : 'rgba(143,99,244,0.06)',
    },
    userAvatarWrap: { position: 'relative' },
    userAvatar: { width: 48, height: 48, borderRadius: 24 },
    userAvatarFallback: { backgroundColor: `${Ping.purple}44`, alignItems: 'center', justifyContent: 'center' },
    userAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    onlineDot: {
      position: 'absolute', bottom: 0, right: 0,
      width: 13, height: 13, borderRadius: 7,
      backgroundColor: Ping.green, borderWidth: 2, borderColor: isDark ? '#080815' : '#FFFFFF',
    },
    userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    userName: { color: isDark ? '#F1F0FF' : '#1A1730', fontWeight: '700', fontSize: 15, flexShrink: 1 },
    userHandle: { color: isDark ? '#6B7280' : '#6B6080', fontSize: 12, marginTop: 1 },
    userBio: { color: isDark ? '#9490C0' : '#6B6080', fontSize: 12, marginTop: 2 },
    empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
    emptyTitle: { color: isDark ? '#6B7280' : '#6B6080', fontSize: 15, fontWeight: '600' },
    emptyHint: { color: isDark ? '#4B4B6E' : '#6B6080', fontSize: 13 },
    connectBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(187,146,255,0.12)' : 'rgba(143,99,244,0.08)',
      borderWidth: 1, borderColor: isDark ? 'rgba(187,146,255,0.3)' : 'rgba(143,99,244,0.2)',
    },
    connectBtnSent: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
      borderColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)',
    },
  });
}

// Map tile styles — free, no API key required
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_DARK  = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const DEFAULT_CENTER: [number, number] = [78.9629, 20.5937]; // India center [lng, lat] — only shown before GPS fix
const DEFAULT_ZOOM = 5; // zoomed out so it's clearly "loading", not a specific city

export default function MapScreen() {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const hasFlownRef = useRef(false);
  const mapReadyRef = useRef(false);
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
  const suppressMapTapRef = useRef(false);

  const { coords, granted, loading: locLoading } = useLocation();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  // const [ads, setAds] = useState<Ad[]>([]);
  // const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [selected, setSelected] = useState<Activity | null>(null); // marker with open callout
  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null); // full detail sheet

  // ── Bottom sheet animation ──
  const SHEET_FULL_H = SCREEN_H * 0.92;
  const SHEET_PEEK_Y = SCREEN_H * 0.37; // translateY so 55% of screen shows
  const sheetAnim    = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetExpandedRef = useRef(false);
  const prevSheetIdRef   = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pingCreatedToast, setPingCreatedToast] = useState(false);
  const [showPingAnim, setShowPingAnim] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newPingCount, setNewPingCount] = useState(0);
  const [apiError, setApiError] = useState(false);
  const [apiErrMsg, setApiErrMsg] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [lastLoad, setLastLoad] = useState<Date | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [vibeFilter, setVibeFilter] = useState<string>('');
  const [distanceFilter, setDistanceFilter] = useState<number>(0);
  const [timeFilter, setTimeFilter] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  // Draft values while the sheet is open — applied on "Show results"
  const [draftDistance, setDraftDistance] = useState(0);
  const [draftVibe, setDraftVibe] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [draftType, setDraftType] = useState('');
  const distanceFilterRef = useRef(0);
  const [myActivePing, setMyActivePing] = useState<Activity | null>(null);
  const [mapPois, setMapPois] = useState<MapPoi[]>([]);
  const [selectedPoi, setSelectedPoi] = useState<MapPoi | null>(null);
  const { user } = useAuthStore();
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const so = useMemo(() => makeSoStyles(isDark), [isDark]);
  const styles = useMemo(() => makeStyles(isDark), [isDark]);

  // Fetch dark map style once and boost all label layers to full-white with strong halo
  const [darkStyle, setDarkStyle] = useState<string | undefined>(undefined);
  useEffect(() => {
    fetch(STYLE_DARK)
      .then((r) => r.json())
      .then((json: any) => {
        json.layers = json.layers.map((layer: any) => {
          if (layer.type === 'symbol' && layer.layout?.['text-field']) {
            return {
              ...layer,
              paint: {
                ...(layer.paint ?? {}),
                'text-color': '#FFFFFF',
                'text-halo-color': 'rgba(0,0,0,0.88)',
                'text-halo-width': 2,
              },
            };
          }
          return layer;
        });
        setDarkStyle(JSON.stringify(json));
      })
      .catch(() => {}); // fall back to URL if fetch fails
  }, []);

  useEffect(() => {
    console.log(`[Location] granted=${granted} loading=${locLoading} lat=${coords.latitude.toFixed(5)} lng=${coords.longitude.toFixed(5)}`);
    // Wait for map to be ready — onDidFinishLoadingMap handles the initial fly if GPS arrives first
    if (!granted || locLoading || !mapReadyRef.current) return;

    const prev = lastFlownCoordsRef.current;
    const distMoved = prev
      ? Math.abs(coords.latitude - prev.lat) * 111_000 + Math.abs(coords.longitude - prev.lng) * 111_000
      : Infinity;

    if (!hasFlownRef.current || distMoved > 300) {
      hasFlownRef.current = true;
      lastFlownCoordsRef.current = { lat: coords.latitude, lng: coords.longitude };
      console.log(`[Map] Flying to ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (moved ${distMoved < Infinity ? distMoved.toFixed(0) + 'm' : 'first fix'})`);
      cameraRef.current?.flyTo({
        center: [coords.longitude, coords.latitude],
        zoom: 13,
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

  async function loadMyActivePing() {
    try {
      const r = await activitiesApi.mine('live');
      setMyActivePing(r.activities[0] ?? null);
    } catch {
      // non-fatal
    }
  }


  async function handleCancelMyPing() {
    if (!myActivePing) return;
    try {
      await activitiesApi.cancel(myActivePing._id);
      setMyActivePing(null);
      loadNearby(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not cancel ping.' });
    }
  }

  async function loadNearby(silent = false) {
    const lat = coords.latitude;
    const lng = coords.longitude;
    const radius = distanceFilterRef.current || undefined;
    console.log(`[Map] loadNearby  lat=${lat.toFixed(5)} lng=${lng.toFixed(5)}  radius=${radius ?? 'default'}  silent=${silent}`);
    try {
      if (!silent) setRefreshing(true);
      const [res] = await Promise.all([
        activitiesApi.nearby(lat, lng, radius),
      ]);
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

  function openFilterPanel() {
    setDraftDistance(distanceFilter);
    setDraftVibe(vibeFilter);
    setDraftTime(timeFilter);
    setDraftType(typeFilter);
    setShowFilterPanel(true);
  }

  function applyFilters() {
    const distanceChanged = draftDistance !== distanceFilter;
    distanceFilterRef.current = draftDistance;
    setDistanceFilter(draftDistance);
    setVibeFilter(draftVibe);
    setTimeFilter(draftTime);
    setTypeFilter(draftType);
    setShowFilterPanel(false);
    if (distanceChanged) loadNearby(true);
  }

  function clearAllFilters() {
    distanceFilterRef.current = 0;
    setDistanceFilter(0);
    setVibeFilter('');
    setTimeFilter('');
    setTypeFilter('');
    setDraftDistance(0);
    setDraftVibe('');
    setDraftTime('');
    setDraftType('');
    setShowFilterPanel(false);
    loadNearby(true);
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
    loadMyActivePing();
    // Load nearby cafés / restaurants so food spots show (not only hospitals from basemap)
    fetchMapPois(coords.latitude, coords.longitude)
      .then((pois) => setMapPois(pois))
      .catch(() => setMapPois([]));
    pollRef.current = setInterval(() => loadNearby(true), 30_000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
    };
  }, [coords.latitude, coords.longitude, locLoading]));

  const filteredActivities = activities.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (vibeFilter && a.vibe !== vibeFilter) return false;
    const now = new Date();
    if (timeFilter === 'now') {
      return new Date(a.startsAt) <= now && new Date(a.expiresAt) > now;
    }
    if (timeFilter === 'today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const startsAt = new Date(a.startsAt);
      return startsAt >= start && startsAt <= end;
    }
    if (timeFilter === 'later') {
      return new Date(a.startsAt) > now;
    }
    return true;
  });

  const activeFilterCount = (vibeFilter ? 1 : 0) + (distanceFilter ? 1 : 0) + (timeFilter ? 1 : 0);
  const distanceLabel = DISTANCE_OPTIONS.find((d) => d.value === distanceFilter)?.label;
  const vibeLabel = VIBE_FILTER.find((v) => v.key === vibeFilter)?.label;
  const timeLabel = TIME_OPTIONS.find((t) => t.key === timeFilter)?.label;

  // Animate sheet in when a new activity is selected
  useEffect(() => {
    if (sheetActivity && sheetActivity._id !== prevSheetIdRef.current) {
      prevSheetIdRef.current = sheetActivity._id;
      sheetExpandedRef.current = false;
      sheetAnim.setValue(SCREEN_H);
      Animated.spring(sheetAnim, { toValue: SHEET_PEEK_Y, damping: 22, stiffness: 200, useNativeDriver: true }).start();
    }
  }, [sheetActivity]);

  function recenter() {
    cameraRef.current?.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: 13,
      duration: 600,
    });
  }

  function clearSelection() {
    setSelected(null);
    setSheetActivity(null);
    setSelectedPoi(null);
    setShowFilterPanel(false);
    prevSheetIdRef.current = null;
    // setSelectedAd(null);
  }

  function dismissSheet() {
    Animated.timing(sheetAnim, { toValue: SCREEN_H, duration: 260, useNativeDriver: true })
      .start(() => {
        setSelected(null);
        setSheetActivity(null);
        prevSheetIdRef.current = null;
        sheetExpandedRef.current = false;
      });
  }

  function expandSheet() {
    sheetExpandedRef.current = true;
    Animated.spring(sheetAnim, { toValue: 0, damping: 22, stiffness: 200, useNativeDriver: true }).start();
  }

  // Lock map while popup card or detail sheet is open
  const mapLocked = !!(selected || sheetActivity);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
      onPanResponderMove: (_, { dy }) => {
        const base = sheetExpandedRef.current ? 0 : SHEET_PEEK_Y;
        sheetAnim.setValue(Math.max(0, base + dy));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const base = sheetExpandedRef.current ? 0 : SHEET_PEEK_Y;
        const finalY = base + dy;
        if (vy > 0.7 || finalY > SCREEN_H * 0.62) {
          Animated.timing(sheetAnim, { toValue: SCREEN_H, duration: 260, useNativeDriver: true })
            .start(() => {
              setSelected(null);
              setSheetActivity(null);
              prevSheetIdRef.current = null;
              sheetExpandedRef.current = false;
            });
        } else if (vy < -0.5 || dy < -60) {
          sheetExpandedRef.current = true;
          Animated.spring(sheetAnim, { toValue: 0, damping: 22, stiffness: 200, useNativeDriver: true }).start();
        } else {
          Animated.spring(sheetAnim, { toValue: base, damping: 22, stiffness: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.root}>
      <MapLibreMap
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        mapStyle={isDark ? (darkStyle ?? STYLE_DARK) : STYLE_LIGHT}
        onPress={() => {
          if (suppressMapTapRef.current) return;
          if (selected) { setSelected(null); return; }
          if (sheetActivity) return;
          clearSelection();
        }}
        onDidFinishLoadingMap={() => {
          mapReadyRef.current = true;
          if (granted && !locLoading) {
            hasFlownRef.current = true;
            lastFlownCoordsRef.current = { lat: coords.latitude, lng: coords.longitude };
            console.log(`[Map] (onMapLoaded) Flying to ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
            cameraRef.current?.flyTo({
              center: [coords.longitude, coords.latitude],
              zoom: 16,
              duration: 900,
            });
          }
        }}
        dragPan={!mapLocked}
        touchZoom={!mapLocked}
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

        {/* Own active ping marker */}
        {myActivePing && (() => {
          const mLat = myActivePing.location?.coordinates?.[1];
          const mLng = myActivePing.location?.coordinates?.[0];
          if (!mLat || !mLng) return null;
          const isSelected = selected?._id === myActivePing._id;
          return (
            <Marker
              key={`my-${myActivePing._id}`}
              lngLat={[mLng, mLat]}
              anchor="bottom"
              onPress={() => {
                suppressMapTapRef.current = true;
                setTimeout(() => { suppressMapTapRef.current = false; }, 200);
                // setSelectedAd(null);
                setSelected((prev) => prev?._id === myActivePing._id ? null : myActivePing);
              }}
            >
              <PingMarker
                type={myActivePing.type}
                selected={isSelected}
                count={myActivePing.participants?.length ?? 0}
                genderFilter={myActivePing.genderFilter}
                isOwn
              />
            </Marker>
          );
        })()}

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
                suppressMapTapRef.current = true;
                setTimeout(() => { suppressMapTapRef.current = false; }, 200);
                console.log(`[Marker] onPress FIRED ping ${a._id} type=${a.type}`);
                // setSelectedAd(null);
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

        {/* Café / restaurant POIs — highlighted so food spots aren't buried under hospital-only basemap icons */}
        {mapPois.map((poi) => (
          <Marker
            key={`poi-${poi.id}`}
            lngLat={[poi.lng, poi.lat]}
            anchor="bottom"
            onPress={() => {
              suppressMapTapRef.current = true;
              setTimeout(() => { suppressMapTapRef.current = false; }, 200);
              setSelected(null);
              setSheetActivity(null);
              setSelectedPoi((prev) => prev?.id === poi.id ? null : poi);
            }}
          >
            <PlacePoiMarker
              emoji={poi.emoji}
              kind={poi.kind}
              selected={selectedPoi?.id === poi.id}
            />
          </Marker>
        ))}

        {/* Micro Ad markers — disabled */}
        {/* {ads.map((ad) => {
          const aLat = ad.location?.coordinates?.[1];
          const aLng = ad.location?.coordinates?.[0];
          if (!aLat || !aLng) {
            console.warn(`[Marker] SKIP ad ${ad._id} — missing coords`);
            return null;
          }
          return (
            <Marker
              key={`ad-${ad._id}`}
              lngLat={[aLng, aLat]}
              anchor="bottom"
              onPress={() => {
                suppressMapTapRef.current = true;
                setTimeout(() => { suppressMapTapRef.current = false; }, 200);
                setSelected(null); setSheetActivity(null); setSelectedAd(ad);
              }}
            >
              <AdMapMarker ad={ad} selected={selectedAd?._id === ad._id} />
            </Marker>
          );
        })} */}
      </MapLibreMap>

      {/* Catch-all touch shield — map stays visible but not interactive under cards */}
      {mapLocked ? (
        <View style={styles.mapTouchShield} pointerEvents="auto" />
      ) : null}

      {/* ── Popup card — hidden when detail sheet is open so it never overlaps ── */}
      {selected && popupPos && !sheetActivity && (
        <Animated.View
          style={[
            styles.popupOverlay,
            {
              left: Math.max(12, Math.min(SCREEN_W - POPUP_W - 12, popupPos.x - POPUP_W / 2)),
              top: popupPos.y - PIN_VISUAL_H - 240,
              opacity: popupAnim,
              transform: [
                { scale: popupScaleAnim },
                { translateY: popupAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <PopupCard
            activity={selected}
            onOpen={async () => {
              const id = selected._id;
              setSheetActivity(selected);
              setSelected(null);
              try {
                const r = await activitiesApi.get(id);
                setSheetActivity(r.activity);
              } catch {
                // keep the lightweight activity we already have
              }
            }}
            onClose={clearSelection}
          />
        </Animated.View>
      )}

      {/* ── Top gradient scrim (map → chips smooth blend) ── */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(8,8,21,0.98)', 'rgba(8,8,21,0.72)', 'rgba(8,8,21,0.18)', 'transparent']
            : ['rgba(232,232,232,0.98)', 'rgba(232,232,232,0.72)', 'rgba(232,232,232,0.18)', 'transparent']
        }
        locations={[0, 0.42, 0.74, 1]}
        style={styles.topScrim}
        pointerEvents="none"
      />

      {/* ── Top bar ── */}
      <View style={styles.topBar} pointerEvents="box-none">
        {/* Left: greeting — tap to go to profile */}
        <TouchableOpacity
          style={styles.greetChip}
          onPress={() => router.push('/(tabs)/profile' as any)}
          activeOpacity={0.8}
        >
          <Image source={require('../../assets/images/icon.png')} style={styles.greetIcon} />
          <Text style={styles.greetText}>
            {user?.displayName?.split(' ')[0] ?? 'Hey'}
          </Text>
        </TouchableOpacity>

        {/* Right: count + filter + search + chat */}
        <View style={styles.topRight}>
          <View style={styles.countChip}>
            {refreshing ? (
              <ActivityIndicator size="small" color={Ping.purpleLight} style={{ width: 16 }} />
            ) : (
              <>
                <View style={styles.liveDot} />
                <Text style={styles.countText}>{filteredActivities.length + (myActivePing ? 1 : 0)} pings</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.iconChip}
            onPress={() => setShowSearch(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={18} color={isDark ? '#F1F0FF' : '#1C1040'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.iconChip,
              (activeFilterCount > 0 || !!typeFilter) && styles.iconChipActive,
            ]}
            onPress={openFilterPanel}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={(activeFilterCount > 0 || !!typeFilter)
                ? (isDark ? Ping.purpleLight : Ping.purple)
                : (isDark ? '#F1F0FF' : '#1C1040')}
            />
            {(activeFilterCount > 0 || !!typeFilter) && (
              <View style={styles.filterDot} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconChip}
            onPress={() => router.push('/chat')}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={isDark ? '#F1F0FF' : '#1C1040'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Advanced filter panel — floating card */}
      {showFilterPanel && (
        <>
          <TouchableOpacity
            style={styles.filterBackdrop}
            activeOpacity={1}
            onPress={() => setShowFilterPanel(false)}
          />
          <View style={[styles.filterPanel, { bottom: insets.bottom + 155 }]}>
            <View style={styles.filterPanelHeader}>
              <Text style={styles.filterPanelTitle}>Filters</Text>
              <View style={styles.filterPanelHeaderActions}>
                <TouchableOpacity onPress={clearAllFilters} hitSlop={10}>
                  <Text style={styles.filterPanelClear}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterCloseBtn}
                  onPress={() => setShowFilterPanel(false)}
                  hitSlop={10}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={16} color={isDark ? '#EBD8FF' : '#6B6080'} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.filterPanelLabel}>Type</Text>
            <View style={styles.filterPanelRow}>
              {FILTER_TYPES.map(({ key, label, icon, color }) => {
                const chipColor = key ? color : (isDark ? Ping.purpleLight : Ping.purple);
                const active = draftType === key;
                return (
                  <TouchableOpacity
                    key={key || 'all'}
                    style={[styles.fpChip, active && { backgroundColor: `${chipColor}22`, borderColor: chipColor }]}
                    onPress={() => setDraftType(key)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={icon}
                      size={12}
                      color={active ? chipColor : (isDark ? '#6B6B9A' : '#8B8499')}
                    />
                    <Text style={[styles.fpChipText, active && { color: chipColor, fontWeight: '700' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterPanelLabel}>Distance</Text>
            <View style={styles.filterPanelRow}>
              {DISTANCE_OPTIONS.map((d) => {
                const active = draftDistance === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.fpChip, active && styles.fpChipActive]}
                    onPress={() => setDraftDistance(d.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.fpChipText, active && styles.fpChipTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterPanelLabel}>Vibe</Text>
            <View style={styles.filterPanelRow}>
              {VIBE_FILTER.map((v) => {
                const active = draftVibe === v.key;
                return (
                  <TouchableOpacity
                    key={v.key}
                    style={[styles.fpChip, active && { backgroundColor: `${v.color}22`, borderColor: v.color }]}
                    onPress={() => setDraftVibe(active ? '' : v.key)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={v.icon} size={13} color={active ? v.color : (isDark ? '#6B6B9A' : '#8B8499')} />
                    <Text style={[styles.fpChipText, active && { color: v.color, fontWeight: '700' }]}>{v.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterPanelLabel}>When</Text>
            <View style={styles.filterPanelRow}>
              {TIME_OPTIONS.map((t) => {
                const active = draftTime === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.fpChip, active && styles.fpChipActive]}
                    onPress={() => setDraftTime(active ? '' : t.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.fpChipText, active && styles.fpChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.filterDoneBtn}
              onPress={applyFilters}
              activeOpacity={0.85}
            >
              <Text style={styles.filterDoneBtnText}>Show results</Text>
            </TouchableOpacity>
          </View>
        </>
      )}


      {/* Selected café / restaurant label */}
      {selectedPoi && !sheetActivity && (
        <View style={[styles.poiChip, { bottom: insets.bottom + 150 }]}>
          <Text style={styles.poiChipEmoji}>{selectedPoi.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.poiChipName} numberOfLines={1}>{selectedPoi.name}</Text>
            <Text style={styles.poiChipKind}>
              {selectedPoi.kind === 'cafe' ? 'Café' : selectedPoi.kind === 'fast_food' ? 'Fast food' : 'Restaurant'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedPoi(null)} hitSlop={10}>
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

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

      {/* Ad detail sheet — disabled */}
      {/* {selectedAd && (
        <View style={[styles.sheet, { maxHeight: SCREEN_H * 0.62, paddingBottom: insets.bottom + 80 }]}>
          <AdDetailSheet ad={selectedAd} onClose={() => setSelectedAd(null)} />
        </View>
      )} */}

      {/* Full detail bottom sheet (opens when popup is tapped) */}
      {sheetActivity && (
        <Animated.View
          style={[
            styles.sheet,
            { height: SHEET_FULL_H, paddingBottom: insets.bottom + 80, transform: [{ translateY: sheetAnim }] },
          ]}
        >
          <View {...sheetPanResponder.panHandlers} style={styles.sheetHandleArea}>
            <View style={styles.sheetHandle} />
          </View>
          <ActivityDetailSheet
            activity={sheetActivity}
            onRefresh={() => loadNearby()}
            onDismiss={dismissSheet}
            onScrolledDown={expandSheet}
            onActivityUpdate={(act) => setSheetActivity(act)}
          />
        </Animated.View>
      )}

      {/* Recenter button — hide when sheet is open */}
      {!sheetActivity && (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: insets.bottom + 90 }]}
          onPress={recenter}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={20} color="#3B82F6" />
        </TouchableOpacity>
      )}

      {/* Create ping FAB — hidden when detail sheet is open */}
      {!sheetActivity && <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
        onPress={() => {
          if ((user as any)?.verificationStatus !== 'verified') {
            router.push('/verification' as any);
            return;
          }
          setShowFilterPanel(false);
          setShowCreate(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>}

      <CreatePingModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { loadNearby(); loadMyActivePing(); setShowPingAnim(true); setPingCreatedToast(true); }}
        lat={coords.latitude}
        lng={coords.longitude}
      />

      {/* Search overlay — full-screen, sits above everything */}
      <SearchOverlay
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        coords={coords}
        insets={insets}
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
              <View style={[styles.debugDot, { backgroundColor: '#BB92FF' }]} />
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
          <Ionicons name="bug-outline" size={14} color="#BB92FF" />
        </TouchableOpacity>
      )}

      <SuccessToast
        visible={pingCreatedToast}
        message="Ping dropped. Now hope someone shows up."
        subMessage="It's live on the map."
        icon="flash"
        color={Ping.purple}
        onDone={() => setPingCreatedToast(false)}
      />

      {/* Ping creation animation — sonar pulse + particles */}
      <PingDropAnimation
        visible={showPingAnim}
        onDone={() => setShowPingAnim(false)}
      />
    </View>
  );
}

function makeStyles(isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: isDark ? '#1a1a2e' : '#E8E8E8' },

    // ── Top gradient scrim ────────────────────────────────────────────────────
    topScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: Platform.OS === 'ios' ? 175 : 155,
      zIndex: 8,
    },

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
      backgroundColor: isDark ? 'rgba(8,8,21,0.88)' : 'rgba(255,255,255,0.95)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(187,146,255,0.28)' : 'rgba(143,99,244,0.18)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    greetIcon: {
      width: 20,
      height: 20,
    },
    greetText: {
      ...Typography.bodySm,
      fontSize: 14,
      color: isDark ? '#F1F0FF' : '#1A1730',
      fontWeight: '700',
    },
    topRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    countChip: {
      backgroundColor: isDark ? 'rgba(8,8,21,0.88)' : 'rgba(255,255,255,0.95)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(187,146,255,0.28)' : 'rgba(143,99,244,0.18)',
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
      color: isDark ? '#F1F0FF' : '#1A1730',
      fontWeight: '700',
    },
    iconChip: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? 'rgba(8,8,21,0.88)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(187,146,255,0.28)' : 'rgba(143,99,244,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },

    iconChipActive: {
      borderColor: isDark ? Ping.purpleLight : Ping.purple,
      backgroundColor: isDark ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.1)',
    },
    filterDot: {
      position: 'absolute',
      top: 9,
      right: 9,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? Ping.purpleLight : Ping.purple,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(8,8,21,0.9)' : 'rgba(255,255,255,0.9)',
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
      zIndex: 60,
      elevation: 24,
      paddingHorizontal: Spacing.md,
      paddingTop: 6,
      backgroundColor: isDark ? '#13131F' : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(167,139,250,0.12)' : 'rgba(0,0,0,0.12)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      overflow: 'hidden',
    },
    sheetHandleArea: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(167,139,250,0.25)' : 'rgba(0,0,0,0.15)',
    },

    // ── Floating buttons ──────────────────────────────────────────────────────
    recenterBtn: {
      position: 'absolute',
      right: Spacing.md,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: isDark ? 'rgba(15,15,36,0.95)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: 'rgba(187,146,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
    poiChip: {
      position: 'absolute',
      left: Spacing.lg,
      right: Spacing.lg,
      zIndex: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(15,15,36,0.96)' : 'rgba(255,255,255,0.96)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(251,146,60,0.35)' : 'rgba(234,88,12,0.25)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
    },
    poiChipEmoji: { fontSize: 22 },
    poiChipName: {
      color: isDark ? '#F1F0FF' : '#1C1040',
      fontSize: 14,
      fontWeight: '700',
    },
    poiChipKind: {
      color: isDark ? '#9490C0' : '#7B6DAA',
      fontSize: 11,
      marginTop: 1,
      fontWeight: '500',
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
      shadowOpacity: isDark ? 0.8 : 0.4,
      shadowRadius: 18,
      elevation: 14,
    },
    fabLive: {
      backgroundColor: '#EF4444',
      shadowColor: '#EF4444',
    },

    // ── Active ping banner ────────────────────────────────────────────────────
    activePingBanner: {
      position: 'absolute',
      left: 14,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(6,6,18,0.95)' : 'rgba(255,255,255,0.97)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.4)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      zIndex: 12,
      shadowColor: '#22C55E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 10,
    },
    activePingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    activePingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#22C55E',
      shadowColor: '#22C55E',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 6,
      flexShrink: 0,
    },
    activePingMeta: {
      fontSize: 9,
      fontWeight: '800',
      color: '#22C55E',
      letterSpacing: 0.8,
    },
    activePingTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#F1F0FF' : '#1A1730',
    },
    activePingActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 8,
      flexShrink: 0,
    },
    activePingChatBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(143,99,244,0.35)',
      borderWidth: 1,
      borderColor: 'rgba(187,146,255,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activePingCancelBtn: {
      backgroundColor: 'rgba(239,68,68,0.18)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.4)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexShrink: 0,
    },
    activePingCancelText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#EF4444',
    },

    // ── Filter panel ──────────────────────────────────────────────────────────
    filterBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
      zIndex: 11,
    },
    filterPanel: {
      position: 'absolute',
      left: 14,
      right: 14,
      backgroundColor: isDark ? 'rgba(12,12,24,0.97)' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(187,146,255,0.2)' : 'rgba(143,99,244,0.12)',
      padding: 16,
      gap: 11,
      zIndex: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.45 : 0.12,
      shadowRadius: 22,
      elevation: 18,
    },
    filterPanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    filterPanelHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    filterCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterPanelTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F1F0FF' : '#1A1730',
      letterSpacing: -0.2,
    },
    filterPanelClear: {
      fontSize: 12,
      color: isDark ? '#BB92FF' : Ping.purple,
      fontWeight: '600',
    },
    filterPanelLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#8B8699' : '#6B6080',
      letterSpacing: 0.2,
      marginBottom: -2,
    },
    filterPanelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    fpChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F4F8',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(187,146,255,0.14)' : 'rgba(0,0,0,0.06)',
    },
    fpChipActive: {
      backgroundColor: isDark ? 'rgba(143,99,244,0.22)' : 'rgba(143,99,244,0.1)',
      borderColor: isDark ? Ping.purpleLight : Ping.purple,
    },
    fpChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#9490C0' : '#6B6080',
    },
    fpChipTextActive: {
      color: isDark ? Ping.purpleLight : Ping.purple,
      fontWeight: '700',
    },
    filterDoneBtn: {
      marginTop: 4,
      height: 44,
      borderRadius: 12,
      backgroundColor: Ping.purple,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterDoneBtnText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '700',
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
      backgroundColor: isDark ? 'rgba(8,8,21,0.95)' : 'rgba(255,255,255,0.95)',
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
      color: isDark ? '#F1F0FF' : '#1A1730',
      fontWeight: '700',
    },

    // ── Debug panel ───────────────────────────────────────────────────────────
    debugPanel: {
      position: 'absolute',
      left: 10,
      backgroundColor: 'rgba(4,4,12,0.93)',
      borderWidth: 1,
      borderColor: 'rgba(143,99,244,0.4)',
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
      color: '#BB92FF',
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
      color: 'rgba(187,146,255,0.5)',
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
      borderColor: 'rgba(143,99,244,0.35)',
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
    mapTouchShield: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      backgroundColor: 'transparent',
    },
    popupOverlay: {
      position: 'absolute',
      zIndex: 50,
    },

    // ── Suggestion panel ─────────────────────────────────────────────────────
    suggestionPanel: {
      position: 'absolute',
      left: 14,
      right: 14,
      zIndex: 10,
      backgroundColor: isDark ? 'rgba(8,8,20,0.84)' : 'rgba(255,255,255,0.98)',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(187,146,255,0.13)' : 'rgba(143,99,244,0.1)',
      paddingTop: 14,
      paddingBottom: 14,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.6 : 0.12,
      shadowRadius: 24,
      elevation: 24,
    },
    suggestionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingRight: 10,
    },
    suggestionHeading: {
      fontSize: 13,
      fontWeight: '800',
      color: isDark ? '#F1F0FF' : '#1A1730',
      letterSpacing: 1.4,
    },
    suggestionScroll: {
      paddingHorizontal: 14,
      gap: 9,
    },
    suggestionAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      alignSelf: 'center',
      backgroundColor: 'rgba(143,99,244,0.25)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(187,146,255,0.35)',
      paddingHorizontal: 20,
      paddingVertical: 8,
      marginHorizontal: 14,
    },
    suggestionAddText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#D4C7FF' : '#6545D9',
    },
  });
}

