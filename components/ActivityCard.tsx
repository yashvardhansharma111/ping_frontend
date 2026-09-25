import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Share,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import {
  Barbell, ForkKnife, MusicNotes, BookOpen,
  PersonSimpleWalk, GameController, UsersThree,
  MapPin, ChatCircle, Export, CheckCircle,
  Clock, Lightning, Flame, DotsThreeVertical,
  type Icon,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { activitiesApi, chatApi, type Activity, type ActivityParticipant } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import ConfirmSheet from '@/components/ConfirmSheet';
import PaywallModal from '@/components/PaywallModal';
import { Ping, Radius, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ── Type meta — purple only for consistency ───────────────────────────────────
const TYPE_META: Record<string, { Icon: Icon; label: string }> = {
  sport:   { Icon: Barbell,          label: 'Sport'   },
  food:    { Icon: ForkKnife,        label: 'Food'    },
  music:   { Icon: MusicNotes,       label: 'Music'   },
  study:   { Icon: BookOpen,         label: 'Study'   },
  outdoor: { Icon: PersonSimpleWalk, label: 'Outdoor' },
  gaming:  { Icon: GameController,   label: 'Gaming'  },
  meetup:  { Icon: UsersThree,       label: 'Meetup'  },
  default: { Icon: MapPin,           label: 'Ping'    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function participantCount(p: ActivityParticipant[]) { return p?.length ?? 0; }

function isParticipant(p: ActivityParticipant[], uid: string) {
  return p?.some((x) => {
    const id = typeof x.userId === 'object' ? (x.userId as any)?.toString() : x.userId;
    return id === uid;
  }) ?? false;
}

function getMyParticipant(p: ActivityParticipant[], uid: string) {
  return p?.find((x) => {
    const id = typeof x.userId === 'object' ? (x.userId as any)?.toString() : x.userId;
    return id === uid;
  });
}

type TimeStatus = 'live' | 'soon' | 'scheduled' | 'expired';

function getTimeStatus(startsAt: string, expiresAt: string): TimeStatus {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const expire = new Date(expiresAt).getTime();
  if (now > expire) return 'expired';
  if (now >= start) return 'live';
  if (start - now < 30 * 60 * 1000) return 'soon';
  return 'scheduled';
}

function formatDateShort(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStartTime(startsAt: string) {
  const start = new Date(startsAt);
  const now = new Date();
  const diffMin = Math.round((start.getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return 'Now';
  if (diffMin < 60) return `in ${diffMin}m`;
  const isToday = start.toDateString() === now.toDateString();
  const t = start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return isToday ? `Today ${t}` : formatDateShort(startsAt);
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name?: string) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const STATUS_CONFIG: Record<TimeStatus, { label: string; bg: string; text: string; dot?: string }> = {
  live:      { label: 'LIVE',  bg: 'rgba(139,92,246,0.22)', text: Ping.purpleLight, dot: Ping.purple },
  soon:      { label: 'SOON',  bg: 'rgba(139,92,246,0.14)', text: Ping.purpleLight, dot: Ping.purpleLight },
  scheduled: { label: 'SCHED', bg: 'rgba(139,92,246,0.10)', text: Ping.purpleLight, dot: Ping.purpleLight },
  expired:   { label: 'ENDED', bg: 'rgba(139,92,246,0.07)', text: 'rgba(187,146,255,0.45)' },
};

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  activity: Activity;
  onJoin?: () => void;
  onPress?: () => void;
  compact?: boolean;
}

export default function ActivityCard({ activity: a, onJoin, onPress, compact = false }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const { user } = useAuthStore();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [showJoinSafety, setShowJoinSafety] = useState(false);
  const [paywall, setPaywall] = useState<{ message: string; upgradeTo: 'pro' | 'premium' } | null>(null);
  const [openingChat, setOpeningChat] = useState(false);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(10)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, damping: 18, stiffness: 200, mass: 0.7, useNativeDriver: true }),
    ]).start();
  }, []);

  const myId = user?._id ?? '';
  const isJoined = isParticipant(a.participants, myId);
  const count = participantCount(a.participants);
  const spotsLeft = a.maxParticipants ? a.maxParticipants - count : null;
  const typeCfg = TYPE_META[a.type] ?? TYPE_META.default;
  const TypeIcon = typeCfg.Icon;
  const timeStatus = getTimeStatus(a.startsAt, a.expiresAt);
  const statusCfg = STATUS_CONFIG[timeStatus];
  const isExpired = timeStatus === 'expired';

  const ink = isDark ? c.text : '#111111';
  const muted = isDark ? c.textSecondary : '#6F6866';
  const cardBg = isDark ? c.card : '#FFFFFF';
  const accent = isDark ? Ping.purpleLight : Ping.purple;
  const accentMist = isDark ? 'rgba(187,146,255,0.14)' : 'rgba(143,99,244,0.12)';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  function requireVerified() {
    if ((user as any)?.verificationStatus !== 'verified') {
      router.push('/verification' as any);
      return false;
    }
    return true;
  }

  async function handleJoin() {
    if (isJoined || joining || isExpired || !requireVerified()) return;
    setShowJoinSafety(true);
  }

  async function confirmJoin() {
    if (isJoined || joining || isExpired) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    try {
      await activitiesApi.join(a._id);
      onJoin?.();
    } catch (err: any) {
      const code = String(err.code || '');
      const msg = String(err.message || '');
      const isStale = code === 'not_live' || code === 'activity_not_found' || msg.includes('no longer live');
      if (code.includes('quota_') || code.includes('upgrade_')) {
        setPaywall({ message: err.message || 'Weekly join limit reached.', upgradeTo: err.details?.upgradeTo === 'premium' ? 'premium' : 'pro' });
      } else if (isStale) {
        Toast.show({ type: 'info', text1: 'Ping just ended', text2: 'This one wrapped up.' });
        onJoin?.();
      } else {
        Toast.show({ type: 'error', text1: 'Could not join', text2: err.message || 'Try again.' });
      }
    } finally { setJoining(false); }
  }

  async function handleOpenChat() {
    if (openingChat || !requireVerified()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpeningChat(true);
    try {
      const res = await chatApi.openActivityRoom(a._id);
      router.push({ pathname: '/chat/[roomId]' as any, params: { roomId: res.room._id, type: a.type ?? '', title: a.title ?? '', venue: a.placeName ?? '', creator: a.creator?.displayName ?? '' } });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not open chat.' });
    } finally { setOpeningChat(false); }
  }

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await Share.share({ message: `Join "${a.title}" on Ping — a live activity near you!` }); } catch {}
  }

  return (
    <Animated.View style={[s.card, { backgroundColor: cardBg, borderColor, opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
      <TouchableOpacity activeOpacity={onPress ? 0.78 : 1} onPress={onPress} disabled={!onPress}>

        {/* ── Cover photo ── */}
        <View style={s.coverWrap}>
          {a.imageUrl ? (
            <Image source={{ uri: a.imageUrl }} style={s.cover} resizeMode="cover" />
          ) : (
            <View style={[s.coverPlaceholder, { backgroundColor: accentMist }]}>
              <TypeIcon size={36} color={accent} weight="duotone" />
            </View>
          )}

          {/* Status pill — top left */}
          <View style={[s.statusPill, { backgroundColor: statusCfg.bg }]}>
            {statusCfg.dot && <View style={[s.statusDot, { backgroundColor: statusCfg.dot }]} />}
            <Text style={[s.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>

          {/* Share — top right */}
          <TouchableOpacity style={s.shareOverlay} onPress={handleShare} activeOpacity={0.8} hitSlop={8}>
            <Export size={14} color="#FFF" weight="bold" />
          </TouchableOpacity>

          {/* Bottom bar on image */}
          <View style={s.imgFooter}>
            {count > 0 && (
              <View style={s.countChip}>
                <UsersThree size={11} color="#FFF" weight="fill" />
                <Text style={s.countChipText}>{count} going{a.maxParticipants ? `/${a.maxParticipants}` : ''}</Text>
              </View>
            )}
            {a.placeName && (
              <View style={s.venueChip}>
                <MapPin size={10} color="#FFF" weight="fill" />
                <Text style={s.venueChipText} numberOfLines={1}>{a.placeName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Card body ── */}
        <View style={s.body}>
          {/* Creator row */}
          <View style={s.creatorRow}>
            <View style={[s.avatar, { backgroundColor: accentMist }]}>
              {(a as any).creator?.avatarUrl ? (
                <Image source={{ uri: (a as any).creator.avatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={[s.avatarLetter, { color: accent }]}>{initials(a.creator?.displayName)}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.creatorName, { color: ink }]} numberOfLines={1}>{a.creator?.displayName ?? 'Someone'}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={[s.timeText, { color: muted }]}>{timeAgo(a.startsAt)}</Text>
              <View style={[s.typePill, { backgroundColor: accentMist }]}>
                <TypeIcon size={9} color={accent} weight="bold" />
                <Text style={[s.typePillText, { color: accent }]}>{typeCfg.label}</Text>
              </View>
            </View>
          </View>

          {/* Title */}
          <Text style={[s.title, { color: ink }]} numberOfLines={1}>{a.title}</Text>

          {/* Urgency */}
          {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && !isExpired && (
            <View style={s.urgencyRow}>
              <Flame size={11} color={accent} weight="fill" />
              <Text style={[s.urgencyText, { color: accent }]}>Only {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Action row ── */}
      {!compact && (
        <View style={[s.actionRow, { borderTopColor: borderColor }]}>
          <Animated.View style={[{ flex: 1, flexDirection: 'row', justifyContent: 'center', paddingLeft: 10 }, { transform: [{ scale: btnScale }] }]}>
            <TouchableOpacity
              style={[s.mainBtn, { backgroundColor: isExpired ? (isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0') : accent }]}
              onPress={() => {
                Animated.sequence([
                  Animated.spring(btnScale, { toValue: 0.94, damping: 20, stiffness: 500, useNativeDriver: true }),
                  Animated.spring(btnScale, { toValue: 1, damping: 14, stiffness: 220, useNativeDriver: true }),
                ]).start();
                isJoined ? handleOpenChat() : handleJoin();
              }}
              disabled={joining || openingChat || isExpired}
              activeOpacity={0.85}
            >
              {joining || openingChat ? (
                <ActivityIndicator size="small" color={isExpired ? muted : '#FFF'} />
              ) : isExpired ? (
                <>
                  <Clock size={14} color={muted} weight="bold" />
                  <Text style={[s.mainBtnText, { color: muted }]}>Ended</Text>
                </>
              ) : isJoined ? (
                <>
                  <ChatCircle size={15} color="#FFF" weight="fill" />
                  <Text style={s.mainBtnText}>Open Chat</Text>
                </>
              ) : (
                <>
                  <UsersThree size={15} color="#FFF" weight="fill" />
                  <Text style={s.mainBtnText}>Join</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={[s.shareBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F5F5' }]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Export size={15} color={muted} weight="bold" />
          </TouchableOpacity>
        </View>
      )}

      <ConfirmSheet
        visible={showJoinSafety}
        onClose={() => setShowJoinSafety(false)}
        title="Safety before you join"
        subtitle="1 registration = 1 person only. Bringing extra friends gets you blacklisted permanently."
        confirmLabel="I understand — Join"
        cancelLabel="Cancel"
        danger
        onConfirm={() => { setShowJoinSafety(false); confirmJoin(); }}
      />
      <PaywallModal
        visible={!!paywall}
        onClose={() => setPaywall(null)}
        title="Upgrade to join more"
        message={paywall?.message}
        upgradeTo={paywall?.upgradeTo}
      />
    </Animated.View>
  );
}

export { isParticipant, getMyParticipant, participantCount, getTimeStatus, formatStartTime, STATUS_CONFIG };

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Cover
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 124 },
  coverPlaceholder: {
    width: '100%', height: 100,
    alignItems: 'center', justifyContent: 'center',
  },

  statusPill: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  shareOverlay: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },

  imgFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingBottom: 8,
  },
  countChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  countChipText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  venueChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    maxWidth: 130,
  },
  venueChipText: { fontSize: 10, fontWeight: '600', color: '#FFF' },

  // Body
  body: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },

  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 12, fontWeight: '800' },
  creatorName: { fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  metaCol: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20,
  },
  typePillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
  metaDot: { fontSize: 10 },
  timeText: { fontSize: 10, fontWeight: '500' },

  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, lineHeight: 23, marginTop: 2, marginBottom: 6 },

  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  urgencyText: { fontSize: 11, fontWeight: '600' },

  // Actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mainBtn: {
    height: 40, flex: 0.74, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  mainBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  shareBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
});
