import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activitiesApi, friendsApi, type Activity, type Friendship } from '@/lib/api';
import { Ping, Colors, Spacing, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import { useLocation } from '@/hooks/useLocation';

const AVATAR_COLORS = ['#7C3AED', '#F97316', '#22C55E', '#3B82F6', '#EC4899', '#10B981'];

const PING_TYPE_EMOJI: Record<string, string> = {
  sport: '🏃', food: '🍜', music: '🎧', study: '📚',
  outdoor: '🌿', gaming: '🎮', meetup: '👋', custom: '✨',
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── Story bubble (friend avatar with ring) ────────────────────────────────────
function StoryBubble({
  uri, name, hasRing, ringColor = Ping.purple, onPress, delay = 0,
}: {
  uri?: string | null; name: string; hasRing?: boolean;
  ringColor?: string; onPress: () => void; delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, damping: 16, stiffness: 180, delay, useNativeDriver: true }).start();
  }, []);

  const letter = name ? name[0].toUpperCase() : '?';
  const bg = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim }] }}>
      <TouchableOpacity style={s.bubble} onPress={onPress} activeOpacity={0.8}>
        <View style={[s.ringWrap, hasRing && { borderColor: ringColor, borderWidth: 2 }]}>
          <View style={[s.avatarCircle, { backgroundColor: `${bg}44` }]}>
            {uri ? (
              <Image source={{ uri }} style={s.avatarImg} />
            ) : (
              <Text style={[s.avatarLetter, { color: bg }]}>{letter}</Text>
            )}
          </View>
        </View>
        <Text style={s.bubbleName} numberOfLines={1}>{name.split(' ')[0]}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Ping highlight card ────────────────────────────────────────────────────────
function PingCard({ activity, onPress, isDark }: { activity: Activity; onPress: () => void; isDark: boolean }) {
  const emoji = PING_TYPE_EMOJI[activity.type] ?? '📍';
  const isLive = activity.status === 'live' || (() => {
    const now = Date.now();
    return new Date(activity.startsAt).getTime() <= now && new Date(activity.expiresAt).getTime() > now;
  })();

  return (
    <TouchableOpacity
      style={[s.pingCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F5F3FF', borderColor: isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.12)' }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {activity.imageUrl ? (
        <Image source={{ uri: activity.imageUrl }} style={s.pingCardCover} resizeMode="cover" />
      ) : (
        <View style={[s.pingCardCoverPlaceholder, { backgroundColor: `${Ping.purple}18` }]}>
          <Text style={s.pingCardEmoji}>{emoji}</Text>
        </View>
      )}
      <View style={s.pingCardBody}>
        {isLive && (
          <View style={s.liveChip}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        )}
        <Text style={[s.pingCardTitle, { color: isDark ? '#F1F0FF' : '#1C1040' }]} numberOfLines={2}>{activity.title}</Text>
        {activity.placeName ? (
          <Text style={[s.pingCardVenue, { color: isDark ? 'rgba(241,240,255,0.45)' : '#9CA3AF' }]} numberOfLines={1}>
            📍 {activity.placeName}
          </Text>
        ) : null}
        <Text style={[s.pingCardTime, { color: isDark ? 'rgba(241,240,255,0.35)' : '#9CA3AF' }]}>
          {timeAgo(activity.startsAt)} · {activity.participants?.length ?? 0} going
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StoryStrip({ onCreatePing }: { onCreatePing?: () => void }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const router = useRouter();
  const { user } = useAuthStore();
  const { coords } = useLocation();

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [recentPings, setRecentPings] = useState<Activity[]>([]);

  useEffect(() => {
    friendsApi.list().then((r) => setFriends(r.friends ?? [])).catch(() => {});
    activitiesApi.nearby(coords.latitude, coords.longitude, 5000)
      .then((r) => setRecentPings((r.activities ?? []).slice(0, 8)))
      .catch(() => {});
  }, [coords.latitude, coords.longitude]);

  const myName = user?.displayName ?? user?.username ?? 'Me';
  const myAvatar = (user as any)?.avatarUrl ?? null;

  return (
    <View style={s.root}>
      {/* ── Friends row ── */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Friends</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.storiesRow}
      >
        {/* Your story / create ping */}
        <TouchableOpacity style={s.bubble} onPress={onCreatePing} activeOpacity={0.8}>
          <View style={[s.ringWrap, { borderColor: Ping.purple, borderWidth: 2, borderStyle: 'dashed' }]}>
            <View style={[s.avatarCircle, { backgroundColor: `${Ping.purple}22` }]}>
              {myAvatar ? (
                <Image source={{ uri: myAvatar }} style={s.avatarImg} />
              ) : (
                <Text style={[s.avatarLetter, { color: Ping.purple }]}>{myName[0]?.toUpperCase()}</Text>
              )}
              <View style={s.addBadge}>
                <Ionicons name="add" size={10} color="#FFF" />
              </View>
            </View>
          </View>
          <Text style={[s.bubbleName, { color: Ping.purpleLight }]}>Your Ping</Text>
        </TouchableOpacity>

        {friends.slice(0, 12).map((f, i) => {
          const u = f.friend;
          if (!u) return null;
          return (
            <StoryBubble
              key={u._id}
              uri={u.avatarUrl}
              name={u.displayName ?? u.username ?? 'User'}
              hasRing={i < 5}
              ringColor={i % 2 === 0 ? Ping.purple : '#EC4899'}
              delay={i * 40}
              onPress={() => router.push(`/user/${u._id}`)}
            />
          );
        })}
      </ScrollView>

      {/* ── Recent pings highlights ── */}
      {recentPings.length > 0 && (
        <>
          <View style={[s.sectionHeader, { marginTop: 16 }]}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Recent Pings</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore' as any)} activeOpacity={0.7}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pingsRow}
          >
            {recentPings.map((a) => (
              <PingCard
                key={a._id}
                activity={a}
                isDark={isDark}
                onPress={() => router.push('/(tabs)/explore' as any)}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  seeAll: { fontSize: 13, color: Ping.purpleLight, fontWeight: '600' },

  // Stories
  storiesRow: { paddingHorizontal: Spacing.lg, gap: 16 },
  bubble: { alignItems: 'center', width: 62 },
  ringWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 0,
    marginBottom: 5,
  },
  avatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 999 },
  avatarLetter: { fontSize: 20, fontWeight: '700' },
  bubbleName: { fontSize: 11, fontWeight: '600', color: '#9490C0', textAlign: 'center', maxWidth: 62 },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F0F1A',
  },

  // Ping cards
  pingsRow: { paddingHorizontal: Spacing.lg, gap: 12 },
  pingCard: {
    width: 160,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pingCardCover: { width: '100%', height: 90 },
  pingCardCoverPlaceholder: {
    width: '100%',
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingCardEmoji: { fontSize: 30 },
  pingCardBody: { padding: 10, gap: 3 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 8, fontWeight: '800', color: '#EF4444', letterSpacing: 0.5 },
  pingCardTitle: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  pingCardVenue: { fontSize: 11, marginTop: 1 },
  pingCardTime: { fontSize: 11 },
});
