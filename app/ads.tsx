import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adsApi, type Ad, type AdAnalyticsTotals } from '@/lib/api';
import { useLocation } from '@/hooks/useLocation';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import CreateAdModal from '@/components/CreateAdModal';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS_COLOR: Record<string, string> = {
  live:            '#22C55E',
  pending_payment: '#F97316',
  expired:         '#9490C0',
  removed:         '#EF4444',
  refunded:        '#9490C0',
};

const STATUS_LABEL: Record<string, string> = {
  live:            'Live',
  pending_payment: 'Awaiting payment',
  expired:         'Expired',
  removed:         'Removed',
  refunded:        'Refunded',
};

// ── sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, icon, c }: { label: string; value: number; icon: IoniconName; c: typeof Colors['dark'] }) {
  return (
    <View style={[sb.box, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Ionicons name={icon} size={16} color={Ping.purpleLight} />
      <Text style={[sb.value, { color: c.text }]}>{value}</Text>
      <Text style={[sb.label, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  box: {
    flex: 1, minWidth: '30%', borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', padding: Spacing.md, gap: 4,
  },
  value: { ...Typography.h3, fontSize: 24 },
  label: { ...Typography.caption, textAlign: 'center' },
});

function AdCard({ ad, onPress, c, borderColor }: { ad: Ad; onPress: () => void; c: typeof Colors['dark']; borderColor: string }) {
  const statusColor = STATUS_COLOR[ad.status] ?? '#9490C0';
  const isLive = ad.status === 'live';
  const expiresAt = ad.expiresAt ? new Date(ad.expiresAt) : null;
  const hoursLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3_600_000))
    : null;

  return (
    <TouchableOpacity
      style={[ac.card, { backgroundColor: c.surface, borderColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={ac.row}>
        <View style={[ac.tierBadge, { backgroundColor: ad.tier === 'pro_99' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)' }]}>
          <Text style={[ac.tierText, { color: ad.tier === 'pro_99' ? '#8B5CF6' : '#3B82F6' }]}>
            {ad.tier === 'pro_99' ? 'Pro' : 'Basic'}
          </Text>
        </View>
        <View style={[ac.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          {isLive && <View style={[ac.liveDot, { backgroundColor: statusColor }]} />}
          <Text style={[ac.statusText, { color: statusColor }]}>{STATUS_LABEL[ad.status]}</Text>
        </View>
      </View>

      <Text style={[ac.name, { color: c.text }]}>{ad.businessName}</Text>
      <Text style={[ac.tagline, { color: c.textSecondary }]} numberOfLines={1}>
        {ad.tagline || ad.category.replace('_', ' ')}
      </Text>

      {isLive && hoursLeft !== null && (
        <Text style={[ac.expiry, { color: c.textSecondary }]}>
          <Ionicons name="time-outline" size={12} color={c.textSecondary} /> Expires in {hoursLeft}h
        </Text>
      )}

      <Text style={[ac.products, { color: c.icon }]}>
        {ad.products.length} product{ad.products.length !== 1 ? 's' : ''}
      </Text>
    </TouchableOpacity>
  );
}

const ac = StyleSheet.create({
  card:       { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 4 },
  row:        { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
  tierBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  tierText:   { ...Typography.caption, fontWeight: '700' },
  statusBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  liveDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...Typography.caption, fontWeight: '600' },
  name:       { ...Typography.h3, fontSize: 16 },
  tagline:    { ...Typography.bodySm },
  expiry:     { ...Typography.caption, marginTop: 2 },
  products:   { ...Typography.caption },
});

function AnalyticsSheet({ adId, onClose }: { adId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const borderColor = scheme === 'dark' ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.1)';
  const handleColor = scheme === 'dark' ? 'rgba(167,139,250,0.3)'  : 'rgba(124,58,237,0.2)';

  const [loading, setLoading] = useState(true);
  const [totals, setTotals]   = useState<AdAnalyticsTotals | null>(null);
  const [adName, setAdName]   = useState('');

  useEffect(() => {
    adsApi.analytics(adId).then(res => {
      setTotals(res.totals as AdAnalyticsTotals);
      setAdName(res.ad.businessName);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [adId]);

  return (
    <View style={[an.sheet, { backgroundColor: c.surface, borderColor, paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={[an.handle, { backgroundColor: handleColor }]} />
      <View style={[an.header, { borderBottomColor: borderColor }]}>
        <Text style={[an.title, { color: c.text }]}>{adName || 'Analytics'}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color={c.icon} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 40 }} />
      ) : totals ? (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }} showsVerticalScrollIndicator={false}>
          <Text style={[an.sectionTitle, { color: c.textSecondary }]}>Performance</Text>
          <View style={an.grid}>
            <StatBox label="Views"         value={totals.views}          icon="eye-outline"              c={c} />
            <StatBox label="Reach"         value={totals.uniqueReach}    icon="people-outline"           c={c} />
            <StatBox label="Thumbs Up"     value={totals.thumbsUp}       icon="thumbs-up-outline"        c={c} />
            <StatBox label="Want to Visit" value={totals.wantToVisit}    icon="bookmark-outline"         c={c} />
            <StatBox label="Contact Taps"  value={totals.contactTaps}    icon="call-outline"             c={c} />
            <StatBox label="Swipes"        value={totals.productSwipes}  icon="swap-horizontal-outline"  c={c} />
          </View>
        </ScrollView>
      ) : (
        <Text style={[an.empty, { color: c.textSecondary }]}>
          No analytics yet. Data appears once your ad is live.
        </Text>
      )}
    </View>
  );
}

const an = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: 1, maxHeight: '70%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.sm },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  title:        { ...Typography.h3 },
  sectionTitle: { ...Typography.bodyMed, fontWeight: '700' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  empty:        { ...Typography.bodySm, textAlign: 'center', margin: 40 },
});

// ── main screen ───────────────────────────────────────────────────────────────

export default function AdsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coords } = useLocation();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];

  const borderColor = scheme === 'dark' ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.1)';
  const cardBorder  = scheme === 'dark' ? 'rgba(167,139,250,0.12)' : 'rgba(124,58,237,0.08)';

  const [ads, setAds]                   = useState<Ad[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const [analyticsAdId, setAnalyticsAdId] = useState<string | null>(null);

  async function loadAds(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adsApi.mine('all');
      setAds(res.ads ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }

  useFocusEffect(useCallback(() => { loadAds(); }, []));

  const liveAds  = ads.filter(a => a.status === 'live');
  const otherAds = ads.filter(a => a.status !== 'live');

  return (
    <View style={[st.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.primary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: c.text }]}>My Ads</Text>
        <TouchableOpacity style={st.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={st.createBtnText}>New Ad</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAds(true)} tintColor={Ping.purpleLight} />
          }
        >
          {ads.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="megaphone-outline" size={52} color="rgba(167,139,250,0.3)" />
              <Text style={[st.emptyTitle, { color: c.text }]}>No ads yet</Text>
              <Text style={[st.emptySub, { color: c.textSecondary }]}>
                Create a Micro Ad to pin your business on the Ping map.
              </Text>
            </View>
          ) : (
            <>
              {liveAds.length > 0 && (
                <View style={st.group}>
                  <Text style={[st.groupLabel, { color: c.textSecondary }]}>Active</Text>
                  {liveAds.map(ad => (
                    <AdCard key={ad._id} ad={ad} onPress={() => setAnalyticsAdId(ad._id)} c={c} borderColor={cardBorder} />
                  ))}
                </View>
              )}
              {otherAds.length > 0 && (
                <View style={st.group}>
                  <Text style={[st.groupLabel, { color: c.textSecondary }]}>Past</Text>
                  {otherAds.map(ad => (
                    <AdCard key={ad._id} ad={ad} onPress={() => setAnalyticsAdId(ad._id)} c={c} borderColor={cardBorder} />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Analytics bottom sheet */}
      {analyticsAdId && (
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            activeOpacity={1}
            onPress={() => setAnalyticsAdId(null)}
          />
          <View style={an.overlay}>
            <AnalyticsSheet adId={analyticsAdId} onClose={() => setAnalyticsAdId(null)} />
          </View>
        </View>
      )}

      <CreateAdModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => loadAds()}
        lat={coords.latitude}
        lng={coords.longitude}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3, flex: 1, textAlign: 'center' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Ping.purple, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: Radius.full,
  },
  createBtnText: { ...Typography.bodySm, color: '#FFF', fontWeight: '700' },
  content:    { padding: Spacing.lg, gap: Spacing.lg, flexGrow: 1 },
  group:      { gap: Spacing.sm },
  groupLabel: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 80 },
  emptyTitle: { ...Typography.h3 },
  emptySub:   { ...Typography.bodySm, textAlign: 'center', maxWidth: 260 },
});

