import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { activitiesApi, type Activity } from '@/lib/api';
import { useLocation } from '@/hooks/useLocation';
import ActivityCard from '@/components/ActivityCard';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'nearby' | 'joined' | 'mine';

const FILTERS: { key: Filter; label: string; icon: IoniconName }[] = [
  { key: 'nearby', label: 'Nearby',  icon: 'location-outline' },
  { key: 'joined', label: 'Joined',  icon: 'checkmark-circle-outline' },
  { key: 'mine',   label: 'Mine',    icon: 'star-outline' },
];

export default function ActivitiesScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const { coords } = useLocation();
  const [filter, setFilter] = useState<Filter>('nearby');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(f: Filter = filter) {
    setLoading(true);
    try {
      let res: { activities: Activity[] };
      if (f === 'nearby') res = await activitiesApi.nearby(coords.latitude, coords.longitude);
      else if (f === 'joined') res = await activitiesApi.joined();
      else res = await activitiesApi.mine();
      setActivities(res.activities ?? []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, [filter, coords.latitude]));

  function switchFilter(f: Filter) {
    setFilter(f);
    load(f);
  }

  const EMPTY_LABEL: Record<Filter, string> = {
    nearby: 'No pings near you right now',
    joined: 'You haven\'t joined any pings yet',
    mine: 'You haven\'t created any pings yet',
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>Activities</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Discover what's happening near you
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={18} color={c.icon} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                { borderColor: c.border, backgroundColor: c.surface },
                active && styles.chipActive,
              ]}
              onPress={() => switchFilter(f.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={f.icon} size={13} color={active ? '#FFF' : c.textSecondary} />
              <Text style={[styles.chipLabel, { color: active ? '#FFF' : c.textSecondary }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={activities}
        keyExtractor={(a) => a._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => load()}
            tintColor={Ping.purple}
            colors={[Ping.purple]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Ping.purpleLight} size="large" />
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${Ping.purple}18` }]}>
                <Ionicons name="flash-outline" size={36} color={Ping.purpleLight} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Nothing here</Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {EMPTY_LABEL[filter]}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <ActivityCard activity={item} onJoin={() => load()} />}
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
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { ...Typography.h2, fontSize: 26 },
  subtitle: { ...Typography.caption, marginTop: 2 },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  chipLabel: { ...Typography.bodySm, fontWeight: '600', fontSize: 13 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 130, gap: Spacing.sm },
  center: { paddingTop: 80, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: { ...Typography.bodyMed, fontSize: 17 },
  emptyText: { ...Typography.bodySm, textAlign: 'center' },
});
