import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
          <Text style={[styles.systemText, { color: c.textSecondary }]}>{msg.body}</Text>
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
          <Text style={[styles.senderName, { color: c.tint }]}>{senderName}</Text>
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

const VIBE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  cozy: 'cafe-outline', fun: 'happy-outline', exciting: 'flash-outline',
  chill: 'leaf-outline', networking: 'business-outline', fitness: 'barbell-outline',
};

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
    useLocalSearchParams<{ roomId: string; type?: string; title?: string; vibe?: string; venue?: string; creator?: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef(0);

  // Screen entrance animations
  const screenAnim  = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(-16)).current;
  const inputAnim   = useRef(new Animated.Value(20)).current;
  const sendScale   = useRef(new Animated.Value(1)).current;
  const cardAnim    = useRef(new Animated.Value(0)).current;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    // Allow to throw so the initial Promise.all catch can surface it
    const res = await chatApi.getRoom(roomId);
    setRoom(res.room);
  }

  function runEntrance() {
    Animated.parallel([
      Animated.spring(screenAnim, { toValue: 1, damping: 20, stiffness: 200, mass: 0.9, useNativeDriver: true }),
      Animated.spring(headerAnim, { toValue: 0, damping: 18, stiffness: 220, delay: 60,  useNativeDriver: true }),
      Animated.spring(inputAnim,  { toValue: 0, damping: 18, stiffness: 220, delay: 100, useNativeDriver: true }),
    ]).start();
  }

  useEffect(() => {
    runEntrance();
    setError(null);
    Promise.all([loadRoom(), loadMessages()])
      .then(() => {
        Animated.spring(cardAnim, { toValue: 1, damping: 18, stiffness: 200, delay: 160, useNativeDriver: true }).start();
      })
      .catch((e: any) => {
        setError(e.message || 'Could not load chat');
      })
      .finally(() => setLoading(false));
    pollRef.current = setInterval(loadMessages, 5000);

    // Scroll to bottom when keyboard opens so the latest message stays visible
    const kbSub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      kbSub.remove();
    };
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  function pressSend() {
    if (!text.trim() || sending) return;
    Animated.sequence([
      Animated.spring(sendScale, { toValue: 0.82, damping: 20, stiffness: 500, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1,    damping: 14, stiffness: 220, mass: 0.8, useNativeDriver: true }),
    ]).start();
    send();
  }

  const roomTitle = getRoomTitle(room, user?._id);
  const subtitle = getRoomSubtitle(room);
  const listItems = buildListItems(messages);
  const quickActions = getQuickActions(pingType);
  const isActivityRoom = room?.kind === 'activity';
  const typeColor = (pingType && TYPE_COLORS[pingType]) ? TYPE_COLORS[pingType] : Ping.purple;
  const typeIcon: React.ComponentProps<typeof Ionicons>['name'] = (pingType && TYPE_ICONS[pingType]) ? TYPE_ICONS[pingType] : 'flash';

  // Activity info card — animated entrance after messages load
  const ActivityInfoCard = isActivityRoom && (title || vibe || venue || creator) ? (
    <Animated.View
      style={{
        opacity: cardAnim,
        transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }}
    >
      <View style={[styles.activityCard, { backgroundColor: `${typeColor}12`, borderColor: `${typeColor}30` }]}>
        <View style={[styles.activityCardAccent, { backgroundColor: typeColor }]} />
        <View style={{ flex: 1, gap: 6 }}>
          {title ? (
            <View style={styles.activityCardRow}>
              <View style={[styles.activityCardIconWrap, { backgroundColor: `${typeColor}22` }]}>
                <Ionicons name={typeIcon} size={14} color={typeColor} />
              </View>
              <Text style={[styles.activityCardTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
            </View>
          ) : null}
          <View style={styles.activityCardMeta}>
            {vibe ? (
              <View style={[styles.activityMetaChip, { backgroundColor: `${typeColor}18` }]}>
                <Ionicons name={VIBE_ICON[vibe] ?? 'sparkles-outline'} size={11} color={typeColor} />
                <Text style={[styles.activityMetaText, { color: typeColor }]}>{vibe.charAt(0).toUpperCase() + vibe.slice(1)}</Text>
              </View>
            ) : null}
            {venue ? (
              <View style={[styles.activityMetaChip, { backgroundColor: `${c.textSecondary}22` }]}>
                <Ionicons name="location-outline" size={11} color={c.textSecondary} />
                <Text style={[styles.activityMetaText, { color: c.textSecondary }]} numberOfLines={1}>{venue}</Text>
              </View>
            ) : null}
            {creator ? (
              <View style={[styles.activityMetaChip, { backgroundColor: `${c.textSecondary}22` }]}>
                <Ionicons name="person-outline" size={11} color={c.textSecondary} />
                <Text style={[styles.activityMetaText, { color: c.textSecondary }]}>{creator}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  ) : null;

  return (
    <Animated.View
      style={[
        { flex: 1 },
        {
          opacity: screenAnim,
          transform: [
            { translateY: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            { scale:      screenAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}
    >
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {/* Header — slides down on enter */}
      <Animated.View
        style={[
          styles.header,
          { borderBottomColor: c.border, backgroundColor: c.background, paddingTop: insets.top + 12 },
          { transform: [{ translateY: headerAnim }] },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={styles.headerMid}>
          <View style={[styles.headerAvatar, { backgroundColor: `${typeColor}33` }]}>
            <Ionicons
              name={room?.kind === 'dm' ? 'person' : typeIcon}
              size={14}
              color={typeColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
              {room?.kind === 'dm' ? roomTitle : (title || roomTitle)}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSub, { color: c.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <View style={[styles.loadingCard, { backgroundColor: c.card }]}>
            <View style={[styles.loadingIconWrap, { backgroundColor: `${typeColor}22` }]}>
              <Ionicons name={typeIcon} size={28} color={typeColor} />
            </View>
            <ActivityIndicator color={typeColor} size="small" style={{ marginTop: 4 }} />
            {title ? (
              <Text style={[styles.loadingTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
            ) : null}
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading chat…</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={[styles.loadingCard, { backgroundColor: c.card }]}>
            <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
            <Text style={[styles.loadingTitle, { color: c.text }]}>Could not load chat</Text>
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: Ping.purple }]}
              onPress={() => {
                setError(null);
                setLoading(true);
                Promise.all([loadRoom(), loadMessages()])
                  .then(() => {
                    Animated.spring(cardAnim, { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }).start();
                  })
                  .catch((e: any) => setError(e.message || 'Could not load chat'))
                  .finally(() => setLoading(false));
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={listItems}
          keyExtractor={(item) => item.kind === 'msg' ? item.msg._id : item.id}
          contentContainerStyle={[styles.msgList, messages.length === 0 && { flex: 1 }]}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={ActivityInfoCard}
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
              <View style={[styles.emptyIconWrap, { backgroundColor: `${typeColor}22` }]}>
                <Ionicons name="chatbubbles" size={36} color={typeColor} />
              </View>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                No messages yet — say hi!
              </Text>
            </View>
          }
        />
      )}

      {/* Quick actions + input bar — slides up on enter */}
      <Animated.View style={{ transform: [{ translateY: inputAnim }] }}>
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
                <MaterialCommunityIcons name={qa.icon} size={13} color={c.tint} />
                <Text style={[styles.quickText, { color: c.tint }]}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom || Spacing.sm }]}>
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
            onSubmitEditing={pressSend}
          />
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && [styles.sendBtnDisabled, { backgroundColor: c.card }]]}
              onPress={pressSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={16} color="#FFF" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
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
    paddingBottom: Spacing.lg,
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
  loadingCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    minWidth: 200,
  },
  loadingIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  loadingTitle: { ...Typography.bodyMed, fontWeight: '700', textAlign: 'center' },
  loadingText: { ...Typography.bodySm, textAlign: 'center' },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: Radius.full,
  },
  retryBtnText: { ...Typography.bodySm, color: '#FFF', fontWeight: '700' },
  activityCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  activityCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  activityCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityCardIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardTitle: {
    ...Typography.bodyMed,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  activityCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activityMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(148,144,192,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  activityMetaText: { ...Typography.caption, color: '#9490C0', fontSize: 11 },
});
