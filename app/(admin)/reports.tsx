import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, type AdminReport } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const STATUS_COLOR: Record<string, string> = {
  pending: '#F97316', escalated: '#EF4444',
  resolved: '#22C55E', dismissed: '#9490C0',
};

const TARGET_ICON: Record<string, string> = {
  ping: 'location-outline', ad: 'megaphone-outline',
  user: 'person-outline', message: 'chatbubble-outline',
};

const TABS = ['all', 'pings', 'ads', 'users', 'resolved'] as const;
type Tab = typeof TABS[number];

function ReportRow({ item, onAction }: { item: AdminReport; onAction: (r: AdminReport) => void }) {
  const statusColor = STATUS_COLOR[item.status] ?? '#9490C0';
  const icon = (TARGET_ICON[item.targetType] ?? 'alert-circle-outline') as any;
  return (
    <TouchableOpacity style={s.row} onPress={() => onAction(item)} activeOpacity={0.75}>
      <View style={[s.typeIcon, { backgroundColor: `${Ping.purple}1A` }]}>
        <Ionicons name={icon} size={18} color={Ping.purpleLight} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowType} numberOfLines={1}>
          {item.targetType.charAt(0).toUpperCase() + item.targetType.slice(1)} report
          {item.reporterId ? ` by ${item.reporterId.displayName ?? item.reporterId.username ?? 'user'}` : ''}
        </Text>
        <Text style={s.rowReason} numberOfLines={2}>{item.reason}</Text>
        {item.targetUserId ? (
          <Text style={s.rowTarget}>
            Target: {item.targetUserId.displayName ?? item.targetUserId.username ?? 'user'}
            {' '}· {item.targetUserId.status}
          </Text>
        ) : null}
      </View>
      <View style={[s.badge, { backgroundColor: `${statusColor}22` }]}>
        <Text style={[s.badgeText, { color: statusColor }]}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ActionSheet({ report, onClose, onDone }: { report: AdminReport; onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const isPending = report.status === 'pending' || report.status === 'escalated';

  async function act(fn: () => Promise<any>, msg: string) {
    setLoading(true);
    try {
      await fn();
      Alert.alert('Done', msg);
      onDone();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function promptReason(title: string, cb: (r: string) => void) {
    Alert.prompt(title, 'Enter reason', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: (r) => r && cb(r) },
    ], 'plain-text');
  }

  return (
    <View style={[as.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={as.handle} />
      <View style={as.header}>
        <Text style={as.type}>{report.targetType} · {report.status}</Text>
        <Text style={as.reason} numberOfLines={3}>{report.reason}</Text>
      </View>

      {loading ? <ActivityIndicator color={Ping.purple} style={{ margin: 24 }} /> : (
        <View style={as.actions}>
          {isPending && (
            <>
              <TouchableOpacity
                style={as.btn}
                onPress={() => act(() => adminApi.dismissReport(report._id), 'Report dismissed')}
              >
                <Ionicons name="close-circle-outline" size={20} color="#9490C0" />
                <Text style={[as.btnText, { color: '#9490C0' }]}>Dismiss (no action)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={as.btn}
                onPress={() => promptReason('Remove content', (r) => act(() => adminApi.removeReport(report._id, r), 'Content removed'))}
              >
                <Ionicons name="trash-outline" size={20} color="#F97316" />
                <Text style={[as.btnText, { color: '#F97316' }]}>Remove content</Text>
              </TouchableOpacity>

              {report.targetUserId && (
                <TouchableOpacity
                  style={as.btn}
                  onPress={() => promptReason('Remove & warn user', (r) => act(() => adminApi.warnReport(report._id, r), 'Content removed + user warned'))}
                >
                  <Ionicons name="warning-outline" size={20} color="#EF4444" />
                  <Text style={[as.btnText, { color: '#EF4444' }]}>Remove + warn user</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={as.cancelBtn} onPress={onClose}>
            <Text style={as.cancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminReports() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AdminReport | null>(null);

  async function load(t = tab, refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.reports(t);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <Text style={s.title}>Reports</Text>
        <Text style={s.count}>{total}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => { setTab(t); load(t); }}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={r => r._id}
          renderItem={({ item }) => <ReportRow item={item} onAction={setSelected} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(tab, true)} tintColor={Ping.purpleLight} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="checkmark-circle-outline" size={48} color="rgba(34,197,94,0.4)" />
              <Text style={s.empty}>
                {tab === 'resolved' ? 'No resolved reports' : 'No pending reports — all clear!'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        />
      )}

      {selected && (
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            activeOpacity={1}
            onPress={() => setSelected(null)}
          />
          <View style={as.overlay}>
            <ActionSheet
              report={selected}
              onClose={() => setSelected(null)}
              onDone={() => load()}
            />
          </View>
        </View>
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
  count: {
    ...Typography.caption, color: '#FFF', fontWeight: '700',
    backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, gap: 6,
  },
  tab: {
    paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  tabActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  tabText: { ...Typography.caption, color: '#9490C0', fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  typeIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  rowBody: { flex: 1, gap: 3 },
  rowType: { ...Typography.bodyMed, color: '#F1F0FF' },
  rowReason: { ...Typography.caption, color: '#9490C0' },
  rowTarget: { ...Typography.caption, color: '#5C5A80' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  badgeText: { ...Typography.caption, fontWeight: '700' },
  sep: { height: 1, backgroundColor: 'rgba(167,139,250,0.07)' },
  emptyWrap: { alignItems: 'center', gap: Spacing.md, paddingTop: 80 },
  empty: { ...Typography.bodySm, color: '#9490C0', textAlign: 'center' },
});

const as = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: '#11112A', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.3)',
    alignSelf: 'center', marginTop: Spacing.sm,
  },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 4 },
  type: { ...Typography.bodyMed, color: '#9490C0', textTransform: 'capitalize' },
  reason: { ...Typography.bodyMed, color: '#F1F0FF' },
  actions: { padding: Spacing.lg, gap: Spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.12)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  btnText: { ...Typography.bodyMed, fontWeight: '600' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelText: { ...Typography.bodyMed, color: '#9490C0' },
});
