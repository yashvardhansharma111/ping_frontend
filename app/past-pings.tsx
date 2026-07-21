import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { activitiesApi, type Activity } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TYPE_CFG: Record<string, { icon: MCIName; color: string }> = {
  sport:   { icon: 'dumbbell',          color: '#EF4444' },
  food:    { icon: 'food-fork-drink',   color: '#F97316' },
  music:   { icon: 'music',             color: '#8B5CF6' },
  study:   { icon: 'book-open-variant', color: '#3B82F6' },
  outdoor: { icon: 'walk',              color: '#10B981' },
  gaming:  { icon: 'gamepad-variant',   color: '#EC4899' },
  meetup:  { icon: 'account-group',     color: '#7C3AED' },
  default: { icon: 'flash',             color: Ping.purpleLight },
};

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
    const cfg = TYPE_CFG[a.type] ?? TYPE_CFG.default;
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
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Past Pings</Text>
        <View style={{ width: 46 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purpleLight} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flash-outline" size={40} color={c.icon} />
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>No past pings yet</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: c.border }]}
                onPress={() => setShownCount((n) => n + PAGE_SIZE)}
                activeOpacity={0.8}
              >
                <Text style={[styles.loadMoreText, { color: Ping.purpleLight }]}>Load more</Text>
                <Ionicons name="chevron-down" size={16} color={Ping.purpleLight} />
              </TouchableOpacity>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3 },
  list: { paddingTop: 12 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyText: { ...Typography.bodyMed },
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: Spacing.md, marginTop: 12, marginBottom: 8,
    height: 44, borderRadius: Radius.md, borderWidth: 1.5,
  },
  loadMoreText: { ...Typography.bodySm, fontWeight: '700' },
});
