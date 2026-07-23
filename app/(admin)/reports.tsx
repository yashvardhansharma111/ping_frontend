import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { adminApi, type AdminReport } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const STATUS_COLOR: Record<string, string> = {
  pending: '#F97316', escalated: '#EF4444',
  resolved: '#22C55E', dismissed: '#6B7280',
};

const TARGET_ICON: Record<string, string> = {
  ping: 'location-outline', ad: 'megaphone-outline',
  user: 'person-outline', message: 'chatbubble-outline',
};

const TABS = ['all', 'pings', 'ads', 'users', 'resolved'] as const;
type Tab = typeof TABS[number];

type PendingAction = {
  title: string;
  cb: (reason: string) => void;
};

function ReportRow({ item, onAction }: { item: AdminReport; onAction: (r: AdminReport) => void }) {
  const statusColor = STATUS_COLOR[item.status] ?? '#6B7280';
  const icon = (TARGET_ICON[item.targetType] ?? 'alert-circle-outline') as any;
  return (
    <TouchableOpacity style={s.row} onPress={() => onAction(item)} activeOpacity={0.75}>
      <View style={[s.typeIcon, { backgroundColor: `${Ping.purple}1A` }]}>
        <Ionicons name={icon} size={18} color={Ping.purple} />
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

function ReasonModal({
  action,
  onClose,
}: {
  action: PendingAction | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    if (!reason.trim() || !action) return;
    action.cb(reason.trim());
    setReason('');
    onClose();
  }

  function handleClose() {
    setReason('');
    onClose();
  }

  return (
    <Modal
      visible={!!action}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <Text style={rm.title}>{action?.title ?? ''}</Text>
          <Text style={rm.sub}>Enter reason</Text>
          <TextInput
            style={rm.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Reason…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={200}
            autoFocus
          />
          <View style={rm.btns}>
            <TouchableOpacity style={rm.cancelBtn} onPress={handleClose}>
              <Text style={rm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.confirmBtn, !reason.trim() && rm.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!reason.trim()}
            >
              <Text style={rm.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', gap: 12 },
  title: { ...Typography.h4, color: '#111827' },
  sub: { ...Typography.bodySm, color: '#6B7280' },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: Radius.md, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 12, color: '#111827',
    ...Typography.body, minHeight: 80, textAlignVertical: 'top',
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: Radius.sm,
  },
  cancelText: { ...Typography.bodySm, color: '#6B7280', fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: Radius.sm,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { ...Typography.bodySm, color: '#EF4444', fontWeight: '700' },
});

function ActionSheet({
  report,
  onClose,
  onDone,
  onPromptReason,
}: {
  report: AdminReport;
  onClose: () => void;
  onDone: () => void;
  onPromptReason: (title: string, cb: (r: string) => void) => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const isPending = report.status === 'pending' || report.status === 'escalated';

  async function act(fn: () => Promise<any>, msg: string) {
    setLoading(true);
    try {
      await fn();
      Toast.show({ type: 'success', text1: 'Done', text2: msg });
      onDone();
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setLoading(false);
    }
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
                <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
                <Text style={[as.btnText, { color: '#6B7280' }]}>Dismiss (no action)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={as.btn}
                onPress={() => onPromptReason('Remove content', (r) => act(() => adminApi.removeReport(report._id, r), 'Content removed'))}
              >
                <Ionicons name="trash-outline" size={20} color="#F97316" />
                <Text style={[as.btnText, { color: '#F97316' }]}>Remove content</Text>
              </TouchableOpacity>

              {report.targetUserId && (
                <TouchableOpacity
                  style={as.btn}
                  onPress={() => onPromptReason('Remove & warn user', (r) => act(() => adminApi.warnReport(report._id, r), 'Content removed + user warned'))}
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  async function load(t = tab, refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.reports(t);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function handlePromptReason(title: string, cb: (r: string) => void) {
    setPendingAction({ title, cb });
  }

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(tab, true)} tintColor={Ping.purple} />}
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
              onPromptReason={handlePromptReason}
            />
          </View>
        </View>
      )}

      <ReasonModal
        action={pendingAction}
        onClose={() => setPendingAction(null)}
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
  count: {
    ...Typography.caption, color: '#FFF', fontWeight: '700',
    backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, gap: 8, backgroundColor: '#FFFFFF',
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: '#111827' },
  tabText: { ...Typography.caption, color: '#6B7280', fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  typeIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  rowBody: { flex: 1, gap: 3 },
  rowType: { ...Typography.bodyMed, color: '#111827', fontWeight: '600' },
  rowReason: { ...Typography.caption, color: '#6B7280' },
  rowTarget: { ...Typography.caption, color: '#9CA3AF' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  badgeText: { ...Typography.caption, fontWeight: '600' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F3' },
  emptyWrap: { alignItems: 'center', gap: Spacing.md, paddingTop: 80 },
  empty: { ...Typography.bodySm, color: '#9CA3AF', textAlign: 'center' },
});

const as = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E8E8ED',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginTop: Spacing.sm,
  },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 4 },
  type: { ...Typography.bodyMed, color: '#6B7280', textTransform: 'capitalize' },
  reason: { ...Typography.bodyMed, color: '#111827' },
  actions: { padding: Spacing.lg, gap: Spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: '#F3F4F6',
  },
  btnText: { ...Typography.bodyMed, fontWeight: '600' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: '#F3F4F6',
  },
  cancelText: { ...Typography.bodyMed, color: '#6B7280' },
});
