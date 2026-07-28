import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useThemeStore, { type SchemePreference } from '@/lib/stores/themeStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import ScreenHeader from '@/components/ScreenHeader';
import { SectionLabel } from '@/components/ui';

const OPTIONS: {
  key: SchemePreference;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  desc: string;
}[] = [
  { key: 'dark',   label: 'Dark',   icon: 'moon',          desc: 'Purple + Black' },
  { key: 'light',  label: 'Light',  icon: 'sunny',         desc: 'Purple + White' },
  { key: 'system', label: 'System', icon: 'phone-portrait', desc: 'Follow device setting' },
];

function MiniPreview({ mode }: { mode: 'light' | 'dark' }) {
  const bg   = mode === 'dark' ? '#080815' : '#F4F0FF';
  const card = mode === 'dark' ? '#11112A' : '#FFFFFF';
  const bar  = mode === 'dark' ? 'rgba(12,12,28,0.97)' : 'rgba(255,255,255,0.97)';
  const dot  = mode === 'dark' ? 'rgba(167,139,250,0.4)' : 'rgba(124,58,237,0.25)';
  return (
    <View style={[pv.frame, { backgroundColor: bg }]}>
      <View style={[pv.card, { backgroundColor: card }]} />
      <View style={[pv.card, { backgroundColor: card, width: '60%' }]} />
      <View style={[pv.tabBar, { backgroundColor: bar }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[pv.dot, { backgroundColor: i === 0 ? Ping.purpleLight : dot }]} />
        ))}
      </View>
    </View>
  );
}

const pv = StyleSheet.create({
  frame: {
    width: 72, height: 52, borderRadius: 8,
    overflow: 'hidden', padding: 6, gap: 4, justifyContent: 'flex-start',
  },
  card: { height: 10, borderRadius: 3, width: '100%' },
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

export default function AppearanceScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useThemeStore();

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="Appearance"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />

      <View style={[s.content, { paddingBottom: insets.bottom + 40 }]}>
        <SectionLabel>THEME</SectionLabel>

        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.sm]}>
          {OPTIONS.map(({ key, label, icon, desc }, i) => {
            const active = preference === key;
            const previewMode: 'light' | 'dark' = key === 'system' ? scheme : key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.row,
                  i < OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                  active && { backgroundColor: `${Ping.purple}10` },
                ]}
                onPress={() => setPreference(key)}
                activeOpacity={0.75}
              >
                <MiniPreview mode={previewMode} />
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Ionicons name={icon} size={17} color={active ? Ping.purpleLight : c.icon} />
                    <Text style={[s.rowLabel, { color: c.text, fontWeight: active ? '700' : '500' }]}>
                      {label}
                    </Text>
                  </View>
                  <Text style={[s.rowDesc, { color: c.textSecondary }]}>{desc}</Text>
                </View>
                <View style={[s.radio, { borderColor: active ? Ping.purple : c.border }]}>
                  {active && <View style={[s.radioDot, { backgroundColor: Ping.purple }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.hint, { color: c.textSecondary }]}>
          Changes take effect immediately across the whole app.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, padding: Spacing.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  rowLabel: { ...Typography.bodyMed },
  rowDesc: { ...Typography.caption },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  hint: { ...Typography.caption, textAlign: 'center', lineHeight: 18 },
});
