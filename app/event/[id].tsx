import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventsApi, type PingEvent } from '@/lib/api';
import { Ping, Spacing, Radius, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { openEventLocation, eventMapsUrl, eventPlaceLabel, isLiveNow, fmtDate, fmtTime, fmtRange } from '@/lib/eventUtils';

const { width: W } = Dimensions.get('window');
const IMG_H = Math.round(W * 0.78); // same aspect for every event
const BOOKMARK_KEY = 'events:bookmarks';
const ABOUT_LINES = 4;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'dark';
  const isDark = scheme === 'dark';
  const c = Colors[scheme];

  const [ev, setEv] = useState<PingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!id) return;
    eventsApi.getById(id).then(setEv).catch(() => setEv(null)).finally(() => setLoading(false));
    AsyncStorage.getItem(BOOKMARK_KEY).then((v) => { if (v) setBookmarked((JSON.parse(v) as string[]).includes(id)); }).catch(() => {});
  }, [id]);

  async function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const v = await AsyncStorage.getItem(BOOKMARK_KEY);
      const set = new Set<string>(v ? JSON.parse(v) : []);
      next ? set.add(id!) : set.delete(id!);
      await AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set]));
    } catch { /* ignore */ }
  }

  if (loading) {
    return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={Ping.purple} /></View>;
  }
  if (!ev) {
    return (
      <View style={[s.center, { backgroundColor: c.background, gap: 10 }]}>
        <Ionicons name="calendar-outline" size={40} color={c.textSecondary} />
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>Event not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: Ping.purpleLight, fontWeight: '600' }}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const live = isLiveNow(ev);
  const hasMaps = !!eventMapsUrl(ev);
  const orgInitial = (ev.organizer || 'P')[0].toUpperCase();
  const darkBtn = isDark ? '#F1F0FF' : '#111111';
  const darkBtnText = isDark ? '#111111' : '#FFFFFF';

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={[s.imgWrap, { height: IMG_H }]}>
          {ev.imageUrl
            ? <Image source={{ uri: ev.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <LinearGradient colors={['#3B2A6B', '#1E1533']} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.35)']} style={StyleSheet.absoluteFill} />

          <View style={[s.imgTop, { top: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.roundBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color="#111" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => Share.share({ message: `${ev.title}${ev.venueName ? ` · ${ev.venueName}` : ''}\n${fmtRange(ev.startDate, ev.endDate)}${eventMapsUrl(ev) ? `\n${eventMapsUrl(ev)}` : ''}` }).catch(() => {})} style={s.roundBtn} hitSlop={8}>
                <Ionicons name="share-outline" size={18} color="#111" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleBookmark} style={s.roundBtn} hitSlop={8}>
                <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={bookmarked ? '#F59E0B' : '#111'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location chip → Google Maps */}
          <TouchableOpacity style={s.locChip} onPress={() => openEventLocation(ev)} disabled={!hasMaps} activeOpacity={0.85}>
            <Ionicons name="navigate" size={13} color="#FFF" />
            <Text style={s.locChipText} numberOfLines={1}>{ev.city ? `${eventPlaceLabel(ev)} · ${ev.city}` : eventPlaceLabel(ev)}</Text>
            {hasMaps && <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.8)" />}
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          {/* Date pill */}
          <View style={[s.datePill, { backgroundColor: darkBtn }]}>
            <Text style={[s.datePillText, { color: darkBtnText }]}>{live ? 'Happening now' : fmtRange(ev.startDate, ev.endDate)}</Text>
          </View>

          <Text style={[s.title, { color: c.text }]}>{ev.title}</Text>

          <View style={s.byRow}>
            <View style={[s.orgAvatar, { backgroundColor: `${Ping.purple}26` }]}>
              <Text style={[s.orgInitial, { color: isDark ? Ping.purpleLight : Ping.purple }]}>{orgInitial}</Text>
            </View>
            <Text style={[s.by, { color: c.textSecondary }]}>By <Text style={{ color: c.text, fontWeight: '700' }}>{ev.organizer || 'Ping'}</Text></Text>
            {ev.category === 'offer' && (
              <View style={[s.tag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}><Text style={[s.tagText, { color: '#F59E0B' }]}>OFFER</Text></View>
            )}
          </View>

          {/* About */}
          <Text style={[s.h, { color: c.text }]}>About</Text>
          <Text
            style={[s.about, { color: c.textSecondary }]}
            numberOfLines={expanded ? undefined : ABOUT_LINES}
            onTextLayout={(e) => { if (!expanded && e.nativeEvent.lines.length >= ABOUT_LINES) setCanExpand(true); }}
          >
            {ev.description?.trim() || 'No description added yet.'}
          </Text>
          {(canExpand || expanded) && (
            <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
              <Text style={[s.seeAll, { color: isDark ? Ping.purpleLight : Ping.purple }]}>{expanded ? 'Show less' : 'See all'}</Text>
            </TouchableOpacity>
          )}

          {/* Details */}
          <Text style={[s.h, { color: c.text }]}>Details</Text>
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <DetailRow icon="calendar-outline" label="Date" value={fmtRange(ev.startDate, ev.endDate)} c={c} isDark={isDark} />
            <DetailRow icon="time-outline" label="Time" value={`${fmtTime(ev.startDate)} – ${fmtTime(ev.endDate)}`} c={c} isDark={isDark} />
            <DetailRow
              icon="location-outline"
              label="Location"
              value={[ev.venueName, ev.venueAddress].filter(Boolean).join(', ') || ev.city || 'Not set'}
              c={c} isDark={isDark}
              onPress={hasMaps ? () => openEventLocation(ev) : undefined}
              last
            />
          </View>

          {ev.tags?.length ? (
            <View style={s.tags}>
              {ev.tags.map((t) => (
                <View key={t} style={[s.tag, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[s.tagText, { color: c.textSecondary }]}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14, backgroundColor: c.background, borderTopColor: c.border }]}>
        <TouchableOpacity
          onPress={() => openEventLocation(ev)}
          disabled={!hasMaps}
          activeOpacity={0.88}
          style={[s.cta, { backgroundColor: darkBtn, opacity: hasMaps ? 1 : 0.5 }]}
        >
          <Ionicons name="navigate" size={18} color={darkBtnText} />
          <Text style={[s.ctaText, { color: darkBtnText }]}>{hasMaps ? 'Get directions' : 'Location not available'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ icon, label, value, c, isDark, onPress, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string;
  c: typeof Colors.light; isDark: boolean; onPress?: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.75} style={[s.detailRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={[s.detailIcon, { backgroundColor: `${Ping.purple}1A` }]}>
        <Ionicons name={icon} size={16} color={isDark ? Ping.purpleLight : Ping.purple} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.detailLabel, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[s.detailValue, { color: onPress ? (isDark ? Ping.purpleLight : Ping.purple) : c.text }]} numberOfLines={2}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={16} color={c.textSecondary} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imgWrap: { width: W, backgroundColor: '#1E1533', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  imgTop: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  locChip: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: Radius.full, backgroundColor: 'rgba(17,17,17,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', maxWidth: W - 28 },
  locChipText: { color: '#FFF', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  body: { paddingHorizontal: Spacing.lg, paddingTop: 16, gap: 10 },
  datePill: { alignSelf: 'flex-start', paddingHorizontal: 12, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  datePillText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orgAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  orgInitial: { fontSize: 12, fontWeight: '800' },
  by: { fontSize: 13 },
  h: { fontSize: 15, fontWeight: '700', marginTop: 10 },
  about: { fontSize: 14, lineHeight: 21 },
  seeAll: { fontSize: 13, fontWeight: '700', marginTop: -2 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  detailIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '600', marginTop: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full },
  tagText: { fontSize: 11, fontWeight: '700' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { height: 54, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '700' },
});
