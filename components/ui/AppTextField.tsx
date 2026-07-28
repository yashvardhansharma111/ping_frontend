import { View, Text, TextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
  right?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextInputProps['style'];
}

/**
 * Themed text field — use for forms, search bars (with leftIcon), and sheets.
 */
export default function AppTextField({
  label,
  hint,
  error,
  leftIcon,
  right,
  containerStyle,
  inputStyle,
  ...inputProps
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: c.input,
            borderColor: error ? c.danger : c.inputBorder,
          },
        ]}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={16} color={c.icon} style={styles.leftIcon} />
        ) : null}
        <TextInput
          placeholderTextColor={c.tabIconDefault}
          selectionColor={c.primary}
          {...inputProps}
          style={[styles.input, { color: c.text }, inputStyle]}
        />
        {right}
      </View>
      {error ? (
        <Text style={[styles.meta, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.meta, { color: c.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...Typography.caption, fontWeight: '600', marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
  },
  leftIcon: { marginRight: 8 },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 12,
  },
  meta: { ...Typography.caption, marginLeft: 2 },
});
