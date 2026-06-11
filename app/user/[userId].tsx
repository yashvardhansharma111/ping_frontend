import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, friendsApi, reportsApi, type UserProfile } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function TrustBar({ value = 100 }: { value?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct > 70 ? Ping.green : pct > 40 ? Ping.orange : Ping.red;
  return (
    <View style={trust.wrap}>
      <View style={trust.track}>
        <View style={[trust.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[trust.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const trust = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.15)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  label: { ...Typography.caption, fontWeight: '700', minWidth: 30, textAlign: 'right' },
});

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const { user: me } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    usersApi.getProfile(userId)
      .then((res) => setProfile(res.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const initials = (profile?.displayName ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function sendRequest() {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    try {
      await friendsApi.send(profile._id);
      setProfile((p) => p ? { ...p, friendshipStatus: 'pending_sent' } : p);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send request.');
    } finally {
      setActionLoading(false);
    }
  }

  async function removeFriend() {
    if (!profile || actionLoading) return;
    Alert.alert('Remove friend?', `Remove ${profile.displayName ?? 'this user'} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await friendsApi.remove(profile._id);
            setProfile((p) => p ? { ...p, friendshipStatus: 'none' } : p);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  function handleMoreOptions() {
    if (!profile) return;
    const name = profile.displayName ?? 'this user';
    Alert.alert(`Options for ${name}`, undefined, [
      {
        text: 'Report user',
        onPress: () => {
          Alert.alert('Report user', 'What\'s the issue?', [
            { text: 'Inappropriate behaviour', onPress: () => reportsApi.create('user', profile._id, 'inappropriate').catch(() => {}) },
            { text: 'Felt unsafe', onPress: () => reportsApi.create('user', profile._id, 'unsafe').catch(() => {}) },
            { text: 'Fake profile', onPress: () => reportsApi.create('user', profile._id, 'fake').catch(() => {}) },
            { text: 'Spam', onPress: () => reportsApi.create('user', profile._id, 'spam').catch(() => {}) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        },
      },
      {
        text: 'Block user',
        style: 'destructive',
        onPress: () => {
          Alert.alert(`Block ${name}?`, 'They won\'t be able to see your pings or contact you.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                try {
                  await friendsApi.block(profile._id);
                  Alert.alert('Blocked', `${name} has been blocked.`);
                  router.back();
                } catch (e: any) {
                  Alert.alert('Error', e.message);
                }
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Ping.purpleLight} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="person-outline" size={48} color={c.textSecondary} />
        <Text style={[styles.notFound, { color: c.textSecondary }]}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: Ping.purpleLight }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSelf = profile.friendshipStatus === 'self';
  const isAccepted = profile.friendshipStatus === 'accepted';
  const isPendingSent = profile.friendshipStatus === 'pending_sent';
  const isPendingReceived = profile.friendshipStatus === 'pending_received';

  const accountAgeDays = profile.createdAt
    ? (Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const isVerified = !!profile.phoneVerifiedAt && accountAgeDays >= 7;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Profile</Text>
        {!isSelf && profile ? (
          <TouchableOpacity onPress={handleMoreOptions} hitSlop={12}>
            <Ionicons name="ellipsis-vertical" size={20} color={c.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: `${Ping.purple}55` }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {profile.status === 'active' && <View style={styles.onlineDot} />}
        </View>

        {/* Name + username */}
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: c.text }]}>
            {profile.displayName ?? 'User'}
          </Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
            </View>
          )}
        </View>
        {profile.username ? (
          <Text style={[styles.username, { color: c.textSecondary }]}>@{profile.username}</Text>
        ) : null}

        {/* Bio */}
        {profile.bio ? (
          <Text style={[styles.bio, { color: c.textSecondary }]}>{profile.bio}</Text>
        ) : null}

        {/* Trust rate */}
        {profile.trustRate !== undefined && (
          <View style={[styles.trustCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.trustRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={Ping.purpleLight} />
              <Text style={[styles.trustLabel, { color: c.textSecondary }]}>Trust rating</Text>
            </View>
            <TrustBar value={profile.trustRate} />
          </View>
        )}

        {/* Action buttons */}
        {!isSelf && (
          <View style={styles.actionsWrap}>
            {isAccepted && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary, styles.actionBtnFull, { borderColor: c.border }]}
                onPress={removeFriend}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="person-remove-outline" size={17} color={c.textSecondary} />
                <Text style={[styles.actionBtnTextSecondary, { color: c.textSecondary }]}>Remove Friend</Text>
              </TouchableOpacity>
            )}

            {profile.friendshipStatus === 'none' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnFull]}
                onPress={sendRequest}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={17} color="#FFF" />
                    <Text style={styles.actionBtnTextPrimary}>Add Friend</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {isPendingSent && (
              <View style={[styles.actionBtn, styles.actionBtnPending, styles.actionBtnFull, { borderColor: c.border }]}>
                <Ionicons name="time-outline" size={17} color={c.textSecondary} />
                <Text style={[styles.actionBtnTextSecondary, { color: c.textSecondary }]}>
                  Request sent
                </Text>
              </View>
            )}

            {isPendingReceived && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnFull]}
                onPress={async () => {
                  setActionLoading(true);
                  try {
                    await friendsApi.accept(profile._id);
                    setProfile((p) => p ? { ...p, friendshipStatus: 'accepted' } : p);
                  } catch (e: any) {
                    Alert.alert('Error', e.message);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={17} color="#FFF" />
                    <Text style={styles.actionBtnTextPrimary}>Accept Request</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...Typography.bodyMed, fontSize: 17 },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 80,
    gap: Spacing.sm,
  },
  avatarWrap: { position: 'relative', marginBottom: Spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#FFF' },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Ping.green,
    borderWidth: 2,
    borderColor: '#080815',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...Typography.h3, textAlign: 'center' },
  verifiedBadge: { marginTop: 2 },
  username: { ...Typography.bodySm, marginTop: 2 },
  bio: {
    ...Typography.bodySm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  trustCard: {
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustLabel: { ...Typography.bodySm },
  actionsWrap: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
    borderRadius: Radius.md,
  },
  actionBtnFull: { flex: undefined, width: '100%' },
  actionBtnPrimary: {
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnSecondary: { borderWidth: 1 },
  actionBtnPending: { borderWidth: 1, opacity: 0.7 },
  actionBtnTextPrimary: { ...Typography.bodyMed, color: '#FFF', fontWeight: '600' },
  actionBtnTextSecondary: { ...Typography.bodyMed, fontWeight: '600' },
  notFound: { ...Typography.bodyMed, marginTop: Spacing.md },
  backLink: { marginTop: Spacing.md, padding: Spacing.sm },
});
