import { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi } from '@/lib/api';

function ToggleRow({ label, sublabel, value, onValueChange, loading, c }: {
  label: string; sublabel?: string; value: boolean;
  onValueChange: (v: boolean) => void; loading?: boolean;
  c: (typeof Colors)['dark'];
}) {
  return (
    <View style={[s.row, { borderBottomColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[s.rowSub, { color: c.textSecondary }]}>{sublabel}</Text> : null}
      </View>
      {loading
        ? <ActivityIndicator size="small" color={Ping.purpleLight} />
        : <Switch value={value} onValueChange={onValueChange} trackColor={{ false: c.border, true: Ping.purple }} thumbColor="#FFF" />}
    </View>
  );
}

export default function PrivacyScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [ghostMode, setGhostMode] = useState(user?.privacy?.ghostMode ?? false);
  const [locationSharing, setLocationSharing] = useState(user?.privacy?.locationSharing ?? true);
  const [ghostLoading, setGhostLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  async function toggleGhost(value: boolean) {
    setGhostMode(value);
    setGhostLoading(true);
    try {
      const res = await usersApi.updatePrivacy({ ghostMode: value });
      if (user) setUser({ ...user, privacy: { ...user.privacy!, ...res.privacy } });
    } catch (err: any) {
      setGhostMode(!value);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not update setting.' });
    } finally { setGhostLoading(false); }
  }

  async function toggleLocation(value: boolean) {
    setLocationSharing(value);
    setLocLoading(true);
    try {
      const res = await usersApi.updatePrivacy({ locationSharing: value });
      if (user) setUser({ ...user, privacy: { ...user.privacy!, ...res.privacy } });
    } catch (err: any) {
      setLocationSharing(!value);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not update setting.' });
    } finally { setLocLoading(false); }
  }

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Privacy & Location</Text>
        <View style={{ width: 46 }} />
      </View>
      <View style={{ padding: Spacing.lg }}>
        <ToggleRow label="Ghost mode" sublabel="Hide your dot from the map" value={ghostMode} onValueChange={toggleGhost} loading={ghostLoading} c={c} />
        <ToggleRow label="Share location" sublabel="Let friends see you on the map" value={locationSharing} onValueChange={toggleLocation} loading={locLoading} c={c} />
        <Text style={[s.hint, { color: c.textSecondary }]}>
          Location is only shared while the app is in the foreground.
        </Text>
      </View>
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
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, gap: Spacing.md,
  },
  rowLabel: { ...Typography.bodyMed },
  rowSub: { ...Typography.caption },
  hint: { ...Typography.caption, marginTop: Spacing.md, lineHeight: 18 },
});
