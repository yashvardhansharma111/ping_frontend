import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { friendsApi, chatApi, usersApi, type Friendship, type User } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '@/lib/stores/authStore';

type Tab = 'friends' | 'requests';

// ── Avatar helper ─────────────────────────────────────────────────────────────
function Avatar({ user, size = 48 }: { user: Pick<User, 'displayName' | 'phone' | 'avatarUrl'>; size?: number }) {
  const initials = ((user.displayName ?? user.phone ?? '?'))
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  wrap: {
    backgroundColor: `${Ping.purple}55`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#FFF', fontWeight: '700' },
});

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
    setSending(userId);
    try {
      await friendsApi.send(userId);
      setSentIds((prev) => new Set([...prev, userId]));
      onSent();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send request.');
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
          {/* Handle */}
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
                    <Avatar user={u} size={44} />
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
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [openingDm, setOpeningDm] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [fr, rq] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
      setFriends(fr.friends ?? []);
      setRequests(rq.requests ?? []);
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
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function reject(userId: string) {
    Alert.alert('Decline request?', 'This will remove the pending request.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try { await friendsApi.reject(userId); load(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }

  async function removeFriend(userId: string, name: string) {
    Alert.alert(`Remove ${name}?`, 'They will no longer be in your friends list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try { await friendsApi.remove(userId); load(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }

  async function openDm(userId: string) {
    if (openingDm) return;
    setOpeningDm(userId);
    try {
      const res = await chatApi.openDm(userId);
      router.push(`/chat/${res.room._id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open chat.');
    } finally {
      setOpeningDm(null);
    }
  }

  function renderFriend({ item }: { item: Friendship }) {
    const u = item.friend;
    const isDmLoading = openingDm === u._id;
    return (
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Avatar user={u} size={48} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {u.displayName ?? 'User'}
          </Text>
          <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
            {u.username ? `@${u.username}` : u.phone}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: `${Ping.purple}22`, borderColor: c.border }]}
          onPress={() => openDm(u._id)}
          disabled={!!openingDm}
          activeOpacity={0.75}
        >
          {isDmLoading ? (
            <ActivityIndicator size="small" color={Ping.purpleLight} />
          ) : (
            <Ionicons name="chatbubble" size={16} color={Ping.purpleLight} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: c.border }]}
          onPress={() => removeFriend(u._id, u.displayName ?? 'this user')}
          activeOpacity={0.75}
        >
          <Ionicons name="person-remove-outline" size={16} color={c.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderRequest({ item }: { item: Friendship }) {
    const u = item.friend;
    return (
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Avatar user={u} size={48} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {u.displayName ?? 'User'}
          </Text>
          <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
            {u.username ? `@${u.username}` : u.phone}
          </Text>
        </View>
        <View style={styles.reqActions}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => accept(u._id)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineBtn, { borderColor: c.border }]}
            onPress={() => reject(u._id)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={18} color={c.icon} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const data = tab === 'friends' ? friends : requests;
  const renderItem = tab === 'friends' ? renderFriend : renderRequest;

  const EMPTY: Record<Tab, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string }> = {
    friends: {
      icon: 'people-outline',
      title: 'No friends yet',
      sub: 'Search for people to add as friends',
    },
    requests: {
      icon: 'mail-outline',
      title: 'No pending requests',
      sub: 'When someone adds you, it shows up here',
    },
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>Friends</Text>
          <Text style={[styles.titleSub, { color: c.textSecondary }]}>
            {friends.length > 0 ? `${friends.length} friend${friends.length === 1 ? '' : 's'}` : 'Find people near you'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: Ping.purple }]}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
        {(['friends', 'requests'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && { borderBottomColor: Ping.purple }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, { color: tab === t ? Ping.purpleLight : c.textSecondary }]}>
              {t === 'friends' ? 'Friends' : `Requests${requests.length > 0 ? ` · ${requests.length}` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Ping.purpleLight} size="large" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i._id}
          contentContainerStyle={[styles.list, data.length === 0 && { flex: 1 }]}
          renderItem={renderItem as any}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${Ping.purple}18` }]}>
                <Ionicons name={EMPTY[tab].icon} size={36} color={Ping.purpleLight} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>{EMPTY[tab].title}</Text>
              <Text style={[styles.emptySub, { color: c.textSecondary }]}>{EMPTY[tab].sub}</Text>
              {tab === 'friends' && (
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setShowAdd(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-add" size={16} color="#FFF" />
                  <Text style={styles.emptyAddText}>Add friends</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <AddFriendModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSent={load}
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
  title: { ...Typography.h2, fontSize: 26 },
  titleSub: { ...Typography.caption, marginTop: 2 },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: Spacing.lg,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { ...Typography.bodyMed, fontSize: 14 },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 130, gap: Spacing.sm },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: { ...Typography.bodyMed, fontSize: 18 },
  emptySub: { ...Typography.bodySm, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Ping.purple,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  emptyAddText: { ...Typography.bodySm, color: '#FFF', fontWeight: '700' },
});
