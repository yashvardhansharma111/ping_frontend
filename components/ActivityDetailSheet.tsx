/**
 * Full-detail bottom sheet for a selected activity.
 * Shows: header info, participants, creator, all action buttons.
 * Used inside the map screen's selected-activity sheet.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Share,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { activitiesApi, chatApi, friendsApi, reportsApi, type Activity, type ActivityParticipant } from '@/lib/api';
import { scheduleStartingNotification, cancelStartingNotification, scheduleSafetyReminder, cancelSafetyReminder } from '@/lib/notifications';
import useAuthStore from '@/lib/stores/authStore';
import SuccessToast from './SuccessToast';
import ConfirmSheet from '@/components/ConfirmSheet';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  isParticipant,
  getMyParticipant,
  participantCount,
  getTimeStatus,
  formatStartTime,
  STATUS_CONFIG,
} from './ActivityCard';
import PingFullCelebration from './PingFullCelebration';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_OPENERS: Record<string, string> = {
  sport:   "Alright, let's get sweaty. Who's showing up and what's the plan? 💪",
  food:    "Food has arrived (well, almost). What are we eating? 🍴",
  music:   "The vibe is loading... What are we blasting tonight? 🎧",
  study:   "Study mode: activated. What are we pretending to understand today? 📚",
  outdoor: "Touch grass time! Where are we heading? 🌿",
  gaming:  "Controllers ready. Excuses loading... What are we playing? 🎮",
  meetup:  "Look at us, actual humans meeting in real life. Wild. 👋",
  default: "Hey everyone! Your creator has entered the chat. No pressure. 😄",
};

const JOIN_TAUNTS = [
  'showed up — respect. 🫡',
  'has entered the chat AND the real world. Bold move. 😂',
  'just slid into the ping 🎉',
  'is here! Plot twist: they actually came through 🙌',
  'joined! Someone alert the press. 📰',
  'arrived. Fashionably, obviously. ✨',
  "is in the building (probably). Let's go! 🚀",
  'dropped their location and their dignity. Welcome! 😅',
];

function getJoinTaunt(name: string) {
  return `${name} ${JOIN_TAUNTS[Math.floor(Math.random() * JOIN_TAUNTS.length)]}`;
}

const TYPE_META: Record<string, { icon: IoniconName; color: string }> = {
  sport:   { icon: 'barbell-outline',        color: Ping.purple },
  food:    { icon: 'restaurant-outline',      color: Ping.purple },
  music:   { icon: 'musical-notes-outline',   color: Ping.purple },
  study:   { icon: 'book-outline',            color: Ping.purple },
  outdoor: { icon: 'walk-outline',            color: Ping.purple },
  gaming:  { icon: 'game-controller-outline', color: Ping.purple },
  meetup:  { icon: 'people-outline',          color: Ping.purple },
  default: { icon: 'location-outline',        color: Ping.purple },
};

function ParticipantAvatar({
  participant,
  index,
  onPress,
  isSelf = false,
}: {
  participant: ActivityParticipant;
  index: number;
  onPress: () => void;
  isSelf?: boolean;
}) {
  const name = participant.displayName ?? participant.username ?? null;
  const letter = name ? name[0].toUpperCase() : `${index + 1}`;
  const hasArrived = !!participant.arrivedAt;
  const onWay = !!participant.onMyWayAt && !hasArrived;
  const colors = ['#7C3AED', '#F97316', '#22C55E', '#3B82F6', '#EC4899', '#10B981'];
  const bg = colors[index % colors.length];
  const avatarUrl = participant.avatarUrl;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={av.wrap}>
      <View style={av.circleWrap}>
        <View style={[av.circle, { backgroundColor: `${bg}44`, borderColor: `${bg}66`, borderWidth: 1.5 }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={av.avatarImg} />
          ) : (
            <Text style={[av.letter, { color: bg }]}>{letter}</Text>
          )}
        </View>
        {onWay && <View style={[av.badge, { backgroundColor: Ping.orange }]} />}
        {hasArrived && <View style={[av.badge, { backgroundColor: Ping.green }]} />}
      </View>
      <Text style={av.name} numberOfLines={1}>
        {isSelf ? 'You' : (name ?? 'User')}
      </Text>
    </TouchableOpacity>
  );
}

const av = StyleSheet.create({
  wrap: { alignItems: 'center', width: 52 },
  circleWrap: { width: 40, height: 40, marginBottom: 4 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Ping.purple}44`,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  letter: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  badge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 11, height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#11112A',
  },
  name: { ...Typography.caption, color: '#9490C0', fontSize: 10, maxWidth: 48 },
});

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  activity: Activity;
  onRefresh: () => void;
  onDismiss: () => void;
  onScrolledDown?: () => void;
  onActivityUpdate?: (activity: Activity) => void;
  scrollEnabled?: boolean;
}

export default function ActivityDetailSheet({ activity: initial, onRefresh, onDismiss, onScrolledDown, onActivityUpdate, scrollEnabled = true }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const rpt = useMemo(() => makeRptStyles(isDark, c), [isDark]);
  const jc  = useMemo(() => makeJcStyles(isDark), [isDark]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [a, setA] = useState(initial);
  useEffect(() => { setA(initial); }, [initial]);

  const myId = user?._id ?? '';
  const isCreator = a.creatorId === myId || a.creator?._id === myId;
  const isJoined = isParticipant(a.participants, myId);
  const myParticipant = getMyParticipant(a.participants, myId);
  const count = participantCount(a.participants);
  const timeStatus = getTimeStatus(a.startsAt, a.expiresAt);
  const statusCfg = STATUS_CONFIG[timeStatus];
  const typeCfg = TYPE_META[a.type] ?? TYPE_META.default;
  const isExpired = timeStatus === 'expired';

  const [joining, setJoining] = useState(false);
  const [joinToast, setJoinToast] = useState(false);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [soloAcked, setSoloAcked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leavingQuietly, setLeavingQuietly] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatInflightRef = useRef(false);
  const [onMyWayLoading, setOnMyWayLoading] = useState(false);
  const [arrivedLoading, setArrivedLoading] = useState(false);
  const [mutualCount, setMutualCount] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ names: string[]; count: number } | null>(null);
  const [connectSent, setConnectSent] = useState<Record<string, boolean>>({});

  // Destructive confirm states
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Report sheet state
  const [showReport, setShowReport] = useState(false);

  // Profile menu state
  const [profileMenu, setProfileMenu] = useState<{ userId: string; name: string; sent: boolean } | null>(null);

  // Fetch mutual friends count for the Safety Card (only when not creator)
  useEffect(() => {
    const cId = a.creator?._id ?? a.creatorId;
    if (!cId || cId === myId) return;
    friendsApi.mutual(cId)
      .then((r) => setMutualCount(r.count))
      .catch(() => setMutualCount(0));
  }, [a._id]);

  // Always load full activity (populated participants + image) when sheet opens
  useEffect(() => {
    let cancelled = false;
    activitiesApi.get(initial._id)
      .then((r) => {
        if (cancelled || !r.activity) return;
        setA(r.activity);
        onActivityUpdate?.(r.activity);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initial._id]);

  function chatUrl(roomId: string) {
    const p = new URLSearchParams({ type: a.type });
    if (a.title) p.set('title', a.title);
    if ((a as any).vibe) p.set('vibe', (a as any).vibe);
    if ((a as any).placeName) p.set('venue', (a as any).placeName);
    if (a.creator?.displayName) p.set('creator', a.creator.displayName);
    return `/chat/${roomId}?${p.toString()}`;
  }

  async function handleJoin() {
    if (joining || isExpired) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    const myName = user?.displayName ?? user?.username ?? 'Someone';
    const willBeFull = !!a.maxParticipants && (count + 1 >= a.maxParticipants);
    try {
      await activitiesApi.join(a._id);
      onRefresh();
      // Hydrate local sheet so "Joined" UI shows even if parent list is slow
      try {
        const fresh = await activitiesApi.get(a._id);
        if (fresh.activity) {
          setA(fresh.activity);
          onActivityUpdate?.(fresh.activity);
        }
      } catch {
        // non-fatal — parent refresh will catch up
      }
      // Schedule "starts in 15 min" local notification if ping is upcoming
      if (a.startsAt) {
        scheduleStartingNotification(a._id, a.title, new Date(a.startsAt));
        scheduleSafetyReminder(a._id, a.title, new Date(a.startsAt));
      }
      const res = await chatApi.openActivityRoom(a._id);
      chatApi.sendMessage(res.room._id, getJoinTaunt(myName)).catch(() => {});
      if (willBeFull) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const existingNames = (a.participants ?? []).map((p: any) => p.displayName ?? p.username ?? '').filter(Boolean);
        setCelebration({ names: [...existingNames, myName], count: a.maxParticipants! });
      } else {
        setJoinToast(true);
        setTimeout(() => router.push(chatUrl(res.room._id)), 800);
      }
    } catch (e: any) {
      const code = String(e.code || '');
      if (code === 'not_live') {
        Toast.show({ type: 'info', text1: 'Ping just ended', text2: 'This one wrapped up — check out others nearby.' });
        onDismiss();
        onRefresh();
      } else if (code === 'gender_restricted') {
        Toast.show({ type: 'info', text1: 'Restricted ping', text2: e.message });
      } else {
        Toast.show({ type: 'error', text1: 'Could not join', text2: e.message });
      }
    } finally {
      setJoining(false);
    }
  }

  async function doLeave() {
    setLeaving(true);
    try {
      const name = user?.displayName ?? user?.username ?? 'Someone';
      await chatApi.openActivityRoom(a._id)
        .then((r) => chatApi.sendMessage(r.room._id, `${name} left the ping.`).catch(() => {}))
        .catch(() => {});
      await activitiesApi.leave(a._id);
      onRefresh();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setLeaving(false);
    }
  }

  function handleLeave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setConfirmLeave(true);
  }

  async function handleLeaveQuietly() {
    setLeavingQuietly(true);
    try {
      await activitiesApi.leaveQuietly(a._id);
      onRefresh();
      onDismiss();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setLeavingQuietly(false);
    }
  }

  function handleReport() {
    setShowReport(true);
  }

  function handleCancel() {
    setConfirmCancel(true);
  }

  async function doCancel() {
    setCancelling(true);
    try {
      await activitiesApi.cancel(a._id);
      cancelStartingNotification(a._id);
      cancelSafetyReminder(a._id);
      onDismiss();
      onRefresh();
      Toast.show({ type: 'success', text1: 'Ping cancelled.', text2: 'Your ping has been removed.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setCancelling(false);
    }
  }

  async function handleOpenChat() {
    if (chatInflightRef.current) return;
    chatInflightRef.current = true;
    setChatLoading(true);
    try {
      const res = await chatApi.openActivityRoom(a._id);
      const roomId = res?.room?._id;
      if (!roomId) throw new Error('Chat room unavailable — please try again.');
      if (isCreator) {
        chatApi.listMessages(roomId)
          .then((msgRes) => {
            if (msgRes.messages.length === 0) {
              const opener = TYPE_OPENERS[a.type] ?? TYPE_OPENERS.default;
              chatApi.sendMessage(roomId, opener).catch(() => {});
            }
          })
          .catch(() => {});
      }
      router.push(chatUrl(roomId));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not open chat', text2: e.message || 'Please try again.' });
    } finally {
      setChatLoading(false);
      chatInflightRef.current = false;
    }
  }

  async function handleOnMyWay() {
    setOnMyWayLoading(true);
    try {
      await activitiesApi.onMyWay(a._id);
      await chatApi.openActivityRoom(a._id).then((res) =>
        chatApi.sendMessage(res.room._id, 'On my way! 🚶').catch(() => {})
      );
      onRefresh();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setOnMyWayLoading(false);
    }
  }

  async function handleArrived() {
    setArrivedLoading(true);
    try {
      await activitiesApi.arrived(a._id);
      await chatApi.openActivityRoom(a._id).then((res) =>
        chatApi.sendMessage(res.room._id, 'I\'m here! 📍').catch(() => {})
      );
      onRefresh();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setArrivedLoading(false);
    }
  }

  const creatorId = a.creator?._id ?? a.creatorId;

  const scrollExpandedRef = useRef(false);

  return (
    <>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.root, { paddingBottom: insets.bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={32}
      scrollEnabled={scrollEnabled}
      onScroll={(e) => {
        const y = e.nativeEvent.contentOffset.y;
        if (y > 40 && !scrollExpandedRef.current) {
          scrollExpandedRef.current = true;
          onScrolledDown?.();
        } else if (y <= 0) {
          scrollExpandedRef.current = false;
        }
      }}
      key={a._id}
    >
      {/* Cover image */}
      {a.imageUrl ? (
        <Image source={{ uri: a.imageUrl }} style={styles.coverImage} resizeMode="cover" />
      ) : null}

      {/* Gradient header strip */}
      <View style={[styles.gradientHeader, { backgroundColor: `${typeCfg.color}18` }]}>
        <View style={[styles.gradientHeaderAccent, { backgroundColor: typeCfg.color }]} />
        <View style={[styles.headerIconWrap, { backgroundColor: `${typeCfg.color}33` }]}>
          <Ionicons name={typeCfg.icon} size={22} color={typeCfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: typeCfg.color }]} numberOfLines={1}>{a.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, alignSelf: 'flex-start' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
            <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.shareIconBtn, { backgroundColor: `${typeCfg.color}22` }]}
          onPress={() => {
            const HOOKS: Record<string, string> = {
              food: "We're eating. Come hungry or don't come at all.",
              sport: 'Moving our bodies like functioning humans. Join.',
              music: 'The aux is open. Bring your actual taste.',
              study: "Group delusion that we'll be productive. You in?",
              outdoor: "Outside. On purpose. It'll be worth it.",
              gaming: 'We play, we argue, we do it again. Classic.',
              meetup: 'Real people. IRL. In this economy. Wild.',
            };
            const emoji = ({ sport: '🏃', food: '🍜', music: '🎧', study: '📖', outdoor: '🌿', gaming: '🎮', meetup: '👋' } as Record<string,string>)[a.type] ?? '📍';
            const hook  = HOOKS[a.type];
            const place = (a as any).placeName as string | undefined;
            const time  = new Date(a.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const date  = new Date(a.startsAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const body  = [a.description?.trim() || null, place ? `📍 ${place}` : null, `🕐 ${date}, ${time}`].filter(Boolean).join('\n');
            const msg   = [`${emoji} ${a.title}`, '', hook ?? body, ...(hook ? ['', body] : []), '', 'Get on Ping and join → https://pingnow.in'].join('\n');
            Share.share({ message: msg });
          }}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={18} color={typeCfg.color} />
        </TouchableOpacity>
      </View>

      {/* Meta row (time / place / distance) */}
      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={c.icon} />
          <Text style={[styles.metaText, { color: timeStatus === 'live' ? Ping.purpleLight : c.textSecondary }]}>
            {timeStatus === 'live' ? 'Happening now' : formatStartTime(a.startsAt)}
          </Text>
        </View>
        {a.placeName ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={c.icon} />
            <Text style={[styles.metaText, { color: c.textSecondary }]}>{a.placeName}</Text>
          </View>
        ) : null}
        {a.distance !== undefined && a.distance !== null && (
          <View style={styles.metaRow}>
            <Ionicons name="navigate-outline" size={13} color={c.icon} />
            <Text style={[styles.metaText, { color: c.textSecondary }]}>
              {a.distance < 1000 ? `${Math.round(a.distance)}m away` : `${(a.distance / 1000).toFixed(1)}km away`}
            </Text>
          </View>
        )}
      </View>

      {/* Gender filter badge */}
      {a.genderFilter && a.genderFilter !== 'all' && (
        <View style={[
          styles.genderBadge,
          { backgroundColor: 'rgba(143,99,244,0.12)', borderColor: `${Ping.purple}60` },
        ]}>
          <Ionicons
            name={a.genderFilter === 'women_only' ? 'female' : 'male'}
            size={13}
            color={Ping.purpleLight}
          />
          <Text style={[styles.genderBadgeText, { color: Ping.purpleLight }]}>
            {a.genderFilter === 'women_only' ? 'Women only' : 'Men only'}
          </Text>
        </View>
      )}

      {/* Description */}
      {a.description ? (
        <Text style={[styles.description, { color: c.textSecondary }]}>{a.description}</Text>
      ) : null}

      {/* Creator Safety Card (shown before joining a stranger's ping) */}
      {a.creator?.displayName && (
        <TouchableOpacity
          style={[styles.creatorRow, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => {
            if (!creatorId) return;
            if (isCreator) { router.push(`/user/${creatorId}`); return; }
            const name = a.creator!.displayName!;
            const alreadySent = connectSent[creatorId] ?? false;
            setProfileMenu({ userId: creatorId, name, sent: alreadySent });
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.creatorAvatar, { backgroundColor: `${Ping.purple}44` }]}>
            {a.creator.avatarUrl ? (
              <Image source={{ uri: a.creator.avatarUrl }} style={styles.creatorAvatarImg} />
            ) : (
              <Text style={styles.creatorInitial}>
                {a.creator.displayName[0].toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.creatorName, { color: c.text }]}>{a.creator.displayName}</Text>
            <View style={styles.creatorMeta}>
              {/* Trust Rate — only shown once the creator has real ratings */}
              {a.creator.ratingCount != null && a.creator.ratingCount > 0 && a.creator.trustRate !== undefined && (
                <View style={styles.trustChip}>
                  <View style={[styles.trustDot, { backgroundColor: Ping.purpleLight }]} />
                  <Text style={[styles.trustText, { color: c.textSecondary }]}>
                    {a.creator.trustRate}% trust
                  </Text>
                </View>
              )}
              {/* Mutual friends */}
              {mutualCount !== null && mutualCount > 0 && (
                <View style={styles.trustChip}>
                  <Ionicons name="people-outline" size={10} color={Ping.purpleLight} />
                  <Text style={[styles.trustText, { color: c.textSecondary }]}>
                    {mutualCount} mutual
                  </Text>
                </View>
              )}
              {/* Account age */}
              {a.creator.createdAt && (
                <View style={styles.trustChip}>
                  <Ionicons name="calendar-outline" size={10} color={c.icon} />
                  <Text style={[styles.trustText, { color: c.textSecondary }]}>
                    {(() => {
                      const months = Math.floor((Date.now() - new Date(a.creator.createdAt!).getTime()) / (30 * 24 * 3600 * 1000));
                      return months < 1 ? 'New member' : `${months}mo ago`;
                    })()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {creatorId && <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />}
        </TouchableOpacity>
      )}

      {/* Participants */}
      {count > 0 && (() => {
        const others = a.participants.filter((p) => {
          const uid = typeof p.userId === 'string' ? p.userId : String((p.userId as any)?._id ?? p.userId ?? '');
          return uid && uid !== myId;
        });
        const soloOwner = isCreator && others.length === 0;

        return (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
                {soloOwner
                  ? 'Just you so far'
                  : `${count} going${a.maxParticipants ? ` · ${Math.max(0, a.maxParticipants - count)} spots left` : ''}`}
              </Text>
              {!soloOwner && others.length > 0 && (
                <View style={styles.tapHint}>
                  <Ionicons name="person-add-outline" size={11} color={Ping.purpleLight} />
                  <Text style={[styles.tapHintText, { color: Ping.purpleLight }]}>tap to connect</Text>
                </View>
              )}
            </View>

            {soloOwner ? (
              <View style={[styles.soloBox, { backgroundColor: `${typeCfg.color}12`, borderColor: `${typeCfg.color}28` }]}>
                <Ionicons name="people-outline" size={18} color={typeCfg.color} />
                <Text style={[styles.soloText, { color: c.textSecondary }]}>
                  Waiting for others to join. Share this ping to fill it up.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsRow}>
                {a.participants.slice(0, 12).map((p, i) => {
                  const uid = typeof p.userId === 'string'
                    ? p.userId
                    : String((p.userId as any)?._id ?? (p.userId as any)?.id ?? '');
                  const isSelf = !!uid && uid === myId;
                  const alreadySent = uid ? connectSent[uid] : false;
                  const name = p.displayName ?? p.username ?? 'this person';
                  return (
                    <ParticipantAvatar
                      key={uid || i}
                      index={i}
                      participant={p}
                      isSelf={isSelf}
                      onPress={() => {
                        if (!uid) {
                          Toast.show({ type: 'error', text1: 'Unavailable', text2: 'Could not open this profile.' });
                          return;
                        }
                        if (isSelf) {
                          router.push(`/user/${uid}`);
                          return;
                        }
                        setProfileMenu({ userId: uid, name, sent: alreadySent });
                      }}
                    />
                  );
                })}
                {count > 12 && (
                  <View style={[av.circle, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginTop: 4 }]}>
                    <Text style={[av.letter, { color: c.textSecondary, fontSize: 12 }]}>+{count - 12}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        );
      })()}

      {/* Pre-meetup safety banner — shown when joined and starting within 30 min */}
      {isJoined && !isCreator && a.startsAt && (() => {
        const msUntil = new Date(a.startsAt).getTime() - Date.now();
        return (timeStatus === 'live' || (msUntil > 0 && msUntil <= 30 * 60 * 1000));
      })() && (
        <TouchableOpacity
          style={styles.safetyBanner}
          onPress={() => router.push('/safety' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.safetyBannerIcon}>
            <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.safetyBannerTitle}>Safety reminder</Text>
            <Text style={styles.safetyBannerSub}>Share your location with a trusted contact before you meet.</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#22C55E" />
        </TouchableOpacity>
      )}

      {/* ── Action buttons ── */}
      <View style={styles.actionsGrid}>
        {/* Not joined yet */}
        {!isJoined && !isCreator && (
          <>
            <TouchableOpacity
              style={[styles.btnPrimary, isExpired && styles.btnDisabled]}
              onPress={() => setShowJoinConfirm(true)}
              disabled={joining || isExpired}
              activeOpacity={0.85}
            >
              {joining ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={18} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>{isExpired ? 'Ping Ended' : 'Join Ping'}</Text>
                </>
              )}
            </TouchableOpacity>

            {!isExpired && (
              <View style={styles.safetyNotice}>
                <Ionicons name="shield-checkmark" size={15} color="#F59E0B" style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.safetyNoticeTitle}>1 registration = 1 person only</Text>
                  <Text style={styles.safetyNoticeBody}>
                    Bringing uninvited guests is a violation of Ping's community guidelines. If we detect attendance fraud — extra people joining under one registration — your account will be permanently suspended without appeal.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Joined actions */}
        {isJoined && !isCreator && (
          <>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleOpenChat}
              disabled={chatLoading}
              activeOpacity={0.85}
            >
              {chatLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="chatbubbles" size={18} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>Open Chat</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.btnRow}>
              {!myParticipant?.onMyWayAt && (
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={handleOnMyWay}
                  disabled={onMyWayLoading}
                  activeOpacity={0.8}
                >
                  {onMyWayLoading ? (
                    <ActivityIndicator size="small" color={Ping.purpleLight} />
                  ) : (
                    <>
                      <Ionicons name="walk-outline" size={15} color={Ping.purpleLight} />
                      <Text style={[styles.btnSecondaryText, { color: Ping.purpleLight }]}>On My Way</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {!myParticipant?.arrivedAt && (
                <TouchableOpacity
                  style={[styles.btnSecondary, { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.07)' }]}
                  onPress={handleArrived}
                  disabled={arrivedLoading}
                  activeOpacity={0.8}
                >
                  {arrivedLoading ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <>
                      <Ionicons name="pin" size={15} color="#22C55E" />
                      <Text style={[styles.btnSecondaryText, { color: '#22C55E' }]}>I'm Here</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btnSecondary, styles.btnDanger]}
                onPress={handleLeave}
                disabled={leaving}
                activeOpacity={0.8}
              >
                {leaving ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="exit-outline" size={15} color="#EF4444" />
                    <Text style={[styles.btnSecondaryText, { color: '#EF4444' }]}>Leave</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Discreet exit + report row */}
            <View style={styles.safetyRow}>
              <TouchableOpacity
                style={styles.safetyBtn}
                onPress={handleLeaveQuietly}
                disabled={leavingQuietly}
                activeOpacity={0.7}
              >
                {leavingQuietly ? (
                  <ActivityIndicator size="small" color="#9490C0" />
                ) : (
                  <>
                    <Ionicons name="eye-off-outline" size={13} color="#9490C0" />
                    <Text style={styles.safetyBtnText}>Leave Quietly</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.safetyBtn} onPress={handleReport} activeOpacity={0.7}>
                <Ionicons name="flag-outline" size={13} color="#9490C0" />
                <Text style={styles.safetyBtnText}>Report</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Not joined — report button */}
        {!isJoined && !isCreator && (
          <TouchableOpacity style={[styles.safetyRow, { justifyContent: 'flex-end' }]} onPress={handleReport} activeOpacity={0.7}>
            <Ionicons name="flag-outline" size={13} color="#9490C0" />
            <Text style={styles.safetyBtnText}>Report this ping</Text>
          </TouchableOpacity>
        )}

        {/* Creator actions */}
        {isCreator && (
          <>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleOpenChat}
              disabled={chatLoading}
              activeOpacity={0.85}
            >
              {chatLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="chatbubbles" size={18} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>Open Chat</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.btnRow}>
              {!myParticipant?.onMyWayAt && (
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={handleOnMyWay}
                  disabled={onMyWayLoading}
                  activeOpacity={0.8}
                >
                  {onMyWayLoading ? (
                    <ActivityIndicator size="small" color={Ping.purpleLight} />
                  ) : (
                    <>
                      <Ionicons name="walk-outline" size={15} color={Ping.purpleLight} />
                      <Text style={[styles.btnSecondaryText, { color: Ping.purpleLight }]}>On My Way</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {!isExpired && (
                <TouchableOpacity
                  style={[styles.btnSecondary, styles.btnDanger]}
                  onPress={handleCancel}
                  disabled={cancelling}
                  activeOpacity={0.8}
                >
                  {cancelling ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={15} color="#EF4444" />
                      <Text style={[styles.btnSecondaryText, { color: '#EF4444' }]}>Cancel Ping</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>

    {celebration && (
      <PingFullCelebration
        count={celebration.count}
        names={celebration.names}
        color={typeCfg.color}
        visible={!!celebration}
        onDone={() => {
          setCelebration(null);
          chatApi.openActivityRoom(a._id)
            .then((res) => router.push(chatUrl(res.room._id)))
            .catch(() => {});
        }}
      />
    )}

    <SuccessToast
      visible={joinToast}
      message="You joined the ping!"
      subMessage="Opening chat..."
      icon="flash"
      color={Ping.purple}
      onDone={() => setJoinToast(false)}
    />

    {/* Leave ping confirm */}
    <ConfirmSheet
      visible={confirmLeave}
      onClose={() => setConfirmLeave(false)}
      title="Leave ping?"
      subtitle="You can rejoin later if it's still open."
      confirmLabel="Leave"
      cancelLabel="Stay"
      danger
      onConfirm={doLeave}
    />

    {/* Cancel ping confirm */}
    <ConfirmSheet
      visible={confirmCancel}
      onClose={() => setConfirmCancel(false)}
      title="Cancel ping?"
      subtitle="This will end the ping for everyone."
      confirmLabel="Cancel ping"
      cancelLabel="Keep it"
      danger
      onConfirm={doCancel}
    />

    {/* Report sheet */}
    <Modal
      visible={showReport}
      transparent
      animationType="slide"
      onRequestClose={() => setShowReport(false)}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={rpt.backdrop}
        activeOpacity={1}
        onPress={() => setShowReport(false)}
      />
      <View style={rpt.sheet}>
        <View style={rpt.handle} />
        <View style={rpt.iconWrap}>
          <Ionicons name="flag" size={22} color="#EF4444" />
        </View>
        <Text style={rpt.title}>Report this ping</Text>
        <Text style={rpt.subtitle}>What's the issue?</Text>
        {([
          { label: 'Inappropriate content', reason: 'inappropriate' },
          { label: 'Felt unsafe',           reason: 'unsafe' },
          { label: 'Spam',                  reason: 'spam' },
          { label: 'Fake activity',         reason: 'fake' },
          ...((isJoined || isCreator) && new Date(a.startsAt) <= new Date()
            ? [{ label: 'Attendance fraud — extra people showed up', reason: 'attendance_fraud' }]
            : []),
        ] as { label: string; reason: string }[]).map(({ label, reason }) => (
          <TouchableOpacity
            key={reason}
            style={rpt.option}
            activeOpacity={0.75}
            onPress={() => {
              setShowReport(false);
              reportsApi.create('ping', a._id, reason).catch(() => {});
              Toast.show({ type: 'success', text1: 'Report submitted', text2: 'Thanks for keeping Ping safe.' });
            }}
          >
            <Text style={rpt.optionText}>{label}</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(241,240,255,0.3)" />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={rpt.cancelBtn} onPress={() => setShowReport(false)} activeOpacity={0.8}>
          <Text style={rpt.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>

    {/* Join confirmation — solo acknowledgement */}
    <Modal
      visible={showJoinConfirm}
      transparent
      animationType="slide"
      onRequestClose={() => { setShowJoinConfirm(false); setSoloAcked(false); }}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={rpt.backdrop}
        activeOpacity={1}
        onPress={() => { setShowJoinConfirm(false); setSoloAcked(false); }}
      />
      <View style={rpt.sheet}>
        <View style={rpt.handle} />
        <View style={[rpt.iconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
          <Ionicons name="shield-checkmark" size={22} color="#F59E0B" />
        </View>
        <Text style={rpt.title}>Safety & Attendance Policy</Text>

        {/* Rules list */}
        <View style={jc.rulesList}>
          <View style={jc.ruleRow}>
            <Ionicons name="person" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
            <Text style={jc.ruleText}>
              <Text style={jc.ruleBold}>1 registration = 1 person only.</Text>{' '}
              You cannot bring friends or invite anyone who hasn't registered separately.
            </Text>
          </View>
          <View style={jc.ruleRow}>
            <Ionicons name="ban" size={14} color="#EF4444" style={{ marginTop: 1 }} />
            <Text style={jc.ruleText}>
              <Text style={jc.ruleBold}>No uninvited guests — ever.</Text>{' '}
              Showing up with extra people is a direct violation of Ping's community rules.
            </Text>
          </View>
          <View style={jc.ruleRow}>
            <Ionicons name="lock-closed" size={14} color="#9490C0" style={{ marginTop: 1 }} />
            <Text style={jc.ruleText}>
              <Text style={jc.ruleBold}>Violation = permanent blacklist.</Text>{' '}
              Attendance fraud results in immediate and permanent account suspension with no appeal.
            </Text>
          </View>
        </View>

        {/* Checkbox */}
        <TouchableOpacity
          style={jc.checkRow}
          activeOpacity={0.75}
          onPress={() => setSoloAcked((v) => !v)}
        >
          <View style={[jc.checkbox, soloAcked && jc.checkboxChecked]}>
            {soloAcked && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
          <Text style={jc.checkLabel}>
            I understand — I will attend alone and will not bring any extra people.
          </Text>
        </TouchableOpacity>

        {/* Buttons */}
        <TouchableOpacity
          style={[rpt.cancelBtn, { marginTop: 12 }]}
          onPress={() => { setShowJoinConfirm(false); setSoloAcked(false); }}
          activeOpacity={0.8}
        >
          <Text style={rpt.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[jc.confirmBtn, !soloAcked && jc.confirmBtnDisabled]}
          disabled={!soloAcked}
          activeOpacity={0.85}
          onPress={() => {
            setShowJoinConfirm(false);
            setSoloAcked(false);
            handleJoin();
          }}
        >
          <Text style={jc.confirmBtnText}>Confirm &amp; Join</Text>
        </TouchableOpacity>
      </View>
    </Modal>

    {/* Profile menu (creator / participant tap) */}
    <Modal
      visible={!!profileMenu}
      transparent
      animationType="slide"
      onRequestClose={() => setProfileMenu(null)}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={rpt.backdrop}
        activeOpacity={1}
        onPress={() => setProfileMenu(null)}
      />
      {profileMenu && (
        <View style={rpt.sheet}>
          <View style={rpt.handle} />
          <View style={[rpt.iconWrap, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
            <Ionicons name="person" size={22} color={Ping.purple} />
          </View>
          <Text style={rpt.title}>{profileMenu.name}</Text>
          <TouchableOpacity
            style={rpt.option}
            activeOpacity={0.75}
            onPress={() => {
              setProfileMenu(null);
              router.push(`/user/${profileMenu.userId}`);
            }}
          >
            <Text style={rpt.optionText}>View Profile</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(241,240,255,0.3)" />
          </TouchableOpacity>
          {profileMenu.sent ? (
            <View style={[rpt.option, { opacity: 0.5 }]}>
              <Text style={rpt.optionText}>Request Sent</Text>
              <Ionicons name="checkmark" size={14} color="#22C55E" />
            </View>
          ) : (
            <TouchableOpacity
              style={rpt.option}
              activeOpacity={0.75}
              onPress={() => {
                const uid = profileMenu.userId;
                setProfileMenu(null);
                friendsApi.send(uid)
                  .then(() => {
                    setConnectSent((prev) => ({ ...prev, [uid]: true }));
                    Toast.show({ type: 'success', text1: 'Request sent', text2: `Friend request sent to ${profileMenu.name}` });
                  })
                  .catch((e: any) => Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not send request' }));
              }}
            >
              <Text style={rpt.optionText}>Send Friend Request</Text>
              <Ionicons name="person-add-outline" size={14} color="rgba(241,240,255,0.3)" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={rpt.cancelBtn} onPress={() => setProfileMenu(null)} activeOpacity={0.8}>
            <Text style={rpt.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: Spacing.lg, gap: Spacing.md },
  coverImage: {
    width: '100%',
    height: 160,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  gradientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientHeaderAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  shareIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 4,
  },
  headerTitle: { ...Typography.bodyMed, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaBlock: { gap: 4 },
  title: { ...Typography.bodyMed, flex: 1, fontSize: 17 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  metaText: { ...Typography.caption, fontSize: 12 },
  description: { ...Typography.bodySm, lineHeight: 20 },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  genderBadgeText: { ...Typography.caption, fontWeight: '700', fontSize: 12 },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  creatorAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  creatorInitial: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  creatorName: { ...Typography.bodyMed, fontSize: 14 },
  creatorLabel: { ...Typography.caption, marginTop: 1 },
  creatorMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trustDot: { width: 6, height: 6, borderRadius: 3 },
  trustText: { ...Typography.caption, fontSize: 11 },
  safetyRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  safetyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(148,144,192,0.18)',
    backgroundColor: 'rgba(148,144,192,0.07)',
  },
  safetyBtnText: { fontSize: 12, color: '#9490C0', fontWeight: '600', letterSpacing: 0.1 },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.07)',
  },
  safetyBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyBannerTitle: { ...Typography.bodyMed, color: '#22C55E', fontSize: 13, fontWeight: '700' },
  safetyBannerSub: { ...Typography.caption, color: '#22C55E', opacity: 0.8, marginTop: 1 },
  section: { gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.5 },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tapHintText: { fontSize: 10, fontWeight: '600' },
  participantsRow: { gap: Spacing.sm, paddingVertical: 4 },
  soloBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  soloText: { ...Typography.bodySm, flex: 1, lineHeight: 18 },
  actionsGrid: { gap: Spacing.sm },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    borderRadius: 14,
    padding: 12,
  },
  safetyNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.1,
  },
  safetyNoticeBody: {
    fontSize: 11.5,
    color: 'rgba(245,158,11,0.75)',
    lineHeight: 17,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Ping.purple,
    height: 52,
    borderRadius: Radius.md,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  btnPrimaryText: { fontSize: 15, color: '#FFF', fontWeight: '700', letterSpacing: 0.2 },
  btnDisabled: { backgroundColor: '#2E2B4A', shadowOpacity: 0, elevation: 0 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.3)',
    backgroundColor: 'rgba(167,139,250,0.07)',
  },
  btnDanger: {
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.07)',
  },
  btnSecondaryText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  chatTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  chatTeaserLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chatTeaserIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTeaserTitle: { ...Typography.bodySm, color: '#E8E0FF', fontWeight: '700', fontSize: 13 },
  chatTeaserSub: { ...Typography.caption, color: '#9490C0', fontSize: 11, marginTop: 2 },
  chatTeaserLock: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(148,144,192,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Report / Profile menu sheet styles ───────────────────────────────────────

function makeRptStyles(isDark: boolean, c: typeof Colors.dark) {
  const sheetBg  = isDark ? '#11112A' : '#FFFFFF';
  const titleClr = isDark ? '#F1F0FF' : '#111111';
  const subClr   = isDark ? 'rgba(241,240,255,0.45)' : '#6B7280';
  const optionClr= isDark ? '#F1F0FF' : '#111111';
  const divider  = isDark ? 'rgba(167,139,250,0.1)' : 'rgba(0,0,0,0.07)';
  const handleBg = isDark ? 'rgba(167,139,250,0.3)' : 'rgba(0,0,0,0.15)';
  const cancelBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const cancelBorder = isDark ? 'rgba(167,139,250,0.15)' : 'rgba(0,0,0,0.1)';
  const cancelTxt = isDark ? 'rgba(241,240,255,0.6)' : '#6B7280';
  const topBorder = isDark ? 'rgba(167,139,250,0.15)' : 'rgba(0,0,0,0.08)';
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: sheetBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderColor: topBorder,
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: 36,
      alignItems: 'center',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: handleBg,
      marginBottom: Spacing.lg,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(239,68,68,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    title: {
      color: titleClr,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: -0.2,
      marginBottom: 4,
    },
    subtitle: {
      color: subClr,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingVertical: 14,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },
    optionText: {
      color: optionClr,
      fontSize: 15,
      fontWeight: '500',
    },
    cancelBtn: {
      marginTop: Spacing.md,
      width: '100%',
      height: 48,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cancelBg,
      borderWidth: 1,
      borderColor: cancelBorder,
    },
    cancelText: {
      color: cancelTxt,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}

function makeJcStyles(isDark: boolean) {
  const text    = isDark ? '#F1F0FF' : '#111111';
  const subText = isDark ? 'rgba(241,240,255,0.75)' : '#4B5563';
  const divider = isDark ? 'rgba(167,139,250,0.1)' : 'rgba(0,0,0,0.07)';
  const rowBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const disabledBg = isDark ? '#3A3A5C' : '#C4B5FD';
  return StyleSheet.create({
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      width: '100%',
      paddingVertical: 14,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: 'rgba(167,139,250,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    checkboxChecked: {
      backgroundColor: Ping.purple,
      borderColor: Ping.purple,
    },
    checkLabel: {
      flex: 1,
      color: text,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    rulesList: {
      width: '100%',
      gap: 10,
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: rowBg,
      borderRadius: 10,
      padding: 11,
    },
    ruleText: {
      flex: 1,
      color: subText,
      fontSize: 12.5,
      lineHeight: 18,
    },
    ruleBold: {
      color: text,
      fontWeight: '700',
    },
    confirmBtn: {
      marginTop: 8,
      width: '100%',
      height: 52,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Ping.purple,
      shadowColor: Ping.purple,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 8,
    },
    confirmBtnDisabled: {
      backgroundColor: disabledBg,
      shadowOpacity: 0,
      elevation: 0,
    },
    confirmBtnText: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
