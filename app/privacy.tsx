import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi } from '@/lib/api';
import ScreenHeader from '@/components/ScreenHeader';
import { ToggleRow } from '@/components/ui';

export default function PrivacyScreen() {
  const scheme = useColorScheme() ?? 'light';
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
      <ScreenHeader
        title="Privacy & Location"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />
      <View style={{ padding: Spacing.lg }}>
        <ToggleRow
          label="Ghost mode"
          sublabel="Hide your dot from the map"
          value={ghostMode}
          onValueChange={toggleGhost}
          loading={ghostLoading}
        />
        <ToggleRow
          label="Share location"
          sublabel="Let friends see you on the map"
          value={locationSharing}
          onValueChange={toggleLocation}
          loading={locLoading}
          separator={false}
        />
        <Text style={[s.hint, { color: c.textSecondary }]}>
          Location is only shared while the app is in the foreground.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hint: { ...Typography.caption, marginTop: Spacing.md, lineHeight: 18 },
});
