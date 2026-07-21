import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi, friendsApi, reportsApi, chatApi, activitiesApi, type UserProfile, type Activity } from '@/lib/api';
import HighlightsSection from '@/components/HighlightsSection';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ShareSheet from '@/components/ShareSheet';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PHOTO_H = SCREEN_H * 0.70;

const TYPE_CFG: Record<string, { icon: MCIName; color: string }> = {
  sport:   { icon: 'dumbbell',          color: '#EF4444' },
  food:    { icon: 'food-fork-drink',   color: '#F97316' },
  music:   { icon: 'music',             color: '#8B5CF6' },
  study:   { icon: 'book-open-variant', color: '#3B82F6' },
  outdoor: { icon: 'walk',             color: '#10B981' },
  gaming:  { icon: 'gamepad-variant',  color: '#EC4899' },
  meetup:  { icon: 'account-group',    color: '#7C3AED' },
  default: { icon: 'map-marker',       color: '#6B7280' },
};

// ── Photo carousel ──────────────────────────────────────────────────────────

function PhotoCarousel({ avatarUrl, photos, initials }: { avatarUrl?: string; photos?: string[]; initials: string }) {
  const [active, setActive] = useState(0);
  const allPhotos = [avatarUrl, ...(photos ?? [])].filter(Boolean) as string[];

  if (allPhotos.length === 0) {
    return (
      <View style={[pc.single, { backgroundColor: '#1A1A2E' }]}>
        <Text style={pc.initials}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={pc.wrap}>
      <FlatList
        data={allPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        renderItem={({ item }) => <Image source={{ uri: item }} style={pc.photo} resizeMode="cover" />}
        keyExtractor={(_, i) => String(i)}
      />
      {allPhotos.length > 1 && (
        <View style={pc.dots}>
          {allPhotos.map((_, i) => (
            <View key={i} style={[pc.dot, i === active && pc.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  wrap: { width: SCREEN_W, height: PHOTO_H },
  photo: { width: SCREEN_W, height: PHOTO_H },
  single: { width: SCREEN_W, height: PHOTO_H, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 80, fontWeight: '800', color: '#FFF' },
  dots: { position: 'absolute', top: 20, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 16 },
});

// ── Star display ─────────────────────────────────────────────────────────────

function StarDisplay({ value, count }: { value: number; count: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rounded ? 'star' : rounded === n - 0.5 ? 'star-half' : 'star-outline'} size={13} color="#FBBF24" />
      ))}
      <Text style={{ color: '#FBBF24', fontWeight: '700', fontSize: 12, marginLeft: 2 }}>{value.toFixed(1)}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>({count})</Text>
    </View>
  );
}

function getAge(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

// ── Invite to Ping sheet ─────────────────────────────────────────────────────

function InviteToPingSheet({ visible, targetUserId, targetName, onClose }: {
  visible: boolean; targetUserId: string; targetName: string; onClose: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    activitiesApi.mine()
      .then((r) => setActivities(r.activities.filter((a) => !a.status || a.status === 'live')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  async function invite(activity: Activity) {
    if (inviting) return;
    setInviting(activity._id);
    try {
      const { room } = await chatApi.openDm(targetUserId);
      const time = new Date(activity.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      await chatApi.sendMessage(room._id, `Hey! 👋 I'd like to invite you to my ping: "${activity.title}" — starting at ${time}. Would love to have you there!`);
      onClose();
      router.push(`/chat/${room._id}` as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not send invite.' });
    } finally {
      setInviting(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={inv.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[inv.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={inv.header}>
            <Text style={inv.title}>Invite to a Ping</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color="#9CA3AF" /></TouchableOpacity>
          </View>
          <Text style={inv.sub}>Pick one of your active pings to invite {targetName}:</Text>
          {loading ? (
            <ActivityIndicator color={Ping.purpleLight} style={{ padding: 40 }} />
          ) : activities.length === 0 ? (
            <View style={inv.empty}>
              <Ionicons name="flash-outline" size={36} color="#5C5A80" />
              <Text style={inv.emptyText}>No active pings. Drop one on the map first.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={inv.list} showsVerticalScrollIndicator={false}>
              {activities.map((activity) => {
                const cfg = TYPE_CFG[activity.type] ?? TYPE_CFG.default;
                return (
                  <TouchableOpacity
                    key={activity._id}
                    style={[inv.pingRow, { borderColor: `${cfg.color}40`, opacity: inviting === activity._id ? 0.5 : 1 }]}
                    onPress={() => invite(activity)}
                    disabled={!!inviting}
                    activeOpacity={0.75}
                  >
                    <View style={[inv.pingIcon, { backgroundColor: `${cfg.color}20` }]}>
                      <MaterialCommunityIcons name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={inv.pingTitle}>{activity.title}</Text>
                      <Text style={inv.pingMeta}>{new Date(activity.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {activity.participants?.length ?? 0} joined</Text>
                    </View>
                    {inviting === activity._id
                      ? <ActivityIndicator size="small" color={Ping.purpleLight} />
                      : <Ionicons name="paper-plane-outline" size={18} color={Ping.purpleLight} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const inv = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#11112A', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(167,139,250,0.12)' },
  title: { color: '#F1F0FF', fontSize: 17, fontWeight: '700' },
  sub: { color: '#9490C0', fontSize: 13, paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 4 },
  list: { padding: Spacing.md, gap: 10 },
  pingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A38', borderRadius: 14, padding: 14, borderWidth: 1 },
  pingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pingTitle: { color: '#F1F0FF', fontWeight: '600', fontSize: 14 },
  pingMeta: { color: '#9490C0', fontSize: 12, marginTop: 2 },
  empty: { padding: 40, alignItems: 'center', gap: 10 },
  emptyText: { color: '#5C5A80', textAlign: 'center', lineHeight: 20 },
});

// ── Main profile screen ───────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const router = useRouter();
  const { user: me } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [mutualCount, setMutualCount] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [recentPings, setRecentPings] = useState<Activity[]>([]);
  const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  useEffect(() => {
    usersApi.getProfile(userId)
      .then((res) => {
        setProfile(res.user);
        if (res.user.friendshipStatus !== 'self') {
          friendsApi.mutual(userId).then((r) => setMutualCount(r.count)).catch(() => {});
        }
        activitiesApi.byUser(userId).then((r) => setRecentPings(r.activities)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const initials = (profile?.displayName ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  async function sendRequest() {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    try {
      await friendsApi.send(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'pending_sent' } : p);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not send request.' }); }
    finally { setActionLoading(false); }
  }

  async function acceptRequest() {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    try {
      await friendsApi.accept(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'accepted' } : p);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message }); }
    finally { setActionLoading(false); }
  }

  async function removeFriend() {
    if (!profile || actionLoading) return;
    setShowRemoveFriendConfirm(true);
  }

  async function doRemoveFriend() {
    if (!profile) return;
    setActionLoading(true);
    try {
      await friendsApi.remove(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'none' } : p);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message }); }
    finally { setActionLoading(false); }
  }

  async function openDm() {
    if (!profile || dmLoading) return;
    setDmLoading(true);
    try {
      const { room } = await chatApi.openDm(profile._id);
      router.push(`/chat/${room._id}` as any);
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not open chat.' }); }
    finally { setDmLoading(false); }
  }

  async function toggleSave() {
    if (!profile || saveLoading) return;
    setSaveLoading(true);
    try {
      if (profile.isSaved) {
        await usersApi.unsaveProfile(profile._id);
        setProfile((p) => p ? { ...p, isSaved: false } : p);
      } else {
        await usersApi.saveProfile(profile._id);
        setProfile((p) => p ? { ...p, isSaved: true } : p);
      }
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not update.' }); }
    finally { setSaveLoading(false); }
  }

  async function doBlockUser() {
    if (!profile) return;
    try { await friendsApi.block(profile._id); router.back(); }
    catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message }); }
  }

  function handleMoreOptions() {
    if (!profile) return;
    setShowBlockConfirm(true);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Ping.purpleLight} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Ionicons name="person-outline" size={48} color="#555" />
        <Text style={{ color: '#888', ...Typography.bodyMed }}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing.sm }}>
          <Text style={{ color: Ping.purpleLight }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSelf = profile.friendshipStatus === 'self';
  const isAccepted = profile.friendshipStatus === 'accepted';
  const isPendingSent = profile.friendshipStatus === 'pending_sent';
  const isPendingReceived = profile.friendshipStatus === 'pending_received';
  const isVerified = profile.verificationStatus === 'verified';
  const age = getAge(profile.dob);
  const genderLabel = profile.gender === 'male' ? 'Male' : profile.gender === 'female' ? 'Female' : profile.gender === 'other' ? 'Other' : null;

  const allTags = [
    ...(profile.hobbies ?? []).map((h) => `#${h}`),
    ...(profile.vibePreferences ?? []).map((v) => `#${v}`),
    ...(profile.favoriteActivities ?? []).map((fa) => `#${fa}`),
  ];

  return (
    <View style={s.root}>
      {/* ── Floating header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>
        {profile.username ? (
          <Text style={s.headerHandle}>@{profile.username}</Text>
        ) : <View />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => setShowShare(true)} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="share-outline" size={19} color="#FFF" />
          </TouchableOpacity>
          {!isSelf && (
            <TouchableOpacity onPress={handleMoreOptions} hitSlop={12} style={s.headerBtn}>
              <Ionicons name="ellipsis-vertical" size={18} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ── Full-screen photo with gradient + info overlay ── */}
        <View style={{ height: PHOTO_H }}>
          <PhotoCarousel avatarUrl={profile.avatarUrl} photos={profile.photos} initials={initials} />

          {/* Dark gradient from bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.93)']}
            locations={[0.35, 0.65, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Info overlaid at bottom of photo */}
          <View style={s.overlay}>
            {/* Name + verified */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={s.name}>{profile.displayName ?? 'User'}</Text>
              {isVerified && (
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              )}
            </View>

            {/* Handle + age/gender */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {profile.username ? <Text style={s.handle}>@{profile.username}</Text> : null}
              {(age || genderLabel) ? (
                <Text style={s.handleMeta}>
                  {[genderLabel, age ? `${age} yrs` : null].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {profile.city ? <Text style={s.handleMeta}>📍 {profile.city}</Text> : null}
            </View>

            {/* Bio */}
            {profile.bio ? (
              <Text style={s.bio} numberOfLines={2}>"{profile.bio}"</Text>
            ) : null}

            {/* Stats row */}
            <View style={s.statsRow}>
              {mutualCount !== null && mutualCount > 0 && (
                <>
                  <View style={s.statItem}>
                    <Text style={s.statNum}>{mutualCount}</Text>
                    <Text style={s.statLabel}>Mutuals</Text>
                  </View>
                  <View style={s.statDivider} />
                </>
              )}
              {(profile.completedPingsCount ?? 0) > 0 && (
                <>
                  <View style={s.statItem}>
                    <Text style={s.statNum}>{profile.completedPingsCount}</Text>
                    <Text style={s.statLabel}>Pings</Text>
                  </View>
                  <View style={s.statDivider} />
                </>
              )}
              {profile.averageRating !== null && profile.averageRating !== undefined && (profile.ratingCount ?? 0) > 0 ? (
                <View style={s.statItem}>
                  <StarDisplay value={profile.averageRating} count={profile.ratingCount!} />
                  <Text style={s.statLabel}>Rating</Text>
                </View>
              ) : profile.trustRate !== undefined ? (
                <View style={s.statItem}>
                  <Text style={[s.statNum, { color: profile.trustRate > 70 ? '#22C55E' : profile.trustRate > 40 ? '#F59E0B' : '#9CA3AF' }]}>
                    {profile.trustRate}%
                  </Text>
                  <Text style={s.statLabel}>Trust</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Hashtag chips ── */}
        {allTags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tagsRow}
          >
            {allTags.map((tag) => (
              <View key={tag} style={s.tagChip}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Additional meta row ── */}
        {(profile.occupation || profile.institute || profile.instagramHandle) && (
          <View style={s.metaRow}>
            {profile.occupation && (
              <View style={s.metaItem}>
                <Text style={s.metaEmoji}>
                  {profile.occupation === 'job' ? '👨‍💻' : profile.occupation === 'student' ? '🎓' : profile.occupation === 'founder' ? '🚀' : profile.occupation === 'business' ? '💼' : profile.occupation === 'freelancer' ? '🖥️' : '🌍'}
                </Text>
                <Text style={s.metaText}>
                  {profile.occupation === 'job' ? 'Working' : profile.occupation === 'student' ? 'Student' : profile.occupation === 'founder' ? 'Founder' : profile.occupation === 'business' ? 'Business' : profile.occupation === 'freelancer' ? 'Freelancer' : 'Exploring'}
                </Text>
              </View>
            )}
            {profile.institute && (
              <View style={s.metaItem}>
                <Ionicons name="school-outline" size={13} color="#A78BFA" />
                <Text style={s.metaText} numberOfLines={1}>{profile.institute}</Text>
              </View>
            )}
            {profile.instagramHandle && (
              <View style={s.metaItem}>
                <MaterialCommunityIcons name="instagram" size={13} color="#E1306C" />
                <Text style={[s.metaText, { color: '#E1306C' }]}>@{profile.instagramHandle}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Highlights ── */}
        <HighlightsSection userId={userId} isOwnProfile={isSelf} scheme={scheme} />

        {/* ── Ping pitch / fun truth ── */}
        {(profile.pingPitch || profile.funTruth) && (
          <View style={s.quotesSection}>
            {profile.pingPitch && (
              <View style={s.pitchCard}>
                <Text style={s.pitchQuote}>"</Text>
                <Text style={s.pitchText}>{profile.pingPitch}</Text>
              </View>
            )}
            {profile.funTruth && (
              <View style={s.truthCard}>
                <Text style={s.truthLabel}>Fun truth 😂</Text>
                <Text style={s.truthText}>{profile.funTruth}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Recent Pings ── */}
        {recentPings.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recent Pings</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: Spacing.lg }}>
              {recentPings.slice(0, 6).map((ping) => {
                const cfg = TYPE_CFG[ping.type] ?? TYPE_CFG.default;
                const isLive = ping.status === 'live' && new Date(ping.expiresAt) > new Date();
                return (
                  <View key={ping._id} style={[s.pingCard, { borderColor: `${cfg.color}30` }]}>
                    <View style={[s.pingCardIcon, { backgroundColor: `${cfg.color}18` }]}>
                      <MaterialCommunityIcons name={cfg.icon} size={18} color={cfg.color} />
                    </View>
                    <Text style={s.pingCardTitle} numberOfLines={2}>{ping.title}</Text>
                    <Text style={s.pingCardMeta}>{ping.participants?.length ?? 0} joined</Text>
                    {isLive && (
                      <View style={s.liveDot}>
                        <View style={[s.liveDotInner, { backgroundColor: cfg.color }]} />
                        <Text style={[s.liveText, { color: cfg.color }]}>LIVE</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* ── Fixed action buttons at bottom ── */}
      {!isSelf && (
        <View style={[s.bottomActions, { paddingBottom: insets.bottom + 12 }]}>
          {/* Primary CTA */}
          {profile.friendshipStatus === 'none' && (
            <TouchableOpacity style={s.btnPrimary} onPress={sendRequest} disabled={actionLoading} activeOpacity={0.88}>
              {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="person-add" size={17} color="#FFF" />
                  <Text style={s.btnPrimaryText}>Add Friend</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {isPendingReceived && (
            <TouchableOpacity style={s.btnPrimary} onPress={acceptRequest} disabled={actionLoading} activeOpacity={0.88}>
              {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={17} color="#FFF" />
                  <Text style={s.btnPrimaryText}>Accept Request</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {isPendingSent && (
            <View style={[s.btnOutline, { opacity: 0.65 }]}>
              <Ionicons name="time-outline" size={17} color="rgba(255,255,255,0.6)" />
              <Text style={s.btnOutlineText}>Request Sent</Text>
            </View>
          )}
          {isAccepted && (
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btnHalf, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={openDm} disabled={dmLoading} activeOpacity={0.85}>
                {dmLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <>
                    <Ionicons name="chatbubble-outline" size={17} color="#FFF" />
                    <Text style={s.btnHalfText}>Message</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={() => setShowInvite(true)} activeOpacity={0.85}>
                <Ionicons name="flash-outline" size={17} color="#FFF" />
                <Text style={s.btnPrimaryText}>Invite to Ping</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Secondary row for non-friends */}
          {(profile.friendshipStatus === 'none' || isPendingSent) && (
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btnHalf, { backgroundColor: 'rgba(255,255,255,0.08)' }]} onPress={openDm} disabled={dmLoading} activeOpacity={0.85}>
                {dmLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <>
                    <Ionicons name="chatbubble-outline" size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={[s.btnHalfText, { color: 'rgba(255,255,255,0.7)' }]}>Message</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnHalf, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: profile.isSaved ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.15)' }]}
                onPress={toggleSave} disabled={saveLoading} activeOpacity={0.85}
              >
                {saveLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <>
                    <Ionicons name={profile.isSaved ? 'bookmark' : 'bookmark-outline'} size={16} color={profile.isSaved ? '#FB923C' : 'rgba(255,255,255,0.7)'} />
                    <Text style={[s.btnHalfText, { color: profile.isSaved ? '#FB923C' : 'rgba(255,255,255,0.7)' }]}>{profile.isSaved ? 'Saved' : 'Save'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {/* Remove friend (accepted) */}
          {isAccepted && (
            <TouchableOpacity style={[s.btnOutline, { marginTop: -4 }]} onPress={removeFriend} disabled={actionLoading} activeOpacity={0.85}>
              <Ionicons name="person-remove-outline" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={[s.btnOutlineText, { color: 'rgba(255,255,255,0.5)' }]}>Remove Friend</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <InviteToPingSheet
        visible={showInvite}
        targetUserId={profile._id}
        targetName={profile.displayName ?? 'them'}
        onClose={() => setShowInvite(false)}
      />

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        content={{
          type: 'profile',
          title: profile.displayName ?? 'Ping user',
          subtitle: profile.username ? `@${profile.username}` : undefined,
          emoji: '👤',
          body: profile.bio ? profile.bio : `Check out ${profile.displayName ?? 'someone'} on Ping!`,
        }}
      />

      <ConfirmSheet
        visible={showRemoveFriendConfirm}
        onClose={() => setShowRemoveFriendConfirm(false)}
        title="Remove friend?"
        subtitle={`Remove ${profile.displayName ?? 'this user'} from your friends?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onConfirm={() => { setShowRemoveFriendConfirm(false); doRemoveFriend(); }}
        icon="person-remove-outline"
      />

      <ConfirmSheet
        visible={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        title={`Block ${profile.displayName ?? 'this user'}?`}
        subtitle="They won't see your pings or contact you."
        confirmLabel="Block"
        cancelLabel="Cancel"
        danger
        onConfirm={() => { setShowBlockConfirm(false); doBlockUser(); }}
        icon="ban-outline"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Floating header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerHandle: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  // Photo overlay info
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 22,
    gap: 6,
  },
  name: { fontSize: 36, fontWeight: '800', color: '#FFF', letterSpacing: -0.5, lineHeight: 42 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#3B82F6', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verifiedText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  handle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
  handleMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  bio: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 2 },

  // Stats row on photo
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  statItem: { alignItems: 'flex-start', gap: 1 },
  statNum: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Hashtag chips
  tagsRow: { paddingHorizontal: Spacing.lg, paddingVertical: 14, gap: 7, flexDirection: 'row' },
  tagChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  tagText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

  // Meta row
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: Spacing.lg, paddingBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaEmoji: { fontSize: 13 },
  metaText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },

  // Quotes
  quotesSection: { paddingHorizontal: Spacing.lg, gap: 10, paddingVertical: 4 },
  pitchCard: {
    backgroundColor: 'rgba(139,92,246,0.1)', borderLeftWidth: 3,
    borderLeftColor: Ping.purple, borderRadius: 8, padding: 14, gap: 4,
  },
  pitchQuote: { fontSize: 22, color: Ping.purpleLight, lineHeight: 20, fontWeight: '800' },
  pitchText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
  truthCard: {
    backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', padding: 14, gap: 4,
  },
  truthLabel: { color: '#FBBF24', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  truthText: { color: 'rgba(229,216,138,0.85)', fontSize: 13, lineHeight: 20 },

  // Section
  section: { marginTop: Spacing.md },
  sectionTitle: {
    color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: Spacing.lg, marginBottom: 10,
  },

  // Ping cards
  pingCard: {
    width: 130, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1, padding: 12, gap: 8,
  },
  pingCardIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pingCardTitle: { color: '#FFF', fontWeight: '600', fontSize: 12, lineHeight: 16 },
  pingCardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDotInner: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Bottom actions
  bottomActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 50, borderRadius: Radius.full,
    backgroundColor: '#FFF',
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#000' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  btnOutlineText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  btnHalf: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 50, borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  btnHalfText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
