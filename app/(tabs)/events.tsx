import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  Image,
  ActivityIndicator,
  RefreshControl,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useLocation } from '@/hooks/useLocation';
import { eventsApi, type PingEvent } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.72;
const CARD_H = Math.min(SCREEN_H * 0.52, 460);
const SIDE_PAD = (SCREEN_W - CARD_W) / 2;
const ACCENTS = ['#6545D9', '#8F63F4', '#BB92FF', '#7B5CFF', '#C8A8FF'];

function accentFor(item: PingEvent, index: number) {
  if (item.category === 'offer') return '#8F63F4';
  return ACCENTS[index % ACCENTS.length];
}

function badgeLabel(item: PingEvent) {
  const now = Date.now();
  const start = new Date(item.startDate).getTime();
  const end = new Date(item.endDate).getTime();
  if (now >= start && now <= end) {
    return item.category === 'offer' ? 'Live offer' : 'Happening now';
  }
  if (now < start) return 'Coming soon';
  return item.category === 'offer' ? 'Offer' : 'Event';
}

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString('en-IN', opts);
  }
  return `${s.toLocaleDateString('en-IN', opts)} – ${e.toLocaleDateString('en-IN', opts)}`;
}

// ── Carousel card ─────────────────────────────────────────────────────────────

function EventPosterCard({
  item,
  index,
  scrollX,
  bookmarked,
  onToggleBookmark,
  isDark,
}: {
  item: PingEvent;
  index: number;
  scrollX: Animated.Value;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  isDark: boolean;
}) {
  const accent = accentFor(item, index);
  const inputRange = [
    (index - 1) * CARD_W,
    index * CARD_W,
    (index + 1) * CARD_W,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.86, 1, 0.86],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.45, 1, 0.45],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[card.wrap, { transform: [{ scale }], opacity }]}>
      <View style={[card.inner, !isDark && card.innerLight]}>
        <View style={card.imageArea}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={card.image} resizeMode="cover" />
          ) : (
            <View style={[card.placeholder, { backgroundColor: accent }]}>
              <Ionicons
                name={item.category === 'offer' ? 'pricetag' : 'ticket'}
                size={48}
                color="rgba(255,255,255,0.85)"
              />
            </View>
          )}

          <View style={card.badge}>
            <Text style={card.badgeText}>{badgeLabel(item)}</Text>
          </View>

          <TouchableOpacity
            style={card.bookmark}
            onPress={onToggleBookmark}
            hitSlop={8}
            activeOpacity={0.8}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={bookmarked ? '#FBBF24' : '#FFF'}
            />
          </TouchableOpacity>
        </View>

        <View style={[card.titleBlock, { backgroundColor: accent }]}>
          <Text style={card.titleBlockText} numberOfLines={2}>
            {item.title.toUpperCase()}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const card = StyleSheet.create({
  wrap: {
    width: CARD_W,
    height: CARD_H,
    justifyContent: 'center',
  },
  inner: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
  },
  innerLight: {
    backgroundColor: '#FFF',
    shadowColor: '#6545D9',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  imageArea: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(20,20,20,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  bookmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(20,20,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    minHeight: CARD_H * 0.22,
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlockText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    lineHeight: 26,
  },
});

// ── Pagination dots ───────────────────────────────────────────────────────────

function Dots({ count, active, isDark }: { count: number; active: number; isDark: boolean }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dots.dot,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(28,16,64,0.18)' },
            i === active && {
              width: 22,
              backgroundColor: isDark ? '#FFF' : Ping.purple,
            },
          ]}
        />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

// ── Empty / loading ───────────────────────────────────────────────────────────

function EmptyState({ isDark, colors }: { isDark: boolean; colors: typeof Colors.light }) {
  return (
    <View style={empty.wrap}>
      <View style={[empty.iconCircle, { backgroundColor: isDark ? 'rgba(124,58,237,0.14)' : 'rgba(124,58,237,0.1)' }]}>
        <Ionicons name="sparkles-outline" size={40} color={isDark ? Ping.purpleLight : Ping.purple} />
      </View>
      <Text style={[empty.title, { color: colors.text }]}>No events yet</Text>
      <Text style={[empty.sub, { color: colors.textSecondary }]}>
        When something special drops nearby,{'\n'}it’ll show up here in style.
      </Text>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { ...Typography.h3 },
  sub: { ...Typography.bodySm, textAlign: 'center', lineHeight: 20 },
});

// ── Filters ───────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'event' | 'offer';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'event', label: 'Events' },
  { key: 'offer', label: 'Offers' },
];

function makeScreenStyles(isDark: boolean, c: typeof Colors.light) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    glow: {
      position: 'absolute',
      top: -80,
      alignSelf: 'center',
      width: SCREEN_W * 0.9,
      height: 220,
      borderRadius: 110,
      backgroundColor: isDark ? 'rgba(124,58,237,0.16)' : 'rgba(124,58,237,0.08)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: 8,
      paddingBottom: 14,
    },
    kicker: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginTop: 2,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.25)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.full,
      marginBottom: 6,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: Ping.green,
    },
    liveText: {
      color: Ping.green,
      fontSize: 12,
      fontWeight: '700',
    },
    filters: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      gap: 8,
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : c.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : c.border,
    },
    chipOn: {
      backgroundColor: isDark ? 'rgba(167,139,250,0.18)' : 'rgba(124,58,237,0.1)',
      borderColor: isDark ? 'rgba(167,139,250,0.45)' : 'rgba(124,58,237,0.35)',
    },
    chipText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    chipTextOn: {
      color: isDark ? '#E9E5FF' : Ping.purple,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: c.textSecondary,
      fontSize: 13,
    },
    carouselBlock: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 100,
    },
    meta: {
      paddingHorizontal: Spacing.xl,
      alignItems: 'center',
      marginTop: 22,
      gap: 6,
      minHeight: 92,
    },
    metaTitle: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    metaSub: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      maxWidth: SCREEN_W * 0.82,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
      maxWidth: SCREEN_W * 0.85,
    },
    metaMeta: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    metaDot: {
      color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(28,16,64,0.25)',
      marginHorizontal: 2,
    },
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const c = Colors[scheme];
  const scr = useMemo(() => makeScreenStyles(isDark, c), [isDark, c]);
  const { coords } = useLocation();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);

  const [events, setEvents] = useState<PingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const metaOpacity = useRef(new Animated.Value(1)).current;

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await eventsApi.list({
        lat: coords.latitude,
        lng: coords.longitude,
        radius: 50000,
        category: filter === 'all' ? undefined : filter,
      });
      setEvents(data);
      setActiveIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
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

  useEffect(() => {
    Animated.sequence([
      Animated.timing(metaOpacity, { toValue: 0.35, duration: 90, useNativeDriver: true }),
      Animated.timing(metaOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [activeIndex]);

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
    const clamped = Math.max(0, Math.min(events.length - 1, idx));
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      Haptics.selectionAsync();
    }
  }

  function toggleBookmark(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const active = events[activeIndex];
  const metaIcon = c.textSecondary;

  return (
    <View style={[scr.root, { paddingTop: insets.top }]}>
      <View style={scr.glow} pointerEvents="none" />

      <View style={scr.header}>
        <View>
          <Text style={scr.kicker}>Discover</Text>
          <Text style={scr.title}>Events</Text>
        </View>
        <View style={scr.livePill}>
          <View style={scr.liveDot} />
          <Text style={scr.liveText}>Live</Text>
        </View>
      </View>

      <View style={scr.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[scr.chip, on && scr.chipOn]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[scr.chipText, on && scr.chipTextOn]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={scr.center}>
          <ActivityIndicator color={isDark ? Ping.purpleLight : Ping.purple} size="large" />
          <Text style={scr.loadingText}>Curating nearby…</Text>
        </View>
      ) : events.length === 0 ? (
        <EmptyState isDark={isDark} colors={c} />
      ) : (
        <View style={scr.carouselBlock}>
          <Animated.FlatList
            ref={listRef as any}
            data={events}
            keyExtractor={(e) => e._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W}
            decelerationRate="fast"
            bounces
            contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumEnd}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(true); }}
                tintColor={isDark ? Ping.purpleLight : Ping.purple}
              />
            }
            renderItem={({ item, index }) => (
              <EventPosterCard
                item={item}
                index={index}
                scrollX={scrollX}
                bookmarked={bookmarks.has(item._id)}
                onToggleBookmark={() => toggleBookmark(item._id)}
                isDark={isDark}
              />
            )}
          />

          <Animated.View style={[scr.meta, { opacity: metaOpacity }]}>
            {active ? (
              <>
                <Text style={scr.metaTitle} numberOfLines={2}>{active.title}</Text>
                <Text style={scr.metaSub} numberOfLines={2}>
                  {active.description?.trim()
                    || (active.venueName
                      ? `${active.venueName}${active.venueAddress ? ` · ${active.venueAddress}` : ''}`
                      : formatRange(active.startDate, active.endDate))}
                </Text>
                <View style={scr.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={metaIcon} />
                  <Text style={scr.metaMeta}>{formatRange(active.startDate, active.endDate)}</Text>
                  {active.venueName ? (
                    <>
                      <Text style={scr.metaDot}>·</Text>
                      <Ionicons name="location-outline" size={13} color={metaIcon} />
                      <Text style={scr.metaMeta} numberOfLines={1}>{active.venueName}</Text>
                    </>
                  ) : null}
                </View>
              </>
            ) : null}
          </Animated.View>

          <Dots count={Math.min(events.length, 8)} active={Math.min(activeIndex, 7)} isDark={isDark} />
        </View>
      )}
    </View>
  );
}
