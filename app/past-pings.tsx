import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { activitiesApi, type Activity } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ScreenHeader from '@/components/ScreenHeader';
import { EmptyState, AppButton } from '@/components/ui';
import { activityTypeMeta } from '@/constants/activityTypes';

const PAGE_SIZE = 10;

export default function PastPingsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [all, setAll] = useState<Activity[]>([]);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activitiesApi.past()
      .then((r) => setAll(r.activities))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shown = all.slice(0, shownCount);
  const hasMore = shownCount < all.length;

  function renderItem({ item: a }: { item: Activity }) {
    const cfg = activityTypeMeta(a.type);
    const when = new Date(a.expiresAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    return (
      <View style={[row.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[row.icon, { backgroundColor: `${cfg.color}18` }]}>
          <MaterialCommunityIcons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[row.title, { color: c.text }]} numberOfLines={1}>{a.title}</Text>
          <Text style={[row.meta, { color: c.textSecondary }]}>
            {when} · {a.participants?.length ?? 0} joined
          </Text>
        </View>
        <View style={[
          row.badge,
          { backgroundColor: a.status === 'cancelled' ? 'rgba(239,68,68,0.12)' : 'rgba(107,114,128,0.12)' },
        ]}>
          <Text style={[row.badgeText, { color: a.status === 'cancelled' ? '#EF4444' : c.textSecondary }]}>
            {a.status === 'cancelled' ? 'Cancelled' : 'Ended'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="Past Pings"
        onBack={() => router.back()}
        paddingTop={insets.top + 8}
      />

      {loading ? (
        <ActivityIndicator color={Ping.purpleLight} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, all.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="flash-outline"
              title="No past pings yet"
              subtitle="Pings you join or create will show up here after they end"
            />
          }
          ListFooterComponent={
            hasMore ? (
              <AppButton
                label="Load more"
                variant="secondary"
                size="sm"
                iconRight="chevron-down"
                onPress={() => setShownCount((n) => n + PAGE_SIZE)}
                style={{ marginHorizontal: Spacing.md, marginTop: 12 }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md, marginHorizontal: Spacing.md, marginVertical: 5,
    borderRadius: Radius.lg, borderWidth: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyMed, fontWeight: '600' },
  meta: { ...Typography.caption, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  badgeText: { fontSize: 11, fontWeight: '600' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingTop: 12 },
});
