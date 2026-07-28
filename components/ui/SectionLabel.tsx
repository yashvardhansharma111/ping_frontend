import { Text, StyleSheet, type TextStyle } from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  children: string;
  style?: TextStyle;
}

/** Uppercase / group section label used above cards and tool grids. */
export default function SectionLabel({ children, style }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <Text style={[styles.label, { color: c.textSecondary }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.label,
    marginLeft: 4,
    marginBottom: 2,
    marginTop: Spacing.xs,
  },
});
