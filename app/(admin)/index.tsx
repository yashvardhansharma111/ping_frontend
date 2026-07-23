import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, type AdminOverview, type AdminDailyPoint, authApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Spacing, Radius, Typography } from '@/constants/theme';
import { Admin, adminChrome } from '@/constants/adminTheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W } = Dimensions.get('window');

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: IoniconName; color: string; sub?: string;
}) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface BarChartProps {
  data: AdminDailyPoint[];
  field: keyof AdminDailyPoint;
  color: string;
  label: string;
  format?: (v: number) => string;
}

function BarChart({ data, field, color, label, format }: BarChartProps) {
  const values = data.map(d => (d[field] as number) || 0);
  const max = Math.max(...values, 1);
  const chartH = 72;
  const barW = Math.floor(((SCREEN_W - Spacing.lg * 2 - 28) / data.length) - 6);
  const total = values.reduce((a, b) => a + b, 0);
  const fmt = format ?? ((v: number) => String(v));

  return (
    <View style={bc.wrap}>
      <View style={bc.header}>
        <Text style={bc.label}>{label}</Text>
        <Text style={[bc.total, { color }]}>{fmt(total)}</Text>
      </View>
      <View style={bc.chartArea}>
        {data.map((d, i) => {
          const val = (d[field] as number) || 0;
          const heightPct = max > 0 ? val / max : 0;
          const barH = Math.max(heightPct * chartH, val > 0 ? 3 : 2);
          return (
            <View key={i} style={bc.barCol}>
              <View style={[bc.barBg, { height: chartH }]}>
                <View
                  style={[
                    bc.barFill,
                    {
                      height: barH,
                      backgroundColor: val > 0 ? color : Admin.elevated,
                      width: barW,
                    },
                  ]}
                />
              </View>
              {val > 0 && <Text style={bc.barVal}>{fmt(val)}</Text>}
              <Text style={bc.barDay}>{d.day.replace(/^0/, '')}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  wrap: {
    backgroundColor: Admin.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Admin.border,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: { ...Typography.bodySm, color: Admin.textSecondary, fontWeight: '600' },
  total: { ...Typography.bodySm, fontWeight: '700' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barBg: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { borderRadius: 3, minHeight: 2 },
  barVal: { fontSize: 8, fontWeight: '600', color: Admin.text },
  barDay: { fontSize: 9, color: Admin.muted, fontWeight: '500' },
});

function MetricPill({ icon, label, value, color }: {
  icon: IoniconName; label: string; value: number | string; color: string;
}) {
  return (
    <View style={mp.pill}>
      <View style={[mp.icon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <View>
        <Text style={mp.value}>{value}</Text>
        <Text style={mp.label}>{label}</Text>
      </View>
    </View>
  );
}

const mp = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Admin.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Admin.border,
    padding: 10,
  },
  icon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  value: { ...Typography.bodySm, color: Admin.text, fontWeight: '700', fontSize: 15 },
  label: { ...Typography.caption, color: Admin.muted, fontSize: 10 },
});

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { logout, refreshToken } = useAuthStore();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.overview();
      setData(res);
    } catch (err: any) {
      if (err.message !== 'Not authenticated') {
        Toast.show({ type: 'error', text1: 'Error', text2: err.message });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function doLogout() {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch {}
    await logout();
  }

  const daily = data?.daily ?? [];
  const fmtRupees = (minor: number) => `₹${Math.round(minor / 100)}`;

  return (
    <View style={[adminChrome.root, { paddingTop: insets.top }]}>
      <View style={adminChrome.header}>
        <View>
          <Text style={adminChrome.title}>Admin</Text>
          <Text style={s.subtitle}>Overview</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => setShowLogout(true)} hitSlop={8}>
          <Ionicons name="log-out-outline" size={20} color={Admin.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Admin.accent} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Admin.accent} colors={[Admin.accent]} />
          }
        >
          <View style={s.metricsRow}>
            <MetricPill icon="radio-outline" label="Active" value={data?.live.activeNow ?? 0} color={Admin.success} />
            <MetricPill icon="location-outline" label="Pings" value={data?.live.activePings ?? 0} color={Admin.accent} />
            <MetricPill icon="megaphone-outline" label="Ads" value={data?.live.activeAds ?? 0} color={Admin.warning} />
          </View>

          <View style={s.revCard}>
            <Text style={s.revLabel}>Today</Text>
            <Text style={s.revValue}>{fmtRupees(data?.live.todaysRevenueMinor ?? 0)}</Text>
          </View>

          {daily.length > 0 && (
            <Section title="Last 7 days">
              <View style={s.chartGrid}>
                <BarChart data={daily} field="signups" color={Admin.info} label="Signups" />
                <BarChart data={daily} field="revenueMinor" color={Admin.success} label="Revenue" format={fmtRupees} />
                <BarChart data={daily} field="pings" color={Admin.accent} label="Pings" />
                <BarChart data={daily} field="ads" color={Admin.warning} label="Ads" />
              </View>
            </Section>
          )}

          <Section title="Totals">
            <View style={s.grid}>
              <StatCard label="Signups" value={data?.last7d.newSignups ?? 0} icon="person-add-outline" color={Admin.info} />
              <StatCard label="Pings" value={data?.last7d.pingsCreated ?? 0} icon="flash-outline" color={Admin.accent} />
              <StatCard label="Ads" value={data?.last7d.adsLaunched ?? 0} icon="megaphone-outline" color={Admin.warning} />
              <StatCard label="Bans" value={data?.last7d.bansIssued ?? 0} icon="ban-outline" color={Admin.danger} />
              <StatCard label="Reports" value={data?.last7d.reportsSubmitted ?? 0} icon="flag-outline" color={Admin.warning} />
            </View>
          </Section>

          <Section title="Queue">
            <View style={s.grid}>
              <StatCard
                label="Reports"
                value={data?.queues.pendingReports ?? 0}
                icon="flag-outline"
                color={data?.queues.pendingReports ? Admin.danger : Admin.success}
                sub={data?.queues.pendingReports ? 'Action needed' : 'Clear'}
              />
              <StatCard
                label="Appeals"
                value={data?.queues.pendingAppeals ?? 0}
                icon="chatbubble-ellipses-outline"
                color={data?.queues.pendingAppeals ? Admin.warning : Admin.success}
                sub={data?.queues.pendingAppeals ? 'Review' : 'Clear'}
              />
            </View>
          </Section>
        </ScrollView>
      )}

      <ConfirmSheet
        visible={showLogout}
        onClose={() => setShowLogout(false)}
        title="Log out?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        danger
        icon="log-out-outline"
        onConfirm={doLogout}
      />
    </View>
  );
}

const s = StyleSheet.create({
  subtitle: { ...Typography.caption, color: Admin.muted, marginTop: 2 },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Admin.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  revCard: {
    backgroundColor: Admin.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Admin.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  revLabel: { ...Typography.caption, color: Admin.muted, fontWeight: '600' },
  revValue: { ...Typography.h3, color: Admin.text, fontSize: 28, fontWeight: '700', marginTop: 2 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    ...Typography.caption, color: Admin.muted,
    fontWeight: '600', letterSpacing: 0.2,
  },
  chartGrid: { gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Admin.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Admin.border,
    padding: Spacing.md, gap: 2,
  },
  statIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { ...Typography.h3, color: Admin.text, fontSize: 22, fontWeight: '700' },
  statLabel: { ...Typography.caption, color: Admin.textSecondary },
  statSub: { ...Typography.caption, color: Admin.muted, fontSize: 10 },
});
