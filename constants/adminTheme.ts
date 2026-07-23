import { StyleSheet } from 'react-native';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

/** Light minimalist palette for the admin panel */
export const Admin = {
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  elevated: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  muted: '#9CA3AF',
  border: '#E8E8ED',
  borderSoft: '#F0F0F3',
  accent: Ping.purple,
  accentSoft: 'rgba(124,58,237,0.08)',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
};

export const adminChrome = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Admin.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Admin.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Admin.border,
  },
  title: {
    ...Typography.h3,
    color: Admin.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  count: {
    ...Typography.caption,
    color: Admin.textSecondary,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
    backgroundColor: Admin.surface,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Admin.elevated,
  },
  chipOn: {
    backgroundColor: Admin.text,
  },
  chipText: {
    ...Typography.caption,
    color: Admin.textSecondary,
    fontWeight: '600',
  },
  chipTextOn: {
    color: '#FFF',
  },
  row: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Admin.surface,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Admin.borderSoft,
    marginLeft: Spacing.lg,
  },
  empty: {
    ...Typography.bodySm,
    color: Admin.muted,
    textAlign: 'center',
    marginTop: 48,
  },
  card: {
    backgroundColor: Admin.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Admin.border,
    padding: Spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: 4,
    backgroundColor: Admin.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Admin.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySm,
    color: Admin.text,
    paddingVertical: 0,
  },
});
