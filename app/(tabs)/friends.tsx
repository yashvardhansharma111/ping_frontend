import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { friendsApi, usersApi, type Friendship, type User } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import SkeletonList from '@/components/SkeletonLoader';
import FadeInItem from '@/components/FadeInItem';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '@/lib/stores/authStore';
import SuccessToast from '@/components/SuccessToast';
import ConfirmSheet from '@/components/ConfirmSheet';
import AppAvatar from '@/components/AppAvatar';
import { EmptyState } from '@/components/ui';

type Tab = 'received' | 'sent' | 'friends';

const TAB_LABELS: Record<Tab, string> = {
  received: 'Received',
  sent:     'Sent',
  friends:  'Friends',
};

const TABS: Tab[] = ['received', 'sent', 'friends'];

// ── Add Friend Modal ──────────────────────────────────────────────────────────
function AddFriendModal({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: () => void }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { user: me } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await usersApi.search(text.trim());
        setResults((res.users ?? []).filter((u) => u._id !== me?._id));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function sendRequest(userId: string) {
    if (sending || sentIds.has(userId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(userId);
    try {
      await friendsApi.send(userId);
      setSentIds((prev) => new Set([...prev, userId]));
      onSent();
    } catch {
      // silently ignore — button returns to idle state
    } finally {
      setSending(null);
    }
  }

  function close() {
    setQuery('');
    setResults([]);
    setSentIds(new Set());
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={close} />
        <View style={[m.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={[m.handle, { backgroundColor: c.border }]} />

          <View style={[m.header, { borderBottomColor: c.border }]}>
            <Text style={[m.headerTitle, { color: c.text }]}>Add Friend</Text>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Ionicons name="close" size={22} color={c.icon} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
            <View style={[m.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.icon} />
              <TextInput
                style={[m.searchInput, { color: c.text }]}
                placeholder="Search by name or @username..."
                placeholderTextColor={c.textSecondary}
                value={query}
                onChangeText={onQueryChange}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searching && <ActivityIndicator size="small" color={Ping.purpleLight} />}
            </View>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={m.resultsList}
            style={{ maxHeight: 380 }}
          >
            {results.length === 0 && query.trim().length >= 2 && !searching ? (
              <View style={m.noResults}>
                <Ionicons name="person-outline" size={32} color={c.textSecondary} />
                <Text style={[m.noResultsText, { color: c.textSecondary }]}>No users found</Text>
              </View>
            ) : (
              results.map((u) => {
                const isSent = sentIds.has(u._id);
                const isLoading = sending === u._id;
                return (
                  <View key={u._id} style={[m.resultRow, { borderBottomColor: c.border }]}>
                    <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[m.resultName, { color: c.text }]} numberOfLines={1}>
                        {u.displayName ?? 'User'}
                      </Text>
                      {u.username ? (
                        <Text style={[m.resultSub, { color: c.textSecondary }]}>@{u.username}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[m.addBtn, isSent && m.addBtnSent]}
                      onPress={() => sendRequest(u._id)}
                      disabled={isSent || isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : isSent ? (
                        <Ionicons name="checkmark" size={16} color={Ping.green} />
                      ) : (
                        <Ionicons name="person-add" size={15} color="#FFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {query.trim().length < 2 && (
              <View style={m.hint}>
                <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
                <Text style={[m.hintText, { color: c.textSecondary }]}>
                  Type at least 2 characters to search
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...Typography.h3 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, ...Typography.bodySm },
  resultsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultName: { ...Typography.bodyMed },
  resultSub: { ...Typography.caption, marginTop: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnSent: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  noResults: { alignItems: 'center', paddingTop: 32, gap: Spacing.sm },
  noResultsText: { ...Typography.bodySm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  hintText: { ...Typography.caption, flex: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('received');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [received, setReceived] = useState<Friendship[]>([]);
  const [sent, setSent] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [acceptToast, setAcceptToast] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const [confirm, setConfirm] = useState({
    visible: false,
    title: '',
    subtitle: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Keep',
    danger: false,
    icon: 'alert-circle-outline' as React.ComponentProps<typeof Ionicons>['name'],
    onConfirm: () => {},
  });

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 1, damping: 18, stiffness: 160, mass: 0.9, useNativeDriver: true,
    }).start();
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    Haptics.selectionAsync();
  }

  async function load() {
    setLoading(true);
    try {
      const [fr, recv, snt] = await Promise.all([
        friendsApi.list(),
        friendsApi.requests('received'),
        friendsApi.requests('sent'),
      ]);
      setFriends((fr.friends ?? []).filter((f) => f.friend && f.friend.displayName !== 'Deleted user'));
      setReceived(recv.requests ?? []);
      setSent(snt.requests ?? []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function accept(userId: string) {
    try {
      await friendsApi.accept(userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAcceptToast(true);
      load();
    } catch (e: any) {
      setErrorToast(e.message || 'Something went wrong');
    }
  }

  function decline(userId: string) {
    setConfirm({
      visible: true,
      title: 'Decline this request?',
      subtitle: 'This will remove the pending request.',
      confirmLabel: 'Decline',
      cancelLabel: 'Keep',
      danger: true,
      icon: 'close-circle-outline',
      onConfirm: async () => {
        try { await friendsApi.reject(userId); load(); }
        catch (e: any) { setErrorToast(e.message || 'Something went wrong'); }
      },
    });
  }

  function cancelSent(userId: string, name: string) {
    setConfirm({
      visible: true,
      title: `Cancel request to ${name}?`,
      subtitle: 'Your request will be withdrawn. They won’t be notified.',
      confirmLabel: 'Cancel Request',
      cancelLabel: 'Keep',
      danger: true,
      icon: 'person-remove-outline',
      onConfirm: async () => {
        try { await friendsApi.reject(userId); load(); }
        catch (e: any) { setErrorToast(e.message || 'Something went wrong'); }
      },
    });
  }

  // Unfriend lives on the profile screen only — not in this list.

  function timeAgo(iso: string) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
  }

  // ── Render: Incoming request ───────────────────────────────────────────────
  function renderReceived({ item, index }: { item: Friendship; index: number }) {
    const u = item.friend;
    if (!u) return <View />;

    return (
      <FadeInItem delay={index * 55}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push(`/user/${u._id}`)}
          activeOpacity={0.85}
        >
          <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={52} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {u.displayName ?? 'User'}
            </Text>
            {u.username ? (
              <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
                @{u.username}
              </Text>
            ) : null}
            <Text style={[styles.timeLabel, { color: c.textSecondary }]}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
          <View style={styles.reqActions}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => accept(u._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.declineBtn, { borderColor: c.border }]}
              onPress={() => decline(u._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </FadeInItem>
    );
  }

  // ── Render: Outgoing request ───────────────────────────────────────────────
  function renderSent({ item, index }: { item: Friendship; index: number }) {
    const u = item.friend;
    if (!u) return <View />;

    return (
      <FadeInItem delay={index * 55}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push(`/user/${u._id}`)}
          activeOpacity={0.85}
        >
          <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={52} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {u.displayName ?? 'User'}
            </Text>
            <View style={styles.pendingBadge}>
              <View style={[styles.pendingDot, { backgroundColor: Ping.yellow }]} />
              <Text style={[styles.pendingText, { color: Ping.yellow }]}>Pending</Text>
            </View>
            <Text style={[styles.timeLabel, { color: c.textSecondary }]}>
              Sent {timeAgo(item.createdAt)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: c.border }]}
            onPress={() => cancelSent(u._id, u.displayName ?? 'User')}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </FadeInItem>
    );
  }

  // ── Render: Accepted friend card ──────────────────────────────────────────
  function renderFriend({ item, index }: { item: Friendship; index: number }) {
    const u = item.friend;
    if (!u || u.displayName === 'Deleted user') return <View />;

    const metaBits = [
      u.username ? `@${u.username}` : null,
      u.city || null,
      u.gender === 'female' ? 'Female' : u.gender === 'male' ? 'Male' : null,
    ].filter(Boolean) as string[];

    return (
      <FadeInItem delay={index * 55}>
        <TouchableOpacity
          style={[styles.card, styles.friendCard, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push(`/user/${u._id}`)}
          activeOpacity={0.8}
        >
          <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={56} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {u.displayName ?? 'User'}
            </Text>
            {metaBits.length > 0 ? (
              <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
                {metaBits.join(' · ')}
              </Text>
            ) : null}
            {u.bio?.trim() ? (
              <Text style={[styles.bio, { color: c.textSecondary }]} numberOfLines={2}>
                {u.bio.trim()}
              </Text>
            ) : u.institute ? (
              <Text style={[styles.bio, { color: c.textSecondary }]} numberOfLines={1}>
                {u.institute}
              </Text>
            ) : (
              <Text style={[styles.bioHint, { color: `${Ping.purpleLight}99` }]} numberOfLines={1}>
                Tap to view profile
              </Text>
            )}
          </View>
          <View style={[styles.chevronWrap, { backgroundColor: `${Ping.purple}18` }]}>
            <Ionicons name="chevron-forward" size={16} color={Ping.purpleLight} />
          </View>
        </TouchableOpacity>
      </FadeInItem>
    );
  }

  // ── Data and render dispatch ───────────────────────────────────────────────
  const dataMap: Record<Tab, Friendship[]> = {
    received,
    sent,
    friends,
  };
  const renderMap: Record<Tab, (info: { item: Friendship; index: number }) => React.ReactElement> = {
    received: renderReceived,
    sent:     renderSent,
    friends:  renderFriend,
  };

  const EMPTY: Record<Tab, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string }> = {
    received: {
      icon: 'mail-outline',
      title: 'No incoming requests',
      sub: 'When someone sends you a friend request, it shows up here',
    },
    sent: {
      icon: 'paper-plane-outline',
      title: 'No sent requests',
      sub: "Requests you send will appear here while they're pending",
    },
    friends: {
      icon: 'people-outline',
      title: 'No friends yet',
      sub: 'Search for people and send friend requests',
    },
  };

  const currentData = dataMap[tab];

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + 12 },
          {
            opacity: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
          },
        ]}
      >
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]}>Friends</Text>
          </View>
          <Text style={[styles.titleSub, { color: c.textSecondary }]}>
            {friends.length > 0
              ? `${friends.length} friend${friends.length === 1 ? '' : 's'}`
              : 'Find people near you'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: Ping.purple }]}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={18} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {TABS.map((t) => {
          const isActive = tab === t;
          const badge = t === 'received' && received.length > 0 ? received.length : null;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.chip,
                { borderColor: c.border, backgroundColor: c.surface },
                isActive && styles.chipActive,
              ]}
              onPress={() => switchTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipLabel, { color: c.textSecondary }, isActive && styles.chipLabelActive]}>
                {TAB_LABELS[t]}
              </Text>
              {badge !== null && (
                <View style={[styles.chipBadge, isActive ? styles.chipBadgeActive : { backgroundColor: Ping.purple }]}>
                  <Text style={styles.chipBadgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <SkeletonList count={6} variant="friends" />
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(i) => i._id}
          contentContainerStyle={[styles.list, currentData.length === 0 && { flex: 1 }]}
          renderItem={({ item, index }) => renderMap[tab]({ item, index })}
          ListEmptyComponent={
            <EmptyState
              icon={EMPTY[tab].icon}
              title={EMPTY[tab].title}
              subtitle={EMPTY[tab].sub}
              actionLabel={tab === 'friends' || tab === 'received' ? (tab === 'friends' ? 'Add friends' : 'Find people') : undefined}
              onAction={tab === 'friends' || tab === 'received' ? () => setShowAdd(true) : undefined}
            />
          }
        />
      )}

      <AddFriendModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSent={load}
      />

      <ConfirmSheet
        visible={confirm.visible}
        onClose={() => setConfirm((p) => ({ ...p, visible: false }))}
        title={confirm.title}
        subtitle={confirm.subtitle}
        confirmLabel={confirm.confirmLabel}
        cancelLabel={confirm.cancelLabel}
        danger={confirm.danger}
        icon={confirm.icon}
        onConfirm={confirm.onConfirm}
      />

      <SuccessToast
        visible={acceptToast}
        message="Friend request accepted!"
        subMessage="You're now connected"
        icon="people"
        color="#22C55E"
        onDone={() => setAcceptToast(false)}
      />

      <SuccessToast
        visible={!!errorToast}
        message={errorToast ?? ''}
        icon="alert-circle"
        color="#EF4444"
        onDone={() => setErrorToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  titleSub: { ...Typography.caption, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  chipLabel: { ...Typography.bodySm, fontWeight: '600', fontSize: 13 },
  chipLabelActive: { color: '#FFF' },
  chipBadge: {
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 130,
    gap: Spacing.sm,
  },
  friendCard: { alignItems: 'flex-start', paddingVertical: 14 },
  bio: { fontSize: 12, fontWeight: '400', lineHeight: 16, marginTop: 2 },
  bioHint: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  info: { flex: 1 },
  name: { ...Typography.bodyMed },
  sub: { ...Typography.caption, marginTop: 2 },
  timeLabel: { ...Typography.caption, fontSize: 11, marginTop: 3 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqActions: { flexDirection: 'row', gap: Spacing.xs },
  acceptBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Ping.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  declineBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pendingText: { fontSize: 11, fontWeight: '600' },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelBtnText: { ...Typography.caption, fontSize: 12, fontWeight: '600' },
});
