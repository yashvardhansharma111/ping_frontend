import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { AppButton, SectionLabel } from '@/components/ui';
import {
  subscriptionsApi,
  type SubscriptionPlan,
  type SubscriptionSnapshot,
} from '@/lib/api';
import { Colors, Ping, Spacing, Radius, Typography, Shadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BillingTab = 'weekly' | 'monthly' | '3m' | 'yearly';

const BILLING: { key: BillingTab; label: string; suffix: string }[] = [
  { key: 'weekly', label: 'Weekly', suffix: '_weekly' },
  { key: 'monthly', label: 'Monthly', suffix: '_monthly' },
  { key: '3m', label: '3 Months', suffix: '_3m' },
  { key: 'yearly', label: 'Yearly', suffix: '_yearly' },
];

const TIER_FEATURES: Record<'free' | 'pro' | 'premium', string[]> = {
  free: [
    '1 create / week',
    '1 join / week',
    'Group chat in pings',
    'Friend requests',
  ],
  pro: [
    'Direct messages',
    'Direct pings to non-friends',
    '5 creates / week',
    '15 joins / week',
  ],
  premium: [
    'Unlimited create & join',
    'Tag in Highlights',
    'Create activity groups',
    'Everything in Pro',
  ],
};

export default function SubscriptionScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
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

  const currentTier = mine?.tier ?? 'free';

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
          <View style={[styles.statusCard, { backgroundColor: c.surface, borderColor: c.border }, Shadow.sm]}>
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
          <SectionLabel>BILLING</SectionLabel>
          <View style={styles.billingRow}>
            {BILLING.map((b) => {
              const active = billing === b.key;
              return (
                <TouchableOpacity
                  key={b.key}
                  onPress={() => setBilling(b.key)}
                  style={[
                    styles.billingChip,
                    {
                      backgroundColor: active ? c.primary : c.soft,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.billingText, { color: active ? '#FFF' : c.text }]}>{b.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Free */}
          <TierCard
            name="Free"
            priceLabel="₹0"
            features={TIER_FEATURES.free}
            current={currentTier === 'free'}
            c={c}
          />

          {/* Pro */}
          {(() => {
            const plan = planFor('pro');
            return (
              <TierCard
                name="Pro"
                priceLabel={plan ? `₹${plan.amountRupees}` : '—'}
                interval={plan?.intervalLabel}
                features={TIER_FEATURES.pro}
                current={currentTier === 'pro'}
                c={c}
                accent={Ping.purple}
                action={
                  currentTier === 'pro' || currentTier === 'premium' ? undefined : (
                    <AppButton
                      label={buying === plan?.planId ? 'Unlocking…' : 'Get Pro'}
                      onPress={() => plan && buy(plan)}
                      loading={buying === plan?.planId}
                      disabled={!plan || !!buying}
                      size="sm"
                    />
                  )
                }
              />
            );
          })()}

          {/* Premium */}
          {(() => {
            const plan = planFor('premium');
            return (
              <TierCard
                name="Premium"
                priceLabel={plan ? `₹${plan.amountRupees}` : '—'}
                interval={plan?.intervalLabel}
                features={TIER_FEATURES.premium}
                current={currentTier === 'premium'}
                c={c}
                accent={Ping.purpleDim}
                highlight
                action={
                  currentTier === 'premium' ? undefined : (
                    <AppButton
                      label={buying === plan?.planId ? 'Unlocking…' : 'Get Premium'}
                      onPress={() => plan && buy(plan)}
                      loading={buying === plan?.planId}
                      disabled={!plan || !!buying}
                      size="sm"
                      gradient
                    />
                  )
                }
              />
            );
          })()}

          <Text style={[styles.footnote, { color: c.textSecondary }]}>
            Prices in INR. Cancel anytime by letting the period expire. Pro 3-month is ₹149 for 90 days as recorded on the sheet.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function TierCard({
  name,
  priceLabel,
  interval,
  features,
  current,
  action,
  c,
  accent,
  highlight,
}: {
  name: string;
  priceLabel: string;
  interval?: string;
  features: string[];
  current?: boolean;
  action?: React.ReactNode;
  c: (typeof Colors)['light'];
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.tierCard,
        {
          backgroundColor: c.surface,
          borderColor: highlight ? (accent ?? Ping.purple) : c.border,
          borderWidth: highlight ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.tierTop}>
        <View>
          <Text style={[styles.tierName, { color: c.text }]}>{name}</Text>
          {current ? (
            <Text style={[styles.currentBadge, { color: accent ?? c.primary }]}>Current plan</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.tierPrice, { color: c.text }]}>{priceLabel}</Text>
          {interval ? (
            <Text style={[styles.tierInterval, { color: c.textSecondary }]}>/ {interval}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.featList}>
        {features.map((f) => (
          <View key={f} style={styles.featRow}>
            <Ionicons name="checkmark-circle" size={16} color={accent ?? c.primary} />
            <Text style={[styles.featText, { color: c.text }]}>{f}</Text>
          </View>
        ))}
      </View>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
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
  billingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  billingChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  billingText: { fontSize: 12, fontWeight: '700' },
  tierCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 4,
  },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tierName: { ...Typography.h3 },
  currentBadge: { ...Typography.caption, fontWeight: '700', marginTop: 2 },
  tierPrice: { fontSize: 22, fontWeight: '800' },
  tierInterval: { ...Typography.caption },
  featList: { gap: 8, marginTop: 4 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featText: { ...Typography.bodySm, flex: 1 },
  footnote: { ...Typography.caption, textAlign: 'center', lineHeight: 18, marginTop: 8 },
});
