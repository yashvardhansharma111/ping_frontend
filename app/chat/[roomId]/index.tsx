import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Image,
  Modal,
} from 'react-native';
import AppAvatar from '@/components/AppAvatar';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { chatApi, friendsApi, type ChatMessage, type ChatRoom } from '@/lib/api';
import Toast from 'react-native-toast-message';
import useAuthStore from '@/lib/stores/authStore';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };

type ListItem =
  | { kind: 'msg'; msg: LocalMessage }
  | { kind: 'sep'; label: string; id: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getRoomTitle(room: ChatRoom | null, myId?: string, fallbackTitle?: string) {
  if (!room) return fallbackTitle || 'Chat';
  if (room.kind === 'dm') {
    const other = room.participantIds.find((p) => p._id !== myId);
    return other?.displayName || other?.username || 'Chat';
  }
  return room.name || fallbackTitle || (room.kind === 'activity' ? 'Activity Chat' : 'Squad Chat');
}

function getRoomSubtitle(room: ChatRoom | null) {
  if (!room) return '';
  if (room.kind === 'dm') return 'Direct message';
  const count = room.participantIds.length;
  return `${count} participant${count === 1 ? '' : 's'}`;
}

/** Chronological messages → inverted list items (newest first). */
function buildListItems(messages: LocalMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      items.push({ kind: 'sep', label: d, id: `sep-${d}-${msg._id}` });
      lastDate = d;
    }
    items.push({ kind: 'msg', msg });
  }
  return items.reverse();
}

const DateSeparator = memo(function DateSeparator({ label }: { label: string }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  return (
    <View style={styles.sepRow}>
      <View style={[styles.sepPill, { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.sepLabel, { color: c.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
});

const SWIPE_THRESHOLD = 55;

const MessageBubble = memo(function MessageBubble({
  msg,
  myId,
  isGroup,
  onReply,
}: {
  msg: LocalMessage;
  myId?: string;
  isGroup: boolean;
  onReply: (msg: LocalMessage) => void;
}) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
  const isMine = senderId === myId;
  const translateX = useSharedValue(0);
  const triggered = useSharedValue(false);

  if (msg.type === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.systemText, { color: c.textSecondary }]}>{msg.body}</Text>
      </View>
    );
  }

  const sender = typeof msg.senderId === 'object' ? msg.senderId : null;
  const senderName = sender?.displayName || sender?.username || 'User';
  const bodyText =
    msg.body ||
    (msg.type === 'image' ? '📷 Photo' : msg.type === 'location' ? '📍 Location' : '');

  const quoted = msg.replyTo;
  const quotedSender = quoted?.senderId?.displayName || quoted?.senderId?.username || 'User';
  const quotedBody = quoted?.body || (quoted?.type === 'image' ? '📷 Photo' : '📍 Location');

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([SWIPE_THRESHOLD * -2, 8])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const dx = Math.max(0, e.translationX);
      translateX.value = Math.min(dx, SWIPE_THRESHOLD + 10);
      if (dx >= SWIPE_THRESHOLD && !triggered.value) {
        triggered.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onReply)(msg);
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 18, stiffness: 260 });
      triggered.value = false;
    });

  const bubbleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconOpacity = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / SWIPE_THRESHOLD, 1),
    transform: [{ scale: 0.7 + 0.3 * Math.min(translateX.value / SWIPE_THRESHOLD, 1) }],
  }));

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={[styles.bubbleRow, isMine ? styles.rowMine : styles.rowTheirs]}>
        {/* Reply icon peeks in from left as you swipe */}
        <Reanimated.View style={[styles.replyIcon, replyIconOpacity]}>
          <Ionicons name="return-down-forward" size={16} color={Ping.purpleLight} />
        </Reanimated.View>

        {!isMine && (
          <AppAvatar uri={sender?.avatarUrl} name={senderName} size={28} />
        )}

        <Reanimated.View
          style={[
            styles.bubble,
            isMine
              ? styles.bubbleMine
              : [styles.bubbleTheirs, { backgroundColor: scheme === 'dark' ? '#1F1F36' : '#FFFFFF' }],
            msg.failed && styles.bubbleFailed,
            msg.pending && styles.bubblePending,
            bubbleAnim,
          ]}
        >
          {/* Quoted message preview */}
          {quoted && (
            <View style={[
              styles.quotedWrap,
              { borderLeftColor: isMine ? 'rgba(255,255,255,0.5)' : Ping.purpleLight,
                backgroundColor: isMine ? 'rgba(0,0,0,0.18)' : scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
            ]}>
              <Text style={[styles.quotedSender, { color: isMine ? 'rgba(255,255,255,0.85)' : Ping.purpleLight }]} numberOfLines={1}>
                {quotedSender}
              </Text>
              <Text style={[styles.quotedBody, { color: isMine ? 'rgba(255,255,255,0.7)' : c.textSecondary }]} numberOfLines={2}>
                {quotedBody}
              </Text>
            </View>
          )}

          {!isMine && isGroup ? (
            <Text style={[styles.senderName, { color: Ping.purpleLight }]} numberOfLines={1}>
              {senderName}
            </Text>
          ) : null}
          <Text style={[styles.bubbleText, { color: isMine ? '#FFF' : c.text }]}>
            {bodyText}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.msgTime, { color: isMine ? 'rgba(255,255,255,0.7)' : c.textSecondary }]}>
              {formatTime(msg.createdAt)}
            </Text>
            {isMine ? (
              msg.failed ? (
                <Ionicons name="alert-circle" size={12} color="#FCA5A5" />
              ) : msg.pending ? (
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.65)" />
              ) : (
                <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.75)" />
              )
            ) : null}
          </View>
        </Reanimated.View>
      </View>
    </GestureDetector>
  );
});

type QuickAction = { label: string; icon: MCIName; msg: string };

const BASE_QUICK: QuickAction[] = [
  { label: 'On my way', icon: 'walk', msg: 'On my way!' },
  { label: "I'm here", icon: 'map-marker-check', msg: "I'm here!" },
  { label: 'Running late', icon: 'clock-alert-outline', msg: 'Running a bit late, sorry!' },
];

const TYPE_QUICK: Record<string, QuickAction[]> = {
  sport: [
    { label: "Let's go!", icon: 'lightning-bolt', msg: "Let's go!" },
    { label: 'Workout?', icon: 'dumbbell', msg: "What's the workout today?" },
  ],
  food: [
    { label: "What's on?", icon: 'food-fork-drink', msg: 'What are we eating?' },
    { label: "I'm hungry!", icon: 'food', msg: "I'm starving, let's eat!" },
  ],
  music: [
    { label: 'Vibe check', icon: 'music', msg: "What's the vibe tonight?" },
    { label: 'Hyped!', icon: 'music-note', msg: 'So hyped for this!' },
  ],
  study: [
    { label: 'Studying what?', icon: 'book-open-variant', msg: 'What are you studying today?' },
    { label: 'Coffee break?', icon: 'coffee', msg: 'Coffee break anyone?' },
  ],
  outdoor: [
    { label: 'Ready!', icon: 'hiking', msg: 'Ready for the adventure!' },
    { label: 'Weather?', icon: 'weather-partly-cloudy', msg: 'Weather looking good?' },
  ],
  gaming: [
    { label: 'Game on!', icon: 'gamepad-variant', msg: 'Game on!' },
    { label: "Let's win!", icon: 'trophy', msg: "Let's get that win!" },
  ],
  meetup: [
    { label: 'Hey everyone!', icon: 'account-group', msg: 'Hey everyone!' },
    { label: 'So excited!', icon: 'heart', msg: 'Super excited to meet you all!' },
  ],
};

function getQuickActions(type?: string): QuickAction[] {
  const extras = type && TYPE_QUICK[type]
    ? TYPE_QUICK[type]
    : [{ label: 'Sounds good!', icon: 'thumb-up' as MCIName, msg: 'Sounds good!' }];
  return [...extras, ...BASE_QUICK];
}

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  sport: 'barbell-outline', food: 'restaurant-outline', music: 'musical-notes-outline',
  study: 'book-outline', outdoor: 'walk-outline', gaming: 'game-controller-outline',
  meetup: 'people-outline',
};

const TYPE_COLORS: Record<string, string> = {
  sport: '#22C55E', food: '#F97316', music: '#8B5CF6', study: '#3B82F6',
  outdoor: '#10B981', gaming: '#EC4899', meetup: '#7C3AED',
};

export default function ChatRoomScreen() {
  const { roomId, type: pingType, title, vibe, venue, creator } =
    useLocalSearchParams<{
      roomId: string; type?: string; title?: string; vibe?: string; venue?: string; creator?: string;
    }>();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingLock = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<LocalMessage | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showDpViewer, setShowDpViewer] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);

  // UI-thread IME tracking — sticks to keyboard like WhatsApp (no JS lag)
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const composerH = useSharedValue(64);

  useAnimatedReaction(
    () => keyboard.height.value > 40,
    (open, prev) => {
      if (open !== prev) runOnJS(setKeyboardOpen)(open);
    },
  );

  const listAnimStyle = useAnimatedStyle(() => ({
    flex: 1,
    marginBottom: keyboard.height.value + composerH.value,
  }));

  const composerAnimStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value,
  }));

  const listItems = useMemo(() => buildListItems(messages), [messages]);
  const quickActions = useMemo(() => getQuickActions(pingType), [pingType]);
  const isGroup = room?.kind === 'activity' || room?.kind === 'squad';
  const isActivityRoom = room?.kind === 'activity';
  const typeColor = (pingType && TYPE_COLORS[pingType]) ? TYPE_COLORS[pingType] : Ping.purple;
  const typeIcon: React.ComponentProps<typeof Ionicons>['name'] =
    (pingType && TYPE_ICONS[pingType]) ? TYPE_ICONS[pingType] : 'flash';
  const roomTitle = getRoomTitle(room, user?._id, title);
  const subtitle = getRoomSubtitle(room);
  const dmOtherParticipant = room?.kind === 'dm'
    ? room.participantIds.find((p) => p._id !== user?._id)
    : null;
  const dmOtherAvatar = dmOtherParticipant?.avatarUrl ?? null;

  const mergeServerMessages = useCallback((server: ChatMessage[]) => {
    setMessages((prev) => {
      const localOnly = prev.filter((m) => m.pending || m.failed);
      const keepLocal = localOnly.filter((local) => {
        if (local.failed) return true;
        // Drop pending once the same text shows up from the server
        return !server.some((s) => {
          const sid = typeof s.senderId === 'object' ? s.senderId._id : s.senderId;
          return s.body === local.body && sid === user?._id;
        });
      });
      const next = [...server, ...keepLocal];
      if (
        next.length === prev.length &&
        next.every(
          (m, i) =>
            m._id === prev[i]._id &&
            !!m.pending === !!prev[i].pending &&
            !!m.failed === !!prev[i].failed,
        )
      ) {
        return prev;
      }
      return next;
    });
  }, [user?._id]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await chatApi.listMessages(roomId);
      mergeServerMessages(res.messages ?? []);
      if ((res.messages ?? []).length > 0) chatApi.markRead(roomId).catch(() => {});
    } catch {
      // keep stale
    }
  }, [roomId, mergeServerMessages]);

  const loadRoom = useCallback(async () => {
    const res = await chatApi.getRoom(roomId);
    setRoom(res.room);
    if (user?._id && res.room.mutedBy?.includes(user._id)) setMuted(true);
    else setMuted(false);
    if (res.room.kind === 'dm' && user?._id) {
      const other = res.room.participantIds.find((p) => p._id !== user._id);
      if (other) {
        friendsApi.blocked().then((r) => {
          setIsBlockedByMe(r.users.some((u) => u._id === other._id));
        }).catch(() => {});
      }
    }
  }, [roomId, user?._id]);

  useEffect(() => {
    setError(null);
    setLoading(true);
    Promise.all([loadRoom(), loadMessages()])
      .catch((e: any) => setError(e.message || 'Could not load chat'))
      .finally(() => setLoading(false));

    pollRef.current = setInterval(loadMessages, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [roomId, loadRoom, loadMessages]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) loadRoom().catch(() => {});
    }, [loadRoom, loading]),
  );

  const sendBody = useCallback(async (body: string, replyToMsg?: LocalMessage | null) => {
    if (!body || sendingLock.current || !user) return;
    sendingLock.current = true;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const tempId = `tmp-${Date.now()}`;
    const optimistic: LocalMessage = {
      _id: tempId,
      roomId,
      senderId: {
        _id: user._id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
      type: 'text',
      body,
      readBy: [],
      createdAt: new Date().toISOString(),
      pending: true,
      ...(replyToMsg ? {
        replyTo: {
          _id: replyToMsg._id,
          body: replyToMsg.body,
          type: replyToMsg.type,
          senderId: typeof replyToMsg.senderId === 'object'
            ? { _id: replyToMsg.senderId._id, displayName: replyToMsg.senderId.displayName, username: replyToMsg.senderId.username }
            : { _id: String(replyToMsg.senderId) },
        },
      } : {}),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setReplyingTo(null);

    try {
      const res = await chatApi.sendMessage(roomId, body, replyToMsg?._id);
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...res.message, pending: false } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, pending: false, failed: true } : m)),
      );
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  }, [roomId, user]);

  const pressSend = useCallback(() => {
    const body = text.trim();
    if (!body || sending) return;
    sendBody(body, replyingTo);
  }, [text, sending, sendBody, replyingTo]);

  const retryFailed = useCallback((msg: LocalMessage) => {
    if (!msg.body || !msg.failed) return;
    setMessages((prev) => prev.filter((m) => m._id !== msg._id));
    sendBody(msg.body);
  }, [sendBody]);

  const handleReply = useCallback((msg: LocalMessage) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  }, []);

  const handleClearChat = useCallback(async () => {
    setShowOptions(false);
    try {
      await chatApi.clearMessages(roomId);
      setMessages([]);
      Toast.show({ type: 'success', text1: 'Chat cleared' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not clear chat' });
    }
  }, [roomId]);

  const handleToggleMute = useCallback(async () => {
    setShowOptions(false);
    try {
      const res = await chatApi.toggleMute(roomId);
      setMuted(res.muted);
      Toast.show({ type: 'success', text1: res.muted ? 'Chat muted' : 'Chat unmuted' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not update mute' });
    }
  }, [roomId]);

  const handleBlock = useCallback(async () => {
    setShowOptions(false);
    if (!dmOtherParticipant?._id) return;
    try {
      await friendsApi.block(dmOtherParticipant._id);
      setIsBlockedByMe(true);
      setMessages([]);
      Toast.show({ type: 'success', text1: 'User blocked' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not block user' });
    }
  }, [dmOtherParticipant?._id]);

  const handleUnblock = useCallback(async () => {
    setShowOptions(false);
    if (!dmOtherParticipant?._id) return;
    try {
      await friendsApi.unblock(dmOtherParticipant._id);
      setIsBlockedByMe(false);
      Toast.show({ type: 'success', text1: 'User unblocked' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not unblock user' });
    }
  }, [dmOtherParticipant?._id]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'sep') return <DateSeparator label={item.label} />;
      const bubble = (
        <MessageBubble msg={item.msg} myId={user?._id} isGroup={!!isGroup} onReply={handleReply} />
      );
      if (item.msg.failed) {
        return (
          <Pressable onPress={() => retryFailed(item.msg)}>{bubble}</Pressable>
        );
      }
      return bubble;
    },
    [user?._id, isGroup, retryFailed],
  );

  const keyExtractor = useCallback(
    (item: ListItem) => (item.kind === 'msg' ? item.msg._id : item.id),
    [],
  );

  const ActivityHeader = useMemo(() => {
    if (!isActivityRoom || !(title || vibe || venue || creator)) return null;
    return (
      <View style={[styles.activityCard, {
        backgroundColor: scheme === 'dark' ? c.surface : '#FFFFFF',
        borderColor: c.border,
      }]}>
        {/* Type icon pill + title row */}
        <View style={styles.activityTitleRow}>
          <View style={[styles.activityIconPill, { backgroundColor: `${typeColor}20` }]}>
            <Ionicons name={typeIcon} size={15} color={typeColor} />
          </View>
          <Text style={[styles.activityTitle, { color: c.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.activityLiveBadge}>
            <View style={styles.activityLiveDot} />
            <Text style={styles.activityLiveText}>LIVE</Text>
          </View>
        </View>
        {/* Meta row */}
        {(venue || creator) ? (
          <View style={styles.activityMeta}>
            {venue ? (
              <View style={styles.activityMetaItem}>
                <Ionicons name="location-outline" size={11} color={c.textSecondary} />
                <Text style={[styles.activityMetaText, { color: c.textSecondary }]} numberOfLines={1}>{venue}</Text>
              </View>
            ) : null}
            {creator ? (
              <View style={styles.activityMetaItem}>
                <Ionicons name="person-outline" size={11} color={c.textSecondary} />
                <Text style={[styles.activityMetaText, { color: c.textSecondary }]}>{creator}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }, [isActivityRoom, title, vibe, venue, creator, typeColor, typeIcon, c, scheme]);

  return (
    <View style={[styles.root, { backgroundColor: scheme === 'dark' ? '#0B0B14' : '#EFEAE2' }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: scheme === 'dark' ? c.surface : '#F0F2F5',
            borderBottomColor: c.border,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={styles.headerMid}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              if (isGroup) router.push(`/chat/${roomId}/settings` as any);
              else if (dmOtherAvatar) setShowDpViewer(true);
            }}
            hitSlop={4}
          >
            <AppAvatar
              uri={dmOtherAvatar || room?.avatarUrl}
              name={dmOtherParticipant?.displayName || dmOtherParticipant?.username}
              icon={room?.kind === 'dm' ? 'person' : typeIcon}
              size={36}
              bg={`${typeColor}33`}
              tint={typeColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, minWidth: 0 }}
            activeOpacity={0.7}
            onPress={() => {
              if (isGroup) router.push(`/chat/${roomId}/settings` as any);
              else if (dmOtherParticipant?._id) router.push(`/user/${dmOtherParticipant._id}` as any);
            }}
          >
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
              {roomTitle}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSub, { color: c.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>

        {isGroup ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push(`/chat/${roomId}/settings` as any)}
            hitSlop={12}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={c.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setShowOptions(true)}
            hitSlop={12}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={c.text} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={typeColor} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: c.text }]}>Could not load chat</Text>
          <Text style={[styles.errorSub, { color: c.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: Ping.purple }]}
            onPress={() => {
              setError(null);
              setLoading(true);
              Promise.all([loadRoom(), loadMessages()])
                .catch((e: any) => setError(e.message || 'Could not load chat'))
                .finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Messages shrink above keyboard on the UI thread */}
          <Reanimated.View style={listAnimStyle}>
            {ActivityHeader}
            <FlatList
              data={listItems}
              inverted
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                listItems.length === 0 && styles.listEmpty,
              ]}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={40} color={c.textSecondary} />
                  <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                    No messages yet — say hi!
                  </Text>
                </View>
              }
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={20}
              maxToRenderPerBatch={16}
              windowSize={11}
            />
          </Reanimated.View>

          {/* Composer pinned to top of keyboard (WhatsApp-smooth) */}
          <Reanimated.View
            onLayout={(e) => {
              composerH.value = e.nativeEvent.layout.height;
            }}
            style={[
              styles.composerWrap,
              {
                backgroundColor: scheme === 'dark' ? c.surface : '#F0F2F5',
                borderTopColor: c.border,
              },
              composerAnimStyle,
            ]}
          >
            {/* Reply preview bar */}
            {replyingTo && (
              <View style={[styles.replyBar, { borderTopColor: c.border, backgroundColor: scheme === 'dark' ? '#16162A' : '#F0F0FA' }]}>
                <View style={[styles.replyBarAccent, { backgroundColor: Ping.purple }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.replyBarSender, { color: Ping.purpleLight }]} numberOfLines={1}>
                    {typeof replyingTo.senderId === 'object'
                      ? replyingTo.senderId.displayName || replyingTo.senderId.username
                      : 'User'}
                  </Text>
                  <Text style={[styles.replyBarBody, { color: c.textSecondary }]} numberOfLines={1}>
                    {replyingTo.body || (replyingTo.type === 'image' ? '📷 Photo' : '📍 Location')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={10}>
                  <Ionicons name="close" size={18} color={c.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {!keyboardOpen && !text.trim() && !replyingTo ? (
              <View style={[styles.quickBar, { borderBottomColor: c.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
                  {quickActions.map((qa) => (
                    <TouchableOpacity
                      key={qa.label}
                      style={[styles.quickPill, { borderColor: c.border, backgroundColor: scheme === 'dark' ? c.card : '#FFF' }]}
                      onPress={() => sendBody(qa.msg)}
                      disabled={sending}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name={qa.icon} size={13} color={c.tint} />
                      <Text style={[styles.quickText, { color: c.text }]}>{qa.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View
              style={[
                styles.composer,
                { paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8) },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    color: c.text,
                    backgroundColor: scheme === 'dark' ? '#1A1A2E' : '#FFFFFF',
                    borderColor: c.border,
                  },
                ]}
                placeholder="Message"
                placeholderTextColor={c.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={4000}
                blurOnSubmit={false}
                returnKeyType="default"
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!text.trim() || sending) && styles.sendBtnOff,
                ]}
                onPress={pressSend}
                disabled={!text.trim() || sending}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        </>
      )}

      {/* DM options sheet */}
      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <View style={dmOpt.container}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowOptions(false)}
          />
          <View style={[dmOpt.sheet, { backgroundColor: scheme === 'dark' ? '#1A1A2E' : '#FFFFFF', paddingBottom: insets.bottom + 8 }]}>
            <View style={[dmOpt.handle, { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]} />
            <TouchableOpacity style={dmOpt.row} onPress={handleClearChat} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={scheme === 'dark' ? '#E5E7EB' : '#374151'} />
              <Text style={[dmOpt.rowText, { color: scheme === 'dark' ? '#E5E7EB' : '#374151' }]}>Clear Chat</Text>
            </TouchableOpacity>
            <View style={[dmOpt.divider, { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
            <TouchableOpacity style={dmOpt.row} onPress={handleToggleMute} activeOpacity={0.7}>
              <Ionicons name={muted ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={scheme === 'dark' ? '#E5E7EB' : '#374151'} />
              <Text style={[dmOpt.rowText, { color: scheme === 'dark' ? '#E5E7EB' : '#374151' }]}>{muted ? 'Unmute Chat' : 'Mute Chat'}</Text>
            </TouchableOpacity>
            <View style={[dmOpt.divider, { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
            <TouchableOpacity style={dmOpt.row} onPress={isBlockedByMe ? handleUnblock : handleBlock} activeOpacity={0.7}>
              <Ionicons name={isBlockedByMe ? 'shield-checkmark-outline' : 'ban-outline'} size={20} color="#EF4444" />
              <Text style={[dmOpt.rowText, { color: '#EF4444' }]}>{isBlockedByMe ? 'Unblock User' : 'Block User'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DP full-screen viewer (DM only) */}
      {dmOtherAvatar ? (
        <Modal
          visible={showDpViewer}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDpViewer(false)}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={styles.dpBackdrop}
            activeOpacity={1}
            onPress={() => setShowDpViewer(false)}
          >
            <Image
              source={{ uri: dmOtherAvatar }}
              style={styles.dpFull}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.dpClose}
              onPress={() => setShowDpViewer(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpFull: {
    width: '100%',
    height: '80%',
  },
  dpClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMid: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { ...Typography.bodyMed, fontSize: 16, fontWeight: '600' },
  headerSub: { ...Typography.caption, fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  errorText: { ...Typography.bodyMed, fontWeight: '700' },
  errorSub: { ...Typography.bodySm, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  retryBtnText: { ...Typography.bodySm, color: '#FFF', fontWeight: '700' },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  composerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sepRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  sepPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  sepLabel: { ...Typography.caption, fontSize: 11, fontWeight: '600' },
  bubbleRow: {
    marginVertical: 2,
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  bubble: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 12,
  },
  bubbleMine: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
  },
  bubblePending: { opacity: 0.75 },
  bubbleFailed: { backgroundColor: '#B91C1C' },
  senderName: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  bubbleText: {
    ...Typography.bodySm,
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  msgTime: { fontSize: 10, fontWeight: '500' },
  replyIcon: {
    position: 'absolute',
    left: -28,
    top: '50%',
    marginTop: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotedWrap: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  quotedSender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  quotedBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBarAccent: {
    width: 3,
    height: 36,
    borderRadius: 2,
  },
  replyBarSender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyBarBody: {
    fontSize: 12,
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemText: {
    ...Typography.caption,
    fontSize: 12,
    textAlign: 'center',
  },
  quickBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  quickScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickText: { ...Typography.caption, fontWeight: '600', fontSize: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    minHeight: 42,
    fontSize: 15,
    lineHeight: 20,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  sendBtnOff: {
    backgroundColor: '#9CA3AF',
    opacity: 0.55,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: { ...Typography.bodySm, textAlign: 'center' },
  activityCard: {
    marginHorizontal: 4,
    marginBottom: 10,
    marginTop: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    paddingLeft: 14,
    gap: 6,
    overflow: 'hidden',
  },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityTitle: { ...Typography.bodyMed, fontSize: 14, fontWeight: '700', flex: 1 },
  activityIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(143,99,244,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activityLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#8F63F4',
  },
  activityLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8F63F4',
    letterSpacing: 0.8,
  },
  activityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  activityMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityMetaText: { ...Typography.caption, fontSize: 11 },
});

const dmOpt = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  rowText: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 22 },
});
