import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { activitiesApi, friendsApi, storiesApi, uploadApi, type Activity, type Friendship, type StoryGroup } from '@/lib/api';
import { Ping, Colors, Spacing, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import { useLocation } from '@/hooks/useLocation';
import StoryViewer, { STORY_RING } from '@/components/StoryViewer';

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

// ── Add-story source picker ────────────────────────────────────────────────────
function AddStorySheet({ visible, onClose, onPick, isDark }: {
  visible: boolean; onClose: () => void; onPick: (src: 'camera' | 'library') => void; isDark: boolean;
}) {
  const bg = isDark ? '#16131F' : '#FFFFFF';
  const text = isDark ? '#F1F0FF' : '#111111';
  const sub = isDark ? '#9490C0' : '#6F6866';
  const Row = ({ icon, label, hint, src }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; hint: string; src: 'camera' | 'library' }) => (
    <TouchableOpacity style={[s.addRow, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} onPress={() => onPick(src)} activeOpacity={0.8}>
      <View style={[s.addRowIcon, { backgroundColor: `${Ping.purple}1F` }]}>
        <Ionicons name={icon} size={20} color={isDark ? Ping.purpleLight : Ping.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.addRowLabel, { color: text }]}>{label}</Text>
        <Text style={[s.addRowHint, { color: sub }]}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={sub} />
    </TouchableOpacity>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.addRoot}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose} />
        <View style={[s.addCard, { backgroundColor: bg }]}>
          <View style={s.addHandle} />
          <Text style={[s.addTitle, { color: text }]}>Add to your story</Text>
          <Text style={[s.addSub, { color: sub }]}>Friends can see it for 24 hours.</Text>
          <Row icon="camera" label="Take a photo" hint="Open the camera" src="camera" />
          <Row icon="images" label="Choose from gallery" hint="Pick an existing photo" src="library" />
        </View>
      </View>
    </Modal>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StoryStrip() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const router = useRouter();
  const { user } = useAuthStore();
  const { coords } = useLocation();

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [recentPings, setRecentPings] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewer, setViewer] = useState<{ open: boolean; start: number }>({ open: false, start: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadStories = useCallback(() => {
    storiesApi.feed().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    friendsApi.list().then((r) => setFriends(r.friends ?? [])).catch(() => {});
    activitiesApi.nearby(coords.latitude, coords.longitude, 5000)
      .then((r) => setRecentPings((r.activities ?? []).slice(0, 8)))
      .catch(() => {});
  }, [coords.latitude, coords.longitude]);

  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  const myName = user?.displayName ?? user?.username ?? 'Me';
  const myAvatar = (user as any)?.avatarUrl ?? null;
  const myGroupIdx = groups.findIndex((g) => g.isSelf);
  const myGroup = myGroupIdx >= 0 ? groups[myGroupIdx] : null;
  const friendGroups = groups.filter((g) => !g.isSelf);
  const withStories = new Set(friendGroups.map((g) => String(g.user._id)));

  async function pickAndUpload(src: 'camera' | 'library') {
    setAddOpen(false);
    try {
      const perm = src === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission needed', text2: src === 'camera' ? 'Allow camera access to take a photo.' : 'Allow photo access to pick an image.' });
        return;
      }
      const result = src === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'stories');
      await storiesApi.create({ mediaUrl: url });
      loadStories();
      Toast.show({ type: 'success', text1: 'Story added', text2: 'Your friends can see it for 24 hours.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not add story', text2: e?.message || 'Try again.' });
    } finally {
      setUploading(false);
    }
  }

  function markViewed(storyId: string) {
    setGroups((prev) => prev.map((g) => {
      if (!g.stories.some((st) => st._id === storyId)) return g;
      const stories = g.stories.map((st) => (st._id === storyId ? { ...st, seen: true } : st));
      return { ...g, stories, hasUnseen: stories.some((st) => !st.seen) };
    }));
  }

  function dropStory(storyId: string) {
    setGroups((prev) => prev
      .map((g) => ({ ...g, stories: g.stories.filter((st) => st._id !== storyId) }))
      .filter((g) => g.stories.length > 0));
  }

  return (
    <View style={s.root}>
      {/* ── Stories row ── */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Stories</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.storiesRow}
      >
        {/* Your story — tap to view (if any) or add; the + always adds */}
        <View style={s.bubble}>
          <TouchableOpacity
            onPress={() => (myGroup ? setViewer({ open: true, start: myGroupIdx }) : setAddOpen(true))}
            activeOpacity={0.8}
            disabled={uploading}
          >
            <View style={s.ringOuter}>
              <View style={[s.ringWrap, myGroup
                ? { borderColor: STORY_RING.unseen, borderWidth: 2 }
                : { borderColor: Ping.purple, borderWidth: 2, borderStyle: 'dashed' }]}>
                <View style={[s.avatarCircle, { backgroundColor: `${Ping.purple}22` }]}>
                  {myAvatar ? (
                    <Image source={{ uri: myAvatar }} style={s.avatarImg} />
                  ) : (
                    <Text style={[s.avatarLetter, { color: Ping.purple }]}>{myName[0]?.toUpperCase()}</Text>
                  )}
                  {uploading && (
                    <View style={s.uploadOverlay}><ActivityIndicator color="#FFF" size="small" /></View>
                  )}
                </View>
              </View>
              <TouchableOpacity style={s.addBadge} onPress={() => setAddOpen(true)} hitSlop={6} disabled={uploading}>
                <Ionicons name="add" size={11} color="#FFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          <Text style={[s.bubbleName, { color: Ping.purpleLight }]}>Your story</Text>
        </View>

        {/* Friends with active stories */}
        {friendGroups.map((g, i) => (
          <StoryBubble
            key={`story-${g.user._id}`}
            uri={g.user.avatarUrl}
            name={g.user.displayName ?? g.user.username ?? 'User'}
            hasRing
            ringColor={g.hasUnseen ? STORY_RING.unseen : STORY_RING.seen}
            delay={i * 40}
            onPress={() => setViewer({ open: true, start: groups.indexOf(g) })}
          />
        ))}

        {/* Friends without stories — open profile */}
        {friends.filter((f) => f.friend && !withStories.has(String(f.friend._id))).slice(0, 12).map((f, i) => {
          const u = f.friend;
          return (
            <StoryBubble
              key={u._id}
              uri={u.avatarUrl}
              name={u.displayName ?? u.username ?? 'User'}
              delay={(friendGroups.length + i) * 40}
              onPress={() => router.push(`/user/${u._id}`)}
            />
          );
        })}
      </ScrollView>

      <AddStorySheet visible={addOpen} onClose={() => setAddOpen(false)} onPick={pickAndUpload} isDark={isDark} />

      <StoryViewer
        visible={viewer.open}
        groups={groups}
        startGroup={viewer.start}
        onClose={() => setViewer({ open: false, start: 0 })}
        onViewed={markViewed}
        onDeleted={dropStory}
      />

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
  ringOuter: { position: 'relative' },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

  // Add-story sheet
  addRoot: { flex: 1, justifyContent: 'flex-end' },
  addCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 8 },
  addHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,144,192,0.4)', marginBottom: 10 },
  addTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  addSub: { fontSize: 12, marginBottom: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  addRowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addRowLabel: { fontSize: 14, fontWeight: '700' },
  addRowHint: { fontSize: 12, marginTop: 1 },
  addBadge: {
    position: 'absolute',
    bottom: 3,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F0F1A',
    zIndex: 2,
    elevation: 3,
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
