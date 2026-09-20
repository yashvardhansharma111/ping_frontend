import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
  Platform, Animated, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import useNotificationStore from '@/lib/stores/notificationStore';
import { friendsApi, usersApi, type User } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import AppAvatar from '@/components/AppAvatar';

export default function AddFriendModal() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { user: me } = useAuthStore();

  const visible = useNotificationStore((s) => s.showAddFriend);
  const setVisible = useNotificationStore((s) => s.setShowAddFriend);
  const friendIds = useNotificationStore((s) => s.friendIds);
  const pendingIds = useNotificationStore((s) => s.pendingIds);
  const onSentCallback = useNotificationStore((s) => s.addFriendOnSentCallback);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide-up animation (native driver — translateY only)
  const slideY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keyboard offset — non-native driver (bottom position)
  const kbOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 26, stiffness: 300, mass: 0.8, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Keyboard listeners — move sheet up/down without KAV
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(kbOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(kbOffset, {
        toValue: 0,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  function onQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await usersApi.search(text.trim());
        setResults((res.users ?? []).filter((u: User) => u._id !== me?._id));
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
      onSentCallback?.();
    } catch {
    } finally {
      setSending(null);
    }
  }

  function close() {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setSentIds(new Set());
    setVisible(false);
  }

  if (!visible && slideY.__getValue() >= 599) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, m.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Sheet — bottom tracks keyboard via kbOffset */}
      <Animated.View
        style={[m.kavWrap, { bottom: kbOffset }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[m.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md, transform: [{ translateY: slideY }] }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
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
                autoFocus={visible}
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
            style={{ maxHeight: 340 }}
          >
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
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const m = StyleSheet.create({
  backdrop:  { backgroundColor: 'rgba(0,0,0,0.55)' },
  kavWrap:   { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:     { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: Spacing.sm },
  handle:    { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:  { ...Typography.h3 },
  searchBar:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 10, marginBottom: Spacing.sm },
  searchInput:  { flex: 1, ...Typography.bodySm },
  resultsList:  { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  resultRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultName:   { ...Typography.bodyMed },
  resultSub:    { ...Typography.caption, marginTop: 1 },
  addBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Ping.purple, alignItems: 'center', justifyContent: 'center' },
  addBtnSent:   { backgroundColor: 'rgba(34,197,94,0.15)' },
  friendBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: `${Ping.purple}18`, borderWidth: 1, borderColor: `${Ping.purpleLight}40` },
  friendBadgeText: { color: Ping.purpleLight, fontSize: 11, fontWeight: '700' },
  noResults:    { alignItems: 'center', paddingTop: 32, gap: Spacing.sm },
  noResultsText: { ...Typography.bodySm },
  hint:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.lg, paddingHorizontal: Spacing.sm },
  hintText:     { ...Typography.caption, flex: 1 },
});
