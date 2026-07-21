import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, TextInput, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { adminApi } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type PendingUser = {
  _id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  verificationSelfieUrl?: string;
  phone: string;
  createdAt: string;
};

function VerificationCard({
  user,
  onApprove,
  onReject,
}: {
  user: PendingUser;
  onApprove: () => void;
  onReject: () => void;
}) {
  const joined = new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <View style={c.card}>
      <View style={c.photos}>
        {user.avatarUrl ? (
          <View style={c.photoCol}>
            <Image source={{ uri: user.avatarUrl }} style={c.photo} />
            <Text style={c.photoLabel}>Profile</Text>
          </View>
        ) : (
          <View style={[c.photoCol]}>
            <View style={[c.photo, c.photoPlaceholder]}>
              <Ionicons name="person" size={32} color="#5C5A80" />
            </View>
            <Text style={c.photoLabel}>Profile</Text>
          </View>
        )}
        <Ionicons name="swap-horizontal-outline" size={22} color="#5C5A80" style={{ alignSelf: 'center' }} />
        {user.verificationSelfieUrl ? (
          <View style={c.photoCol}>
            <Image source={{ uri: user.verificationSelfieUrl }} style={c.photo} />
            <Text style={c.photoLabel}>Selfie</Text>
          </View>
        ) : (
          <View style={c.photoCol}>
            <View style={[c.photo, c.photoPlaceholder]}>
              <Ionicons name="camera" size={32} color="#5C5A80" />
            </View>
            <Text style={c.photoLabel}>Selfie</Text>
          </View>
        )}
      </View>

      <View style={c.info}>
        <Text style={c.name}>{user.displayName ?? 'Unnamed'}</Text>
        {user.username ? <Text style={c.username}>@{user.username}</Text> : null}
        <Text style={c.meta}>{user.phone} · Joined {joined}</Text>
      </View>

      <View style={c.actions}>
        <TouchableOpacity style={c.approveBtn} onPress={onApprove}>
          <Ionicons name="checkmark-circle" size={16} color="#FFF" />
          <Text style={c.approveBtnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={c.rejectBtn} onPress={onReject}>
          <Ionicons name="close-circle" size={16} color="#EF4444" />
          <Text style={c.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: '#11112A',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    padding: Spacing.md,
    gap: 12,
  },
  photos: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, justifyContent: 'center' },
  photoCol: { alignItems: 'center', gap: 6 },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    backgroundColor: '#1A1A38',
    alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { ...Typography.caption, color: '#5C5A80' },
  info: { gap: 2 },
  name: { ...Typography.h4, color: '#F1F0FF' },
  username: { ...Typography.bodySm, color: '#9490C0' },
  meta: { ...Typography.caption, color: '#5C5A80' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  approveBtnText: { ...Typography.bodySm, color: '#22C55E', fontWeight: '700' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  rejectBtnText: { ...Typography.bodySm, color: '#EF4444', fontWeight: '700' },
});

// ── Reject reason modal ───────────────────────────────────────────────────────

function RejectModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <Text style={rm.title}>Rejection Reason</Text>
          <Text style={rm.sub}>This will be shown to the user so they can try again.</Text>
          <TextInput
            style={rm.input}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Face not clearly visible"
            placeholderTextColor="#5C5A80"
            multiline
            maxLength={200}
          />
          <View style={rm.btns}>
            <TouchableOpacity style={rm.cancelBtn} onPress={onClose}>
              <Text style={rm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.confirmBtn, !reason.trim() && rm.confirmBtnDisabled]}
              onPress={() => reason.trim() && onConfirm(reason.trim())}
              disabled={!reason.trim()}
            >
              <Text style={rm.confirmText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: '#11112A', borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', gap: 12 },
  title: { ...Typography.h4, color: '#F1F0FF' },
  sub: { ...Typography.bodySm, color: '#9490C0' },
  input: {
    backgroundColor: '#1A1A38', borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)', padding: 12, color: '#F1F0FF',
    ...Typography.body, minHeight: 80, textAlignVertical: 'top',
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.sm,
  },
  cancelText: { ...Typography.bodySm, color: '#9490C0', fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: Radius.sm,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { ...Typography.bodySm, color: '#EF4444', fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AdminVerifications() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<string | null>(null);

  async function load(p = 1, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else if (p === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await adminApi.pendingVerifications(p);
      if (p === 1) setUsers(res.users);
      else setUsers((prev) => [...prev, ...res.users]);
      setTotal(res.total);
      setPage(p);
    } catch (err: any) {
      if (err.message !== 'Not authenticated') {
        Toast.show({ type: 'error', text1: 'Error', text2: err.message });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  useFocusEffect(useCallback(() => { load(1); }, []));

  async function confirmApprove() {
    if (!approveTarget) return;
    const id = approveTarget;
    setApproveTarget(null);
    try {
      await adminApi.approveVerification(id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      setTotal((t) => t - 1);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  }

  async function handleReject(id: string, reason: string) {
    try {
      await adminApi.rejectVerification(id, reason);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      setTotal((t) => t - 1);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
    setRejectTarget(null);
  }

  const hasMore = users.length < total;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Verifications</Text>
          <Text style={s.headerSub}>{total} pending review</Text>
        </View>
        <View style={[s.badge, total > 0 && s.badgeLive]}>
          <Text style={s.badgeText}>{total}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor={Ping.purpleLight} />
          }
          renderItem={({ item }) => (
            <VerificationCard
              user={item}
              onApprove={() => setApproveTarget(item._id)}
              onReject={() => setRejectTarget(item._id)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#2A2A50" />
              <Text style={s.emptyTitle}>No pending verifications</Text>
              <Text style={s.emptySub}>All caught up! New submissions will appear here.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={s.loadMore} onPress={() => load(page + 1)}>
                {loadingMore ? <ActivityIndicator color={Ping.purple} /> : <Text style={s.loadMoreText}>Load more</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <ConfirmSheet
        visible={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve verification?"
        subtitle="This user will receive a Verified badge."
        confirmLabel="Approve"
        cancelLabel="Cancel"
        onConfirm={confirmApprove}
        icon="checkmark-circle-outline"
      />

      <RejectModal
        visible={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget, reason)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080815' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  headerTitle: { ...Typography.h3, color: '#F1F0FF' },
  headerSub: { ...Typography.caption, color: '#9490C0', marginTop: 2 },
  badge: {
    minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8,
    backgroundColor: '#1A1A38', alignItems: 'center', justifyContent: 'center',
  },
  badgeLive: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  badgeText: { ...Typography.caption, color: '#EF4444', fontWeight: '800' },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { ...Typography.h3, color: '#5C5A80' },
  emptySub: { ...Typography.bodySm, color: '#2A2A50', textAlign: 'center', maxWidth: 260 },
  loadMore: { alignItems: 'center', paddingVertical: Spacing.lg },
  loadMoreText: { ...Typography.bodyMed, color: Ping.purpleLight },
});
