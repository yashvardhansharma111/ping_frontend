import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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

function UserRow({ user, onAction }: { user: AdminUser; onAction: (u: AdminUser) => void }) {
  const statusColor = STATUS_COLOR[user.status] ?? '#9490C0';
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

function ActionSheet({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const isBanned = user.status === 'temp_banned' || user.status === 'perm_banned';
  const [loading, setLoading] = useState(false);

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

  function promptReason(title: string, onSubmit: (r: string) => void) {
    Alert.prompt(
      title, 'Enter a reason',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: (r) => r && onSubmit(r) }],
      'plain-text',
    );
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
            onPress={() => promptReason('Issue Warning', (r) => act(() => adminApi.warnUser(user._id, r), 'Warning issued'))}
          >
            <Ionicons name="warning-outline" size={20} color="#F97316" />
            <Text style={[as.actionText, { color: '#F97316' }]}>Issue Warning</Text>
          </TouchableOpacity>

          {!isBanned ? (
            <TouchableOpacity
              style={as.actionBtn}
              onPress={() =>
                Alert.alert('Ban Duration', '', [
                  { text: '1 day', onPress: () => promptReason('Temp Ban (1d)', (r) => act(() => adminApi.banUser(user._id, 'temp', r, 1), 'User temp banned')) },
                  { text: '7 days', onPress: () => promptReason('Temp Ban (7d)', (r) => act(() => adminApi.banUser(user._id, 'temp', r, 7), 'User temp banned')) },
                  { text: 'Permanent', style: 'destructive', onPress: () => promptReason('Permanent Ban', (r) => act(() => adminApi.banUser(user._id, 'perm', r), 'User permanently banned')) },
                  { text: 'Cancel', style: 'cancel' },
                ])
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

  async function load(search = q, f = filter, refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.users(search, f);
      setUsers(res.users ?? []);
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
        <Text style={s.title}>Users</Text>
        <Text style={s.count}>{total} total</Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color="#5C5A80" style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search name, @username, phone…"
          placeholderTextColor="#5C5A80"
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(q, filter, true)} tintColor={Ping.purpleLight} />}
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
  count: { ...Typography.caption, color: '#9490C0' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: '#11112A', borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)', paddingHorizontal: Spacing.md, height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, ...Typography.bodyMed, color: '#F1F0FF' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  filterText: { ...Typography.caption, color: '#9490C0', fontWeight: '600' },
  filterTextActive: { color: '#FFF' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  sep: { height: 1, backgroundColor: 'rgba(167,139,250,0.07)', marginLeft: 72 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...Typography.bodyMed, color: Ping.purpleLight, fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { ...Typography.bodyMed, color: '#F1F0FF' },
  rowSub: { ...Typography.caption, color: '#9490C0' },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.sm },
  badgeText: { ...Typography.caption, fontWeight: '600', textTransform: 'capitalize' },
  strikes: { ...Typography.caption, color: '#F97316' },
  empty: { ...Typography.bodySm, color: '#9490C0', textAlign: 'center', marginTop: 60 },
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
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  name: { ...Typography.h3, color: '#F1F0FF' },
  sub: { ...Typography.caption, color: '#9490C0' },
  actions: { padding: Spacing.lg, gap: Spacing.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.12)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionText: { ...Typography.bodyMed, fontWeight: '600' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: Spacing.md,
    marginTop: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelText: { ...Typography.bodyMed, color: '#9490C0' },
});
