import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import useAuthStore from '@/lib/stores/authStore';
import { authApi, usersApi, friendsApi, uploadApi, activitiesApi } from '@/lib/api';
import HighlightsSection from '@/components/HighlightsSection';
import ConfirmSheet from '@/components/ConfirmSheet';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const INTEREST_EMOJIS: Record<string, string> = {
  Aviation: '✈️', Art: '🎨', Crypto: '🪙', Baking: '🥐', Botany: '🌿',
  Cars: '🚗', 'Real Estate': '🏠', Technology: '💻', Fashion: '👗', Dogs: '🐕',
  Birds: '🐦', 'Health care': '🏥', Geography: '🗺️', Finance: '💵', Cats: '🐈',
  LGBTQ: '🏳️‍🌈', 'Mental Health': '🧠', Programming: '⌨️', Cinema: '🎬', Sports: '🏀',
  Travel: '✈️', Gaming: '🎮', Photography: '📷', Design: '✏️', UFO: '🛸',
  Music: '🎵', Food: '🍕', Fitness: '💪', Coffee: '☕', Yoga: '🧘',
  Cooking: '👨‍🍳', Reading: '📚', Dancing: '💃', Anime: '🎌',
};

const OCCUPATION_MAP: Record<string, string> = {
  job: '👨‍💻 Working',
  student: '🎓 Student',
  founder: '🚀 Founder',
  business: '💼 Business',
  freelancer: '🖥️ Freelancer',
  exploring: '🌍 Exploring',
};

type MenuItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  badge?: string;
};

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser, refreshToken, logout } = useAuthStore();

  const [friendCount, setFriendCount]               = useState<number | null>(null);
  const [activityCount, setActivityCount]           = useState<number | null>(null);
  const [completedPingCount, setCompletedPingCount] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar]       = useState(false);
  const [showLogout, setShowLogout]                 = useState(false);

  const scrollRef  = useRef<ScrollView>(null);
  const settingsY  = useRef(0);

  const heroAnim  = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const menuAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    friendsApi.list().then((r) => setFriendCount(r.friends?.length ?? 0)).catch(() => {});
    activitiesApi.mine('all').then((r) => setActivityCount(r.activities?.length ?? 0)).catch(() => {});
    activitiesApi.mine('expired').then((r) => setCompletedPingCount(r.activities?.length ?? 0)).catch(() => {});
    Animated.stagger(90, [
      Animated.spring(heroAnim,  { toValue: 1, damping: 18, stiffness: 180, mass: 0.9, useNativeDriver: true }),
      Animated.spring(statsAnim, { toValue: 1, damping: 18, stiffness: 180, mass: 0.9, useNativeDriver: true }),
      Animated.spring(menuAnim,  { toValue: 1, damping: 18, stiffness: 180, mass: 0.9, useNativeDriver: true }),
    ]).start();
  }, []);

  const initials = (user?.displayName ?? user?.phone ?? '?')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const isVerified       = user?.verificationStatus === 'verified';
  const verificationStatus = user?.verificationStatus ?? 'none';
  const hobbies          = (user as any)?.hobbies as string[] | undefined;

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'info', text1: 'Permission needed', text2: 'Allow photo access to update your profile picture.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'avatars');
      const res = await usersApi.updateMe({ avatarUrl: url });
      setUser(res.user);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message || 'Could not update profile picture.' });
    } finally { setUploadingAvatar(false); }
  }

  // ── Settings groups ──────────────────────────────────────────────────────────
  const profileGroup: MenuItem[] = [
    { icon: 'person-outline',    label: 'Edit Profile', onPress: () => router.push('/edit-profile' as any) },
    { icon: 'flash-outline',     label: 'My Activity',  onPress: () => router.push('/my-activity' as any) },
    { icon: 'megaphone-outline', label: 'My Ads',       onPress: () => router.push('/ads') },
  ];

  const prefGroup: MenuItem[] = [
    { icon: 'color-palette-outline', label: 'Appearance',         onPress: () => router.push('/appearance' as any) },
    { icon: 'eye-outline',           label: 'Privacy & Location',  onPress: () => router.push('/privacy' as any) },
    { icon: 'notifications-outline', label: 'Notifications',       onPress: () => router.push('/notifications' as any) },
  ];

  const accountGroup: MenuItem[] = [
    {
      icon: verificationStatus === 'verified'
        ? 'shield-checkmark-outline'
        : verificationStatus === 'pending'
        ? 'hourglass-outline'
        : 'shield-half-outline',
      label: verificationStatus === 'verified'
        ? 'Identity Verified'
        : verificationStatus === 'pending'
        ? 'Verification Pending…'
        : 'Get Verified',
      onPress: () => router.push('/verification' as any),
      badge: verificationStatus !== 'verified' ? '!' : undefined,
    },
    { icon: 'shield-outline', label: 'Safety & Account', onPress: () => router.push('/safety' as any) },
  ];

  function SettingsGroup({ items }: { items: MenuItem[] }) {
    return (
      <View style={[styles.settingsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.settingsRow,
              i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
            ]}
            onPress={item.onPress}
            activeOpacity={0.65}
          >
            <View style={[styles.settingsIconWrap, { backgroundColor: 'rgba(124,58,237,0.1)' }]}>
              <Ionicons name={item.icon} size={18} color={c.tint} />
            </View>
            <Text style={[styles.settingsLabel, { color: c.text }]}>{item.label}</Text>
            {item.badge && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{item.badge}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={15} color={c.icon} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>

      {/* ── Sticky top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4, backgroundColor: c.background, borderBottomColor: c.border }]}>
        <Text style={[styles.topTitle, { color: c.text }]}>Profile</Text>
        <TouchableOpacity
          style={[styles.gearBtn, { backgroundColor: c.surface }]}
          onPress={() => scrollRef.current?.scrollTo({ y: settingsY.current - 16, animated: true })}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color={c.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ── */}
        <Animated.View style={[styles.hero, {
          opacity: heroAnim,
          transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        }]}>
          {/* Avatar with gradient ring */}
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarWrap}>
            <LinearGradient
              colors={['#A78BFA', '#7C3AED', '#EC4899']}
              style={styles.gradientRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.avatarInner, { backgroundColor: c.background }]}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: Ping.purple }]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
            <View style={[styles.cameraBtn, { backgroundColor: Ping.purple, borderColor: c.background }]}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="camera" size={13} color="#FFF" />}
            </View>
          </TouchableOpacity>

          {/* Name + verified badge */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: c.text }]}>
              {user?.displayName ?? 'No name set'}
            </Text>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#FFF" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* Username */}
          {user?.username ? (
            <Text style={[styles.username, { color: c.textSecondary }]}>@{user.username}</Text>
          ) : null}

          {/* Bio */}
          {(user as any)?.bio ? (
            <Text style={[styles.bio, { color: c.textSecondary }]}>{(user as any).bio}</Text>
          ) : null}

          {/* Occupation chip */}
          {user?.occupation ? (
            <View style={[styles.occupationChip, { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.2)' }]}>
              <Text style={[styles.occupationText, { color: c.tint }]}>
                {OCCUPATION_MAP[user.occupation as string] ?? user.occupation}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* ── Stats ── */}
        <Animated.View style={[styles.statsRow, { backgroundColor: c.surface, borderColor: c.border }, {
          opacity: statsAnim,
          transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }]}>
          {[
            { label: 'Friends',  value: friendCount          !== null ? String(friendCount)          : '—' },
            { label: 'Pings',    value: activityCount        !== null ? String(activityCount)        : '—' },
            { label: 'Done',     value: completedPingCount   !== null ? String(completedPingCount)   : '—' },
          ].map((stat, i) => (
            <View
              key={stat.label}
              style={[
                styles.statItem,
                i < 2 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
              ]}
            >
              <Text style={[styles.statValue, { color: c.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Interests ── */}
        {hobbies && hobbies.length > 0 && (
          <Animated.View style={{
            opacity: statsAnim,
            transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>INTERESTS</Text>
            <View style={styles.interestWrap}>
              {hobbies.map((h) => (
                <View
                  key={h}
                  style={[styles.interestChip, { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.18)' }]}
                >
                  <Text style={styles.interestEmoji}>{INTEREST_EMOJIS[h] ?? '✨'}</Text>
                  <Text style={[styles.interestText, { color: c.text }]}>{h}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Highlights ── */}
        {user && (
          <HighlightsSection userId={user._id} isOwnProfile={true} scheme={scheme} />
        )}

        {/* ── Settings ── */}
        <Animated.View
          onLayout={(e) => { settingsY.current = e.nativeEvent.layout.y; }}
          style={[{
            opacity: menuAnim,
            transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            gap: Spacing.md,
          }]}
        >
          <View style={styles.settingsTitleRow}>
            <Ionicons name="settings-outline" size={12} color={c.icon} />
            <Text style={[styles.sectionLabel, { color: c.textSecondary, marginBottom: 0 }]}>SETTINGS</Text>
          </View>

          <SettingsGroup items={profileGroup} />
          <SettingsGroup items={prefGroup} />
          <SettingsGroup items={accountGroup} />

          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)' }]}
            onPress={() => setShowLogout(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={18} color={Ping.red} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={[styles.version, { color: c.icon }]}>Ping v1.0.0</Text>
      </ScrollView>

      <ConfirmSheet
        visible={showLogout}
        onClose={() => setShowLogout(false)}
        title="Log out?"
        subtitle="You'll have to type your number again. Worth it?"
        confirmLabel="Log out"
        cancelLabel="Stay"
        danger
        onConfirm={async () => {
          try { if (refreshToken) await authApi.logout(refreshToken); } catch {}
          await logout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { ...Typography.h3 },
  gearBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg, paddingTop: Spacing.lg },

  // Hero
  hero: { alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
  avatarWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  gradientRing: {
    width: 108, height: 108, borderRadius: 54, padding: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: 102, height: 102, borderRadius: 51,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  avatarImage:    { width: 102, height: 102 },
  avatarFallback: { width: 102, height: 102, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 36, fontWeight: '800', color: '#FFF' },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  name:         { ...Typography.h2 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  username:     { ...Typography.bodySm },
  bio: {
    ...Typography.bodySm,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  occupationChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, marginTop: 2,
  },
  occupationText: { fontSize: 13, fontWeight: '600' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statItem: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', gap: 3 },
  statValue: { ...Typography.h2 },
  statLabel: { ...Typography.caption },

  // Interests
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },
  interestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1,
  },
  interestEmoji: { fontSize: 14 },
  interestText:  { fontSize: 13, fontWeight: '500' },

  // Settings
  settingsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingsCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    gap: Spacing.md,
  },
  settingsIconWrap: {
    width: 34, height: 34, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsLabel: { ...Typography.bodyMed, flex: 1 },
  notifBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Ping.red, alignItems: 'center', justifyContent: 'center',
  },
  notifBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15,
    borderRadius: Radius.lg, borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: Ping.red },

  version: { ...Typography.caption, textAlign: 'center' },
});
