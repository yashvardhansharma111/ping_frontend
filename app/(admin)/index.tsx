import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, type AdminOverview, type AdminDailyPoint, authApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W } = Dimensions.get('window');

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: IoniconName; color: string; sub?: string;
}) {
  return (
    <View style={[s.statCard, { borderColor: `${color}33` }]}>
      <View style={[s.statIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
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

// ── Bar chart (pure RN, no external lib) ─────────────────────────────────────

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
  const chartH = 80;
  const barW = Math.floor(((SCREEN_W - Spacing.lg * 2 - 32) / data.length) - 6);

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
          const barH = Math.max(heightPct * chartH, val > 0 ? 4 : 2);
          return (
            <View key={i} style={bc.barCol}>
              <View style={[bc.barBg, { height: chartH }]}>
                <View
                  style={[
                    bc.barFill,
                    {
                      height: barH,
                      backgroundColor: val > 0 ? color : 'rgba(255,255,255,0.06)',
                      width: barW,
                    },
                  ]}
                />
              </View>
              {val > 0 && (
                <Text style={bc.barVal}>{fmt(val)}</Text>
              )}
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
    backgroundColor: '#11112A',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.12)',
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  label: { ...Typography.bodySm, color: '#9490C0', fontWeight: '700' },
  total: { ...Typography.bodySm, fontWeight: '800' },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  barBg: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    borderRadius: 4,
    minHeight: 2,
  },
  barVal: {
    fontSize: 8,
    fontWeight: '700',
    color: '#F1F0FF',
  },
  barDay: {
    fontSize: 9,
    color: '#5C5A80',
    fontWeight: '600',
  },
});

// ── Mini metric row inside chart ─────────────────────────────────────────────

function MetricPill({ icon, label, value, color }: {
  icon: IoniconName; label: string; value: number | string; color: string;
}) {
  return (
    <View style={[mp.pill, { borderColor: `${color}30` }]}>
      <View style={[mp.icon, { backgroundColor: `${color}18` }]}>
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
    minWidth: '28%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#11112A',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 10,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...Typography.bodySm, color: '#F1F0FF', fontWeight: '800', fontSize: 15 },
  label: { ...Typography.caption, color: '#9490C0', fontSize: 10 },
});

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { logout, refreshToken } = useAuthStore();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await adminApi.overview();
      setData(res);
    } catch (err: any) {
      if (err.message !== 'Not authenticated') {
        Alert.alert('Error', err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleLogout() {
    Alert.alert('Log out?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          try { if (refreshToken) await authApi.logout(refreshToken); } catch {}
          await logout();
        },
      },
    ]);
  }

  const daily = data?.daily ?? [];
  const fmtRupees = (minor: number) => `₹${Math.round(minor / 100)}`;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={Ping.purple} />
          </View>
          <View>
            <Text style={s.headerTitle}>Admin Panel</Text>
            <Text style={s.headerSub}>Ping Dashboard</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color="#5C5A80" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Ping.purpleLight} />
          }
        >
          {/* ── Live pulse row ── */}
          <View style={s.liveRow}>
            <View style={s.livePulse} />
            <Text style={s.liveLabel}>Live right now</Text>
          </View>
          <View style={s.metricsRow}>
            <MetricPill icon="radio-outline"     label="Active Users"  value={data?.live.activeNow ?? 0}     color="#22C55E" />
            <MetricPill icon="location-outline"  label="Live Pings"    value={data?.live.activePings ?? 0}   color={Ping.purple} />
            <MetricPill icon="megaphone-outline" label="Live Ads"      value={data?.live.activeAds ?? 0}     color="#F97316" />
          </View>
          <View style={[s.revCard, { borderColor: 'rgba(34,197,94,0.25)' }]}>
            <Ionicons name="cash-outline" size={20} color="#22C55E" />
            <View style={{ flex: 1 }}>
              <Text style={s.revLabel}>Today's Revenue</Text>
              <Text style={s.revValue}>{fmtRupees(data?.live.todaysRevenueMinor ?? 0)}</Text>
            </View>
          </View>

          {/* ── Charts section ── */}
          {daily.length > 0 && (
            <Section title="Last 7 Days — Charts">
              <View style={s.chartGrid}>
                <BarChart
                  data={daily}
                  field="signups"
                  color="#3B82F6"
                  label="New Signups"
                />
                <BarChart
                  data={daily}
                  field="revenueMinor"
                  color="#22C55E"
                  label="Revenue"
                  format={fmtRupees}
                />
                <BarChart
                  data={daily}
                  field="pings"
                  color={Ping.purple}
                  label="Pings Created"
                />
                <BarChart
                  data={daily}
                  field="ads"
                  color="#F97316"
                  label="Ads Launched"
                />
              </View>
            </Section>
          )}

          {/* ── 7-day totals ── */}
          <Section title="Last 7 Days — Totals">
            <View style={s.grid}>
              <StatCard label="New Signups"   value={data?.last7d.newSignups ?? 0}   icon="person-add-outline"    color="#3B82F6" />
              <StatCard label="Pings Created" value={data?.last7d.pingsCreated ?? 0} icon="flash-outline"         color={Ping.purple} />
              <StatCard label="Ads Launched"  value={data?.last7d.adsLaunched ?? 0}  icon="megaphone-outline"     color="#F97316" />
              <StatCard label="Bans Issued"   value={data?.last7d.bansIssued ?? 0}   icon="ban-outline"           color="#EF4444" />
              <StatCard label="Reports"       value={data?.last7d.reportsSubmitted ?? 0} icon="flag-outline"      color="#F59E0B" />
            </View>
          </Section>

          {/* ── Moderation queues ── */}
          <Section title="Moderation Queue">
            <View style={s.grid}>
              <StatCard
                label="Pending Reports"
                value={data?.queues.pendingReports ?? 0}
                icon="flag-outline"
                color={data?.queues.pendingReports ? '#EF4444' : '#22C55E'}
                sub={data?.queues.pendingReports ? 'Needs action' : 'All clear'}
              />
              <StatCard
                label="Open Appeals"
                value={data?.queues.pendingAppeals ?? 0}
                icon="chatbubble-ellipses-outline"
                color={data?.queues.pendingAppeals ? '#F97316' : '#22C55E'}
                sub={data?.queues.pendingAppeals ? 'Needs review' : 'All clear'}
              />
            </View>
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080815' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  adminBadge: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3, color: '#F1F0FF' },
  headerSub: { ...Typography.caption, color: '#9490C0' },
  body: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 40 },
  liveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: -8,
  },
  livePulse: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 4, elevation: 3,
  },
  liveLabel: { ...Typography.caption, color: '#22C55E', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  metricsRow: { flexDirection: 'row', gap: Spacing.sm },
  revCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#11112A', borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.md,
  },
  revLabel: { ...Typography.caption, color: '#9490C0' },
  revValue: { ...Typography.h3, color: '#22C55E', fontSize: 28, fontWeight: '800' },
  section: { gap: Spacing.md },
  sectionTitle: {
    ...Typography.caption, color: '#9490C0',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  chartGrid: { gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#11112A',
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.md, gap: 4,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { ...Typography.h3, color: '#F1F0FF', fontSize: 26, fontWeight: '800' },
  statLabel: { ...Typography.bodySm, color: '#9490C0' },
  statSub: { ...Typography.caption, color: '#5C5A80' },
});
