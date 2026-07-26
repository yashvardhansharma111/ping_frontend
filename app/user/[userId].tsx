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
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi, friendsApi, chatApi, activitiesApi, type UserProfile, type Activity } from '@/lib/api';
import HighlightsSection from '@/components/HighlightsSection';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';
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
          <Image source={{ uri: item }} style={[pc.photo, { height }]} resizeMode="cover" />
        )}
        keyExtractor={(_, i) => String(i)}
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
  photo: { width: SCREEN_W },
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

// ── Glass card (detail) ──────────────────────────────────────────────────────

function GlassCard({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={55} tint="dark" style={glass.card}>
        <View style={glass.inner}>{children}</View>
      </BlurView>
    );
  }
  return (
    <View style={[glass.card, glass.android]}>
      <View style={glass.inner}>{children}</View>
    </View>
  );
}

const glass = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  android: { backgroundColor: 'rgba(22,22,22,0.92)' },
  inner: {
    padding: 22,
    gap: 16,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.32)' : 'transparent',
  },
});

// ── Thumbnail gallery with arrow controls ────────────────────────────────────

function PhotoGallery({ photos }: { photos: string[] }) {
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
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
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={gal.thumb} resizeMode="cover" />
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
  navRow: { flexDirection: 'row', gap: 10 },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
});

// ── Quote / testimonial card ─────────────────────────────────────────────────

function QuoteCard({
  text,
  name,
  handle,
  avatarUrl,
  initials,
}: {
  text: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  initials: string;
}) {
  return (
    <View style={quote.card}>
      <Text style={quote.text}>{text}</Text>
      <View style={quote.attr}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={quote.avatar} />
        ) : (
          <View style={[quote.avatar, quote.avatarFallback]}>
            <Text style={quote.avatarText}>{initials}</Text>
          </View>
        )}
        <View>
          <Text style={quote.name}>{name}</Text>
          {handle ? <Text style={quote.handle}>@{handle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const quote = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    padding: 20,
    gap: 16,
  },
  text: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 23,
    fontStyle: 'italic',
  },
  attr: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  name: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  handle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 },
});

// ── Stats (mock-style 3-up) ──────────────────────────────────────────────────

function StatsRow({ items }: { items: { value: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <View style={st.row}>
      {items.map((item) => (
        <View key={item.label} style={st.item}>
          <Text style={st.num}>{item.value}</Text>
          <Text style={st.label}>{item.label}</Text>
        </View>
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
        <View style={[inv.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={inv.header}>
            <Text style={inv.title}>Invite to a Ping</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>
          <Text style={inv.sub}>Pick one of your active pings to invite {targetName}:</Text>
          {loading ? (
            <ActivityIndicator color={Ping.purpleLight} style={{ padding: 40 }} />
          ) : activities.length === 0 ? (
            <View style={inv.empty}>
              <Ionicons name="flash-outline" size={36} color="#5C5A80" />
              <Text style={inv.emptyText}>No active pings. Drop one on the map first.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={inv.list} showsVerticalScrollIndicator={false}>
              {activities.map((activity) => {
                const cfg = TYPE_CFG[activity.type] ?? TYPE_CFG.default;
                return (
                  <TouchableOpacity
                    key={activity._id}
                    style={[inv.pingRow, { borderColor: `${cfg.color}40`, opacity: inviting === activity._id ? 0.5 : 1 }]}
                    onPress={() => invite(activity)}
                    disabled={!!inviting}
                    activeOpacity={0.75}
                  >
                    <View style={[inv.pingIcon, { backgroundColor: `${cfg.color}20` }]}>
                      <MaterialCommunityIcons name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={inv.pingTitle}>{activity.title}</Text>
                      <Text style={inv.pingMeta}>{new Date(activity.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {activity.participants?.length ?? 0} joined</Text>
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
  sheet: { backgroundColor: '#11112A', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(167,139,250,0.12)' },
  title: { color: '#F1F0FF', fontSize: 17, fontWeight: '700' },
  sub: { color: '#9490C0', fontSize: 13, paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 4 },
  list: { padding: Spacing.md, gap: 10 },
  pingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A38', borderRadius: 14, padding: 14, borderWidth: 1 },
  pingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pingTitle: { color: '#F1F0FF', fontWeight: '600', fontSize: 14 },
  pingMeta: { color: '#9490C0', fontSize: 12, marginTop: 2 },
  empty: { padding: 40, alignItems: 'center', gap: 10 },
  emptyText: { color: '#5C5A80', textAlign: 'center', lineHeight: 20 },
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
  const [saveLoading, setSaveLoading] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [mutualCount, setMutualCount] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [mode, setMode] = useState<'preview' | 'detail'>('preview');

  useEffect(() => {
    usersApi.getProfile(userId)
      .then((res) => {
        setProfile(res.user);
        if (res.user.friendshipStatus !== 'self') {
          friendsApi.mutual(userId).then((r) => setMutualCount(r.count)).catch(() => {});
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
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not open chat.' }); }
    finally { setDmLoading(false); }
  }

  async function toggleSave() {
    if (!profile || saveLoading) return;
    setSaveLoading(true);
    try {
      if (profile.isSaved) {
        await usersApi.unsaveProfile(profile._id);
        setProfile((p) => p ? { ...p, isSaved: false } : p);
      } else {
        await usersApi.saveProfile(profile._id);
        setProfile((p) => p ? { ...p, isSaved: true } : p);
      }
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not update.' }); }
    finally { setSaveLoading(false); }
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
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
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

  const socialLinks = [
    profile.instagramHandle ? { icon: 'logo-instagram' as const, label: 'Instagram', handle: profile.instagramHandle } : null,
    profile.linkedinHandle  ? { icon: 'logo-linkedin' as const,  label: 'LinkedIn',  handle: profile.linkedinHandle  } : null,
    profile.spotifyHandle   ? { icon: 'musical-notes-outline' as const, label: 'Spotify', handle: profile.spotifyHandle } : null,
  ].filter(Boolean) as { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; handle: string }[];

  // Stats
  const stats = [
    { value: mutualCount !== null ? String(mutualCount) : '—', label: 'Mutuals' },
    { value: String(profile.completedPingsCount ?? 0), label: 'Pings' },
    { value: `${profile.trustRate ?? 100}%`, label: 'Trust' },
  ];

  // ── Primary CTA label / action ─────────────────────────────────────────────
  function renderPrimaryCta(fullWidth = true) {
    if (isSelf) return null;

    if (profile!.friendshipStatus === 'none') {
      return (
        <TouchableOpacity
          style={[s.btnPrimary, !fullWidth && { flex: 1 }]}
          onPress={sendRequest}
          disabled={actionLoading}
          activeOpacity={0.88}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={s.btnPrimaryText}>Add Friend</Text>
          )}
        </TouchableOpacity>
      );
    }
    if (isPendingReceived) {
      return (
        <TouchableOpacity
          style={[s.btnPrimary, !fullWidth && { flex: 1 }]}
          onPress={acceptRequest}
          disabled={actionLoading}
          activeOpacity={0.88}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={s.btnPrimaryText}>Accept Request</Text>
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
          style={[s.btnPrimary, !fullWidth && { flex: 1 }]}
          onPress={openDm}
          disabled={dmLoading}
          activeOpacity={0.88}
        >
          {dmLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={s.btnPrimaryText}>Message</Text>
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

    const sheetInner = (
      <View style={[s.previewSheetInner, { paddingBottom: sheetPadBottom }]}>
        {/* Swipe pill indicator */}
        <View style={s.swipePill} />

        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={s.name} numberOfLines={1}>{shortName}</Text>
              {isVerified && (
                <Ionicons name="checkmark-circle" size={18} color="#A78BFA" />
              )}
            </View>
            {profile.username ? (
              <Text style={s.handle}>@{profile.username}</Text>
            ) : null}
          </View>
        </View>

        {profile.bio ? (
          <Text style={s.bio} numberOfLines={3}>
            "{profile.bio}"
          </Text>
        ) : null}

        <StatsRow items={stats} />

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
            tint="dark"
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={s.previewSheet}
          >
            <View style={s.previewSheetTint} {...cardSwipePan.panHandlers}>
              {sheetInner}
            </View>
          </BlurView>
        </View>

        {renderSheets()}
      </View>
    );
  }

  // ── DETAIL MODE (mock right screen) ────────────────────────────────────────
  return (
    <View style={s.root}>
      {allPhotos[0] ? (
        <Image source={{ uri: allPhotos[0] }} style={StyleSheet.absoluteFillObject} blurRadius={28} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0A0A0A' }]} />
      )}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

      <View style={[s.detailHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>
        {profile.username ? (
          <Text style={s.headerHandle}>@{profile.username}</Text>
        ) : (
          <View />
        )}
        <TouchableOpacity onPress={() => setShowShare(true)} hitSlop={12} style={s.headerBtn}>
          <Ionicons name="share-outline" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + (isSelf ? 40 : 120),
          gap: 18,
        }}
      >
        <GlassCard>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.detailName}>{profile.displayName ?? 'User'}</Text>
              {isVerified && <Ionicons name="checkmark-circle" size={20} color="#A78BFA" />}
            </View>
            {profile.username ? <Text style={s.handle}>@{profile.username}</Text> : null}
            {infoItems.length > 0 && (
              <Text style={s.infoLine}>{infoItems.join('  ·  ')}</Text>
            )}
          </View>

          {profile.bio ? (
            <Text style={s.detailBio}>"{profile.bio}"</Text>
          ) : null}

          <StatsRow items={stats} />

          {hashTags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tagsRow}
            >
              {hashTags.map((tag) => (
                <View key={tag} style={s.tagChip}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {traitChips.length > 0 && (
            <View style={s.traitsWrap}>
              {traitChips.map((trait) => (
                <View key={trait} style={s.traitChip}>
                  <Text style={s.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          )}

          <PhotoGallery photos={galleryPhotos} />
        </GlassCard>

        {pingPitchText ? (
          <QuoteCard
            text={pingPitchText}
            name={profile.displayName ?? 'User'}
            handle={profile.username}
            avatarUrl={profile.avatarUrl}
            initials={initials}
          />
        ) : null}

        {funTruthText ? (
          <QuoteCard
            text={funTruthText}
            name={profile.displayName ?? 'User'}
            handle={profile.username}
            avatarUrl={profile.avatarUrl}
            initials={initials}
          />
        ) : null}

        {socialLinks.length > 0 && (
          <View style={s.socialCard}>
            <Text style={s.socialTitle}>Socials</Text>
            {socialLinks.map((link) => (
              <View key={link.label} style={s.socialRow}>
                <Ionicons name={link.icon} size={18} color="rgba(255,255,255,0.55)" />
                <Text style={s.socialHandle}>{link.handle}</Text>
              </View>
            ))}
          </View>
        )}

        <HighlightsSection userId={userId} isOwnProfile={isSelf} scheme={scheme} />

        {isAccepted && (
          <TouchableOpacity style={s.removeFriendBtn} onPress={removeFriend} disabled={actionLoading} activeOpacity={0.85}>
            <Text style={s.removeFriendText}>Remove friend</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {!isSelf && (
        <View style={[s.detailActions, { paddingBottom: insets.bottom + 14 }]}>
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
      </>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

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
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  previewSheetInner: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 14,
  },
  swipePill: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
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
  socialCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  socialTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialHandle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },

  detailActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
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

  removeFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  removeFriendText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' },
});
