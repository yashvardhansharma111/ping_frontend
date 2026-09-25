import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '@/components/ScreenHeader';
import {
  subscriptionsApi,
  type SubscriptionPlan,
  type SubscriptionSnapshot,
} from '@/lib/api';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BillingTab = 'weekly' | 'monthly' | '3m' | 'yearly';
type Tier = 'free' | 'pro' | 'premium';

const BILLING: { key: BillingTab; label: string; suffix: string }[] = [
  { key: 'weekly',  label: 'Weekly',   suffix: '_weekly'  },
  { key: 'monthly', label: 'Monthly',  suffix: '_monthly' },
  { key: '3m',      label: '3 Months', suffix: '_3m'      },
  { key: 'yearly',  label: 'Yearly',   suffix: '_yearly'  },
];

// ── Comparison table data ─────────────────────────────────────────────────────
type CellVal = string | boolean;
interface CompRow { label: string; free: CellVal; pro: CellVal; premium: CellVal }

const COMPARE_ROWS: CompRow[] = [
  { label: 'Creates / week',    free: '1',         pro: '5',         premium: 'Unlimited' },
  { label: 'Joins / week',      free: '1',         pro: '7',         premium: 'Unlimited' },
  { label: 'Group chat',        free: true,        pro: true,        premium: true        },
  { label: 'Friend requests',   free: true,        pro: true,        premium: true        },
  { label: 'Direct messages',   free: false,       pro: true,        premium: true        },
  { label: 'Ping non-friends',  free: false,       pro: true,        premium: true        },
  { label: 'Tag in Highlights', free: false,       pro: false,       premium: true        },
  { label: 'Activity groups',   free: false,       pro: false,       premium: true        },
  { label: 'Priority support',  free: false,       pro: false,       premium: true        },
];

const TIER_ACCENT: Record<Tier, string> = {
  free:    '#6B7280',
  pro:     Ping.purple,
  premium: '#BB92FF',
};

export default function SubscriptionScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [billing, setBilling] = useState<BillingTab>('monthly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mine, setMine] = useState<SubscriptionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        subscriptionsApi.plans(),
        subscriptionsApi.me().catch(() => null),
      ]);
      setPlans(p.plans ?? []);
      if (m?.subscription) setMine(m.subscription);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not load plans', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const planFor = (tier: 'pro' | 'premium') =>
    plans.find((p) => p.planId === `${tier}${BILLING.find((b) => b.key === billing)!.suffix}`);

  async function buy(plan: SubscriptionPlan) {
    if (buying) return;
    setBuying(plan.planId);
    try {
      const res = await subscriptionsApi.mockActivate(plan.planId);
      setMine(res.subscription);
      Toast.show({
        type: 'success',
        text1: `${plan.tier === 'premium' ? 'Premium' : 'Pro'} unlocked 🎉`,
        text2: `Active until ${res.subscription.expiresAt ? new Date(res.subscription.expiresAt).toLocaleDateString('en-IN') : '—'}`,
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Purchase failed', text2: e.message });
    } finally {
      setBuying(null);
    }
  }

  const currentTier: Tier = (mine?.tier as Tier) ?? 'free';

  // ── Plan card button label + behavior ─────────────────────────────────────
  function planAction(tier: Tier) {
    const plan = tier === 'free' ? null : planFor(tier as 'pro' | 'premium');
    const isLoading = plan ? buying === plan.planId : false;

    if (tier === 'free') {
      if (currentTier === 'free') {
        return { label: '✓ Current plan', onPress: undefined, variant: 'current' } as const;
      }
      // downgrade — just show UI, no API yet
      return { label: 'Downgrade to Free', onPress: () => Toast.show({ type: 'info', text1: 'Let your plan expire', text2: 'Cancel anytime by letting the period end.' }), variant: 'outline' } as const;
    }

    if (currentTier === tier) {
      return { label: '✓ Current plan', onPress: undefined, variant: 'current' } as const;
    }

    if (tier === 'pro' && currentTier === 'premium') {
      return { label: 'Downgrade to Pro', onPress: () => Toast.show({ type: 'info', text1: 'Let Premium expire', text2: "You'll drop to Pro at renewal." }), variant: 'outline' } as const;
    }

    const label = isLoading
      ? 'Unlocking…'
      : tier === 'premium'
      ? 'Get Premium'
      : 'Get Pro';

    return { label, onPress: plan ? () => buy(plan) : undefined, variant: tier === 'premium' ? 'premium' : 'pro', isLoading } as const;
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScreenHeader title="Ping Plus" onBack={() => router.back()} paddingTop={insets.top + 8} />

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Current status */}
          <View style={[styles.statusCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.statusEyebrow, { color: c.textSecondary }]}>YOUR PLAN</Text>
            <Text style={[styles.statusTier, { color: c.text }]}>
              {currentTier === 'free' ? 'Free' : currentTier === 'pro' ? 'Pro' : 'Premium'}
            </Text>
            {mine?.expiresAt && currentTier !== 'free' ? (
              <Text style={[styles.statusMeta, { color: c.textSecondary }]}>
                Renews / ends {new Date(mine.expiresAt).toLocaleDateString('en-IN')}
              </Text>
            ) : (
              <Text style={[styles.statusMeta, { color: c.textSecondary }]}>
                {mine?.usage.createRemaining != null
                  ? `${mine.usage.createRemaining} create · ${mine.usage.joinRemaining} join left this week`
                  : 'Unlimited pings'}
              </Text>
            )}
          </View>

          {/* Billing interval */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>BILLING</Text>
          <View style={styles.billingRow}>
            {BILLING.map((b) => {
              const active = billing === b.key;
              return (
                <TouchableOpacity
                  key={b.key}
                  onPress={() => setBilling(b.key)}
                  style={[
                    styles.billingChip,
                    { backgroundColor: active ? Ping.purple : c.soft, borderColor: active ? Ping.purple : c.border },
                  ]}
                >
                  <Text style={[styles.billingText, { color: active ? '#FFF' : c.text }]}>{b.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Plan cards ── */}
          <PlanCard
            tier="free"
            name="Free"
            priceLabel="₹0"
            features={['1 create / week', '1 join / week', 'Group chat in pings', 'Friend requests']}
            action={planAction('free')}
            isCurrent={currentTier === 'free'}
            c={c} isDark={isDark}
          />

          {(() => {
            const plan = planFor('pro');
            return (
              <PlanCard
                tier="pro"
                name="Pro"
                priceLabel={plan ? `₹${plan.amountRupees}` : '—'}
                interval={plan?.intervalLabel}
                features={['Direct messages', 'Direct pings to non-friends', '5 creates / week', '7 joins / week']}
                action={planAction('pro')}
                isCurrent={currentTier === 'pro'}
                buying={buying === plan?.planId}
                c={c} isDark={isDark}
              />
            );
          })()}

          {(() => {
            const plan = planFor('premium');
            return (
              <PlanCard
                tier="premium"
                name="Premium"
                priceLabel={plan ? `₹${plan.amountRupees}` : '—'}
                interval={plan?.intervalLabel}
                features={['Unlimited create & join', 'Tag in Highlights', 'Create activity groups', 'Everything in Pro']}
                action={planAction('premium')}
                isCurrent={currentTier === 'premium'}
                buying={buying === plan?.planId}
                highlight
                c={c} isDark={isDark}
              />
            );
          })()}

          {/* ── Feature comparison table ── */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary, marginTop: 8 }]}>FEATURE COMPARISON</Text>
          <View style={[styles.compareCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* Header */}
            <View style={[styles.compareRow, styles.compareHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
              <Text style={[styles.compareFeatureLabel, { color: c.textSecondary }]} />
              {(['free', 'pro', 'premium'] as Tier[]).map((t) => (
                <View key={t} style={styles.compareCell}>
                  <Text style={[styles.compareHeaderTier, { color: currentTier === t ? TIER_ACCENT[t] : c.textSecondary }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                  {currentTier === t && (
                    <View style={[styles.compareActiveDot, { backgroundColor: TIER_ACCENT[t] }]} />
                  )}
                </View>
              ))}
            </View>

            {/* Rows */}
            {COMPARE_ROWS.map((row, i) => {
              const isLast = i === COMPARE_ROWS.length - 1;
              return (
                <View
                  key={row.label}
                  style={[
                    styles.compareRow,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                  ]}
                >
                  <Text style={[styles.compareFeatureLabel, { color: c.text }]} numberOfLines={1}>{row.label}</Text>
                  {(['free', 'pro', 'premium'] as Tier[]).map((t) => {
                    const val = row[t];
                    const accent = TIER_ACCENT[t];
                    return (
                      <View key={t} style={styles.compareCell}>
                        {typeof val === 'boolean' ? (
                          <Ionicons
                            name={val ? 'checkmark-circle' : 'close-circle'}
                            size={18}
                            color={val ? accent : isDark ? '#3A3A55' : '#D1D5DB'}
                          />
                        ) : (
                          <Text style={[styles.compareCellText, { color: accent }]}>{val}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>

          <Text style={[styles.footnote, { color: c.textSecondary }]}>
            Prices in INR. Cancel anytime by letting the period expire.{'\n'}Pro 3-month is ₹149 for 90 days as recorded on the sheet.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ── Plan card component ───────────────────────────────────────────────────────

type ActionVariant = 'current' | 'outline' | 'pro' | 'premium';

function PlanCard({
  tier, name, priceLabel, interval, features, action, isCurrent, buying, highlight, c, isDark,
}: {
  tier: Tier;
  name: string;
  priceLabel: string;
  interval?: string;
  features: string[];
  action: { label: string; onPress?: () => void; variant: ActionVariant; isLoading?: boolean };
  isCurrent: boolean;
  buying?: boolean;
  highlight?: boolean;
  c: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const accent = TIER_ACCENT[tier];

  return (
    <View style={[
      styles.tierCard,
      { backgroundColor: c.surface, borderColor: highlight ? accent : c.border, borderWidth: highlight ? 1.5 : StyleSheet.hairlineWidth },
    ]}>
      {/* Header row */}
      <View style={styles.tierTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tierName, { color: c.text }]}>{name}</Text>
          {isCurrent && (
            <Text style={[styles.currentBadge, { color: accent }]}>Current plan</Text>
          )}
        </View>
        <View style={styles.priceCol}>
          <Text style={[styles.tierPrice, { color: c.text }]}>{priceLabel}</Text>
          {interval && (
            <Text style={[styles.tierInterval, { color: c.textSecondary }]} numberOfLines={1}>
              /{interval.replace(/^1\s+/, '')}
            </Text>
          )}
        </View>
      </View>

      {/* Features */}
      <View style={styles.featList}>
        {features.map((f) => (
          <View key={f} style={styles.featRow}>
            <Ionicons name="checkmark-circle" size={15} color={accent} />
            <Text style={[styles.featText, { color: c.text }]}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Action button — always rendered */}
      <TouchableOpacity
        style={[
          styles.planBtn,
          action.variant === 'current'  && [styles.planBtnCurrent,  { borderColor: accent, backgroundColor: `${accent}14` }],
          action.variant === 'outline'  && [styles.planBtnOutline,  { borderColor: c.border }],
          action.variant === 'pro'      && [styles.planBtnFilled,   { backgroundColor: Ping.purple }],
          action.variant === 'premium'  && [styles.planBtnFilled,   { backgroundColor: '#7C3AED' }],
        ]}
        onPress={action.onPress}
        disabled={!action.onPress || !!buying}
        activeOpacity={action.onPress ? 0.8 : 1}
      >
        {buying ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={[
            styles.planBtnText,
            action.variant === 'current' && { color: accent },
            action.variant === 'outline' && { color: c.textSecondary },
            (action.variant === 'pro' || action.variant === 'premium') && { color: '#FFF' },
          ]}>
            {action.label}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  statusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: 4,
  },
  statusEyebrow: { ...Typography.label, marginBottom: 4 },
  statusTier: { ...Typography.h2 },
  statusMeta: { ...Typography.caption, marginTop: 4 },
  sectionLabel: { ...Typography.label, letterSpacing: 0.6, marginTop: 4 },
  billingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  billingChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  billingText: { fontSize: 12, fontWeight: '700' },

  // ── Tier card ──
  tierCard: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 4 },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tierName: { ...Typography.h3 },
  currentBadge: { ...Typography.caption, fontWeight: '700', marginTop: 2 },
  priceCol: { flexDirection: 'row', alignItems: 'baseline', gap: 2, flexShrink: 0, marginLeft: 12 },
  tierPrice: { fontSize: 22, fontWeight: '800' },
  tierInterval: { ...Typography.caption, fontWeight: '600' },
  featList: { gap: 7, marginTop: 4 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featText: { ...Typography.bodySm, flex: 1 },

  // ── Plan action button ──
  planBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planBtnCurrent: { borderWidth: 1 },
  planBtnOutline: { borderWidth: StyleSheet.hairlineWidth },
  planBtnFilled: { borderWidth: 0 },
  planBtnText: { fontSize: 14, fontWeight: '700' },

  // ── Comparison table ──
  compareCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  compareHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  compareFeatureLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  compareCell: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareHeaderTier: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  compareActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  compareCellText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  footnote: { ...Typography.caption, textAlign: 'center', lineHeight: 18, marginTop: 4 },
});
