import { useState, useRef, useEffect, useCallback, cloneElement } from 'react';
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
  ScrollView,
  Dimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activitiesApi, type Activity } from '@/lib/api';
import { useLocation } from '@/hooks/useLocation';
import ActivityCard from '@/components/ActivityCard';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmptyState } from '@/components/ui';
import * as Haptics from 'expo-haptics';
import {
  MagnifyingGlass,
  MapPin,
  CheckCircle,
  Star,
  Sparkle,
  X,
} from 'phosphor-react-native';

const SCREEN_W = Dimensions.get('window').width;

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

  const [tabIdx, setTabIdx] = useState(0);
  const [contentH, setContentH] = useState(600);

  const [nearbyActivities, setNearbyActivities] = useState<Activity[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<Activity[]>([]);
  const [mineActivities,   setMineActivities]   = useState<Activity[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [joinedLoading, setJoinedLoading] = useState(true);
  const [mineLoading,   setMineLoading]   = useState(true);

  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  const pageScrollRef = useRef<ScrollView>(null);
  const TAB_W = (SCREEN_W - Spacing.lg * 2 - 8 * (FILTERS.length - 1)) / FILTERS.length;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 1, damping: 18, stiffness: 160, mass: 0.9, useNativeDriver: true,
    }).start();
  }, []);

  async function loadNearby() {
    setNearbyLoading(true);
    try {
      const res = await activitiesApi.nearby(coords.latitude, coords.longitude);
      setNearbyActivities(res.activities ?? []);
    } catch {
      setNearbyActivities([]);
    } finally {
      setNearbyLoading(false);
    }
  }

  async function loadJoined() {
    setJoinedLoading(true);
    try {
      const res = await activitiesApi.joined();
      setJoinedActivities(res.activities ?? []);
    } catch {
      setJoinedActivities([]);
    } finally {
      setJoinedLoading(false);
    }
  }

  async function loadMine() {
    setMineLoading(true);
    try {
      const res = await activitiesApi.mine('all');
      const sorted = [...(res.activities ?? [])].sort((a, b) => {
        const aLive = a.status === 'live' ? 0 : 1;
        const bLive = b.status === 'live' ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
      });
      setMineActivities(sorted);
    } catch {
      setMineActivities([]);
    } finally {
      setMineLoading(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      loadNearby();
      loadJoined();
      loadMine();
    }
  }, [isFocused, coords.latitude, coords.longitude]);

  function switchTab(idx: number) {
    setTabIdx(idx);
    pageScrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
    Animated.spring(indicatorX, {
      toValue: idx * (TAB_W + 8),
      damping: 22, stiffness: 220, mass: 0.7,
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
        damping: 22, stiffness: 220, mass: 0.7,
        useNativeDriver: true,
      }).start();
      Haptics.selectionAsync();
    }
  }

  const EMPTY_LABEL: Record<Filter, string> = {
    nearby: 'No pings near you right now',
    joined: "You haven't joined any pings yet",
    mine:   "You haven't created any pings yet",
  };

  function renderPage(f: Filter) {
    const data    = f === 'nearby' ? nearbyActivities : f === 'joined' ? joinedActivities : mineActivities;
    const setData = f === 'nearby' ? setNearbyActivities : f === 'joined' ? setJoinedActivities : setMineActivities;
    const loading = f === 'nearby' ? nearbyLoading    : f === 'joined' ? joinedLoading    : mineLoading;
    const reload  = f === 'nearby' ? loadNearby       : f === 'joined' ? loadJoined       : loadMine;

    const q = searchQuery.trim().toLowerCase();
    const displayed = q
      ? data.filter((a) => a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q))
      : data;

    return (
      <View style={{ width: SCREEN_W, height: contentH }}>
        <FlatList
          data={displayed}
          keyExtractor={(a) => a._id}
          contentContainerStyle={[styles.list, displayed.length === 0 && { flexGrow: 1 }]}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={reload}
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
                subtitle={q ? 'No pings match your search' : EMPTY_LABEL[f]}
              />
            )
          }
          renderItem={({ item }) => (
            <ActivityCard
              activity={item}
              onJoin={() => {
                setData((prev) => prev.filter((a) => a._id !== item._id));
                reload();
              }}
            />
          )}
        />
      </View>
    );
  }

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

      {/* Search bar */}
      {searchOpen && (
        <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
          <MagnifyingGlass size={16} color={c.icon} weight="bold" />
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
              <X size={16} color={c.icon} weight="bold" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tab pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f, idx) => {
          const active = tabIdx === idx;
          const TabIcon = f.Icon;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }, active && styles.chipActive]}
              onPress={() => switchTab(idx)}
              activeOpacity={0.75}
            >
              <TabIcon size={14} color={active ? '#FFF' : c.textSecondary} weight={active ? 'fill' : 'bold'} />
              <Text style={[styles.chipLabel, { color: active ? '#FFF' : c.textSecondary }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Swipeable pages */}
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
          {FILTERS.map((f) => cloneElement(renderPage(f.key), { key: f.key }))}
        </ScrollView>
      </View>
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
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    paddingHorizontal: 14, height: 42,
    borderRadius: Radius.full, borderWidth: 1,
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
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 130, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
