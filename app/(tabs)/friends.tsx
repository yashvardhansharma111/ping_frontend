import { useState, useCallback, useRef, useEffect, cloneElement } from 'react';
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
  Dimensions,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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

const SCREEN_W = Dimensions.get('window').width;

type Tab = 'received' | 'sent' | 'friends' | 'discover';

const TAB_LABELS: Record<Tab, string> = {
  received: 'Received',
  sent:     'Sent',
  friends:  'Friends',
  discover: 'Discover',
};

const TABS: Tab[] = ['received', 'sent', 'friends', 'discover'];

// ── Add Friend Modal ──────────────────────────────────────────────────────────
function AddFriendModal({ visible, onClose, onSent, friendIds, pendingIds }: {
  visible: boolean; onClose: () => void; onSent: () => void;
  friendIds: Set<string>; pendingIds: Set<string>;
}) {
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
      // silently ignore
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
      <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={m.resultsList} style={{ maxHeight: 380 }}>
            {results.length === 0 && query.trim().length >= 2 && !searching ? (
              <View style={m.noResults}>
                <Ionicons name="person-outline" size={32} color={c.textSecondary} />
                <Text style={[m.noResultsText, { color: c.textSecondary }]}>No users found</Text>
              </View>
            ) : (
              results.map((u) => {
                const isFriend   = friendIds.has(u._id);
                const isPending  = pendingIds.has(u._id) || sentIds.has(u._id);
                const isLoading  = sending === u._id;
                const isDisabled = isFriend || isPending || isLoading;
                return (
                  <View key={u._id} style={[m.resultRow, { borderBottomColor: c.border }]}>
                    <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[m.resultName, { color: c.text }]} numberOfLines={1}>{u.displayName ?? 'User'}</Text>
                      {u.username ? <Text style={[m.resultSub, { color: c.textSecondary }]}>@{u.username}</Text> : null}
                    </View>
                    {isFriend ? (
                      <View style={m.friendBadge}>
                        <Ionicons name="people" size={13} color={Ping.purpleLight} />
                        <Text style={m.friendBadgeText}>Friends</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[m.addBtn, isPending && m.addBtnSent]}
                        onPress={() => sendRequest(u._id)}
                        disabled={isDisabled}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : isPending ? (
                          <Ionicons name="checkmark" size={16} color={Ping.green} />
                        ) : (
                          <Ionicons name="person-add" size={15} color="#FFF" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
            {query.trim().length < 2 && (
              <View style={m.hint}>
                <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
                <Text style={[m.hintText, { color: c.textSecondary }]}>Type at least 2 characters to search</Text>
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
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: Spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { ...Typography.h3 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 10, marginBottom: Spacing.sm },
  searchInput: { flex: 1, ...Typography.bodySm },
  resultsList: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultName: { ...Typography.bodyMed },
  resultSub: { ...Typography.caption, marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Ping.purple, alignItems: 'center', justifyContent: 'center' },
  addBtnSent: { backgroundColor: 'rgba(34,197,94,0.15)' },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: `${Ping.purple}18`,
    borderWidth: 1,
    borderColor: `${Ping.purpleLight}40`,
  },
  friendBadgeText: { color: Ping.purpleLight, fontSize: 11, fontWeight: '700' },
  noResults: { alignItems: 'center', paddingTop: 32, gap: Spacing.sm },
  noResultsText: { ...Typography.bodySm },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.lg, paddingHorizontal: Spacing.sm },
  hintText: { ...Typography.caption, flex: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: me } = useAuthStore();

  const [tabIdx, setTabIdx] = useState(0);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [received, setReceived] = useState<Friendship[]>([]);
  const [sent, setSent] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [acceptToast, setAcceptToast] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Discover state
  const [discoverUsers, setDiscoverUsers] = useState<User[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const [discoverSentIds, setDiscoverSentIds] = useState<Set<string>>(new Set());
  const [discoverSending, setDiscoverSending] = useState<string | null>(null);
  const [discoverFallback, setDiscoverFallback] = useState(false);
  const [discoverHasMore, setDiscoverHasMore] = useState(false);
  const [discoverPage, setDiscoverPage] = useState(0);
  const discoverCoordsRef = useRef<{ lat: number; lng: number }>({ lat: 22.7196, lng: 75.8577 });
  const discoverFetched = useRef(false);

  const [confirm, setConfirm] = useState({
    visible: false, title: '', subtitle: '', confirmLabel: 'Confirm', cancelLabel: 'Keep',
    danger: false, icon: 'alert-circle-outline' as React.ComponentProps<typeof Ionicons>['name'],
    onConfirm: () => {},
  });

  // Page scroll ref
  const pageScrollRef = useRef<ScrollView>(null);
  const [contentH, setContentH] = useState(600);

  // Animated tab indicator (sliding underline)
  const indicatorX = useRef(new Animated.Value(0)).current;
  const TAB_W = (SCREEN_W - Spacing.lg * 2 - 8 * (TABS.length - 1)) / TABS.length;

  // Header fade-in
  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, damping: 18, stiffness: 160, mass: 0.9, useNativeDriver: true }).start();
  }, []);

  function switchTab(idx: number) {
    setTabIdx(idx);
    pageScrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
    Animated.spring(indicatorX, {
      toValue: idx * (TAB_W + 8),
      damping: 22,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
    Haptics.selectionAsync();
  }

  function onPageScrollEnd(e: any) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== tabIdx) {
      setTabIdx(idx);
      Animated.spring(indicatorX, {
        toValue: idx * (TAB_W + 8),
        damping: 22,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
      Haptics.selectionAsync();
      }
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

  async function resolveCoords() {
    let lat = 22.7196, lng = 75.8577;
    const { status } = await Location.getForegroundPermissionsAsync();
    console.log('[discover] location permission status:', status);
    if (status === 'granted') {
      const last = await Location.getLastKnownPositionAsync();
      console.log('[discover] lastKnownPosition:', last ? `lat=${last.coords.latitude} lng=${last.coords.longitude} age=${Date.now() - last.timestamp}ms` : 'null');
      if (last) { lat = last.coords.latitude; lng = last.coords.longitude; }
    } else if (status === 'undetermined') {
      const { status: asked } = await Location.requestForegroundPermissionsAsync();
      console.log('[discover] permission after request:', asked);
      if (asked === 'granted') {
        const last = await Location.getLastKnownPositionAsync();
        console.log('[discover] lastKnownPosition after request:', last ? `lat=${last.coords.latitude} lng=${last.coords.longitude}` : 'null');
        if (last) { lat = last.coords.latitude; lng = last.coords.longitude; }
      }
    }
    console.log('[discover] resolved coords: lat=' + lat + ' lng=' + lng);
    return { lat, lng };
  }

  async function loadDiscover() {
    discoverFetched.current = true;
    setDiscoverLoading(true);
    console.log('[discover] loadDiscover start');
    try {
      const { lat, lng } = await resolveCoords();
      discoverCoordsRef.current = { lat, lng };
      console.log('[discover] calling usersApi.nearby lat=' + lat + ' lng=' + lng + ' radius=50000 page=0');
      const res = await usersApi.nearby(lat, lng, 50000, 0);
      console.log('[discover] response: ok=' + res.ok + ' users=' + (res.users?.length ?? 0) + ' fallback=' + res.fallback + ' hasMore=' + res.hasMore);
      setDiscoverFallback(!!res.fallback);
      setDiscoverHasMore(!!res.hasMore);
      setDiscoverPage(0);
      setDiscoverUsers(res.users ?? []);
    } catch (err: any) {
      console.error('[discover] loadDiscover error:', err?.message ?? err);
      setDiscoverUsers([]);
      setDiscoverFallback(false);
      setDiscoverHasMore(false);
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function loadMoreDiscover() {
    if (discoverLoadingMore || !discoverHasMore) return;
    setDiscoverLoadingMore(true);
    try {
      const { lat, lng } = discoverCoordsRef.current;
      const nextPage = discoverPage + 1;
      const seenIds = discoverUsers.map((u) => u._id);
      const res = await usersApi.nearby(lat, lng, 50000, nextPage, seenIds);
      const existingIds = new Set(seenIds);
      const fresh = (res.users ?? []).filter((u) => !existingIds.has(u._id));
      setDiscoverPage(nextPage);
      setDiscoverHasMore(!!res.hasMore);
      setDiscoverUsers((prev) => [...prev, ...fresh]);
    } catch {
      // keep existing list
    } finally {
      setDiscoverLoadingMore(false);
    }
  }

  async function sendDiscoverRequest(userId: string) {
    if (discoverSending || discoverSentIds.has(userId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDiscoverSending(userId);
    try {
      await friendsApi.send(userId);
      setDiscoverSentIds((prev) => new Set([...prev, userId]));
    } catch {
      // ignore
    } finally {
      setDiscoverSending(null);
    }
  }

  useFocusEffect(useCallback(() => {
    load();
    // Pre-fetch discover in the background so it's ready when user swipes to that tab
    discoverFetched.current = false;
    loadDiscover();
  }, []));

  async function accept(userId: string) {
    try {
      await friendsApi.accept(userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAcceptToast(true);
      load();
    } catch (e: any) { setErrorToast(e.message || 'Something went wrong'); }
  }

  function decline(userId: string) {
    setConfirm({
      visible: true, title: 'Decline this request?', subtitle: 'This will remove the pending request.',
      confirmLabel: 'Decline', cancelLabel: 'Keep', danger: true, icon: 'close-circle-outline',
      onConfirm: async () => {
        try { await friendsApi.reject(userId); load(); }
        catch (e: any) { setErrorToast(e.message || 'Something went wrong'); }
      },
    });
  }

  function cancelSent(userId: string, name: string) {
    setConfirm({
      visible: true, title: `Cancel request to ${name}?`, subtitle: "Your request will be withdrawn. They won't be notified.",
      confirmLabel: 'Cancel Request', cancelLabel: 'Keep', danger: true, icon: 'person-remove-outline',
      onConfirm: async () => {
        try { await friendsApi.reject(userId); load(); }
        catch (e: any) { setErrorToast(e.message || 'Something went wrong'); }
      },
    });
  }

  function timeAgo(iso: string) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  // ── Render: Incoming request ───────────────────────────────────────────────
  function renderReceived({ item, index }: { item: Friendship; index: number }) {
    const u = item.friend;
    if (!u) return <View />;
    return (
      <FadeInItem delay={index * 55}>
        <TouchableOpacity style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => router.push(`/user/${u._id}`)} activeOpacity={0.85}>
          <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={52} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{u.displayName ?? 'User'}</Text>
            {u.username ? <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>@{u.username}</Text> : null}
            <Text style={[styles.timeLabel, { color: c.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
          </View>
          <View style={styles.reqActions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => accept(u._id)} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.declineBtn, { borderColor: c.border }]} onPress={() => decline(u._id)} activeOpacity={0.8}>
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
        <TouchableOpacity style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => router.push(`/user/${u._id}`)} activeOpacity={0.85}>
          <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={52} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{u.displayName ?? 'User'}</Text>
            <View style={styles.pendingBadge}>
              <View style={[styles.pendingDot, { backgroundColor: Ping.yellow }]} />
              <Text style={[styles.pendingText, { color: Ping.yellow }]}>Pending</Text>
            </View>
            <Text style={[styles.timeLabel, { color: c.textSecondary }]}>Sent {timeAgo(item.createdAt)}</Text>
          </View>
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: c.border }]} onPress={() => cancelSent(u._id, u.displayName ?? 'User')} activeOpacity={0.8}>
            <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </FadeInItem>
    );
  }

  // ── Render: Accepted friend ────────────────────────────────────────────────
  function renderFriend({ item, index }: { item: Friendship; index: number }) {
    const u = item.friend;
    if (!u || u.displayName === 'Deleted user') return <View />;
    const metaBits = [u.username ? `@${u.username}` : null, u.city || null, u.gender === 'female' ? 'Female' : u.gender === 'male' ? 'Male' : null].filter(Boolean) as string[];
    return (
      <FadeInItem delay={index * 55}>
        <TouchableOpacity style={[styles.card, styles.friendCard, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => router.push(`/user/${u._id}`)} activeOpacity={0.8}>
          <AppAvatar uri={u.avatarUrl} name={u.displayName || u.phone} size={56} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{u.displayName ?? 'User'}</Text>
            {metaBits.length > 0 ? <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>{metaBits.join(' · ')}</Text> : null}
            {u.bio?.trim() ? (
              <Text style={[styles.bio, { color: c.textSecondary }]} numberOfLines={2}>{u.bio.trim()}</Text>
            ) : u.institute ? (
              <Text style={[styles.bio, { color: c.textSecondary }]} numberOfLines={1}>{u.institute}</Text>
            ) : (
              <Text style={[styles.bioHint, { color: `${Ping.purpleLight}99` }]} numberOfLines={1}>Tap to view profile</Text>
            )}
          </View>
          <View style={[styles.chevronWrap, { backgroundColor: `${Ping.purple}18` }]}>
            <Ionicons name="chevron-forward" size={16} color={Ping.purpleLight} />
          </View>
        </TouchableOpacity>
      </FadeInItem>
    );
  }

  // ── Render: Discover user card ─────────────────────────────────────────────
  function renderDiscoverUser({ item, index }: { item: User; index: number }) {
    const isSent = discoverSentIds.has(item._id);
    const isSending = discoverSending === item._id;
    const metaBits = [item.city, item.occupation ? item.occupation : null].filter(Boolean) as string[];
    return (
      <FadeInItem delay={index * 40}>
        <TouchableOpacity
          style={[styles.card, styles.friendCard, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push(`/user/${item._id}`)}
          activeOpacity={0.8}
        >
          <AppAvatar uri={item.avatarUrl} name={item.displayName || item.phone} size={52} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.displayName ?? 'User'}</Text>
            {item.username ? <Text style={[styles.sub, { color: c.textSecondary }]}>@{item.username}</Text> : null}
            {metaBits.length > 0 ? (
              <Text style={[styles.timeLabel, { color: c.textSecondary }]}>{metaBits.join(' · ')}</Text>
            ) : item.bio ? (
              <Text style={[styles.bio, { color: c.textSecondary }]} numberOfLines={1}>{item.bio}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.discoverAddBtn, isSent && styles.discoverAddBtnSent]}
            onPress={() => sendDiscoverRequest(item._id)}
            disabled={isSent || !!isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : isSent ? (
              <Ionicons name="checkmark" size={15} color={Ping.green} />
            ) : (
              <Ionicons name="person-add-outline" size={15} color="#FFF" />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </FadeInItem>
    );
  }

  // ── Page data / render helpers ─────────────────────────────────────────────
  const EMPTY_STATES = {
    received: { icon: 'mail-outline' as const, title: 'No incoming requests', sub: 'When someone sends you a friend request, it shows up here' },
    sent:     { icon: 'paper-plane-outline' as const, title: 'No sent requests', sub: "Requests you send will appear here while they're pending" },
    friends:  { icon: 'people-outline' as const, title: 'No friends yet', sub: 'Search for people and send friend requests' },
    discover: { icon: 'compass-outline' as const, title: 'No one new nearby', sub: 'Pull down to refresh' },
  };

  function renderPage(tab: Tab, h: number) {
    if (tab === 'discover') {
      return (
        <View style={{ width: SCREEN_W, height: h }}>
          {discoverLoading ? (
            <SkeletonList count={6} variant="friends" />
          ) : (
            <FlatList
              data={discoverUsers}
              keyExtractor={(i) => i._id}
              contentContainerStyle={[styles.list, discoverUsers.length === 0 && { flex: 1 }]}
              renderItem={renderDiscoverUser}
              nestedScrollEnabled
              ListHeaderComponent={
                discoverFallback && discoverUsers.length > 0 ? (
                  <View style={styles.fallbackBanner}>
                    <Ionicons name="earth-outline" size={13} color="#9CA3AF" />
                    <Text style={styles.fallbackBannerText}>No one within 50 km — showing people from across Ping</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                discoverUsers.length > 0 ? (
                  discoverHasMore ? (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={loadMoreDiscover}
                      disabled={discoverLoadingMore}
                      activeOpacity={0.8}
                    >
                      {discoverLoadingMore ? (
                        <ActivityIndicator size="small" color={Ping.purpleLight} />
                      ) : (
                        <>
                          <Ionicons name="chevron-down" size={15} color={Ping.purpleLight} />
                          <Text style={styles.loadMoreText}>Discover more</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.endText}>You've seen everyone nearby</Text>
                  )
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  icon={EMPTY_STATES.discover.icon}
                  title={EMPTY_STATES.discover.title}
                  subtitle={EMPTY_STATES.discover.sub}
                  actionLabel="Refresh"
                  onAction={() => { discoverFetched.current = false; loadDiscover(); }}
                />
              }
            />
          )}
        </View>
      );
    }

    const data = tab === 'received' ? received : tab === 'sent' ? sent : friends;
    const render = tab === 'received' ? renderReceived : tab === 'sent' ? renderSent : renderFriend;
    const empty = EMPTY_STATES[tab];

    return (
      <View style={{ width: SCREEN_W, height: h }}>
        {loading ? (
          <SkeletonList count={6} variant="friends" />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(i) => i._id}
            contentContainerStyle={[styles.list, data.length === 0 && { flex: 1 }]}
            renderItem={render as any}
            nestedScrollEnabled
            ListEmptyComponent={
              <EmptyState
                icon={empty.icon}
                title={empty.title}
                subtitle={empty.sub}
                actionLabel={tab === 'friends' || tab === 'received' ? (tab === 'friends' ? 'Add friends' : 'Find people') : undefined}
                onAction={tab === 'friends' || tab === 'received' ? () => setShowAdd(true) : undefined}
              />
            }
          />
        )}
      </View>
    );
  }

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
          <Text style={[styles.title, { color: c.text }]}>Friends</Text>
          <Text style={[styles.titleSub, { color: c.textSecondary }]}>
            {friends.length > 0 ? `${friends.length} friend${friends.length === 1 ? '' : 's'}` : 'Find people near you'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: Ping.purple }]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Ionicons name="person-add" size={18} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Tab pills with animated underline */}
      <View style={styles.filterRow}>
        {TABS.map((t, idx) => {
          const isActive = tabIdx === idx;
          const badge = t === 'received' && received.length > 0 ? received.length : null;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }, isActive && styles.chipActive]}
              onPress={() => switchTab(idx)}
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

      {/* Paged content with swipe support */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
      >
        <ScrollView
          ref={pageScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onPageScrollEnd}
          decelerationRate="fast"
          bounces={false}
          style={{ flex: 1 }}
        >
          {TABS.map((t) => cloneElement(renderPage(t, contentH), { key: t }))}
        </ScrollView>
      </View>

      <AddFriendModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSent={load}
        friendIds={new Set(friends.map((f) => f.friend?._id).filter(Boolean) as string[])}
        pendingIds={new Set(sent.map((s) => s.friend?._id).filter(Boolean) as string[])}
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

      <SuccessToast visible={acceptToast} message="Friend request accepted!" subMessage="You're now connected" icon="people" color="#22C55E" onDone={() => setAcceptToast(false)} />
      <SuccessToast visible={!!errorToast} message={errorToast ?? ''} icon="alert-circle" color="#EF4444" onDone={() => setErrorToast(null)} />
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
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  titleSub: { ...Typography.caption, marginTop: 2 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    shadowColor: Ping.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1,
  },
  chipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  chipLabel: { ...Typography.bodySm, fontWeight: '600', fontSize: 12 },
  chipLabelActive: { color: '#FFF' },
  chipBadge: { borderRadius: 8, minWidth: 16, height: 16, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', lineHeight: 14 },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 120, gap: Spacing.sm },
  fallbackBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  fallbackBannerText: { fontSize: 12, color: '#6B7280', flex: 1 },
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, marginTop: 4,
    borderRadius: Radius.lg, borderWidth: 1,
    borderColor: 'rgba(187,146,255,0.25)',
    backgroundColor: 'rgba(187,146,255,0.07)',
  },
  loadMoreText: { fontSize: 13, fontWeight: '600', color: Ping.purpleLight },
  endText: { textAlign: 'center', fontSize: 12, color: '#6B7280', paddingVertical: 16 },
  friendCard: { alignItems: 'flex-start', paddingVertical: 14 },
  bio: { fontSize: 12, fontWeight: '400', lineHeight: 16, marginTop: 2 },
  bioHint: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  chevronWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.sm },
  info: { flex: 1 },
  name: { ...Typography.bodyMed },
  sub: { ...Typography.caption, marginTop: 2 },
  timeLabel: { ...Typography.caption, fontSize: 11, marginTop: 3 },
  reqActions: { flexDirection: 'row', gap: Spacing.xs },
  acceptBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Ping.green, alignItems: 'center', justifyContent: 'center',
    shadowColor: Ping.green, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  declineBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  pendingDot: { width: 6, height: 6, borderRadius: 3 },
  pendingText: { fontSize: 11, fontWeight: '600' },
  cancelBtn: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnText: { ...Typography.caption, fontSize: 12, fontWeight: '600' },
  discoverAddBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Ping.purple,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Ping.purple, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  discoverAddBtnSent: { backgroundColor: 'rgba(34,197,94,0.12)', shadowOpacity: 0 },
});
