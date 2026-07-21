import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { activitiesApi, usersApi, type Activity, type User } from '@/lib/api';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tab = 'mine' | 'joined' | 'saved' | 'past';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'mine',   label: 'My Pings',  icon: 'flash'        },
  { key: 'joined', label: 'Joined',    icon: 'people'       },
  { key: 'saved',  label: 'Saved',     icon: 'bookmark'     },
  { key: 'past',   label: 'Past',      icon: 'time'         },
];

const SCREEN_W = Dimensions.get('window').width;

const TYPE_CFG: Record<string, { icon: MCIName; color: string }> = {
  sport:   { icon: 'dumbbell',          color: '#EF4444' },
  food:    { icon: 'food-fork-drink',   color: '#F97316' },
  music:   { icon: 'music',             color: '#8B5CF6' },
  study:   { icon: 'book-open-variant', color: '#3B82F6' },
  outdoor: { icon: 'walk',              color: '#10B981' },
  gaming:  { icon: 'gamepad-variant',   color: '#EC4899' },
  meetup:  { icon: 'account-group',     color: '#7C3AED' },
  default: { icon: 'map-marker',        color: '#6B7280' },
};

function PingRow({ activity, c }: { activity: Activity; c: (typeof Colors)['dark'] }) {
  const cfg = TYPE_CFG[activity.type] ?? TYPE_CFG.default;
  const isLive = activity.status === 'live' && new Date(activity.expiresAt) > new Date();
  const date = new Date(activity.startsAt ?? activity.expiresAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
  return (
    <View style={[pr.row, { borderBottomColor: c.border }]}>
      <View style={[pr.icon, { backgroundColor: `${cfg.color}18` }]}>
        <MaterialCommunityIcons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[pr.title, { color: c.text }]} numberOfLines={1}>{activity.title}</Text>
        <Text style={[pr.meta, { color: c.textSecondary }]}>
          {date} · {activity.participants?.length ?? 0} joined
        </Text>
      </View>
      {isLive ? (
        <View style={pr.liveBadge}>
          <Text style={pr.liveBadgeText}>LIVE</Text>
        </View>
      ) : activity.status === 'cancelled' ? (
        <View style={[pr.badge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
          <Text style={[pr.badgeText, { color: '#EF4444' }]}>Cancelled</Text>
        </View>
      ) : (
        <View style={[pr.badge, { backgroundColor: 'rgba(107,114,128,0.1)' }]}>
          <Text style={[pr.badgeText, { color: c.textSecondary }]}>Ended</Text>
        </View>
      )}
    </View>
  );
}

const pr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyMed, fontWeight: '600' },
  meta: { ...Typography.caption, marginTop: 2 },
  liveBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  liveBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  badge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '600' },
});

function SavedUserRow({ user, c, onPress }: { user: User; c: (typeof Colors)['dark']; onPress: () => void }) {
  const initials = (user.displayName ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <TouchableOpacity style={[su.row, { borderBottomColor: c.border }]} onPress={onPress} activeOpacity={0.75}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={su.avatar} />
      ) : (
        <View style={[su.avatarFallback, { backgroundColor: `${Ping.purple}55` }]}>
          <Text style={su.initials}>{initials}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[su.name, { color: c.text }]}>{user.displayName ?? 'User'}</Text>
        {user.username ? (
          <Text style={[su.username, { color: c.textSecondary }]}>@{user.username}</Text>
        ) : null}
        {user.bio ? (
          <Text style={[su.bio, { color: c.textSecondary }]} numberOfLines={1}>{user.bio}</Text>
        ) : null}
      </View>
      {user.city ? (
        <View style={[su.cityChip, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }]}>
          <Text style={[su.cityText, { color: '#10B981' }]}>{user.city}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={c.icon} />
    </TouchableOpacity>
  );
}

const su = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  name: { ...Typography.bodyMed, fontWeight: '700' },
  username: { ...Typography.caption, marginTop: 1 },
  bio: { ...Typography.caption, marginTop: 2 },
  cityChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  cityText: { fontSize: 11, fontWeight: '600' },
});

function EmptyState({ icon, title, c }: { icon: string; title: string; c: (typeof Colors)['dark'] }) {
  return (
    <View style={es.wrap}>
      <Ionicons name={icon as any} size={44} color={c.icon} />
      <Text style={[es.text, { color: c.textSecondary }]}>{title}</Text>
    </View>
  );
}
const es = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  text: { ...Typography.bodyMed, textAlign: 'center', maxWidth: 220 },
});

export default function MyActivityScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('mine');
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const [myPings, setMyPings] = useState<Activity[]>([]);
  const [joinedPings, setJoinedPings] = useState<Activity[]>([]);
  const [savedUsers, setSavedUsers] = useState<User[]>([]);
  const [pastPings, setPastPings] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const tabW = (SCREEN_W - Spacing.lg * 2) / TABS.length;

  useEffect(() => {
    Promise.all([
      activitiesApi.mine('all').then((r) => setMyPings(r.activities)).catch(() => {}),
      activitiesApi.joined().then((r) => setJoinedPings(r.activities)).catch(() => {}),
      usersApi.savedProfiles().then((r) => setSavedUsers(r.users)).catch(() => {}),
      activitiesApi.past().then((r) => setPastPings(r.activities)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function switchTab(key: Tab, idx: number) {
    setTab(key);
    Animated.spring(tabIndicator, {
      toValue: idx,
      damping: 20, stiffness: 260, mass: 0.8, useNativeDriver: true,
    }).start();
  }

  const indicatorX = tabIndicator.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, tabW, tabW * 2, tabW * 3],
  });

  function renderContent() {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Ping.purpleLight} size="large" />
        </View>
      );
    }

    if (tab === 'mine') {
      if (myPings.length === 0) return <EmptyState icon="flash-outline" title="You haven't created any pings yet" c={c} />;
      return (
        <FlatList
          data={myPings}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => <PingRow activity={item} c={c} />}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (tab === 'joined') {
      if (joinedPings.length === 0) return <EmptyState icon="people-outline" title="You haven't joined any pings yet" c={c} />;
      return (
        <FlatList
          data={joinedPings}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => <PingRow activity={item} c={c} />}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (tab === 'saved') {
      if (savedUsers.length === 0) return <EmptyState icon="bookmark-outline" title={"No saved profiles yet.\nBrowse pings to discover people!"} c={c} />;
      return (
        <FlatList
          data={savedUsers}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <SavedUserRow
              user={item}
              c={c}
              onPress={() => router.push(`/user/${item._id}` as any)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (tab === 'past') {
      if (pastPings.length === 0) return <EmptyState icon="time-outline" title="No past meetups yet" c={c} />;
      return (
        <FlatList
          data={pastPings}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => <PingRow activity={item} c={c} />}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    return null;
  }

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>My Activity</Text>
        <View style={{ width: 46 }} />
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={s.tabRow}>
          {TABS.map(({ key, label, icon }, idx) => {
            const active = tab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.tabBtn, { width: tabW }]}
                onPress={() => switchTab(key, idx)}
                activeOpacity={0.75}
              >
                <Ionicons name={icon as any} size={18} color={active ? Ping.purpleLight : c.icon} />
                <Text style={[s.tabLabel, { color: active ? Ping.purpleLight : c.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.indicatorTrack}>
          <Animated.View
            style={[s.indicator, { width: tabW, transform: [{ translateX: indicatorX }] }]}
          />
        </View>
      </View>

      {/* Content */}
      {renderContent()}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3 },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg },
  tabBtn: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  tabLabel: { ...Typography.caption, fontWeight: '700', fontSize: 11 },
  indicatorTrack: {
    height: 3,
    marginHorizontal: Spacing.lg,
    position: 'relative',
  },
  indicator: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Ping.purple,
    position: 'absolute',
    bottom: 0,
  },
});
