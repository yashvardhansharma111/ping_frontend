import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, type AdminOverview, authApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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
      Alert.alert('Error', err.message);
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
          {/* Live now */}
          <Section title="Live Right Now">
            <View style={s.grid}>
              <StatCard label="Active Users" value={data?.live.activeNow ?? 0} icon="radio-outline" color="#22C55E" />
              <StatCard label="Live Pings" value={data?.live.activePings ?? 0} icon="location-outline" color={Ping.purple} />
              <StatCard label="Live Ads" value={data?.live.activeAds ?? 0} icon="megaphone-outline" color="#F97316" />
              <StatCard
                label="Today's Revenue"
                value={`₹${((data?.live.todaysRevenueMinor ?? 0) / 100).toFixed(0)}`}
                icon="cash-outline"
                color="#22C55E"
              />
            </View>
          </Section>

          {/* Last 7 days */}
          <Section title="Last 7 Days">
            <View style={s.grid}>
              <StatCard label="New Signups" value={data?.last7d.newSignups ?? 0} icon="person-add-outline" color="#3B82F6" />
              <StatCard label="Pings Created" value={data?.last7d.pingsCreated ?? 0} icon="flash-outline" color={Ping.purple} />
              <StatCard label="Ads Launched" value={data?.last7d.adsLaunched ?? 0} icon="megaphone-outline" color="#F97316" />
              <StatCard label="Bans Issued" value={data?.last7d.bansIssued ?? 0} icon="ban-outline" color="#EF4444" />
            </View>
          </Section>

          {/* Moderation queues */}
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
  body: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 32 },
  section: { gap: Spacing.md },
  sectionTitle: {
    ...Typography.caption, color: '#9490C0',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
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
