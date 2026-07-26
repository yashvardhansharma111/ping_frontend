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
} from 'react-native';
import AppAvatar from '@/components/AppAvatar';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { chatApi, type ChatMessage, type ChatRoom } from '@/lib/api';
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

const MessageBubble = memo(function MessageBubble({
  msg,
  myId,
  isGroup,
}: {
  msg: LocalMessage;
  myId?: string;
  isGroup: boolean;
}) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
  const isMine = senderId === myId;

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

  return (
    <View style={[styles.bubbleRow, isMine ? styles.rowMine : styles.rowTheirs]}>
      {!isMine && (
        <AppAvatar
          uri={sender?.avatarUrl}
          name={senderName}
          size={28}
        />
      )}
      <View
        style={[
          styles.bubble,
          isMine
            ? styles.bubbleMine
            : [styles.bubbleTheirs, { backgroundColor: scheme === 'dark' ? '#1F1F36' : '#FFFFFF' }],
          msg.failed && styles.bubbleFailed,
          msg.pending && styles.bubblePending,
        ]}
      >
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
      </View>
    </View>
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);

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
  }, [roomId]);

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

  const sendBody = useCallback(async (body: string) => {
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
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');

    try {
      const res = await chatApi.sendMessage(roomId, body);
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
    sendBody(body);
  }, [text, sending, sendBody]);

  const retryFailed = useCallback((msg: LocalMessage) => {
    if (!msg.body || !msg.failed) return;
    setMessages((prev) => prev.filter((m) => m._id !== msg._id));
    sendBody(msg.body);
  }, [sendBody]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'sep') return <DateSeparator label={item.label} />;
      const bubble = (
        <MessageBubble msg={item.msg} myId={user?._id} isGroup={!!isGroup} />
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

  const ActivityFooter = useMemo(() => {
    if (!isActivityRoom || !(title || vibe || venue || creator)) return null;
    return (
      <View style={[styles.activityCard, { backgroundColor: `${typeColor}12`, borderColor: `${typeColor}30` }]}>
        <View style={[styles.activityAccent, { backgroundColor: typeColor }]} />
        {title ? (
          <View style={styles.activityTitleRow}>
            <Ionicons name={typeIcon} size={14} color={typeColor} />
            <Text style={[styles.activityTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
          </View>
        ) : null}
        <View style={styles.activityMeta}>
          {vibe ? (
            <Text style={[styles.activityMetaText, { color: typeColor }]}>
              {vibe.charAt(0).toUpperCase() + vibe.slice(1)}
            </Text>
          ) : null}
          {venue ? (
            <Text style={[styles.activityMetaText, { color: c.textSecondary }]} numberOfLines={1}>
              {venue}
            </Text>
          ) : null}
          {creator ? (
            <Text style={[styles.activityMetaText, { color: c.textSecondary }]}>{creator}</Text>
          ) : null}
        </View>
      </View>
    );
  }, [isActivityRoom, title, vibe, venue, creator, typeColor, typeIcon, c.text, c.textSecondary]);

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

        <TouchableOpacity
          style={styles.headerMid}
          activeOpacity={isGroup ? 0.7 : 1}
          disabled={!isGroup}
          onPress={() => {
            if (isGroup) router.push(`/chat/${roomId}/settings` as any);
          }}
        >
          <AppAvatar
            uri={dmOtherAvatar || room?.avatarUrl}
            name={dmOtherParticipant?.displayName || dmOtherParticipant?.username}
            icon={room?.kind === 'dm' ? 'person' : typeIcon}
            size={36}
            bg={`${typeColor}33`}
            tint={typeColor}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
              {roomTitle}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSub, { color: c.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {isGroup ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push(`/chat/${roomId}/settings` as any)}
            hitSlop={12}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={c.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
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
              ListFooterComponent={ActivityFooter}
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
            {!keyboardOpen && !text.trim() ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  activityAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityTitle: { ...Typography.bodyMed, fontSize: 14, fontWeight: '700', flex: 1 },
  activityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityMetaText: { ...Typography.caption, fontSize: 11 },
});
