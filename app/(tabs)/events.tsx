import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocation } from '@/hooks/useLocation';
import { eventsApi, type PingEvent } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';

// ── Date formatting ───────────────────────────────────────────────────────────

function formatEventDate(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  if (s.toDateString() === e.toDateString()) {
    return `${s.toLocaleDateString('en-IN', opts)} · ${s.toLocaleTimeString('en-IN', timeOpts)} – ${e.toLocaleTimeString('en-IN', timeOpts)}`;
  }
  return `${s.toLocaleDateString('en-IN', opts)} – ${e.toLocaleDateString('en-IN', opts)}`;
}

// ── Category filter ───────────────────────────────────────────────────────────

type FilterKey = 'all' | 'event' | 'offer';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const FILTERS: { key: FilterKey; label: string; icon: IoniconName }[] = [
  { key: 'all',   label: 'All',    icon: 'apps-outline'     },
  { key: 'event', label: 'Events', icon: 'ticket-outline'   },
  { key: 'offer', label: 'Offers', icon: 'pricetag-outline' },
];

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ item, scheme }: { item: PingEvent; scheme: 'dark' | 'light' }) {
  const c = Colors[scheme];
  const tint = scheme === 'dark' ? Ping.purpleLight : Ping.purple;
  const isEvent = item.category === 'event';
  const placeholderIcon: IoniconName = isEvent ? 'ticket-outline' : 'pricetag-outline';
  const badgeColor = isEvent ? Ping.purple : Ping.orange;
  const badgeBg = isEvent ? 'rgba(124,58,237,0.18)' : 'rgba(249,115,22,0.18)';
  const badgeText = isEvent ? 'EVENT' : 'OFFER';
  const placeholderFrom = isEvent ? '#7C3AED' : '#F97316';
  const placeholderTo   = isEvent ? '#5B21B6' : '#C2410C';

  return (
    <View style={[ev.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Cover */}
      {item.imageUrl ? (
        <View style={ev.coverWrap}>
          <Image source={{ uri: item.imageUrl }} style={ev.cover} resizeMode="cover" />
          {/* Gradient overlay */}
          <View style={ev.coverOverlay} />
        </View>
      ) : (
        <View style={[ev.placeholder, { backgroundColor: placeholderFrom }]}>
          <View style={[ev.placeholderInner, { backgroundColor: placeholderTo }]} />
          <Ionicons name={placeholderIcon} size={56} color="rgba(255,255,255,0.75)" />
        </View>
      )}

      {/* Badge */}
      <View style={[ev.badge, { backgroundColor: badgeBg, borderColor: badgeColor }]}>
        <Text style={[ev.badgeText, { color: badgeColor }]}>{badgeText}</Text>
      </View>

      {/* Body */}
      <View style={ev.body}>
        <Text style={[ev.title, { color: c.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {item.venueName ? (
          <View style={ev.venueRow}>
            <Ionicons name="location-outline" size={13} color={c.textSecondary} />
            <Text style={[ev.venueName, { color: c.textSecondary }]} numberOfLines={1}>
              {item.venueName}
            </Text>
          </View>
        ) : null}

        <View style={ev.dateRow}>
          <Ionicons name="calendar-outline" size={13} color={tint} />
          <Text style={[ev.dateText, { color: tint }]}>
            {formatEventDate(item.startDate, item.endDate)}
          </Text>
        </View>

        {item.description ? (
          <Text style={[ev.desc, { color: c.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {item.tags && item.tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ev.tagsRow}
          >
            {item.tags.map((tag) => (
              <View key={tag} style={[ev.tag, { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.18)' }]}>
                <Text style={[ev.tagText, { color: tint }]}>#{tag}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const ev = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  coverWrap: {
    position: 'relative',
    height: 160,
  },
  cover: {
    width: '100%',
    height: 160,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  placeholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderInner: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.45,
    top: -60,
    right: -60,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  body: {
    padding: Spacing.md,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Ping.purpleLight,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Ping.purpleLight,
  },
});

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ scheme }: { scheme: 'dark' | 'light' }) {
  const c = Colors[scheme];
  return (
    <View style={empty.wrap}>
      <View style={[empty.iconCircle, { backgroundColor: scheme === 'dark' ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.08)' }]}>
        <Ionicons name="calendar-outline" size={44} color={scheme === 'dark' ? Ping.purpleLight : Ping.purple} />
      </View>
      <Text style={[empty.title, { color: c.text }]}>Nothing nearby yet</Text>
      <Text style={[empty.sub, { color: c.textSecondary }]}>
        Check back soon — events and café offers{'\n'}will appear here when they're available.
      </Text>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h3,
    textAlign: 'center',
  },
  sub: {
    ...Typography.bodySm,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();

  const [events, setEvents] = useState<PingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await eventsApi.list({
        lat: coords.latitude,
        lng: coords.longitude,
        radius: 5000,
        category: filter === 'all' ? undefined : filter,
      });
      setEvents(data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [filter, coords.latitude, coords.longitude]),
  );

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.category === filter);

  return (
    <View style={[scr.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[scr.header, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
        <View>
          <Text style={[scr.headerTitle, { color: c.text }]}>Events & Offers</Text>
          <Text style={[scr.headerSub, { color: c.textSecondary }]}>Near you</Text>
        </View>
        <View style={[scr.headerBadge, { backgroundColor: 'rgba(124,58,237,0.12)', borderColor: 'rgba(167,139,250,0.25)' }]}>
          <View style={scr.liveDot} />
          <Text style={scr.headerBadgeText}>Live</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={[scr.filterBar, { borderBottomColor: c.border }]}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                scr.filterChip,
                { borderColor: c.border, backgroundColor: c.surface },
                active && { ...scr.filterChipActive, borderColor: c.tint },
              ]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={f.icon} size={13} color={active ? c.tint : c.textSecondary} />
              <Text style={[scr.filterChipText, { color: active ? c.tint : c.textSecondary }, active && scr.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={scr.loadingWrap}>
          <ActivityIndicator color={Ping.purpleLight} size="large" />
          <Text style={[scr.loadingText, { color: c.textSecondary }]}>Finding events near you…</Text>
        </View>
      ) : (
        <ScrollView
          style={scr.scroll}
          contentContainerStyle={[scr.list, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Ping.purpleLight}
              colors={[Ping.purple]}
            />
          }
        >
          {filtered.length === 0 ? (
            <EmptyState scheme={scheme} />
          ) : (
            filtered.map((item) => (
              <EventCard key={item._id} item={item} scheme={scheme} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const scr = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    ...Typography.h2,
    fontWeight: '800',
  },
  headerSub: {
    ...Typography.bodySm,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Ping.green,
    shadowColor: Ping.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Ping.green,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderColor: Ping.purpleLight,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodySm,
  },
  scroll: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
  },
});
