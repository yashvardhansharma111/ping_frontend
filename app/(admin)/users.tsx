import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { adminApi, type AdminUser } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const STATUS_COLOR: Record<string, string> = {
  active: '#22C55E',
  warned: '#F97316',
  temp_banned: '#EF4444',
  perm_banned: '#7F1D1D',
};

const FILTERS = ['all', 'warned', 'banned', 'new'] as const;
type FilterKey = typeof FILTERS[number];

type BanOption = { label: string; days?: number; type: 'temp' | 'perm' };
const BAN_OPTIONS: BanOption[] = [
  { label: '1 day', days: 1, type: 'temp' },
  { label: '7 days', days: 7, type: 'temp' },
  { label: 'Permanent', type: 'perm' },
];

type PendingAction = {
  title: string;
  cb: (reason: string) => void;
};

function UserRow({ user, onAction }: { user: AdminUser; onAction: (u: AdminUser) => void }) {
  const statusColor = STATUS_COLOR[user.status] ?? '#6B7280';
  return (
    <TouchableOpacity style={s.row} onPress={() => onAction(user)} activeOpacity={0.75}>
      <View style={[s.avatar, { backgroundColor: `${Ping.purple}33` }]}>
        <Text style={s.avatarText}>
          {(user.displayName ?? user.phone ?? '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowName}>{user.displayName ?? 'Unnamed'}</Text>
        <Text style={s.rowSub}>{user.username ? `@${user.username} · ` : ''}{user.phone}</Text>
      </View>
      <View style={s.rowRight}>
        <View style={[s.badge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[s.badgeText, { color: statusColor }]}>{user.status.replace('_', ' ')}</Text>
        </View>
        {user.strikeCount > 0 && (
          <Text style={s.strikes}>{user.strikeCount} strike{user.strikeCount !== 1 ? 's' : ''}</Text>
        )}
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
    <Modal visible={!!action} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <Text style={rm.title}>{action?.title ?? ''}</Text>
          <Text style={rm.sub}>Enter a reason</Text>
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

function BanDurationSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (opt: BanOption) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <TouchableOpacity
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[bd.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={bd.handle} />
        <Text style={bd.title}>Ban Duration</Text>
        {BAN_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[bd.option, opt.type === 'perm' && bd.optionDanger]}
            onPress={() => { onSelect(opt); onClose(); }}
          >
            <Ionicons
              name={opt.type === 'perm' ? 'ban-outline' : 'time-outline'}
              size={18}
              color={opt.type === 'perm' ? '#EF4444' : '#F97316'}
            />
            <Text style={[bd.optionText, opt.type === 'perm' && bd.optionTextDanger]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={bd.cancelOption} onPress={onClose}>
          <Text style={bd.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const bd = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: 1, borderColor: '#E8E8ED',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  title: { ...Typography.h4, color: '#111827', marginBottom: Spacing.xs },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)', backgroundColor: 'rgba(249,115,22,0.06)',
  },
  optionDanger: {
    borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.06)',
  },
  optionText: { ...Typography.bodyMed, color: '#F97316', fontWeight: '600' },
  optionTextDanger: { color: '#EF4444' },
  cancelOption: {
    alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs,
    borderRadius: Radius.md, backgroundColor: '#F3F4F6',
  },
  cancelText: { ...Typography.bodyMed, color: '#6B7280' },
});

function ActionSheet({
  user,
  onClose,
  onDone,
  onPromptReason,
  onPickBan,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
  onPromptReason: (title: string, cb: (r: string) => void) => void;
  onPickBan: (cb: (opt: BanOption) => void) => void;
}) {
  const insets = useSafeAreaInsets();
  const isBanned = user.status === 'temp_banned' || user.status === 'perm_banned';
  const [loading, setLoading] = useState(false);

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
        <Text style={as.name}>{user.displayName ?? 'User'}</Text>
        <Text style={as.sub}>{user.phone}</Text>
      </View>

      {loading ? <ActivityIndicator color={Ping.purple} style={{ margin: 24 }} /> : (
        <View style={as.actions}>
          <TouchableOpacity
            style={as.actionBtn}
            onPress={() => onPromptReason('Issue Warning', (r) => act(() => adminApi.warnUser(user._id, r), 'Warning issued'))}
          >
            <Ionicons name="warning-outline" size={20} color="#F97316" />
            <Text style={[as.actionText, { color: '#F97316' }]}>Issue Warning</Text>
          </TouchableOpacity>

          {!isBanned ? (
            <TouchableOpacity
              style={as.actionBtn}
              onPress={() =>
                onPickBan((opt) => {
                  const title = opt.type === 'perm'
                    ? 'Permanent Ban'
                    : `Temp Ban (${opt.label})`;
                  const successMsg = opt.type === 'perm'
                    ? 'User permanently banned'
                    : 'User temp banned';
                  onPromptReason(title, (r) =>
                    act(() => adminApi.banUser(user._id, opt.type, r, opt.days), successMsg)
                  );
                })
              }
            >
              <Ionicons name="ban-outline" size={20} color="#EF4444" />
              <Text style={[as.actionText, { color: '#EF4444' }]}>Ban User</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={as.actionBtn}
              onPress={() => act(() => adminApi.unbanUser(user._id), 'User unbanned')}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#22C55E" />
              <Text style={[as.actionText, { color: '#22C55E' }]}>Unban User</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={as.cancelBtn} onPress={onClose}>
            <Text style={as.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [banPickerCb, setBanPickerCb] = useState<((opt: BanOption) => void) | null>(null);

  async function load(search = q, f = filter, refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.users(search, f);
      setUsers(res.users ?? []);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <Text style={s.title}>Users</Text>
        <Text style={s.count}>{total} total</Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search name, @username, phone…"
          placeholderTextColor="#9CA3AF"
          value={q}
          onChangeText={(v) => { setQ(v); load(v, filter); }}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => { setFilter(f); load(q, f); }}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u._id}
          renderItem={({ item }) => <UserRow user={item} onAction={setSelectedUser} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(q, filter, true)} tintColor={Ping.purple} />}
          ListEmptyComponent={
            <Text style={s.empty}>No users found</Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Action sheet overlay */}
      {selectedUser && (
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            activeOpacity={1}
            onPress={() => setSelectedUser(null)}
          />
          <View style={as.overlay}>
            <ActionSheet
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onDone={() => load()}
              onPromptReason={(title, cb) => setPendingAction({ title, cb })}
              onPickBan={(cb) => setBanPickerCb(() => cb)}
            />
          </View>
        </View>
      )}

      <BanDurationSheet
        visible={!!banPickerCb}
        onClose={() => setBanPickerCb(null)}
        onSelect={(opt) => {
          banPickerCb?.(opt);
          setBanPickerCb(null);
        }}
      />

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
  count: { ...Typography.caption, color: '#6B7280', fontWeight: '600' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    backgroundColor: '#FFFFFF', borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED', paddingHorizontal: 12, height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, ...Typography.bodySm, color: '#111827', paddingVertical: 0 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, gap: 8, backgroundColor: '#FFFFFF',
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: { backgroundColor: '#111827' },
  filterText: { ...Typography.caption, color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#FFF' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F3', marginLeft: 72 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...Typography.bodyMed, color: Ping.purple, fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { ...Typography.bodyMed, color: '#111827', fontWeight: '600' },
  rowSub: { ...Typography.caption, color: '#6B7280' },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.sm },
  badgeText: { ...Typography.caption, fontWeight: '600', textTransform: 'capitalize' },
  strikes: { ...Typography.caption, color: '#D97706' },
  empty: { ...Typography.bodySm, color: '#9CA3AF', textAlign: 'center', marginTop: 48 },
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
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  name: { ...Typography.h3, color: '#111827' },
  sub: { ...Typography.caption, color: '#6B7280' },
  actions: { padding: Spacing.lg, gap: Spacing.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: '#F3F4F6',
  },
  actionText: { ...Typography.bodyMed, fontWeight: '600' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: Spacing.md,
    marginTop: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: '#F3F4F6',
  },
  cancelText: { ...Typography.bodyMed, color: '#6B7280' },
});
