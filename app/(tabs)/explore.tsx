import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activitiesApi, type Activity } from '@/lib/api';
import { useLocation } from '@/hooks/useLocation';
import ActivityCard from '@/components/ActivityCard';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmptyState } from '@/components/ui';
import {
  MagnifyingGlass,
  MapPin,
  CheckCircle,
  Star,
  Sparkle,
  X,
} from 'phosphor-react-native';

type Filter = 'nearby' | 'joined' | 'mine';

const FILTERS: { key: Filter; label: string; Icon: typeof MapPin }[] = [
  { key: 'nearby', label: 'Nearby', Icon: MapPin },
  { key: 'joined', label: 'Joined', Icon: CheckCircle },
  { key: 'mine',   label: 'Mine',   Icon: Star },
];

export default function ActivitiesScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();
  const isFocused = useIsFocused();
  const [filter, setFilter] = useState<Filter>('nearby');
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  const headerAnim  = useRef(new Animated.Value(0)).current;
  const chipScales  = useRef<Record<Filter, Animated.Value>>({
    nearby: new Animated.Value(1),
    joined: new Animated.Value(1),
    mine:   new Animated.Value(1),
  }).current;
  const listOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 1, damping: 18, stiffness: 160, mass: 0.9, useNativeDriver: true,
    }).start();
  }, []);

  async function load(f: Filter = filter) {
    Animated.timing(listOpacity, { toValue: 0.4, duration: 120, useNativeDriver: true }).start();
    setLoading(true);
    try {
      let res: { activities: Activity[] };
      if (f === 'nearby') {
        res = await activitiesApi.nearby(coords.latitude, coords.longitude);
      } else if (f === 'joined') {
        res = await activitiesApi.joined();
      } else {
        res = await activitiesApi.mine();
      }
      setAllActivities(res.activities ?? []);
    } catch {
      setAllActivities([]);
    } finally {
      setLoading(false);
      Animated.spring(listOpacity, { toValue: 1, damping: 16, stiffness: 200, useNativeDriver: true }).start();
    }
  }

  // Re-run whenever the screen gains focus OR GPS coords update while focused
  useEffect(() => {
    if (isFocused) load();
  }, [filter, isFocused, coords.latitude, coords.longitude]);

  function switchFilter(f: Filter) {
    const sc = chipScales[f];
    Animated.sequence([
      Animated.spring(sc, { toValue: 0.82, damping: 20, stiffness: 500, useNativeDriver: true }),
      Animated.spring(sc, { toValue: 1,    damping: 12, stiffness: 220, mass: 0.8, useNativeDriver: true }),
    ]).start();
    setFilter(f);
    load(f);
  }

  const q = searchQuery.trim().toLowerCase();
  const displayedActivities = q
    ? allActivities.filter((a) =>
        a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)
      )
    : allActivities;

  const EMPTY_LABEL: Record<Filter, string> = {
    nearby:  'No pings near you right now',
    joined:  "You haven't joined any pings yet",
    mine:    "You haven't created any pings yet",
  };

  const headerOpacity    = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { borderBottomColor: c.border, opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] },
        ]}
      >
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]}>Activities</Text>
            <Sparkle size={18} color={Ping.purple} weight="fill" />
          </View>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Discover what's happening near you
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => {
              setSearchOpen((v) => {
                if (v) setSearchQuery('');
                else setTimeout(() => searchRef.current?.focus(), 80);
                return !v;
              });
            }}
            activeOpacity={0.8}
          >
            {searchOpen
              ? <X size={18} color={c.icon} weight="bold" />
              : <MagnifyingGlass size={18} color={c.icon} weight="bold" />}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Search bar — Reference Image 2 style capsule pill */}
      {searchOpen && (
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#F2F2F5',
              borderColor: c.border,
            },
          ]}
        >
          <MagnifyingGlass size={18} color={c.icon} weight="bold" />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: c.text }]}
            placeholder="What are you looking for?"
            placeholderTextColor={c.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={c.icon} weight="bold" />
            </TouchableOpacity>
          )}
        </View>
      )}


      {/* Feed type chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const TabIcon = f.Icon;
          return (
            <Animated.View key={f.key} style={{ flex: 1, transform: [{ scale: chipScales[f.key] }] }}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  { borderColor: c.border, backgroundColor: c.surface },
                  active && styles.chipActive,
                ]}
                onPress={() => switchFilter(f.key)}
                activeOpacity={0.75}
              >
                <TabIcon size={14} color={active ? '#FFF' : c.textSecondary} weight={active ? 'fill' : 'bold'} />
                <Text style={[styles.chipLabel, { color: active ? '#FFF' : c.textSecondary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View style={{ flex: 1, opacity: listOpacity }}>
        <FlatList
          data={displayedActivities}
          keyExtractor={(a) => a._id}
          contentContainerStyle={[styles.list, displayedActivities.length === 0 && { flexGrow: 1 }]}
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
              <EmptyState
                icon="flash-outline"
                title="Nothing here"
                subtitle={q ? 'No pings match your search' : EMPTY_LABEL[filter]}
              />
            )
          }
          renderItem={({ item }) => <ActivityCard activity={item} onJoin={() => load()} />}
        />
      </Animated.View>

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
    paddingTop: 8,
    paddingBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  subtitle: { ...Typography.caption, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterBtnLabel: { fontSize: 13, fontWeight: '600' },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: 16,
    height: 46,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
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
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 130, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
