import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView,
  RefreshControl, ActivityIndicator, PanResponder, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocation } from '@/hooks/useLocation';
import { eventsApi, type PingEvent } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import AppAvatar from '@/components/AppAvatar';
import { Ping, Spacing, Radius, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { openEventLocation, eventPlaceLabel, isLiveNow, fmtDate, fmtTime } from '@/lib/eventUtils';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round((SCREEN_W - Spacing.lg * 2) * 0.62); // fixed aspect so every hero matches
const THUMB = 76;
const BOOKMARK_KEY = 'events:bookmarks';

type FilterKey = 'all' | 'event' | 'offer';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'event', label: 'Events' },
  { key: 'offer', label: 'Offers' },
];

const PLACEHOLDER: [string, string] = ['#3B2A6B', '#1E1533'];

// ── Bookmarks (per device) ──────────────────────────────────────────────────
function useBookmarks() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    AsyncStorage.getItem(BOOKMARK_KEY).then((v) => { if (v) setIds(new Set(JSON.parse(v))); }).catch(() => {});
  }, []);
  const toggle = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  return { ids, toggle };
}

// ── Cards ───────────────────────────────────────────────────────────────────
function HeroCard({ ev, bookmarked, onBookmark, onPress, isDark }: {
  ev: PingEvent; bookmarked: boolean; onBookmark: () => void; onPress: () => void; isDark: boolean;
}) {
  const live = isLiveNow(ev);
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[hero.card, { height: HERO_H }]}>
      {ev.imageUrl ? (
        <Image source={{ uri: ev.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={PLACEHOLDER} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFill} />

      <View style={hero.topRow}>
        <View style={hero.pill}>
          <View style={[hero.liveDot, { backgroundColor: live ? '#22C55E' : '#FBBF24' }]} />
          <Text style={hero.pillText}>{live ? 'Happening now' : `${fmtDate(ev.startDate)} · ${fmtTime(ev.startDate)}`}</Text>
        </View>
        <TouchableOpacity onPress={onBookmark} hitSlop={8} style={hero.bookmark}>
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={17} color={bookmarked ? '#FBBF24' : '#111'} />
        </TouchableOpacity>
      </View>

      <View style={hero.bottom}>
        <Text style={hero.title} numberOfLines={2}>{ev.title}</Text>
        <Text style={hero.by} numberOfLines={1}>By {ev.organizer || 'Ping'}{ev.city ? ` · ${ev.city}` : ''}</Text>
        <View style={hero.ctaRow}>
          <View style={[hero.cta, { backgroundColor: isDark ? '#F1F0FF' : '#111111' }]}>
            <Text style={[hero.ctaText, { color: isDark ? '#111' : '#FFF' }]}>{ev.category === 'offer' ? 'View offer' : 'View details'}</Text>
          </View>
          <TouchableOpacity onPress={() => openEventLocation(ev)} hitSlop={6} style={hero.locBtn} activeOpacity={0.8}>
            <Ionicons name="navigate" size={14} color="#FFF" />
            <Text style={hero.locText} numberOfLines={1}>{eventPlaceLabel(ev)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const hero = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#1E1533' },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#111' },
  bookmark: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 4 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, lineHeight: 27 },
  by: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  cta: { paddingHorizontal: 18, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 13, fontWeight: '700' },
  locBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  locText: { color: '#FFF', fontSize: 12, fontWeight: '600', flexShrink: 1 },
});

function EventRow({ ev, onPress, c, isDark }: { ev: PingEvent; onPress: () => void; c: typeof Colors.light; isDark: boolean }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[row.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={row.thumb}>
        {ev.imageUrl
          ? <Image source={{ uri: ev.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <LinearGradient colors={PLACEHOLDER} style={StyleSheet.absoluteFill} />}
        {ev.category === 'offer' && (
          <View style={row.offerTag}><Text style={row.offerTagText}>OFFER</Text></View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={[row.title, { color: c.text }]} numberOfLines={1}>{ev.title}</Text>
        <Text style={[row.by, { color: c.textSecondary }]} numberOfLines={1}>By {ev.organizer || 'Ping'}</Text>
        <View style={row.metaRow}>
          <Ionicons name="time-outline" size={12} color={isDark ? Ping.purpleLight : Ping.purple} />
          <Text style={[row.meta, { color: c.textSecondary }]} numberOfLines={1}>
            {fmtDate(ev.startDate)}, {fmtTime(ev.startDate)}
          </Text>
          <Text style={[row.meta, { color: c.textSecondary }]}> · </Text>
          <TouchableOpacity onPress={() => openEventLocation(ev)} hitSlop={6} style={{ flexShrink: 1 }}>
            <Text style={[row.meta, { color: isDark ? Ping.purpleLight : Ping.purple }]} numberOfLines={1}>
              {eventPlaceLabel(ev)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
    </TouchableOpacity>
  );
}

const row = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1E1533' },
  offerTag: { position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  offerTagText: { color: '#FBBF24', fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  by: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 11, fontWeight: '500' },
});

// ── Screen ──────────────────────────────────────────────────────────────────
export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'dark';
  const isDark = scheme === 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuthStore();
  const { coords, granted } = useLocation();
  const { ids: bookmarks, toggle: toggleBookmark } = useBookmarks();

  const [events, setEvents] = useState<PingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await eventsApi.list({ lat: coords.latitude, lng: coords.longitude, radius: 50000 });
      setEvents(data);
    } catch { /* non-fatal */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, [coords.latitude, coords.longitude]));

  // City chip from a one-off reverse geocode (best effort)
  useEffect(() => {
    if (!granted) return;
    Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
      .then((r) => {
        const g = r[0];
        const label = [g?.city || g?.subregion || g?.district, g?.region].filter(Boolean).join(', ');
        if (label) setPlace(label);
      })
      .catch(() => {});
  }, [granted, Math.round(coords.latitude * 100), Math.round(coords.longitude * 100)]);

  // Swipe anywhere on the header area to move between filters
  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  function shiftFilter(dir: 1 | -1) {
    const i = FILTERS.findIndex((f) => f.key === filterRef.current);
    const next = FILTERS[i + dir];
    if (!next) return;
    Haptics.selectionAsync();
    setFilter(next.key);
  }
  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => { if (g.dx < -50) shiftFilter(1); else if (g.dx > 50) shiftFilter(-1); },
    }),
  ).current;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => filter === 'all' || e.category === filter)
      .filter((e) => !q || [e.title, e.organizer, e.venueName, e.city, ...(e.tags ?? [])].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [events, filter, query]);

  const heroEv = visible.find((e) => isLiveNow(e)) ?? visible[0] ?? null;
  const upcoming = visible.filter((e) => e._id !== heroEv?._id);

  const firstName = (user?.displayName || user?.username || 'there').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={[s.root, { backgroundColor: c.background, paddingTop: insets.top }]} {...swipePan.panHandlers}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Ping.purple} />}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <View style={[s.placeChip, { backgroundColor: isDark ? '#F1F0FF' : '#111111' }]}>
            <Ionicons name="navigate" size={13} color={isDark ? '#111' : '#FFF'} />
            <Text style={[s.placeText, { color: isDark ? '#111' : '#FFF' }]} numberOfLines={1}>{place ?? 'Near you'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.8}>
            <AppAvatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={40} />
          </TouchableOpacity>
        </View>

        <Text style={[s.today, { color: c.textSecondary }]}>Today's {today}</Text>
        <Text style={[s.welcome, { color: c.text }]}>Welcome, {firstName}!</Text>

        {/* Search */}
        <View style={[s.search, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F1F4', borderColor: c.border }]}>
          <Ionicons name="search" size={16} color={c.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: c.text }]}
            placeholder="Search by name, place or tag"
            placeholderTextColor={c.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={c.textSecondary} /></TouchableOpacity>
          ) : null}
        </View>

        {/* Filters */}
        <View style={s.filters}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[s.chip, { backgroundColor: on ? (isDark ? '#F1F0FF' : '#111') : 'transparent', borderColor: on ? 'transparent' : c.border }]} activeOpacity={0.8}>
                <Text style={[s.chipText, { color: on ? (isDark ? '#111' : '#FFF') : c.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={Ping.purple} style={{ marginTop: 40 }} />
        ) : !heroEv ? (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: `${Ping.purple}1A` }]}>
              <Ionicons name="sparkles-outline" size={34} color={isDark ? Ping.purpleLight : Ping.purple} />
            </View>
            <Text style={[s.emptyTitle, { color: c.text }]}>{query ? 'Nothing matches' : 'No events yet'}</Text>
            <Text style={[s.emptySub, { color: c.textSecondary }]}>{query ? 'Try a different search.' : "When something special drops nearby, it'll show up here."}</Text>
          </View>
        ) : (
          <>
            <Text style={[s.section, { color: c.text }]}>{isLiveNow(heroEv) ? 'Happening now' : 'Nearby event'}</Text>
            <HeroCard
              ev={heroEv}
              bookmarked={bookmarks.has(heroEv._id)}
              onBookmark={() => toggleBookmark(heroEv._id)}
              onPress={() => router.push(`/event/${heroEv._id}` as any)}
              isDark={isDark}
            />

            {upcoming.length > 0 && (
              <>
                <View style={s.sectionRow}>
                  <Text style={[s.section, { color: c.text, marginTop: 0 }]}>Upcoming</Text>
                  <Text style={[s.count, { color: c.textSecondary }]}>{upcoming.length}</Text>
                </View>
                <View style={{ gap: 10 }}>
                  {upcoming.map((ev) => (
                    <EventRow key={ev._id} ev={ev} c={c} isDark={isDark} onPress={() => router.push(`/event/${ev._id}` as any)} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: 8, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 40, borderRadius: Radius.full, maxWidth: SCREEN_W * 0.6 },
  placeText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  today: { fontSize: 12, fontWeight: '500', marginTop: 8 },
  welcome: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: -8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '700' },
  section: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginTop: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  count: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
