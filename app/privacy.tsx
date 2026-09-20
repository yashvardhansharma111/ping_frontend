import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Ping, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi } from '@/lib/api';
import ScreenHeader from '@/components/ScreenHeader';
import { ToggleRow } from '@/components/ui';

type PingVis = 'everyone' | 'friends_only' | 'only_me';

const PING_VIS_OPTIONS: { value: PingVis; label: string; sub: string }[] = [
  { value: 'everyone',    label: 'Everyone',     sub: 'All Ping users' },
  { value: 'friends_only', label: 'Friends only', sub: 'People you follow' },
  { value: 'only_me',    label: 'Only me',       sub: 'Hidden from map' },
];

function SectionTitle({ title, c }: { title: string; c: any }) {
  return (
    <Text style={[s.sectionTitle, { color: c.textSecondary }]}>{title}</Text>
  );
}

function PingVisibilityRow({
  value,
  onChange,
  c,
}: {
  value: PingVis;
  onChange: (v: PingVis) => void;
  c: any;
}) {
  return (
    <View style={[s.visCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.visLabel, { color: c.text }]}>Ping visibility</Text>
      <Text style={[s.visSub, { color: c.textSecondary }]}>Who can see your pings on the map</Text>
      <View style={s.visOptions}>
        {PING_VIS_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.75}
              onPress={() => onChange(opt.value)}
              style={[
                s.visOption,
                { borderColor: active ? Ping.purple : c.border, backgroundColor: active ? `${Ping.purple}18` : c.card },
              ]}
            >
              <View style={[s.visRadio, { borderColor: active ? Ping.purple : c.border }]}>
                {active && <View style={[s.visRadioDot, { backgroundColor: Ping.purple }]} />}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[s.visOptLabel, { color: active ? Ping.purple : c.text }]}>{opt.label}</Text>
                <Text style={[s.visOptSub, { color: c.textSecondary }]}>{opt.sub}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function PrivacyScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [ghostMode, setGhostMode]             = useState(user?.privacy?.ghostMode ?? false);
  const [locationSharing, setLocationSharing] = useState(user?.privacy?.locationSharing ?? true);
  const [showSocial, setShowSocial]           = useState(user?.privacy?.showSocialHandles ?? true);
  const [pingVis, setPingVis]                 = useState<PingVis>(user?.privacy?.pingVisibility ?? 'friends_only');

  const [ghostLoading, setGhostLoading]   = useState(false);
  const [locLoading, setLocLoading]       = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [visLoading, setVisLoading]       = useState(false);

  async function save(payload: Parameters<typeof usersApi.updatePrivacy>[0]) {
    try {
      const res = await usersApi.updatePrivacy(payload);
      if (user) setUser({ ...user, privacy: { ...user.privacy!, ...res.privacy } });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not update setting.' });
      return false;
    }
    return true;
  }

  async function toggleGhost(value: boolean) {
    setGhostMode(value);
    setGhostLoading(true);
    if (!await save({ ghostMode: value })) setGhostMode(!value);
    setGhostLoading(false);
  }

  async function toggleLocation(value: boolean) {
    setLocationSharing(value);
    setLocLoading(true);
    if (!await save({ locationSharing: value })) setLocationSharing(!value);
    setLocLoading(false);
  }

  async function toggleSocial(value: boolean) {
    setShowSocial(value);
    setSocialLoading(true);
    if (!await save({ showSocialHandles: value })) setShowSocial(!value);
    setSocialLoading(false);
  }

  async function changePingVis(value: PingVis) {
    const prev = pingVis;
    setPingVis(value);
    setVisLoading(true);
    if (!await save({ pingVisibility: value })) setPingVis(prev);
    setVisLoading(false);
  }

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="Privacy & Location"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />
      <View style={s.content}>

        <SectionTitle title="LOCATION" c={c} />
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
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
        </View>
        <Text style={[s.hint, { color: c.textSecondary }]}>
          Location is only shared while the app is in the foreground.
        </Text>

        <SectionTitle title="PINGS" c={c} />
        <PingVisibilityRow value={pingVis} onChange={changePingVis} c={c} />
        {visLoading && (
          <Text style={[s.hint, { color: c.textSecondary }]}>Saving…</Text>
        )}

        <SectionTitle title="PROFILE" c={c} />
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <ToggleRow
            label="Show social handles"
            sublabel="Let others see your Instagram, LinkedIn & Spotify"
            value={showSocial}
            onValueChange={toggleSocial}
            loading={socialLoading}
            separator={false}
          />
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.lg, gap: 6 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 2,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  hint: { ...Typography.caption, marginTop: 4, marginLeft: 4, lineHeight: 18 },

  // Ping visibility card
  visCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 12,
  },
  visLabel: { ...Typography.bodyMed },
  visSub: { ...Typography.caption, marginTop: -8 },
  visOptions: { gap: 8 },
  visOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  visRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  visOptLabel: { fontSize: 14, fontWeight: '600' },
  visOptSub: { ...Typography.caption },
});
