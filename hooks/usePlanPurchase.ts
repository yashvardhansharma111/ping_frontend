import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { subscriptionsApi, type SubscriptionPlan, type SubscriptionSnapshot } from '@/lib/api';

const RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };
const POLL_EVERY_MS = 3000;
const POLL_MAX = 30; // ~90s

export type PurchaseOutcome = 'activated' | 'pending' | 'failed';

// Real checkout flow: ₹0 (coupon) activates instantly; otherwise the hosted
// Razorpay page opens in the browser, the webhook activates the plan, and we
// poll /subscriptions/me once the app is back in the foreground.
export function usePlanPurchase(onActivated: (s: SubscriptionSnapshot) => void) {
  const [buying, setBuying] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<'pro' | 'premium' | null>(null);
  const pollingRef = useRef(false);
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const poll = useCallback(async (tier: 'pro' | 'premium') => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (let i = 0; i < POLL_MAX; i++) {
        try {
          const r = await subscriptionsApi.me();
          if (RANK[r.subscription.tier] >= RANK[tier]) {
            setPendingTier(null);
            onActivatedRef.current(r.subscription);
            Toast.show({
              type: 'success',
              text1: `${tier === 'premium' ? 'Premium' : 'Pro'} unlocked 🎉`,
              text2: r.subscription.expiresAt ? `Active until ${new Date(r.subscription.expiresAt).toLocaleDateString('en-IN')}` : undefined,
            });
            return;
          }
        } catch { /* keep polling */ }
        await new Promise((res) => setTimeout(res, POLL_EVERY_MS));
      }
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!pendingTier) return;
    const sub = AppState.addEventListener('change', (st: AppStateStatus) => {
      if (st === 'active') poll(pendingTier);
    });
    return () => sub.remove();
  }, [pendingTier, poll]);

  const buy = useCallback(async (plan: SubscriptionPlan, couponCode?: string | null): Promise<PurchaseOutcome> => {
    if (buying) return 'failed';
    setBuying(plan.planId);
    try {
      const res = await subscriptionsApi.createOrder(plan.planId, couponCode);
      if (res.activated && res.subscription) {
        onActivatedRef.current(res.subscription);
        Toast.show({
          type: 'success',
          text1: `${plan.tier === 'premium' ? 'Premium' : 'Pro'} unlocked 🎉`,
          text2: res.subscription.expiresAt ? `Active until ${new Date(res.subscription.expiresAt).toLocaleDateString('en-IN')}` : undefined,
        });
        return 'activated';
      }
      if (!res.checkoutUrl) throw new Error('Checkout unavailable');
      setPendingTier(plan.tier);
      await Linking.openURL(res.checkoutUrl);
      Toast.show({ type: 'info', text1: 'Finish payment in the browser', text2: 'Come back to Ping once it succeeds.' });
      return 'pending';
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Purchase failed', text2: e?.message || 'Try again.' });
      return 'failed';
    } finally {
      setBuying(null);
    }
  }, [buying]);

  return { buy, buying, pendingTier, checkNow: () => (pendingTier ? poll(pendingTier) : undefined) };
}
