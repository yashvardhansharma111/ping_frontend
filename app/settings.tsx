import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ConfirmSheet from '@/components/ConfirmSheet';
import ScreenHeader from '@/components/ScreenHeader';
import AppAvatar from '@/components/AppAvatar';
import UIRow, { UICard } from '@/components/UIRow';
import useAuthStore from '@/lib/stores/authStore';
import { authApi } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshToken, logout } = useAuthStore();
  const [showLogout, setShowLogout] = useState(false);

  const verificationStatus = user?.verificationStatus ?? 'none';

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="Settings"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile header ── */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => router.push('/edit-profile' as any)}
          activeOpacity={0.85}
        >
          <AppAvatar uri={user?.avatarUrl} name={user?.displayName || user?.phone} size={54} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: c.text }]} numberOfLines={1}>
              {user?.displayName || 'Your Profile'}
            </Text>
            <Text style={[styles.profileSub, { color: c.textSecondary }]} numberOfLines={1}>
              {user?.phone ?? 'Tap to edit profile'}
            </Text>
          </View>
          <View style={[styles.editChip, { backgroundColor: `${Ping.purple}18`, borderColor: `${Ping.purple}33` }]}>
            <Text style={[styles.editChipText, { color: Ping.purpleLight }]}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* ── Account ── */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.textSecondary }]}>Account</Text>
          <UICard>
            <UIRow icon="person-outline" label="Edit Profile" onPress={() => router.push('/edit-profile' as any)} separator />
            <UIRow icon="flash-outline" label="My Activity" onPress={() => router.push('/my-activity' as any)} separator />
            <UIRow icon="megaphone-outline" label="My Ads" onPress={() => router.push('/ads')} />
          </UICard>
        </View>

        {/* ── Preferences ── */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.textSecondary }]}>Preferences</Text>
          <UICard>
            <UIRow icon="color-palette-outline" label="Appearance" onPress={() => router.push('/appearance' as any)} separator />
            <UIRow icon="eye-outline" label="Privacy & Location" onPress={() => router.push('/privacy' as any)} separator />
            <UIRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications' as any)} />
          </UICard>
        </View>

        {/* ── Safety ── */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.textSecondary }]}>Safety</Text>
          <UICard>
            <UIRow
              icon={
                verificationStatus === 'verified'
                  ? 'shield-checkmark-outline'
                  : verificationStatus === 'pending'
                  ? 'hourglass-outline'
                  : 'shield-half-outline'
              }
              label={
                verificationStatus === 'verified'
                  ? 'Identity Verified'
                  : verificationStatus === 'pending'
                  ? 'Verification Pending…'
                  : 'Get Verified'
              }
              badge={verificationStatus !== 'verified' ? '!' : undefined}
              onPress={() => router.push('/verification' as any)}
              separator
            />
            <UIRow icon="shield-outline" label="Safety & Account" onPress={() => router.push('/safety' as any)} />
          </UICard>
        </View>

        {/* ── Legal & About ── */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.textSecondary }]}>Legal & About</Text>
          <UICard>
            <UIRow icon="document-text-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://pingapp.in/privacy').catch(() => {})} external separator />
            <UIRow icon="clipboard-outline" label="Terms of Service" onPress={() => Linking.openURL('https://pingapp.in/terms').catch(() => {})} external separator />
            <UIRow icon="people-outline" label="Community Guidelines" onPress={() => Linking.openURL('https://pingapp.in/guidelines').catch(() => {})} external separator />
            <UIRow icon="chatbubble-ellipses-outline" label="Help & Support" onPress={() => Linking.openURL('mailto:support@pingapp.in').catch(() => {})} external separator />
            <UIRow
              icon="share-social-outline"
              label="Share Ping"
              onPress={() => Share.share({ message: 'Check out Ping — drop your location, find your crew! 🎯\nhttps://pingapp.in' }).catch(() => {})}
            />
          </UICard>
        </View>

        {/* ── Log out ── */}
        <UICard>
          <UIRow icon="log-out-outline" label="Log out" onPress={() => setShowLogout(true)} danger />
        </UICard>

        <Text style={[styles.version, { color: c.icon }]}>Ping v1.0.0</Text>
      </ScrollView>

      <ConfirmSheet
        visible={showLogout}
        onClose={() => setShowLogout(false)}
        title="Log out?"
        subtitle="You'll need your number to sign back in."
        confirmLabel="Log out"
        cancelLabel="Stay"
        danger
        onConfirm={async () => {
          try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
          await logout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: `${Ping.purple}33`,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  profileName: { ...Typography.bodyMed, fontSize: 16, fontWeight: '700' },
  profileSub: { ...Typography.caption, marginTop: 2 },
  editChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  editChipText: { ...Typography.caption, fontWeight: '700', fontSize: 12 },

  group: { gap: 8 },
  groupLabel: { ...Typography.label, marginLeft: 4 },
  version: { ...Typography.caption, textAlign: 'center', marginTop: Spacing.xs },
});
