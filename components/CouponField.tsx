import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscriptionsApi, type CouponPreview } from '@/lib/api';
import { Colors, Ping, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type CouponResults = Record<string, CouponPreview>; // by planId

interface Props {
  /** Plans the coupon should be tried against (e.g. the pro + premium plan for the chosen billing). */
  planIds: string[];
  onChange: (results: CouponResults, code: string | null) => void;
  /** Externally requested code (e.g. tapping the featured offer) — applied when it changes. */
  presetCode?: string | null;
}

export default function CouponField({ planIds, onChange, presetCode }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const [results, setResults] = useState<CouponResults>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const planKey = planIds.join('|');
  const lastPreset = useRef<string | null | undefined>(undefined);

  async function apply(raw: string) {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    const out: CouponResults = {};
    let firstErr: string | null = null;
    for (const planId of planIds) {
      try {
        const r = await subscriptionsApi.previewCoupon(trimmed, planId);
        out[planId] = r;
      } catch (e: any) {
        if (!firstErr) firstErr = e?.message || 'Coupon not valid';
      }
    }
    setLoading(false);
    if (Object.keys(out).length === 0) {
      setApplied(null);
      setResults({});
      setError(firstErr ?? 'Coupon not valid');
      onChange({}, null);
      return;
    }
    setCode(trimmed);
    setApplied(trimmed);
    setResults(out);
    onChange(out, trimmed);
  }

  function clear() {
    setCode('');
    setApplied(null);
    setResults({});
    setError(null);
    onChange({}, null);
  }

  // Re-validate an applied code when the candidate plans change (billing toggle)
  useEffect(() => {
    if (applied) apply(applied);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  useEffect(() => {
    if (presetCode && presetCode !== lastPreset.current) {
      lastPreset.current = presetCode;
      setCode(presetCode);
      apply(presetCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCode]);

  const best = Object.values(results)[0];
  const summary = best
    ? best.finalMinor === 0
      ? 'Your plan is free with this code'
      : best.coupon.discountType === 'percent'
        ? `${best.coupon.value}% off`
        : `₹${(best.discountMinor / 100).toFixed(0)} off`
    : null;

  return (
    <View style={s.wrap}>
      <View style={[s.row, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : c.soft, borderColor: applied ? Ping.purple : error ? '#EF4444' : c.border }]}>
        <Ionicons name="pricetag-outline" size={16} color={applied ? Ping.purpleLight : c.textSecondary} />
        <TextInput
          style={[s.input, { color: c.text }]}
          placeholder="Have a coupon code?"
          placeholderTextColor={c.textSecondary}
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase()); if (error) setError(null); }}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!applied && !loading}
          returnKeyType="done"
          onSubmitEditing={() => apply(code)}
        />
        {loading ? (
          <ActivityIndicator size="small" color={Ping.purple} />
        ) : applied ? (
          <TouchableOpacity onPress={clear} hitSlop={8} style={s.btnGhost}>
            <Text style={[s.btnGhostText, { color: c.textSecondary }]}>Remove</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => apply(code)} disabled={!code.trim()} style={[s.btn, { opacity: code.trim() ? 1 : 0.45 }]}>
            <Text style={s.btnText}>Apply</Text>
          </TouchableOpacity>
        )}
      </View>
      {applied && summary ? (
        <View style={s.msgRow}>
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text style={[s.msg, { color: '#22C55E' }]}>{applied} applied · {summary}</Text>
        </View>
      ) : error ? (
        <View style={s.msgRow}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={[s.msg, { color: '#EF4444' }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 14, paddingLeft: 12, paddingRight: 6, height: 50,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  btn: { backgroundColor: Ping.purple, paddingHorizontal: 14, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  btnGhost: { paddingHorizontal: 10, height: 36, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 13, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 4 },
  msg: { fontSize: 12, fontWeight: '600' },
});
