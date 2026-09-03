import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  FlatList,
  Platform,
  PanResponder,
  Animated,
  Linking,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import RAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import PaywallModal from '@/components/PaywallModal';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi, friendsApi, chatApi, activitiesApi, type UserProfile, type Activity } from '@/lib/api';
import HighlightsSection from '@/components/HighlightsSection';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ShareSheet from '@/components/ShareSheet';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PHOTO_H = SCREEN_H;
const THUMB = 92;
const GALLERY_GAP = 12;


const OCCUPATION_LABELS: Record<string, string> = {
  job: 'Working', student: 'Student', founder: 'Founder',
  business: 'Business', freelancer: 'Freelancer', exploring: 'Exploring',
};

const TRAIT_LABELS: Record<string, string> = {
  night_owl: 'Night owl', early_bird: 'Early bird',
  planner: 'Planner', spontaneous: 'Spontaneous',
  street_food: 'Street food', balanced: 'Balanced eater', cafe_aesthetic: 'Café aesthetic',
  always_early: 'Always early', on_time: 'On time', fashionably_late: 'Fashionably late',
  nearby: 'Nearby only', up_to_5km: 'Up to 5 km', travel_for_good_plans: 'Travels for plans',
  weekends_only: 'Weekends', evenings_mostly: 'Evenings', random_anytime: 'Anytime',
  just_hanging: 'Just hanging', activity_partner: 'Activity partner',
  trying_new_places: 'Explorer', networking: 'Networking',
  introvert: 'Introvert', extrovert: 'Extrovert', ambivert: 'Ambivert',
};

const TYPE_CFG: Record<string, { icon: MCIName; color: string }> = {
  sport:   { icon: 'dumbbell',          color: '#7C3AED' },
  food:    { icon: 'food-fork-drink',   color: '#8B5CF6' },
  music:   { icon: 'music',             color: '#A78BFA' },
  study:   { icon: 'book-open-variant', color: '#6D28D9' },
  outdoor: { icon: 'walk',             color: '#5B21B6' },
  gaming:  { icon: 'gamepad-variant',  color: '#C4B5FD' },
  meetup:  { icon: 'account-group',    color: '#7C3AED' },
  default: { icon: 'map-marker',       color: '#A78BFA' },
};

// ── Photo carousel (full-bleed preview) ──────────────────────────────────────

function PhotoCarousel({
  photos,
  initials,
  height = PHOTO_H,
}: {
  photos: string[];
  initials: string;
  height?: number;
}) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <View style={[pc.single, { height, backgroundColor: '#141414' }]}>
        <Text style={pc.initials}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={[pc.wrap, { height }]}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        renderItem={({ item }) => (
          <View style={[pc.photoWrap, { height }]}>
            {/* Blurred fill — same photo scaled to cover the slot */}
            <Image source={{ uri: item }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={22} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
            {/* Crisp photo on top */}
            <Image source={{ uri: item }} style={pc.photoContain} resizeMode="contain" />
          </View>
        )}
      />
      {photos.length > 1 && (
        <View style={pc.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[pc.dot, i === active && pc.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  wrap: { width: SCREEN_W },
  photoWrap: { width: SCREEN_W, overflow: 'hidden' },
  photo: { width: SCREEN_W },
  photoContain: { width: SCREEN_W, flex: 1 },
  single: { width: SCREEN_W, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 80, fontWeight: '800', color: '#FFF' },
  dots: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 16 },
});

// ── Swipe-up hint (blinking) ─────────────────────────────────────────────────

function SwipeHint({ scheme = 'dark' }: { scheme?: 'light' | 'dark' }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const iconColor  = scheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const textColor  = scheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 650, useNativeDriver: true }),
        Animated.delay(300),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={{ alignSelf: 'center', alignItems: 'center', gap: 2, opacity }}>
      <Ionicons name="chevron-up" size={14} color={iconColor} />
      <Text style={{ color: textColor, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }}>
        Swipe up · Full profile
      </Text>
    </Animated.View>
  );
}

// ── Glass card (detail) ──────────────────────────────────────────────────────

function GlassCard({ children, scheme = 'dark' }: { children: React.ReactNode; scheme?: 'light' | 'dark' }) {
  const borderColor = scheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const androidBg   = scheme === 'dark' ? 'rgba(10,10,10,0.95)'   : 'rgba(255,255,255,0.97)';
  const innerBg     = Platform.OS === 'ios'
    ? (scheme === 'dark' ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.40)')
    : 'transparent';

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={55} tint={scheme === 'dark' ? 'dark' : 'light'} style={[glass.card, { borderColor }]}>
        <View style={[glass.inner, { backgroundColor: innerBg }]}>{children}</View>
      </BlurView>
    );
  }
  return (
    <View style={[glass.card, { borderColor, backgroundColor: androidBg }]}>
      <View style={glass.inner}>{children}</View>
    </View>
  );
}

const glass = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
  },
  inner: {
    padding: 22,
    gap: 16,
  },
});

// ── Social icon button ───────────────────────────────────────────────────────

type SocialItem = { label: string; color: string; url: string | null };

function SocialBtn({ link }: { link: SocialItem }) {
  const active = !!link.url;
  return (
    <TouchableOpacity
      onPress={active ? () => Linking.openURL(link.url!) : undefined}
      style={[gal.socialBtn, !active && { opacity: 0.22 }]}
      activeOpacity={active ? 0.75 : 1}
      disabled={!active}
    >
      {link.label === 'Snapchat' ? (
        <MaterialCommunityIcons name="snapchat" size={20} color={link.color} />
      ) : link.label === 'Instagram' ? (
        <Ionicons name="logo-instagram" size={20} color={link.color} />
      ) : link.label === 'LinkedIn' ? (
        <Ionicons name="logo-linkedin" size={20} color={link.color} />
      ) : (
        <Ionicons name="musical-notes-outline" size={20} color={link.color} />
      )}
    </TouchableOpacity>
  );
}

// ── Zoomable image (pinch + double-tap) ──────────────────────────────────────

function ZoomableImage({ uri, onZoomChange }: { uri: string; onZoomChange: (z: boolean) => void }) {
  const scale     = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  function reset(notify = true) {
    'worklet';
    scale.value     = withSpring(1, { damping: 20 });
    tx.value        = withSpring(0, { damping: 20 });
    ty.value        = withSpring(0, { damping: 20 });
    savedScale.value = 1;
    savedTx.value   = 0;
    savedTy.value   = 0;
    if (notify) runOnJS(onZoomChange)(false);
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        reset();
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomChange)(true);
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1.05) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1.05) {
        reset();
      } else {
        scale.value      = withSpring(2.5, { damping: 20 });
        savedScale.value = 2.5;
        runOnJS(onZoomChange)(true);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <RAnimated.View style={{ width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' }}>
        <RAnimated.Image
          source={{ uri }}
          style={[{ width: SCREEN_W, height: SCREEN_H }, animStyle]}
          resizeMode="contain"
        />
      </RAnimated.View>
    </GestureDetector>
  );
}

// ── Full-screen photo viewer modal ───────────────────────────────────────────

function PhotoViewer({ photos, startIndex, onClose }: {
  photos: string[]; startIndex: number; onClose: () => void;
}) {
  const listRef  = useRef<FlatList>(null);
  const [active, setActive]   = useState(startIndex);
  const [zoomed, setZoomed]   = useState(false);
  const insets = useSafeAreaInsets();

  // Scroll to the correct photo after the modal mounts
  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: startIndex, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: i * SCREEN_W, index: i })}
          onMomentumScrollEnd={(e) => {
            setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
            setZoomed(false);
          }}
          renderItem={({ item }) => (
            <ZoomableImage uri={item} onZoomChange={setZoomed} />
          )}
          keyExtractor={(_, i) => `fv-${i}`}
        />

        {photos.length > 1 && (
          <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            {photos.map((_, i) => (
              <View key={i} style={{ width: i === active ? 16 : 5, height: 5, borderRadius: 3, backgroundColor: i === active ? '#FFF' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </View>
        )}

        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10 }} pointerEvents="box-none">
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={{ position: 'absolute', top: insets.top + 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' } as any}>
            {active + 1} / {photos.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Thumbnail gallery with arrow controls ────────────────────────────────────

function PhotoGallery({ photos }: { photos: string[] }) {
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  if (photos.length === 0) return null;

  function scrollTo(next: number) {
    const clamped = Math.max(0, Math.min(photos.length - 1, next));
    setIndex(clamped);
    listRef.current?.scrollToOffset({ offset: clamped * (THUMB + GALLERY_GAP), animated: true });
  }

  return (
    <View style={gal.wrap}>
      <FlatList
        ref={listRef}
        data={photos}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: GALLERY_GAP }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (THUMB + GALLERY_GAP));
          setIndex(Math.max(0, Math.min(photos.length - 1, i)));
        }}
        renderItem={({ item, index: i }) => (
          <TouchableOpacity onPress={() => setViewerIdx(i)} activeOpacity={0.85}>
            <Image source={{ uri: item }} style={gal.thumb} resizeMode="cover" />
          </TouchableOpacity>
        )}
        keyExtractor={(_, i) => `g-${i}`}
      />
      {photos.length > 1 && (
        <View style={gal.navRow}>
          <TouchableOpacity
            style={[gal.navBtn, index === 0 && gal.navBtnDisabled]}
            onPress={() => scrollTo(index - 1)}
            disabled={index === 0}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={16} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[gal.navBtn, index >= photos.length - 1 && gal.navBtnDisabled]}
            onPress={() => scrollTo(index + 1)}
            disabled={index >= photos.length - 1}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-forward" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
      {viewerIdx !== null && (
        <PhotoViewer photos={photos} startIndex={viewerIdx} onClose={() => setViewerIdx(null)} />
      )}
    </View>
  );
}

const gal = StyleSheet.create({
  wrap: { gap: 14 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  navDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },
  socialRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  socialBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Quote / testimonial card ─────────────────────────────────────────────────

function QuoteCard({ question, text, scheme = 'dark' }: { question: string; text: string; scheme?: 'light' | 'dark' }) {
  const cardBg      = scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const questionCol = scheme === 'dark' ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.42)';
  const textCol     = scheme === 'dark' ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.82)';
  return (
    <View style={[quote.card, { backgroundColor: cardBg }]}>
      <Text style={[quote.question, { color: questionCol }]}>{question}</Text>
      <Text style={[quote.text, { color: textCol }]}>{text}</Text>
    </View>
  );
}

const quote = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  question: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  text: {
    fontSize: 15,
    lineHeight: 23,
    fontStyle: 'italic',
  },
});

// ── Stats (mock-style 3-up) ──────────────────────────────────────────────────

function StatsRow({ items, scheme = 'dark' }: { items: { value: string; label: string; onPress?: () => void }[]; scheme?: 'light' | 'dark' }) {
  if (items.length === 0) return null;
  const numColor   = scheme === 'dark' ? '#FFF' : '#0D0B1E';
  const labelColor = scheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(13,11,30,0.55)';
  return (
    <View style={st.row}>
      {items.map((item) => (
        <TouchableOpacity key={item.label} style={st.item} onPress={item.onPress} disabled={!item.onPress} activeOpacity={item.onPress ? 0.7 : 1}>
          <Text style={[st.num, { color: numColor }]}>{item.value}</Text>
          <Text style={[st.label, { color: labelColor }, item.onPress && st.labelTappable]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  item: { alignItems: 'flex-start' },
  num: { color: '#FFF', fontWeight: '800', fontSize: 22, letterSpacing: -0.4 },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  labelTappable: {
    color: Ping.purpleLight,
    textDecorationLine: 'underline',
  },
});

// ── Mutuals sheet ────────────────────────────────────────────────────────────

function MutualsSheet({ visible, mutualIds, onClose }: {
  visible: boolean; mutualIds: string[]; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  type MiniProfile = { _id: string; displayName?: string; username?: string; avatarUrl?: string };
  const [profiles, setProfiles] = useState<MiniProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || mutualIds.length === 0) return;
    setLoading(true);
    Promise.all(mutualIds.map((id) => usersApi.getProfile(id).then((r) => r.user).catch(() => null)))
      .then((results) => setProfiles(results.filter(Boolean) as MiniProfile[]))
      .finally(() => setLoading(false));
  }, [visible, mutualIds.join(',')]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mu.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[mu.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={mu.header}>
            <Text style={mu.title}>Mutual Friends</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={Ping.purpleLight} style={{ padding: 32 }} />
          ) : profiles.length === 0 ? (
            <Text style={mu.empty}>No mutual friends found.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }} showsVerticalScrollIndicator={false}>
              {profiles.map((p) => {
                const initials = (p.displayName ?? p.username ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <TouchableOpacity
                    key={p._id}
                    style={mu.row}
                    activeOpacity={0.75}
                    onPress={() => { onClose(); router.push(`/user/${p._id}` as any); }}
                  >
                    {p.avatarUrl ? (
                      <Image source={{ uri: p.avatarUrl }} style={mu.avatar} />
                    ) : (
                      <View style={[mu.avatar, mu.avatarFallback]}>
                        <Text style={mu.avatarText}>{initials}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={mu.name}>{p.displayName ?? 'User'}</Text>
                      {p.username ? <Text style={mu.handle}>@{p.username}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const mu = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '65%', borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 32, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  name: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  handle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 },
});

// ── Invite to Ping sheet ─────────────────────────────────────────────────────

function InviteToPingSheet({ visible, targetUserId, targetName, onClose }: {
  visible: boolean; targetUserId: string; targetName: string; onClose: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invScheme = useColorScheme() ?? 'dark';
  const invDark = invScheme === 'dark';

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    activitiesApi.mine()
      .then((r) => setActivities(r.activities.filter((a) => !a.status || a.status === 'live')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  async function invite(activity: Activity) {
    if (inviting) return;
    setInviting(activity._id);
    try {
      const { room } = await chatApi.openDm(targetUserId);
      const time = new Date(activity.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      await chatApi.sendMessage(room._id, `Hey! 👋 I'd like to invite you to my ping: "${activity.title}" — starting at ${time}. Would love to have you there!`);
      onClose();
      router.push(`/chat/${room._id}` as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not send invite.' });
    } finally {
      setInviting(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={inv.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[inv.sheet, { backgroundColor: invDark ? '#11112A' : '#FFFFFF', paddingBottom: insets.bottom + 16 }]}>
          <View style={[inv.header, { borderBottomColor: invDark ? 'rgba(167,139,250,0.12)' : 'rgba(0,0,0,0.08)' }]}>
            <Text style={[inv.title, { color: invDark ? '#F1F0FF' : '#111111' }]}>Invite to a Ping</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>
          <Text style={[inv.sub, { color: invDark ? '#9490C0' : '#666666' }]}>Pick one of your active pings to invite {targetName}:</Text>
          {loading ? (
            <ActivityIndicator color={Ping.purpleLight} style={{ padding: 40 }} />
          ) : activities.length === 0 ? (
            <View style={inv.empty}>
              <Ionicons name="flash-outline" size={36} color={invDark ? '#5C5A80' : '#888888'} />
              <Text style={[inv.emptyText, { color: invDark ? '#5C5A80' : '#888888' }]}>No active pings. Drop one on the map first.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={inv.list} showsVerticalScrollIndicator={false}>
              {activities.map((activity) => {
                const cfg = TYPE_CFG[activity.type] ?? TYPE_CFG.default;
                return (
                  <TouchableOpacity
                    key={activity._id}
                    style={[inv.pingRow, { backgroundColor: invDark ? '#1A1A38' : '#F5F5F5', borderColor: `${cfg.color}40`, opacity: inviting === activity._id ? 0.5 : 1 }]}
                    onPress={() => invite(activity)}
                    disabled={!!inviting}
                    activeOpacity={0.75}
                  >
                    <View style={[inv.pingIcon, { backgroundColor: `${cfg.color}20` }]}>
                      <MaterialCommunityIcons name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[inv.pingTitle, { color: invDark ? '#F1F0FF' : '#111111' }]}>{activity.title}</Text>
                      <Text style={[inv.pingMeta, { color: invDark ? '#9490C0' : '#666666' }]}>{new Date(activity.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {activity.participants?.length ?? 0} joined</Text>
                    </View>
                    {inviting === activity._id
                      ? <ActivityIndicator size="small" color={Ping.purpleLight} />
                      : <Ionicons name="paper-plane-outline" size={18} color={Ping.purpleLight} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const inv = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '700' },
  sub: { fontSize: 13, paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 4 },
  list: { padding: Spacing.md, gap: 10 },
  pingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
  pingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pingTitle: { fontWeight: '600', fontSize: 14 },
  pingMeta: { fontSize: 12, marginTop: 2 },
  empty: { padding: 40, alignItems: 'center', gap: 10 },
  emptyText: { textAlign: 'center', lineHeight: 20 },
});

// ── Main profile screen ───────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [dmLoading, setDmLoading] = useState(false);
  const [mutualCount, setMutualCount] = useState<number | null>(null);
  const [mutualIds, setMutualIds] = useState<string[]>([]);
  const [showMutuals, setShowMutuals] = useState(false);
  const [dmPaywall, setDmPaywall] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [mode, setMode] = useState<'preview' | 'detail'>('preview');

  useEffect(() => {
    usersApi.getProfile(userId)
      .then((res) => {
        setProfile(res.user);
        if (res.user.friendshipStatus !== 'self') {
          friendsApi.mutual(userId).then((r) => { setMutualCount(r.count); setMutualIds(r.mutualIds ?? []); }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const initials = (profile?.displayName ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  async function sendRequest() {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    try {
      await friendsApi.send(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'pending_sent' } : p);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not send request.' }); }
    finally { setActionLoading(false); }
  }

  async function acceptRequest() {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    try {
      await friendsApi.accept(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'accepted' } : p);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message }); }
    finally { setActionLoading(false); }
  }

  async function removeFriend() {
    if (!profile || actionLoading) return;
    setShowRemoveFriendConfirm(true);
  }

  async function doRemoveFriend() {
    if (!profile) return;
    setActionLoading(true);
    try {
      await friendsApi.remove(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'none' } : p);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message }); }
    finally { setActionLoading(false); }
  }

  async function openDm() {
    if (!profile || dmLoading) return;
    setDmLoading(true);
    try {
      const { room } = await chatApi.openDm(profile._id);
      router.push(`/chat/${room._id}` as any);
    } catch (e: any) {
      if (String(e.code || '').includes('upgrade_required')) {
        setDmPaywall(true);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not open chat.' });
      }
    } finally { setDmLoading(false); }
  }


  async function doBlockUser() {
    if (!profile) return;
    try { await friendsApi.block(profile._id); router.back(); }
    catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message }); }
  }

  function handleBack() {
    if (mode === 'detail') {
      setMode('preview');
      return;
    }
    router.back();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#A78BFA" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Ionicons name="person-outline" size={48} color="#555" />
        <Text style={{ color: '#888', ...Typography.bodyMed }}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing.sm }}>
          <Text style={{ color: '#FFF' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSelf = profile.friendshipStatus === 'self';
  const isAccepted = profile.friendshipStatus === 'accepted';
  const isPendingSent = profile.friendshipStatus === 'pending_sent';
  const isPendingReceived = profile.friendshipStatus === 'pending_received';
  const isVerified = profile.verificationStatus === 'verified';

  const allPhotos = [profile.avatarUrl, ...(profile.photos ?? [])].filter(
    (uri, i, arr) => !!uri && arr.indexOf(uri) === i,
  ) as string[];

  const interestTags = [
    ...(profile.hobbies ?? []),
    ...(profile.favoriteActivities ?? []),
    ...(profile.vibePreferences ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 12);

  const hashTags = interestTags.map((t) => (t.startsWith('#') ? t : `#${t.replace(/\s+/g, '').toLowerCase()}`));

  const galleryPhotos = (profile.photos?.length ? profile.photos : allPhotos).filter(Boolean) as string[];

  const pingPitchText = profile.pingPitch || null;
  const funTruthText = (profile.funTruth && profile.funTruth !== profile.pingPitch) ? profile.funTruth : null;

  const age = profile.dob
    ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const infoItems = [
    age ? `${age} yrs` : null,
    profile.city,
    profile.occupation ? OCCUPATION_LABELS[profile.occupation] : null,
    profile.institute,
  ].filter(Boolean) as string[];

  const traitChips = [
    profile.sleepType, profile.spontaneity, profile.foodPersonality,
    profile.timeRespect, profile.distanceTolerance, profile.availabilityPattern,
    profile.intentSync, profile.socialPreference,
  ]
    .filter(Boolean)
    .map((t) => TRAIT_LABELS[t as string] ?? (t as string));

  const socialLinks: SocialItem[] = [
    { label: 'Instagram', color: '#E1306C', url: profile.instagramHandle ? `https://www.instagram.com/${profile.instagramHandle.replace('@', '')}` : null },
    { label: 'Snapchat',  color: '#FFFC00', url: profile.snapchatHandle  ? `https://www.snapchat.com/add/${profile.snapchatHandle.replace('@', '')}` : null },
    { label: 'LinkedIn',  color: '#0A66C2', url: profile.linkedinHandle  ? `https://www.linkedin.com/in/${profile.linkedinHandle.replace('@', '')}` : null },
    { label: 'Spotify',   color: '#1DB954', url: profile.spotifyHandle   ? `https://open.spotify.com/user/${profile.spotifyHandle.replace('@', '')}` : null },
  ];

  // Stats
  const canShowMutuals = mutualCount !== null && mutualCount > 0;
  const stats = [
    { value: mutualCount !== null ? String(mutualCount) : '—', label: 'Mutuals', onPress: canShowMutuals ? () => setShowMutuals(true) : undefined },
    { value: String(profile.completedPingsCount ?? 0), label: 'Pings' },
    { value: profile.ratingCount && profile.ratingCount > 0 ? `${profile.trustRate ?? 0}%` : '—', label: 'Trust Rate' },
  ];

  // ── Primary CTA label / action ─────────────────────────────────────────────
  const ctaBg   = scheme === 'dark' ? '#FFF' : Ping.purple;
  const ctaText = scheme === 'dark' ? '#000' : '#FFF';

  function renderPrimaryCta(fullWidth = true) {
    if (isSelf) return null;

    if (profile!.friendshipStatus === 'none') {
      return (
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: ctaBg }, !fullWidth && { flex: 1 }]}
          onPress={sendRequest}
          disabled={actionLoading}
          activeOpacity={0.88}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color={ctaText} />
          ) : (
            <Text style={[s.btnPrimaryText, { color: ctaText }]}>Add Friend</Text>
          )}
        </TouchableOpacity>
      );
    }
    if (isPendingReceived) {
      return (
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: ctaBg }, !fullWidth && { flex: 1 }]}
          onPress={acceptRequest}
          disabled={actionLoading}
          activeOpacity={0.88}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color={ctaText} />
          ) : (
            <Text style={[s.btnPrimaryText, { color: ctaText }]}>Accept Request</Text>
          )}
        </TouchableOpacity>
      );
    }
    if (isPendingSent) {
      return (
        <View style={[s.btnGhost, !fullWidth && { flex: 1 }]}>
          <Text style={s.btnGhostText}>Request Sent</Text>
        </View>
      );
    }
    if (isAccepted) {
      return (
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: ctaBg }, !fullWidth && { flex: 1 }]}
          onPress={openDm}
          disabled={dmLoading}
          activeOpacity={0.88}
        >
          {dmLoading ? (
            <ActivityIndicator size="small" color={ctaText} />
          ) : (
            <Text style={[s.btnPrimaryText, { color: ctaText }]}>Message</Text>
          )}
        </TouchableOpacity>
      );
    }
    return null;
  }

  // ── PREVIEW MODE — frosted bottom card over full-bleed photo ───────────────
  if (mode === 'preview') {
    const sheetPadBottom = Math.max(insets.bottom, 16) + 8;
    const nameParts = (profile.displayName ?? 'User').trim().split(/\s+/);
    const firstName = nameParts[0] ?? 'User';
    const lastInitial = nameParts.length > 1 ? ` ${nameParts[nameParts.length - 1][0]}.` : '';
    const shortName = `${firstName}${lastInitial}`;

    const cardSwipePan = PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) => dy < -8 && Math.abs(dy) > Math.abs(dx),
      onPanResponderRelease: (_, { dy }) => { if (dy < -40) setMode('detail'); },
    });

    const previewTextColor  = scheme === 'dark' ? '#FFF' : '#0D0B1E';
    const previewHandleColor = scheme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(13,11,30,0.6)';
    const previewBioColor   = scheme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(13,11,30,0.8)';

    const sheetInner = (
      <View style={[s.previewSheetInner, { paddingBottom: sheetPadBottom }]}>
        <SwipeHint scheme={scheme} />

        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={[s.name, { color: previewTextColor }]} numberOfLines={1}>{shortName}</Text>
              {isVerified && (
                <Ionicons name="checkmark-circle" size={18} color="#A78BFA" />
              )}
            </View>
            {profile.username ? (
              <Text style={[s.handle, { color: previewHandleColor }]}>@{profile.username}</Text>
            ) : null}
          </View>
        </View>

        {profile.bio ? (
          <Text style={[s.bio, { color: previewBioColor }]} numberOfLines={3}>
            "{profile.bio}"
          </Text>
        ) : null}

        <StatsRow items={stats} scheme={scheme} />

        {!isSelf ? (
          <View style={s.previewCtaWrap}>{renderPrimaryCta(true)}</View>
        ) : null}
      </View>
    );

    return (
      <View style={s.root}>
        <PhotoCarousel photos={allPhotos} initials={initials} />

        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleBack} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setShowShare(true)} hitSlop={12} style={s.headerBtn}>
              <Ionicons name="share-outline" size={19} color="#FFF" />
            </TouchableOpacity>
            {!isSelf && (
              <TouchableOpacity onPress={() => setShowBlockConfirm(true)} hitSlop={12} style={s.headerBtn}>
                <Ionicons name="ellipsis-vertical" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Frosted glass bottom sheet — swipe up to expand */}
        <View style={s.previewSheetWrap} pointerEvents="box-none">
          <BlurView
            intensity={Platform.OS === 'ios' ? 75 : 90}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={s.previewSheet}
          >
            <View
              style={[
                s.previewSheetTint,
                { backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)' },
              ]}
              {...cardSwipePan.panHandlers}
            >
              {sheetInner}
            </View>
          </BlurView>
        </View>

        {renderSheets()}
      </View>
    );
  }

  // ── DETAIL MODE (mock right screen) ────────────────────────────────────────
  const isDark = scheme === 'dark';
  const c = Colors[scheme];
  const dt = {
    text:       isDark ? '#FFF'                       : '#111111',
    sub:        isDark ? 'rgba(255,255,255,0.55)'     : 'rgba(0,0,0,0.55)',
    muted:      isDark ? 'rgba(255,255,255,0.48)'     : 'rgba(0,0,0,0.48)',
    bio:        isDark ? 'rgba(255,255,255,0.80)'     : 'rgba(0,0,0,0.75)',
    tagBg:      isDark ? 'rgba(255,255,255,0.12)'     : 'rgba(0,0,0,0.06)',
    tagText:    isDark ? 'rgba(255,255,255,0.90)'     : 'rgba(0,0,0,0.80)',
    veil:       isDark ? 'rgba(0,0,0,0.75)'           : 'rgba(246,243,239,0.90)',
    base:       isDark ? '#000000'                    : c.background,
    ctaBg:      isDark ? '#FFF'                       : Ping.purple,
    ctaText:    isDark ? '#000'                       : '#FFF',
    barBg:      isDark ? 'rgba(0,0,0,0.82)'           : 'rgba(246,243,239,0.96)',
    barBorder:  isDark ? 'rgba(255,255,255,0.10)'     : 'rgba(0,0,0,0.08)',
    socialBg:   isDark ? 'rgba(255,255,255,0.07)'     : 'rgba(0,0,0,0.04)',
    headerBtn:  isDark ? 'rgba(0,0,0,0.45)'           : 'rgba(0,0,0,0.10)',
    headerText: isDark ? '#FFF'                       : '#111111',
  };

  return (
    <View style={[s.root, { backgroundColor: dt.base }]}>
      {/* Base */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: dt.base }]} />
      {/* Blurred avatar texture */}
      {allPhotos[0] ? (
        <Image source={{ uri: allPhotos[0] }} style={StyleSheet.absoluteFillObject} blurRadius={32} resizeMode="cover" />
      ) : null}
      {/* Veil */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: dt.veil }]} />

      <View style={[s.detailHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={[s.headerBtn, { backgroundColor: dt.headerBtn }]}>
          <Ionicons name="arrow-back" size={20} color={dt.headerText} />
        </TouchableOpacity>
        {profile.username ? (
          <Text style={[s.headerHandle, { color: dt.headerText }]}>@{profile.username}</Text>
        ) : (
          <View />
        )}
        <TouchableOpacity onPress={() => setShowShare(true)} hitSlop={12} style={[s.headerBtn, { backgroundColor: dt.headerBtn }]}>
          <Ionicons name="share-outline" size={18} color={dt.headerText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: isSelf ? insets.bottom + 24 : insets.bottom + 100,
          gap: 18,
        }}
      >
        <GlassCard scheme={scheme}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.detailName, { color: dt.text }]} numberOfLines={1}>{profile.displayName ?? 'User'}</Text>
                {isVerified && <Ionicons name="checkmark-circle" size={20} color="#A78BFA" />}
              </View>
              {profile.username ? <Text style={[s.handle, { color: dt.sub }]}>@{profile.username}</Text> : null}
              {infoItems.length > 0 && (
                <Text style={[s.infoLine, { color: dt.muted }]}>{infoItems.join('  ·  ')}</Text>
              )}
            </View>
            {profile.avatarUrl ? (
              <TouchableOpacity onPress={() => setShowAvatarViewer(true)} activeOpacity={0.85}>
                <Image source={{ uri: profile.avatarUrl }} style={s.detailAvatar} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <View style={[s.detailAvatar, s.detailAvatarFallback]}>
                <Text style={s.detailAvatarInitial}>{initials}</Text>
              </View>
            )}
          </View>

          {profile.bio ? (
            <Text style={[s.detailBio, { color: dt.bio }]}>"{profile.bio}"</Text>
          ) : null}

          <StatsRow items={stats} scheme={scheme} />

          {hashTags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tagsRow}
            >
              {hashTags.map((tag) => (
                <View key={tag} style={[s.tagChip, { backgroundColor: dt.tagBg }]}>
                  <Text style={[s.tagText, { color: dt.tagText }]}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {traitChips.length > 0 && (
            <View style={s.traitsWrap}>
              {traitChips.map((trait) => (
                <View key={trait} style={[s.traitChip, {
                  backgroundColor: isDark ? 'rgba(167,139,250,0.10)' : 'rgba(143,99,244,0.07)',
                  borderColor:     isDark ? 'rgba(167,139,250,0.22)' : 'rgba(143,99,244,0.18)',
                }]}>
                  <Text style={[s.traitText, { color: isDark ? 'rgba(167,139,250,0.9)' : Ping.purpleDim }]}>{trait}</Text>
                </View>
              ))}
            </View>
          )}

          <PhotoGallery photos={galleryPhotos} />
        </GlassCard>

        {pingPitchText ? (
          <QuoteCard question="Ping Pitch" text={pingPitchText} scheme={scheme} />
        ) : null}

        {funTruthText ? (
          <QuoteCard question="Fun Truth" text={funTruthText} scheme={scheme} />
        ) : null}

        <View style={[s.socialCard, { backgroundColor: dt.socialBg }]}>
          {socialLinks.map((link) => <SocialBtn key={link.label} link={link} />)}
        </View>

        <HighlightsSection userId={userId} isOwnProfile={isSelf} scheme={scheme} />

        {isAccepted && (
          <TouchableOpacity style={s.removeFriendBtn} onPress={removeFriend} disabled={actionLoading} activeOpacity={0.85}>
            <Ionicons name="person-remove-outline" size={16} color="#F87171" />
            <Text style={s.removeFriendText}>Remove friend</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {!isSelf && (
        <View style={[s.detailActions, { paddingBottom: insets.bottom + 14, backgroundColor: dt.barBg, borderTopColor: dt.barBorder }]}>
          {isAccepted ? (
            <View style={s.btnRow}>
              {renderPrimaryCta(false)}
              <TouchableOpacity style={[s.btnSecondary, { flex: 1 }]} onPress={() => setShowInvite(true)} activeOpacity={0.85}>
                <Ionicons name="flash-outline" size={16} color="#FFF" />
                <Text style={s.btnSecondaryText}>Invite</Text>
              </TouchableOpacity>
            </View>
          ) : (
            renderPrimaryCta(true)
          )}
        </View>
      )}

      {renderSheets()}
    </View>
  );
  function renderSheets() {
    return (
      <>
        <MutualsSheet
          visible={showMutuals}
          mutualIds={mutualIds}
          onClose={() => setShowMutuals(false)}
        />

        <InviteToPingSheet
          visible={showInvite}
          targetUserId={profile!._id}
          targetName={profile!.displayName ?? 'them'}
          onClose={() => setShowInvite(false)}
        />

        <ShareSheet
          visible={showShare}
          onClose={() => setShowShare(false)}
          content={{
            type: 'profile',
            title: profile!.displayName ?? 'Ping user',
            subtitle: profile!.username ? `@${profile!.username}` : undefined,
            emoji: '👤',
            body: profile!.bio ? profile!.bio : `Check out ${profile!.displayName ?? 'someone'} on Ping!`,
          }}
        />

        <ConfirmSheet
          visible={showRemoveFriendConfirm}
          onClose={() => setShowRemoveFriendConfirm(false)}
          title="Remove friend?"
          subtitle={`Remove ${profile!.displayName ?? 'this user'} from your friends?`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          danger
          onConfirm={() => { setShowRemoveFriendConfirm(false); doRemoveFriend(); }}
          icon="person-remove-outline"
        />

        <ConfirmSheet
          visible={showBlockConfirm}
          onClose={() => setShowBlockConfirm(false)}
          title={`Block ${profile!.displayName ?? 'this user'}?`}
          subtitle="They won't see your pings or contact you."
          confirmLabel="Block"
          cancelLabel="Cancel"
          danger
          onConfirm={() => { setShowBlockConfirm(false); doBlockUser(); }}
          icon="ban-outline"
        />

        <PaywallModal
          visible={dmPaywall}
          onClose={() => setDmPaywall(false)}
          title="DMs are on Pro"
          message="Upgrade to Pro to send direct messages."
          upgradeTo="pro"
        />

        {showAvatarViewer && profile?.avatarUrl && (
          <PhotoViewer
            photos={[profile.avatarUrl]}
            startIndex={0}
            onClose={() => setShowAvatarViewer(false)}
          />
        )}
      </>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: 10,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  headerHandle: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  previewSheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  previewSheetTint: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  previewSheetInner: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 14,
  },
  previewCtaWrap: {
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.6,
    lineHeight: 40,
    flexShrink: 1,
  },
  detailName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
    lineHeight: 36,
    flexShrink: 1,
  },
  detailAvatar: {
    width: 106,
    height: 106,
    borderRadius: 50,
    marginTop:15,
    marginRight:20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  detailAvatarFallback: {
    backgroundColor: 'rgba(124,58,237,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarInitial: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  handle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  bio: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  detailBio: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  infoLine: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tagText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  traitsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  traitText: { color: 'rgba(167,139,250,0.9)', fontSize: 11.5, fontWeight: '600' },
  detailActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: -0.2 },
  btnGhost: {
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  btnSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnSecondaryText: { fontSize: 13, fontWeight: '600', color: '#EDE9FE' },

  socialCard: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  removeFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  removeFriendText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
});
