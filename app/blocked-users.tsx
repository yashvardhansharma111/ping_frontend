import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppAvatar from '@/components/AppAvatar';
import ScreenHeader from '@/components/ScreenHeader';
import { friendsApi, type BlockedUser } from '@/lib/api';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function BlockedUsersScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await friendsApi.blocked();
      setUsers(res.users);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not load blocked users' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUnblock(userId: string) {
    if (unblocking) return;
    setUnblocking(userId);
    try {
      await friendsApi.unblock(userId);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      Toast.show({ type: 'success', text1: 'Unblocked' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not unblock user' });
    } finally {
      setUnblocking(null);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="Blocked Users"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Ping.purple} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No blocked users</Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>
            Users you block will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: c.border }]} />
          )}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: c.surface }]}>
              <AppAvatar uri={item.avatarUrl} name={item.displayName || item.username} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {item.displayName || item.username || 'Unknown'}
                </Text>
                {item.username ? (
                  <Text style={[styles.username, { color: c.textSecondary }]} numberOfLines={1}>
                    @{item.username}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.unblockBtn, { borderColor: Ping.purple }]}
                onPress={() => handleUnblock(item._id)}
                disabled={!!unblocking}
                activeOpacity={0.75}
              >
                {unblocking === item._id ? (
                  <ActivityIndicator size="small" color={Ping.purple} />
                ) : (
                  <Text style={[styles.unblockText, { color: Ping.purple }]}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyTitle: { ...Typography.bodyMed, fontWeight: '700', fontSize: 17 },
  emptySub: { ...Typography.bodySm, textAlign: 'center' },
  list: { padding: Spacing.lg, gap: 0 },
  sep: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  name: { ...Typography.bodyMed, fontWeight: '600' },
  username: { ...Typography.bodySm, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockText: { fontSize: 13, fontWeight: '700' },
});
