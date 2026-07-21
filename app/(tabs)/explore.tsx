import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

interface ActiveFilters {
  distance: number | null;
  vibe: string | null;
  category: string | null;
}

const DEFAULT_FILTERS: ActiveFilters = { distance: null, vibe: null, category: null };

const DISTANCE_OPTIONS = [
  { label: '500 m', meters: 500 },
  { label: '1 km',  meters: 1000 },
  { label: '2 km',  meters: 2000 },
  { label: '5 km',  meters: 5000 },
];

const VIBE_OPTIONS: { key: string; label: string; icon: IoniconName }[] = [
  { key: 'cozy',        label: 'Cozy',        icon: 'cafe-outline' },
  { key: 'fun',         label: 'Fun',         icon: 'happy-outline' },
  { key: 'exciting',    label: 'Exciting',    icon: 'flash-outline' },
  { key: 'chill',       label: 'Chill',       icon: 'leaf-outline' },
  { key: 'networking',  label: 'Networking',  icon: 'business-outline' },
  { key: 'fitness',     label: 'Fitness',     icon: 'barbell-outline' },
];

const CATEGORY_OPTIONS: { key: string; label: string; icon: IoniconName }[] = [
  { key: 'sport',   label: 'Sport',   icon: 'football-outline' },
  { key: 'food',    label: 'Food',    icon: 'restaurant-outline' },
  { key: 'music',   label: 'Music',   icon: 'musical-notes-outline' },
  { key: 'study',   label: 'Study',   icon: 'book-outline' },
  { key: 'outdoor', label: 'Outdoor', icon: 'partly-sunny-outline' },
  { key: 'gaming',  label: 'Gaming',  icon: 'game-controller-outline' },
  { key: 'meetup',  label: 'Meetup',  icon: 'people-outline' },
];

function countActive(f: ActiveFilters): number {
  return (f.distance !== null ? 1 : 0) + (f.vibe !== null ? 1 : 0) + (f.category !== null ? 1 : 0);
}

export default function ActivitiesScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();
  const isFocused = useIsFocused();
  const [filter, setFilter] = useState<Filter>('nearby');
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
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

  async function load(f: Filter = filter, filters: ActiveFilters = activeFilters) {
    Animated.timing(listOpacity, { toValue: 0.4, duration: 120, useNativeDriver: true }).start();
    setLoading(true);
    try {
      let res: { activities: Activity[] };
      if (f === 'nearby') {
        res = await activitiesApi.nearby(coords.latitude, coords.longitude, filters.distance ?? undefined);
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

  function openFilterSheet() {
    setPendingFilters(activeFilters);
    setShowFilterSheet(true);
  }

  function applyFilters() {
    setActiveFilters(pendingFilters);
    setShowFilterSheet(false);
    load(filter, pendingFilters);
  }

  function clearAllFilters() {
    setActiveFilters(DEFAULT_FILTERS);
    load(filter, DEFAULT_FILTERS);
  }

  // Distance is sent to the API; vibe, category, and search are filtered client-side
  const q = searchQuery.trim().toLowerCase();
  const displayedActivities = allActivities.filter((a) => {
    if (activeFilters.vibe && a.vibe !== activeFilters.vibe) return false;
    if (activeFilters.category && a.type !== activeFilters.category) return false;
    if (q && !a.title.toLowerCase().includes(q) && !(a.description ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  const activeCount = countActive(activeFilters);

  const EMPTY_LABEL: Record<Filter, string> = {
    nearby:  'No pings near you right now',
    joined:  "You haven't joined any pings yet",
    mine:    "You haven't created any pings yet",
  };

  const headerOpacity    = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { borderBottomColor: c.border, opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] },
        ]}
      >
        <View>
          <View style={styles.titleRow}>
            <Image source={require('../../assets/images/icon.png')} style={styles.headerIcon} />
            <Text style={[styles.title, { color: c.text }]}>Activities</Text>
          </View>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Discover what's happening near you
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: c.surface, borderColor: activeCount > 0 ? Ping.purple : c.border }]}
            onPress={openFilterSheet}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={16} color={activeCount > 0 ? c.tint : c.icon} />
            <Text style={[styles.filterBtnLabel, { color: activeCount > 0 ? c.tint : c.textSecondary }]}>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </TouchableOpacity>
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
            <Ionicons name={searchOpen ? 'close' : 'search'} size={18} color={c.icon} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Search bar */}
      {searchOpen && (
        <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="search" size={16} color={c.icon} />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Search pings by name..."
            placeholderTextColor={c.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.icon} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Feed type chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Animated.View key={f.key} style={{ transform: [{ scale: chipScales[f.key] }] }}>
              <TouchableOpacity
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
            </Animated.View>
          );
        })}
      </View>

      {/* Active filter pills */}
      {activeCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activePillsRow}
        >
          {activeFilters.distance !== null && (
            <TouchableOpacity
              style={styles.activePill}
              onPress={() => {
                const f = { ...activeFilters, distance: null };
                setActiveFilters(f);
                load(filter, f);
              }}
            >
              <Text style={[styles.activePillText, { color: c.tint }]}>
                {DISTANCE_OPTIONS.find(d => d.meters === activeFilters.distance)?.label ?? 'Distance'}
              </Text>
              <Ionicons name="close" size={12} color={c.tint} />
            </TouchableOpacity>
          )}
          {activeFilters.vibe !== null && (
            <TouchableOpacity
              style={styles.activePill}
              onPress={() => setActiveFilters((prev) => ({ ...prev, vibe: null }))}
            >
              <Text style={[styles.activePillText, { color: c.tint }]}>
                {VIBE_OPTIONS.find(v => v.key === activeFilters.vibe)?.label ?? activeFilters.vibe}
              </Text>
              <Ionicons name="close" size={12} color={c.tint} />
            </TouchableOpacity>
          )}
          {activeFilters.category !== null && (
            <TouchableOpacity
              style={styles.activePill}
              onPress={() => setActiveFilters((prev) => ({ ...prev, category: null }))}
            >
              <Text style={[styles.activePillText, { color: c.tint }]}>
                {CATEGORY_OPTIONS.find(cat => cat.key === activeFilters.category)?.label ?? activeFilters.category}
              </Text>
              <Ionicons name="close" size={12} color={c.tint} />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <Animated.View style={{ flex: 1, opacity: listOpacity }}>
        <FlatList
          data={displayedActivities}
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
                  {activeCount > 0 ? 'No pings match your filters' : EMPTY_LABEL[filter]}
                </Text>
                {activeCount > 0 && (
                  <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                    <Text style={[styles.clearFiltersText, { color: c.tint }]}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          renderItem={({ item }) => <ActivityCard activity={item} onJoin={() => load()} />}
        />
      </Animated.View>

      {/* ── Filter Bottom Sheet ───────────────────────────────────────────── */}
      <Modal
        visible={showFilterSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <View style={fs.overlay}>
          <TouchableOpacity style={fs.backdrop} activeOpacity={1} onPress={() => setShowFilterSheet(false)} />
          <View style={[fs.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={[fs.handle, { backgroundColor: c.border }]} />

            <View style={[fs.sheetHeader, { borderBottomColor: c.border }]}>
              <Text style={[fs.sheetTitle, { color: c.text }]}>Filter Pings</Text>
              <TouchableOpacity onPress={() => setPendingFilters(DEFAULT_FILTERS)}>
                <Text style={fs.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={fs.sheetBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Distance — only meaningful for nearby mode */}
              {filter === 'nearby' && (
                <>
                  <Text style={[fs.sectionLabel, { color: c.textSecondary }]}>Distance</Text>
                  <View style={fs.optionRow}>
                    {DISTANCE_OPTIONS.map((d) => {
                      const active = pendingFilters.distance === d.meters;
                      return (
                        <TouchableOpacity
                          key={d.label}
                          style={[
                            fs.optionChip,
                            { borderColor: c.border, backgroundColor: c.card },
                            active && fs.optionChipActive,
                          ]}
                          onPress={() => setPendingFilters((p) => ({ ...p, distance: active ? null : d.meters }))}
                          activeOpacity={0.75}
                        >
                          <Text style={[fs.optionChipLabel, { color: active ? '#FFF' : c.textSecondary }]}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Vibe */}
              <Text style={[fs.sectionLabel, { color: c.textSecondary }]}>Vibe</Text>
              <View style={fs.optionWrap}>
                {VIBE_OPTIONS.map((v) => {
                  const active = pendingFilters.vibe === v.key;
                  return (
                    <TouchableOpacity
                      key={v.key}
                      style={[
                        fs.optionChip,
                        { borderColor: c.border, backgroundColor: c.card },
                        active && fs.optionChipActive,
                      ]}
                      onPress={() => setPendingFilters((p) => ({ ...p, vibe: active ? null : v.key }))}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={v.icon} size={13} color={active ? '#FFF' : c.textSecondary} />
                      <Text style={[fs.optionChipLabel, { color: active ? '#FFF' : c.textSecondary }]}>
                        {v.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category */}
              <Text style={[fs.sectionLabel, { color: c.textSecondary }]}>Category</Text>
              <View style={fs.optionWrap}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = pendingFilters.category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        fs.optionChip,
                        { borderColor: c.border, backgroundColor: c.card },
                        active && fs.optionChipActive,
                      ]}
                      onPress={() => setPendingFilters((p) => ({ ...p, category: active ? null : cat.key }))}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={cat.icon} size={13} color={active ? '#FFF' : c.textSecondary} />
                      <Text style={[fs.optionChipLabel, { color: active ? '#FFF' : c.textSecondary }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[fs.applyWrap, { borderTopColor: c.border }]}>
              <TouchableOpacity style={fs.applyBtn} onPress={applyFilters} activeOpacity={0.85}>
                <Text style={fs.applyBtnText}>Apply Filters</Text>
                {countActive(pendingFilters) > 0 && (
                  <View style={fs.applyBadge}>
                    <Text style={fs.applyBadgeText}>{countActive(pendingFilters)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 28, height: 28 },
  title: { ...Typography.h2, fontSize: 26 },
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
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
  activePillsRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: `${Ping.purple}22`,
    borderWidth: 1,
    borderColor: `${Ping.purple}44`,
  },
  activePillText: { fontSize: 12, color: Ping.purpleLight, fontWeight: '600' },
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
  clearFiltersBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: `${Ping.purple}22`,
    borderWidth: 1,
    borderColor: `${Ping.purple}44`,
  },
  clearFiltersText: { color: Ping.purpleLight, fontWeight: '600', fontSize: 13 },
});

const fs = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { ...Typography.h3 },
  resetText: { color: Ping.purpleLight, fontSize: 14, fontWeight: '600' },
  sheetBody: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  optionWrap: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  optionChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  optionChipLabel: { fontSize: 13, fontWeight: '600' },
  applyWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyBtn: {
    backgroundColor: Ping.purple,
    borderRadius: Radius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  applyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  applyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});
