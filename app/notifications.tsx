import { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function ToggleRow({ label, sublabel, value, onValueChange, c }: {
  label: string; sublabel?: string; value: boolean;
  onValueChange: (v: boolean) => void;
  c: (typeof Colors)['dark'];
}) {
  return (
    <View style={[s.row, { borderBottomColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[s.rowSub, { color: c.textSecondary }]}>{sublabel}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: c.border, true: Ping.purple }} thumbColor="#FFF" />
    </View>
  );
}

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activities, setActivities] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [messages, setMessages] = useState(true);

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Notifications</Text>
        <View style={{ width: 46 }} />
      </View>
      <View style={{ padding: Spacing.lg }}>
        <ToggleRow label="Nearby activities" sublabel="Pings within your radius" value={activities} onValueChange={setActivities} c={c} />
        <ToggleRow label="Friend requests" sublabel="When someone adds you" value={friendRequests} onValueChange={setFriendRequests} c={c} />
        <ToggleRow label="Messages" sublabel="Chat & activity updates" value={messages} onValueChange={setMessages} c={c} />
        <Text style={[s.hint, { color: c.textSecondary }]}>
          Push notification setup coming soon. These preferences will be applied when ready.
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
