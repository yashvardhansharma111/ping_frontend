import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi, type ChatRoom } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import SkeletonList from '@/components/SkeletonLoader';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | 'activity' | 'dm';

function relativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function getRoomName(room: ChatRoom, myId?: string) {
  if (room.kind === 'dm') {
    const other = room.participantIds.find((p) => p._id !== myId);
    return other?.displayName || other?.username || 'User';
  }
  if (room.kind === 'activity') return 'Activity Chat';
  if (room.kind === 'squad') return 'Squad Chat';
  return 'Chat';
}

const KIND_META: Record<string, { icon: IoniconName; bg: string; tint: string }> = {
  dm:       { icon: 'person',        bg: '#3B82F622', tint: '#60A5FA' },
  activity: { icon: 'flash',         bg: `${Ping.purple}33`, tint: Ping.purpleLight },
  squad:    { icon: 'shield',        bg: '#10B98122', tint: '#34D399' },
};

function RoomRow({ room, myId, onPress }: { room: ChatRoom; myId?: string; onPress: () => void }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const name = getRoomName(room, myId);
  const meta = KIND_META[room.kind] ?? KIND_META.activity;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.tint} />
      </View>

      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={[styles.roomName, { color: c.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.time, { color: c.textSecondary }]}>{relativeTime(room.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.preview, { color: c.textSecondary }]} numberOfLines={1}>
          {room.lastMessagePreview || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  async function load() {
    try {
      const res = await chatApi.listRooms();
      setRooms(res.rooms ?? []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered =
    filter === 'all'
      ? rooms
      : rooms.filter((r) => (filter === 'activity' ? r.kind === 'activity' : r.kind === 'dm'));

  const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'activity', label: 'Activities' },
    { key: 'dm', label: 'DMs' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>Messages</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Pill filter tabs */}
      <View style={styles.tabsWrap}>
        <View style={[styles.tabsTrack, { backgroundColor: c.surface }]}>
          {TABS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabPill, filter === key && { backgroundColor: Ping.purple }]}
              onPress={() => setFilter(key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: filter === key ? '#FFF' : c.textSecondary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <SkeletonList count={5} variant="chat" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${Ping.purple}22` }]}>
            <Ionicons name="chatbubbles" size={40} color={Ping.purpleLight} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No chats yet</Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>
            Join an activity to start chatting with others
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r._id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <RoomRow
              room={item}
              myId={user?._id}
              onPress={() => router.push(`/chat/${item._id}`)}
            />
          )}
        />
      )}
    </View>
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
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  title: { ...Typography.h3, fontSize: 20 },
  tabsWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  tabsTrack: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 4,
    gap: 2,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  tabText: { ...Typography.bodySm, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  roomName: { ...Typography.bodyMed, flex: 1, marginRight: Spacing.sm },
  time: { ...Typography.caption, fontSize: 11 },
  preview: { ...Typography.bodySm, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.bodyMed, fontSize: 18 },
  emptySub: { ...Typography.bodySm, textAlign: 'center', lineHeight: 20 },
});
