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
  Barbell,
  ForkKnife,
  MusicNotes,
  BookOpen,
  PersonSimpleWalk,
  GameController,
  UsersThree,
  MapPin,
  CalendarBlank,
  ChatCircle,
  Export,
  CheckCircle,
  Clock,
  Sparkle,
  Handshake,
  Lightning,
  Coffee,
  Leaf,
  Flame,
  type Icon,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { activitiesApi, chatApi, type Activity, type ActivityParticipant } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import ConfirmSheet from '@/components/ConfirmSheet';
import PaywallModal from '@/components/PaywallModal';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ── Purple-only palette (aligned with Ping design system) ─────────────────────
const P = {
  deep:    Ping.purpleDim,
  primary: Ping.purple,
  soft:    Ping.purpleLight,
  mist:    'rgba(187,146,255,0.18)',
  wash:    'rgba(243,236,255,0.9)',
  ink:     '#111111',
  muted:   '#6F6866',
  line:    'rgba(143,99,244,0.16)',
  endedBg: Ping.lavender,
  endedTx: Ping.purpleDim,
};

const TYPE_META: Record<string, { Icon: Icon; label: string }> = {
  sport:   { Icon: Barbell,          label: 'Sport' },
  food:    { Icon: ForkKnife,        label: 'Food' },
  music:   { Icon: MusicNotes,       label: 'Music' },
  study:   { Icon: BookOpen,         label: 'Study' },
  outdoor: { Icon: PersonSimpleWalk, label: 'Outdoor' },
  gaming:  { Icon: GameController,   label: 'Gaming' },
  meetup:  { Icon: UsersThree,       label: 'Meetup' },
  default: { Icon: MapPin,           label: 'Ping' },
};

const VIBE_ICON: Record<string, Icon> = {
  cozy: Coffee,
  fun: Sparkle,
  exciting: Lightning,
  chill: Leaf,
  networking: Handshake,
  fitness: Barbell,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function participantCount(participants: ActivityParticipant[]) {
  return participants?.length ?? 0;
}

function isParticipant(participants: ActivityParticipant[], userId: string) {
  return participants?.some((p) => {
    const id = typeof p.userId === 'object' ? (p.userId as any)?.toString() : p.userId;
    return id === userId;
  }) ?? false;
}

function getMyParticipant(participants: ActivityParticipant[], userId: string) {
  return participants?.find((p) => {
    const id = typeof p.userId === 'object' ? (p.userId as any)?.toString() : p.userId;
    return id === userId;
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

function formatDateShort(startsAt: string): string {
  const d = new Date(startsAt);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStartTime(startsAt: string): string {
  const start = new Date(startsAt);
  const now = new Date();
  const diffMin = Math.round((start.getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return 'Now';
  if (diffMin < 60) return `in ${diffMin}m`;
  const isToday = start.toDateString() === now.toDateString();
  const time = start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return isToday ? `Today ${time}` : formatDateShort(startsAt);
}

const STATUS_CONFIG: Record<TimeStatus, { label: string; bg: string; text: string; dot: string }> = {
  live:      { label: 'LIVE',      bg: P.mist,    text: P.deep,    dot: P.primary },
  soon:      { label: 'SOON',      bg: P.wash,    text: P.primary, dot: P.soft },
  scheduled: { label: 'SCHEDULED', bg: P.wash,    text: P.soft,    dot: P.soft },
  expired:   { label: 'ENDED',     bg: P.endedBg, text: P.endedTx, dot: P.endedTx },
};

function insightFor(a: Activity, isJoined: boolean, timeStatus: TimeStatus): { title: string; sub: string; Icon: Icon } {
  if (isJoined && timeStatus === 'expired') {
    return { title: 'Great connections', sub: 'You joined this activity', Icon: Handshake };
  }
  if (isJoined && timeStatus === 'live') {
    return { title: "You're in", sub: 'Jump into the chat anytime', Icon: Sparkle };
  }
  if (isJoined) {
    return { title: 'Spot saved', sub: 'You joined this activity', Icon: CheckCircle };
  }
  if (timeStatus === 'live') {
    return { title: 'Happening now', sub: 'Join before it wraps up', Icon: Lightning };
  }
  if (a.vibe && VIBE_ICON[a.vibe]) {
    const label = a.vibe.charAt(0).toUpperCase() + a.vibe.slice(1);
    return { title: `${label} vibe`, sub: a.placeName ? `Near ${a.placeName}` : 'Open to new faces', Icon: VIBE_ICON[a.vibe] };
  }
  return { title: 'Worth a look', sub: 'Tap join to say you are in', Icon: UsersThree };
}

function initials(name?: string) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

// ── Scrolling ticker for long creator names ───────────────────────────────────

function TickerText({ text, color, style }: { text: string; color: string; style?: any }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const containerW = useRef(0);
  const naturalW = useRef(0);
  const started = useRef(false);

  function tryStart() {
    if (started.current || containerW.current === 0 || naturalW.current === 0) return;
    const overflow = naturalW.current - containerW.current;
    if (overflow <= 2) return;
    started.current = true;
    Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(translateX, {
          toValue: -overflow,
          duration: Math.max(overflow * 30, 1400),
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
  }

  return (
    <View
      style={{ maxWidth: 110, flexShrink: 1, overflow: 'hidden' }}
      onLayout={(e) => { containerW.current = e.nativeEvent.layout.width; tryStart(); }}
    >
      {/* Absolutely-positioned ghost text — measures natural (unconstrained) width */}
      <Text
        style={[style, { position: 'absolute', opacity: 0 }]}
        numberOfLines={1}
        onLayout={(e) => { naturalW.current = e.nativeEvent.layout.width; tryStart(); }}
      >
        {text}
      </Text>
      <Animated.Text style={[style, { color, transform: [{ translateX }] }]} numberOfLines={1}>
        {text}
      </Animated.Text>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  activity: Activity;
  onJoin?: () => void;
  compact?: boolean;
}

export default function ActivityCard({ activity: a, onJoin, compact = false }: Props) {
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
  const cardTranslateY = useRef(new Animated.Value(12)).current;
  const joinScale = useRef(new Animated.Value(1)).current;
  const chatScale = useRef(new Animated.Value(1)).current;
  const shareAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, damping: 18, stiffness: 200, mass: 0.7, useNativeDriver: true }),
    ]).start();
  }, []);

  function springPress(anim: Animated.Value) {
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.88, damping: 20, stiffness: 500, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, damping: 14, stiffness: 220, mass: 0.8, useNativeDriver: true }),
    ]).start();
  }

  const myId = user?._id ?? '';
  const isJoined = isParticipant(a.participants, myId);
  const count = participantCount(a.participants);
  const spotsLeft = a.maxParticipants ? a.maxParticipants - count : null;
  const typeCfg = TYPE_META[a.type] ?? TYPE_META.default;
  const TypeIcon = typeCfg.Icon;
  const timeStatus = getTimeStatus(a.startsAt, a.expiresAt);
  const statusCfg = STATUS_CONFIG[timeStatus];
  const isExpired = timeStatus === 'expired';
  const insight = insightFor(a, isJoined, timeStatus);
  const InsightIcon = insight.Icon;

  const avatars = (a.participants ?? [])
    .filter((p) => p.displayName || p.avatarUrl)
    .slice(0, 3);
  const extraAvatars = Math.max(0, count - avatars.length);

  const cardBg = isDark ? c.card : '#FFFFFF';
  const ink = isDark ? c.text : P.ink;
  const muted = isDark ? c.textSecondary : P.muted;
  const accent = isDark ? Ping.purpleLight : P.primary;
  const mist = isDark ? 'rgba(167,139,250,0.14)' : P.mist;
  const wash = isDark ? 'rgba(124,58,237,0.12)' : P.wash;

  function requireVerified(): boolean {
    if ((user as any)?.verificationStatus !== 'verified') {
      router.push('/verification' as any);
      return false;
    }
    return true;
  }

  async function handleJoin() {
    if (isJoined || joining || isExpired) return;
    if (!requireVerified()) return;
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
      const msg  = String(err.message || '');
      const isStale = code === 'not_live' || code === 'activity_not_found'
        || msg.includes('no longer live') || msg.includes('not found');
      if (code.includes('quota_') || code.includes('upgrade_')) {
        setPaywall({
          message: err.message || 'Weekly join limit reached.',
          upgradeTo: err.details?.upgradeTo === 'premium' ? 'premium' : 'pro',
        });
      } else if (isStale) {
        Toast.show({ type: 'info', text1: 'Ping just ended', text2: 'This one wrapped up — check out others nearby.' });
        onJoin?.();
      } else if (code === 'gender_restricted') {
        Toast.show({ type: 'info', text1: 'Restricted ping', text2: err.message });
      } else {
        Toast.show({ type: 'error', text1: 'Could not join', text2: err.message || 'Try again.' });
      }
    } finally {
      setJoining(false);
    }
  }

  async function handleOpenChat() {
    if (openingChat) return;
    if (!requireVerified()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpeningChat(true);
    try {
      const res = await chatApi.openActivityRoom(a._id);
      router.push({
        pathname: '/chat/[roomId]' as any,
        params: {
          roomId: res.room._id,
          type: a.type ?? '',
          title: a.title ?? '',
          vibe: a.vibe ?? '',
          venue: a.placeName ?? '',
          creator: a.creator?.displayName ?? '',
        },
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not open chat.' });
    } finally {
      setOpeningChat(false);
    }
  }

  async function handleShare() {
    springPress(shareAnim);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Join "${a.title}" on Ping — a live activity near you!`,
        url: `ping://activity/${a._id}`,
      });
    } catch {}
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isDark ? c.border : P.line,
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslateY }],
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      {/* Top */}
      <View style={styles.topRow}>
        {a.imageUrl ? (
          <Image source={{ uri: a.imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.iconBox, { backgroundColor: mist }]}>
            <TypeIcon size={22} color={accent} weight="duotone" />
          </View>
        )}

        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: ink }]} numberOfLines={1}>{a.title}</Text>
            {timeStatus === 'live' && <View style={styles.liveDot} />}
            {a.creator?.displayName ? (
              <TickerText
                text={`by ${a.creator.displayName}`}
                color={muted}
                style={styles.creatorInline}
              />
            ) : null}
          </View>

          <View style={styles.meta}>
            <CalendarBlank size={12} color={muted} weight="bold" />
            <Text style={[styles.metaText, { color: muted }]}>
              {formatDateShort(a.startsAt)}
              {'  ·  '}
              {count}{a.maxParticipants ? `/${a.maxParticipants}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Insight banner */}
      <View style={[styles.insight, { backgroundColor: wash }]}>
        <View style={[styles.insightIcon, { backgroundColor: mist }]}>
          <InsightIcon size={16} color={accent} weight="duotone" />
        </View>
        <View style={styles.insightText}>
          <Text style={[styles.insightTitle, { color: ink }]} numberOfLines={1}>{insight.title}</Text>
          <Text style={[styles.insightSub, { color: muted }]} numberOfLines={1}>{insight.sub}</Text>
        </View>
        {count > 0 ? (
          <View style={styles.avatarStack}>
            {avatars.map((p, i) => (
              <View
                key={`${p.userId}-${i}`}
                style={[
                  styles.avatar,
                  { marginLeft: i === 0 ? 0 : -8, borderColor: cardBg, backgroundColor: mist, zIndex: 10 - i },
                ]}
              >
                {p.avatarUrl ? (
                  <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: accent }]}>{initials(p.displayName)}</Text>
                )}
              </View>
            ))}
            {extraAvatars > 0 ? (
              <View style={[styles.avatar, styles.avatarMore, { marginLeft: -8, borderColor: cardBg, backgroundColor: accent }]}>
                <Text style={styles.avatarMoreText}>+{extraAvatars}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && !isExpired ? (
        <View style={styles.urgency}>
          <Flame size={13} color={accent} weight="fill" />
          <Text style={[styles.urgencyText, { color: accent }]}>
            Only {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      {!compact ? (
        <View style={styles.actionsRow}>
          {isJoined ? (
            <Animated.View style={[styles.primaryWrap, { transform: [{ scale: chatScale }] }]}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: accent }]}
                onPress={() => { springPress(chatScale); handleOpenChat(); }}
                disabled={openingChat}
                activeOpacity={0.85}
              >
                {openingChat ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <ChatCircle size={18} color="#FFF" weight="fill" />
                    <Text style={styles.primaryBtnText}>Open Chat</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.primaryWrap, { transform: [{ scale: joinScale }] }]}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: isExpired ? mist : accent },
                ]}
                onPress={() => { springPress(joinScale); handleJoin(); }}
                disabled={joining || isExpired}
                activeOpacity={0.85}
              >
                {joining ? (
                  <ActivityIndicator size="small" color={isExpired ? accent : '#FFF'} />
                ) : isExpired ? (
                  <>
                    <Clock size={16} color={accent} weight="bold" />
                    <Text style={[styles.primaryBtnText, { color: accent }]}>Ended</Text>
                  </>
                ) : (
                  <>
                    <UsersThree size={18} color="#FFF" weight="fill" />
                    <Text style={styles.primaryBtnText}>Join</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View style={{ transform: [{ scale: shareAnim }] }}>
            <TouchableOpacity
              style={[styles.shareBtn, { borderColor: isDark ? c.border : P.line, backgroundColor: isDark ? 'transparent' : '#FFF' }]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Export size={18} color={muted} weight="bold" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : null}

      <ConfirmSheet
        visible={showJoinSafety}
        onClose={() => setShowJoinSafety(false)}
        title="Safety before you join"
        subtitle="1 registration = 1 person only. Do not invite or bring extra friends — that gets you blacklisted permanently."
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingLeft: 16,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3.5,
    borderRadius: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  main: { flex: 1, gap: 3, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...Typography.bodyMed,
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
    letterSpacing: -0.2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  creatorInline: {
    fontSize: 11,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: { flex: 1, minWidth: 0, gap: 1 },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  insightSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 9, fontWeight: '700' },
  avatarMore: {},
  avatarMoreText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  urgency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  urgencyText: { fontSize: 12, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryWrap: { flex: 1 },
  primaryBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
