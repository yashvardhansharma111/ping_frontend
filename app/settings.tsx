import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import useAuthStore from '@/lib/stores/authStore';
import { authApi } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MenuItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  badge?: string;
};

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshToken, logout } = useAuthStore();
  const [showLogout, setShowLogout] = useState(false);

  const verificationStatus = user?.verificationStatus ?? 'none';

  const accountGroup: MenuItem[] = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/edit-profile' as any) },
    { icon: 'flash-outline', label: 'My Activity', onPress: () => router.push('/my-activity' as any) },
    { icon: 'megaphone-outline', label: 'My Ads', onPress: () => router.push('/ads') },
  ];

  const prefGroup: MenuItem[] = [
    { icon: 'color-palette-outline', label: 'Appearance', onPress: () => router.push('/appearance' as any) },
    { icon: 'eye-outline', label: 'Privacy & Location', onPress: () => router.push('/privacy' as any) },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications' as any) },
  ];

  const safetyGroup: MenuItem[] = [
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

  function Group({ title, items }: { title: string; items: MenuItem[] }) {
    return (
      <View style={{ gap: 10 }}>
        <Text style={[styles.groupLabel, { color: c.textSecondary }]}>{title}</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.row,
                i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color={c.textSecondary} />
              <Text style={[styles.rowLabel, { color: c.text }]}>{item.label}</Text>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={c.icon} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Group title="Account" items={accountGroup} />
        <Group title="Preferences" items={prefGroup} />
        <Group title="Safety" items={safetyGroup} />

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowLogout(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={c.textSecondary} />
            <Text style={[styles.rowLabel, { color: c.textSecondary }]}>Log out</Text>
          </TouchableOpacity>
        </View>

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
          try {
            if (refreshToken) await authApi.logout(refreshToken);
          } catch {
            /* ignore */
          }
          await logout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  groupLabel: { ...Typography.label, marginLeft: 4 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: Ping.purpleDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
  },
  rowLabel: { ...Typography.bodyMed, flex: 1 },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  version: { ...Typography.caption, textAlign: 'center', marginTop: Spacing.sm },
});
