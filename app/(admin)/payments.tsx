import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { adminApi, type AdminPayment } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const STATUS_COLOR: Record<string, string> = {
  paid: '#22C55E', created: '#3B82F6', failed: '#EF4444',
  refunded: '#6B7280', attempted: '#F97316',
};

function fmt(minor: number) {
  return `₹${(minor / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function PaymentRow({ item, onRefund }: { item: AdminPayment; onRefund: (p: AdminPayment) => void }) {
  const color = STATUS_COLOR[item.status] ?? '#6B7280';
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.amount}>{fmt(item.amountMinor)}</Text>
        <View style={[s.badge, { backgroundColor: `${color}22` }]}>
          <Text style={[s.badgeText, { color }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={s.meta}>
        {item.userId?.displayName ?? item.userId?.phone ?? 'Unknown user'}
        {item.adId ? ` · ${item.adId.businessName}` : ''}
      </Text>
      <View style={s.rowBottom}>
        <Text style={s.date}>{fmtDate(item.createdAt)}</Text>
        {item.status === 'paid' && (
          <TouchableOpacity
            style={s.refundBtn}
            onPress={() => onRefund(item)}
            hitSlop={8}
          >
            <Ionicons name="return-down-back-outline" size={14} color="#EF4444" />
            <Text style={s.refundText}>Refund</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const FILTERS = ['all', 'paid', 'refunded', 'failed'] as const;
type F = typeof FILTERS[number];

export default function AdminPayments() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalMinor: 0, count: 0 });
  const [filter, setFilter] = useState<F>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refundTarget, setRefundTarget] = useState<AdminPayment | null>(null);

  async function load(f = filter, refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.payments(1, f === 'all' ? undefined : f);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setSummary(res.summary ?? { totalMinor: 0, count: 0 });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function confirmRefund() {
    if (!refundTarget) return;
    const payment = refundTarget;
    setRefundTarget(null);
    try {
      await adminApi.refundPayment(payment._id, 'Admin refund');
      Toast.show({ type: 'success', text1: 'Refunded', text2: 'Payment has been refunded.' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <Text style={s.title}>Payments</Text>
        <Text style={s.count}>{total} records</Text>
      </View>

      {/* Revenue summary */}
      <View style={s.summaryBar}>
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{fmt(summary.totalMinor)}</Text>
          <Text style={s.summaryLabel}>Total Revenue</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{summary.count}</Text>
          <Text style={s.summaryLabel}>Paid Orders</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.chip, filter === f && s.chipActive]}
            onPress={() => { setFilter(f); load(f); }}
          >
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={p => p._id}
          renderItem={({ item }) => <PaymentRow item={item} onRefund={setRefundTarget} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter, true)} tintColor={Ping.purple} />}
          ListEmptyComponent={<Text style={s.empty}>No payments found</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <ConfirmSheet
        visible={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Refund Payment"
        subtitle={refundTarget ? `Refunding ${fmt(refundTarget.amountMinor)} — this cannot be undone.` : ''}
        confirmLabel="Refund"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmRefund}
        icon="return-down-back-outline"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F8' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8ED',
  },
  title: { ...Typography.h3, color: '#111827', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  count: { ...Typography.caption, color: '#6B7280', fontWeight: '600' },
  summaryBar: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    backgroundColor: '#FFFFFF', borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED', overflow: 'hidden',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E8E8ED' },
  summaryValue: { ...Typography.h3, color: '#111827', fontSize: 20, fontWeight: '700' },
  summaryLabel: { ...Typography.caption, color: '#6B7280' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, gap: 8, backgroundColor: '#FFFFFF',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
  },
  chipActive: { backgroundColor: '#111827' },
  chipText: { ...Typography.caption, color: '#6B7280', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  row: {
    paddingHorizontal: Spacing.lg, paddingVertical: 14, gap: 4,
    backgroundColor: '#FFFFFF',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { ...Typography.h3, color: '#111827', fontSize: 18, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  badgeText: { ...Typography.caption, fontWeight: '600' },
  meta: { ...Typography.bodySm, color: '#6B7280' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  date: { ...Typography.caption, color: '#9CA3AF' },
  refundBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refundText: { ...Typography.caption, color: '#DC2626', fontWeight: '600' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F3' },
  empty: { ...Typography.bodySm, color: '#9CA3AF', textAlign: 'center', marginTop: 48 },
});
