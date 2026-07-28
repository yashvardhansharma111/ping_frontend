import { View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Ping, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  loading?: boolean;
  separator?: boolean;
}

/** Settings-style toggle row — Privacy, Notifications, etc. */
export default function ToggleRow({
  label,
  sublabel,
  value,
  onValueChange,
  loading,
  separator = true,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View
      style={[
        styles.row,
        separator && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.sub, { color: c.textSecondary }]}>{sublabel}</Text> : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: c.border, true: Ping.purple }}
          thumbColor="#FFF"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  label: { ...Typography.bodyMed },
  sub: { ...Typography.caption },
});
