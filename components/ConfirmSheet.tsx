import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Radius, Spacing, Colors, Ping } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  /** Kept for callers; no longer shown (minimal dialog). */
  icon?: string;
  /**
   * If set, user must type this exact word (case-insensitive) before Confirm enables.
   * Example: requireType="delete"
   */
  requireType?: string;
  typeHint?: string;
}

export default function ConfirmSheet({
  visible,
  onClose,
  title,
  subtitle,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep',
  danger = false,
  onConfirm,
  requireType,
  typeHint,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const needsType = Boolean(requireType);
  const typedOk =
    !needsType || typed.trim().toLowerCase() === requireType!.trim().toLowerCase();

  function handleConfirm() {
    if (!typedOk) return;
    onClose();
    setTimeout(onConfirm, 80);
  }

  const confirmBg = danger ? Ping.red : c.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(17,17,17,0.28)' },
          ]}
          onPress={onClose}
        />

        <View
          style={[
            s.card,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}
        >
          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[s.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>
          ) : null}

          {needsType ? (
            <View style={s.typeBlock}>
              <Text style={[s.typeHint, { color: c.textSecondary }]}>
                {typeHint ?? `Type ${requireType} to confirm`}
              </Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={requireType}
                placeholderTextColor={c.tabIconDefault}
                style={[
                  s.typeInput,
                  {
                    color: c.text,
                    backgroundColor: isDark ? c.input : c.soft,
                    borderColor: typedOk && typed.length > 0 ? Ping.red : c.border,
                  },
                ]}
              />
            </View>
          ) : null}

          <View style={s.btnRow}>
            <TouchableOpacity
              style={[
                s.btn,
                s.cancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.soft,
                  borderColor: c.border,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.75}
            >
              <Text style={[s.cancelText, { color: c.textSecondary }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.btn,
                s.confirmBtn,
                { backgroundColor: confirmBg, opacity: typedOk ? 1 : 0.4 },
              ]}
              onPress={handleConfirm}
              disabled={!typedOk}
              activeOpacity={0.85}
            >
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 18,
    zIndex: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  typeBlock: {
    width: '100%',
    marginTop: 14,
    gap: 8,
  },
  typeHint: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  typeInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.lg,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {},
  confirmText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
