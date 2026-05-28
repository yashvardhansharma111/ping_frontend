import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, type AdminPayment } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const STATUS_COLOR: Record<string, string> = {
  paid: '#22C55E', created: '#3B82F6', failed: '#EF4444',
  refunded: '#9490C0', attempted: '#F97316',
};

function fmt(minor: number) {
  return `₹${(minor / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function PaymentRow({ item, onRefund }: { item: AdminPayment; onRefund: (p: AdminPayment) => void }) {
  const color = STATUS_COLOR[item.status] ?? '#9490C0';
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

  async function load(f = filter, refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.payments(1, f === 'all' ? undefined : f);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setSummary(res.summary ?? { totalMinor: 0, count: 0 });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function handleRefund(payment: AdminPayment) {
    Alert.prompt(
      'Refund reason', `Refunding ${fmt(payment.amountMinor)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund', style: 'destructive',
          onPress: async (reason) => {
            if (!reason?.trim()) return;
            try {
              await adminApi.refundPayment(payment._id, reason.trim());
              Alert.alert('Refunded', 'Payment has been refunded.');
              load();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
      'plain-text',
    );
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
          renderItem={({ item }) => <PaymentRow item={item} onRefund={handleRefund} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter, true)} tintColor={Ping.purpleLight} />}
          ListEmptyComponent={<Text style={s.empty}>No payments found</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080815' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  title: { ...Typography.h3, color: '#F1F0FF' },
  count: { ...Typography.caption, color: '#9490C0' },
  summaryBar: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: '#11112A', borderRadius: Radius.lg, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)', overflow: 'hidden',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(167,139,250,0.15)' },
  summaryValue: { ...Typography.h3, color: '#22C55E', fontSize: 20 },
  summaryLabel: { ...Typography.caption, color: '#9490C0' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  chipText: { ...Typography.caption, color: '#9490C0', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  row: {
    paddingHorizontal: Spacing.lg, paddingVertical: 12, gap: 4,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { ...Typography.h3, color: '#F1F0FF', fontSize: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  badgeText: { ...Typography.caption, fontWeight: '700' },
  meta: { ...Typography.bodySm, color: '#9490C0' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  date: { ...Typography.caption, color: '#5C5A80' },
  refundBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refundText: { ...Typography.caption, color: '#EF4444', fontWeight: '600' },
  sep: { height: 1, backgroundColor: 'rgba(167,139,250,0.07)' },
  empty: { ...Typography.bodySm, color: '#9490C0', textAlign: 'center', marginTop: 60 },
});
