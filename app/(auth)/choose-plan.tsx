import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import CouponField, { type CouponResults } from '@/components/CouponField';
import { usePlanPurchase } from '@/hooks/usePlanPurchase';
import { subscriptionsApi, type SubscriptionPlan, type CouponInfo } from '@/lib/api';
import { Colors, Ping, Radius, Gradients } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Tier = 'free' | 'pro' | 'premium';
type Billing = 'weekly' | 'monthly' | '3m' | 'yearly';

const BILLING: { key: Billing; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: '3m', label: '3 Months' },
  { key: 'yearly', label: 'Yearly' },
];

const FEATURES: Record<Tier, string[]> = {
  free:    ['1 create + 1 join / week', 'Group chat in pings', 'Friend requests'],
  pro:     ['Direct messages', 'Ping non-friends directly', '5 creates · 7 joins / week'],
  premium: ['Unlimited create & join', 'Tag people in Highlights', 'Create activity groups'],
};

const ACCENT: Record<Tier, string> = { free: '#6B7280', pro: Ping.purple, premium: '#BB92FF' };

export default function ChoosePlanScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [featured, setFeatured] = useState<CouponInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing>('monthly');
  const [tier, setTier] = useState<Tier>('pro');
  const [coupons, setCoupons] = useState<CouponResults>({});
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>(null);

  const { buy, buying, pendingTier } = usePlanPurchase(() => finish());

  useEffect(() => {
    Promise.all([subscriptionsApi.plans(), subscriptionsApi.featuredCoupon().catch(() => null)])
      .then(([p, f]) => {
        setPlans(p.plans ?? []);
        setFeatured(f);
        if (f?.appliesToPlanIds?.length) {
          const b = BILLING.find((x) => f.appliesToPlanIds.some((id) => id.endsWith(`_${x.key}`)));
          if (b) setBilling(b.key);
        }
      })
      .catch((e) => Toast.show({ type: 'error', text1: 'Could not load plans', text2: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const planFor = (t: 'pro' | 'premium') => plans.find((p) => p.planId === `${t}_${billing}`);
  const candidateIds = useMemo(
    () => (['pro', 'premium'] as const).map((t) => planFor(t)?.planId).filter(Boolean) as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, billing],
  );

  function finish() {
    router.replace('/verification' as any);
  }

  function priceOf(t: Tier) {
    if (t === 'free') return { base: 0, final: 0 };
    const p = planFor(t);
    if (!p) return null;
    const cp = coupons[p.planId];
    return { base: p.amountMinor, final: cp ? cp.finalMinor : p.amountMinor };
  }

  async function onContinue() {
    if (tier === 'free') { finish(); return; }
    const plan = planFor(tier);
    if (!plan) return;
    const code = coupons[plan.planId] ? couponCode : null;
    const outcome = await buy(plan, code);
    if (outcome === 'activated') finish();
    // 'pending' → browser opened; usePlanPurchase polls on return and calls finish()
  }

  const selectedPrice = priceOf(tier);
  const ctaLabel = tier === 'free'
    ? 'Continue with Free'
    : buying
      ? 'Opening checkout…'
      : selectedPrice && selectedPrice.final === 0
        ? `Claim ${tier === 'pro' ? 'Pro' : 'Premium'} free`
        : `Get ${tier === 'pro' ? 'Pro' : 'Premium'} — ₹${((selectedPrice?.final ?? 0) / 100).toFixed(0)}`;

  return (
    <View style={[s.root, { backgroundColor: c.background, paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        <Text style={[s.eyebrow, { color: Ping.purpleLight }]}>ONE LAST THING</Text>
        <Text style={[s.title, { color: c.text }]}>Pick your plan</Text>
        <Text style={[s.sub, { color: c.textSecondary }]}>Start free, or unlock more pings and DMs. Change anytime from your profile.</Text>

        {featured && (
          <TouchableOpacity
            style={[s.offer, { backgroundColor: `${Ping.purple}1A`, borderColor: `${Ping.purple}55` }]}
            onPress={() => { setPreset(featured.code); if (featured.appliesToTiers.includes('pro')) setTier('pro'); }}
            activeOpacity={0.85}
          >
            <Text style={s.offerEmoji}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.offerTitle, { color: c.text }]}>{featured.description || 'Welcome offer'}</Text>
              <Text style={[s.offerSub, { color: c.textSecondary }]}>Tap to apply code <Text style={{ color: Ping.purpleLight, fontWeight: '800' }}>{featured.code}</Text></Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={22} color={Ping.purpleLight} />
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={Ping.purple} style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={s.billingRow}>
              {BILLING.map((b) => {
                const on = billing === b.key;
                return (
                  <TouchableOpacity key={b.key} onPress={() => setBilling(b.key)} style={[s.billingChip, { backgroundColor: on ? Ping.purple : c.soft, borderColor: on ? Ping.purple : c.border }]}>
                    <Text style={[s.billingText, { color: on ? '#FFF' : c.text }]}>{b.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {(['free', 'pro', 'premium'] as Tier[]).map((t) => {
              const price = priceOf(t);
              const on = tier === t;
              const accent = ACCENT[t];
              const discounted = !!price && price.final !== price.base;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTier(t)}
                  activeOpacity={0.85}
                  style={[s.card, { backgroundColor: c.surface, borderColor: on ? accent : c.border, borderWidth: on ? 2 : 1 }]}
                >
                  <View style={s.cardTop}>
                    <View style={[s.radio, { borderColor: on ? accent : c.border }]}>
                      {on && <View style={[s.radioDot, { backgroundColor: accent }]} />}
                    </View>
                    <Text style={[s.cardName, { color: c.text }]}>{t === 'free' ? 'Free' : t === 'pro' ? 'Pro' : 'Premium'}</Text>
                    {t === 'premium' && <View style={[s.badge, { backgroundColor: `${accent}26` }]}><Text style={[s.badgeText, { color: accent }]}>BEST</Text></View>}
                    <View style={{ flex: 1 }} />
                    {price ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        {discounted && <Text style={[s.strike, { color: c.textSecondary }]}>₹{(price.base / 100).toFixed(0)}</Text>}
                        <Text style={[s.price, { color: discounted ? '#22C55E' : c.text }]}>
                          {price.final === 0 ? (t === 'free' ? '₹0' : 'FREE') : `₹${(price.final / 100).toFixed(0)}`}
                        </Text>
                        {t !== 'free' && <Text style={[s.per, { color: c.textSecondary }]}>/{planFor(t)?.intervalLabel.replace(/^1\s+/, '')}</Text>}
                      </View>
                    ) : (
                      <Text style={[s.per, { color: c.textSecondary }]}>unavailable</Text>
                    )}
                  </View>
                  <View style={s.features}>
                    {FEATURES[t].map((f) => (
                      <View key={f} style={s.featRow}>
                        <Ionicons name="checkmark-circle" size={14} color={accent} />
                        <Text style={[s.featText, { color: c.textSecondary }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}

            <CouponField planIds={candidateIds} presetCode={preset} onChange={(r, code) => { setCoupons(r); setCouponCode(code); }} />
          </>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 14, backgroundColor: c.background, borderTopColor: c.border }]}>
        {pendingTier && (
          <Text style={[s.pending, { color: c.textSecondary }]}>Waiting for payment confirmation… come back here after paying.</Text>
        )}
        <TouchableOpacity onPress={onContinue} disabled={!!buying || loading} activeOpacity={0.88} style={{ borderRadius: Radius.full, overflow: 'hidden', opacity: buying ? 0.7 : 1 }}>
          <LinearGradient colors={tier === 'free' ? [isDark ? '#2A2A35' : '#E5E7EB', isDark ? '#1E1E25' : '#D1D5DB'] : [...Gradients.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
            {buying ? <ActivityIndicator color="#FFF" /> : (
              <Text style={[s.ctaText, { color: tier === 'free' ? c.text : '#FFF' }]}>{ctaLabel}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={finish} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <Text style={[s.skip, { color: c.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: -4 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  offerEmoji: { fontSize: 24 },
  offerTitle: { fontSize: 14, fontWeight: '700' },
  offerSub: { fontSize: 12, marginTop: 2 },
  billingRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  billingChip: { flex: 1, height: 36, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  billingText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 18, padding: 16, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { fontSize: 18, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  strike: { fontSize: 12, textDecorationLine: 'line-through' },
  price: { fontSize: 22, fontWeight: '800' },
  per: { fontSize: 11, fontWeight: '600' },
  features: { gap: 6 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featText: { fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  pending: { fontSize: 12, textAlign: 'center', marginBottom: 6 },
  cta: { height: 54, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700' },
  skip: { fontSize: 13, fontWeight: '600' },
});
