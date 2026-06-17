import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
import { chatApi, type ChatMessage, type ChatRoom } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

function getRoomTitle(room: ChatRoom | null, myId?: string) {
  if (!room) return 'Chat';
  if (room.kind === 'dm') {
    const other = room.participantIds.find((p) => p._id !== myId);
    return other?.displayName || other?.username || 'Chat';
  }
  if (room.kind === 'activity') return 'Activity Chat';
  return 'Squad Chat';
}

function getRoomSubtitle(room: ChatRoom | null) {
  if (!room) return '';
  const count = room.participantIds.length;
  if (room.kind === 'dm') return 'Direct message';
  return `${count} participant${count === 1 ? '' : 's'}`;
}

function DateSeparator({ label }: { label: string }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  return (
    <View style={sep.row}>
      <View style={[sep.line, { backgroundColor: c.border }]} />
      <Text style={[sep.label, { color: c.textSecondary, backgroundColor: c.background }]}>{label}</Text>
      <View style={[sep.line, { backgroundColor: c.border }]} />
    </View>
  );
}

const sep = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, paddingHorizontal: Spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  label: { ...Typography.caption, paddingHorizontal: Spacing.sm, fontSize: 11 },
});

// Colour palette for sender avatars (cycles by name hash)
const AVATAR_COLORS = ['#7C3AED', '#F97316', '#22C55E', '#3B82F6', '#EC4899', '#10B981', '#EF4444', '#8B5CF6'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function MessageBubble({ msg, myId, animate }: { msg: ChatMessage; myId?: string; animate?: boolean }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const senderId = typeof msg.senderId === 'object' ? (msg.senderId as any)._id : msg.senderId;
  const isMine = senderId === myId;

  const slideAnim = useRef(new Animated.Value(animate ? 18 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 260, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  if (msg.type === 'system') {
    return (
      <View style={styles.systemRow}>
        <View style={[styles.systemLine, { backgroundColor: c.border }]} />
        <View style={[styles.systemPill, { backgroundColor: 'rgba(124,58,237,0.1)', borderColor: 'rgba(124,58,237,0.22)' }]}>
          <Text style={[styles.systemText, { color: '#9490C0' }]}>{msg.body}</Text>
        </View>
        <View style={[styles.systemLine, { backgroundColor: c.border }]} />
      </View>
    );
  }

  const sender = typeof msg.senderId === 'object' ? (msg.senderId as any) : null;
  const senderName = sender?.displayName || sender?.username || 'User';
  const bodyText =
    msg.body ||
    (msg.type === 'image' ? '📷 Photo' : msg.type === 'location' ? '📍 Location' : '');
  const initials = senderName[0].toUpperCase();
  const bg = avatarColor(senderName);

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        isMine ? styles.mine : styles.theirs,
        { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {!isMine && (
        <View style={styles.senderRow}>
          <View style={[styles.senderAvatar, { backgroundColor: `${bg}33`, borderColor: `${bg}66` }]}>
            <Text style={[styles.senderAvatarText, { color: bg }]}>{initials}</Text>
          </View>
          <Text style={[styles.senderName, { color: Ping.purpleLight }]}>{senderName}</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isMine
            ? styles.bubbleMine
            : [styles.bubbleTheirs, { backgroundColor: c.card, borderColor: c.border }],
        ]}
      >
        <Text style={[styles.bubbleText, { color: isMine ? '#FFF' : c.text }]}>
          {bodyText}
        </Text>
      </View>
      <Text style={[styles.msgTime, { color: c.textSecondary }, isMine && { alignSelf: 'flex-end' }]}>
        {formatTime(msg.createdAt)}
      </Text>
    </Animated.View>
  );
}

type ListItem =
  | { kind: 'msg'; msg: ChatMessage }
  | { kind: 'sep'; label: string; id: string };

function buildListItems(messages: ChatMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      items.push({ kind: 'sep', label: d, id: `sep-${msg._id}` });
      lastDate = d;
    }
    items.push({ kind: 'msg', msg });
  }
  return items;
}

type QuickAction = { label: string; icon: MCIName; msg: string };

const BASE_QUICK: QuickAction[] = [
  { label: 'On my way',    icon: 'walk',                  msg: 'On my way!'                  },
  { label: "I'm here",     icon: 'map-marker-check',      msg: "I'm here!"                   },
  { label: 'Running late', icon: 'clock-alert-outline',   msg: 'Running a bit late, sorry!'  },
];

const TYPE_QUICK: Record<string, QuickAction[]> = {
  sport:   [
    { label: "Let's go!",     icon: 'lightning-bolt',  msg: "Let's go!"                    },
    { label: 'Workout?',      icon: 'dumbbell',        msg: "What's the workout today?"    },
  ],
  food:    [
    { label: "What's on?",   icon: 'food-fork-drink', msg: "What are we eating?"          },
    { label: "I'm hungry!",  icon: 'food',            msg: "I'm starving, let's eat!"     },
  ],
  music:   [
    { label: "Vibe check",   icon: 'music',           msg: "What's the vibe tonight?"     },
    { label: 'Hyped!',       icon: 'music-note',      msg: 'So hyped for this!'           },
  ],
  study:   [
    { label: 'Studying what?', icon: 'book-open-variant', msg: "What are you studying today?" },
    { label: 'Coffee break?',  icon: 'coffee',            msg: 'Coffee break anyone?'         },
  ],
  outdoor: [
    { label: "Ready!",       icon: 'hiking',                  msg: 'Ready for the adventure!'  },
    { label: 'Weather?',     icon: 'weather-partly-cloudy',   msg: 'Weather looking good?'     },
  ],
  gaming:  [
    { label: 'Game on!',     icon: 'gamepad-variant',  msg: 'Game on!'                    },
    { label: "Let's win!",   icon: 'trophy',           msg: "Let's get that win!"         },
  ],
  meetup:  [
    { label: 'Hey everyone!', icon: 'account-group',  msg: 'Hey everyone!'                },
    { label: 'So excited!',   icon: 'heart',          msg: 'Super excited to meet you all!' },
  ],
};

function getQuickActions(type?: string): QuickAction[] {
  const extras = type && TYPE_QUICK[type] ? TYPE_QUICK[type] : [{ label: 'Sounds good!', icon: 'thumb-up' as MCIName, msg: 'Sounds good!' }];
  return [...extras, ...BASE_QUICK];
}

export default function ChatRoomScreen() {
  const { roomId, type: pingType } = useLocalSearchParams<{ roomId: string; type?: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuthStore();
  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef(0);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const newMsgIdsRef = useRef<Set<string>>(new Set());

  async function loadMessages() {
    try {
      const res = await chatApi.listMessages(roomId);
      const msgs = res.messages ?? [];
      // Track IDs that are brand-new since last load (animate them in)
      if (lastCountRef.current > 0 && msgs.length > lastCountRef.current) {
        const knownCount = lastCountRef.current;
        msgs.slice(knownCount).forEach((m) => newMsgIdsRef.current.add(m._id));
        setTimeout(() => {
          newMsgIdsRef.current.clear();
        }, 600);
      }
      setMessages(msgs);
      if (msgs.length !== lastCountRef.current) {
        lastCountRef.current = msgs.length;
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
      }
      if (msgs.length > 0) chatApi.markRead(roomId).catch(() => {});
    } catch {
      // keep stale
    }
  }

  async function loadRoom() {
    try {
      const res = await chatApi.getRoom(roomId);
      setRoom(res.room);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    Promise.all([loadRoom(), loadMessages()]).finally(() => setLoading(false));
    pollRef.current = setInterval(loadMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [roomId]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setText('');
    try {
      await chatApi.sendMessage(roomId, body);
      await loadMessages();
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function sendQuick(msg: string) {
    if (sending) return;
    setSending(true);
    try {
      await chatApi.sendMessage(roomId, msg);
      await loadMessages();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  const title = getRoomTitle(room, user?._id);
  const subtitle = getRoomSubtitle(room);
  const listItems = buildListItems(messages);
  const quickActions = getQuickActions(pingType);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={styles.headerMid}>
          <View style={[styles.headerAvatar, { backgroundColor: `${Ping.purple}33` }]}>
            <Ionicons
              name={room?.kind === 'dm' ? 'person' : 'flash'}
              size={14}
              color={Ping.purpleLight}
            />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.headerSub, { color: c.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Ping.purpleLight} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={listItems}
          keyExtractor={(item) => item.kind === 'msg' ? item.msg._id : item.id}
          contentContainerStyle={[styles.msgList, messages.length === 0 && { flex: 1 }]}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) =>
            item.kind === 'sep' ? (
              <DateSeparator label={item.label} />
            ) : (
              <MessageBubble
                msg={item.msg}
                myId={user?._id}
                animate={newMsgIdsRef.current.has(item.msg._id)}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${Ping.purple}22` }]}>
                <Ionicons name="chatbubbles" size={36} color={Ping.purpleLight} />
              </View>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                No messages yet — say hi!
              </Text>
            </View>
          }
        />
      )}

      {/* Quick actions */}
      <View style={[styles.quickBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
          {quickActions.map((qa) => (
            <TouchableOpacity
              key={qa.label}
              style={[styles.quickPill, { borderColor: `${Ping.purple}55`, backgroundColor: `${Ping.purple}18` }]}
              onPress={() => sendQuick(qa.msg)}
              disabled={sending}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={qa.icon} size={13} color={Ping.purpleLight} />
              <Text style={[styles.quickText, { color: Ping.purpleLight }]}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <TextInput
          style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
          placeholder="Message..."
          placeholderTextColor={c.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="send" size={16} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36 },
  headerMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.bodyMed, fontSize: 16 },
  headerSub: { ...Typography.caption, fontSize: 11, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  bubbleWrap: { marginBottom: 8, maxWidth: '80%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  senderAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  senderAvatarText: { fontSize: 10, fontWeight: '800' },
  senderName: { ...Typography.caption, fontWeight: '600' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  bubbleMine: {
    backgroundColor: Ping.purple,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  bubbleTheirs: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: { ...Typography.bodySm, lineHeight: 20 },
  msgTime: { ...Typography.caption, fontSize: 10, marginTop: 3, marginHorizontal: 4 },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginVertical: 10,
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  systemLine: { flex: 1, height: StyleSheet.hairlineWidth },
  systemPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    maxWidth: '72%',
  },
  systemText: { ...Typography.caption, fontSize: 11, textAlign: 'center', color: '#9490C0' },
  quickBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs,
  },
  quickScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  quickText: { ...Typography.caption, fontWeight: '600', fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    ...Typography.bodySm,
    lineHeight: 20,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  sendBtnDisabled: {
    backgroundColor: '#3A3A5C',
    shadowOpacity: 0,
    elevation: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { ...Typography.bodySm, textAlign: 'center' },
});
