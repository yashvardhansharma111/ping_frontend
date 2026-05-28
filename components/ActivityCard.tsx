import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activitiesApi, chatApi, type Activity, type ActivityParticipant } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_META: Record<string, { icon: IoniconName; color: string }> = {
  sport:   { icon: 'barbell-outline',        color: '#22C55E' },
  food:    { icon: 'restaurant-outline',      color: '#F97316' },
  music:   { icon: 'musical-notes-outline',   color: '#8B5CF6' },
  study:   { icon: 'book-outline',            color: '#3B82F6' },
  outdoor: { icon: 'walk-outline',            color: '#10B981' },
  gaming:  { icon: 'game-controller-outline', color: '#EC4899' },
  meetup:  { icon: 'people-outline',          color: Ping.purple },
  default: { icon: 'location-outline',        color: '#6B7280' },
};

const VIS_ICON: Record<string, IoniconName> = {
  public:  'earth-outline',
  friends: 'people-outline',
  squad:   'shield-outline',
};

// ── Time helpers ──────────────────────────────────────────────────────────────

function participantCount(participants: ActivityParticipant[]) {
  return participants?.length ?? 0;
}

function isParticipant(participants: ActivityParticipant[], userId: string) {
  return participants?.some((p) => {
    const id = typeof p.userId === 'object' ? (p.userId as any)?.toString() : p.userId;
    return id === userId;
  }) ?? false;
}

function getMyParticipant(participants: ActivityParticipant[], userId: string) {
  return participants?.find((p) => {
    const id = typeof p.userId === 'object' ? (p.userId as any)?.toString() : p.userId;
    return id === userId;
  });
}

type TimeStatus = 'live' | 'soon' | 'scheduled' | 'expired';

function getTimeStatus(startsAt: string, expiresAt: string): TimeStatus {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const expire = new Date(expiresAt).getTime();
  if (now > expire) return 'expired';
  if (now >= start) return 'live';
  if (start - now < 30 * 60 * 1000) return 'soon'; // within 30 min
  return 'scheduled';
}

function formatStartTime(startsAt: string): string {
  const start = new Date(startsAt);
  const now = new Date();
  const diffMs = start.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin <= 0) return 'Now';
  if (diffMin < 60) return `in ${diffMin}m`;

  const isToday = start.toDateString() === now.toDateString();
  const time = start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return isToday ? `Today ${time}` : `Tomorrow ${time}`;
}

const STATUS_CONFIG = {
  live:      { label: 'LIVE',      bg: '#22C55E22', text: '#22C55E', dot: '#22C55E' },
  soon:      { label: 'SOON',      bg: '#F9731622', text: '#F97316', dot: '#F97316' },
  scheduled: { label: 'SCHEDULED', bg: `${Ping.purple}22`, text: Ping.purpleLight, dot: Ping.purpleLight },
  expired:   { label: 'ENDED',     bg: '#6B728022', text: '#9490C0',  dot: '#6B7280' },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  activity: Activity;
  onJoin?: () => void;
  compact?: boolean; // hide action buttons (for use in detail sheets)
}

export default function ActivityCard({ activity: a, onJoin, compact = false }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const { user } = useAuthStore();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const myId = user?._id ?? '';
  const isJoined = isParticipant(a.participants, myId);
  const myParticipant = getMyParticipant(a.participants, myId);
  const count = participantCount(a.participants);
  const spotsLeft = a.maxParticipants ? a.maxParticipants - count : null;
  const typeCfg = TYPE_META[a.type] ?? TYPE_META.default;
  const visIcon = VIS_ICON[a.visibility] ?? 'earth-outline';
  const timeStatus = getTimeStatus(a.startsAt, a.expiresAt);
  const statusCfg = STATUS_CONFIG[timeStatus];
  const isExpired = timeStatus === 'expired';

  async function handleJoin() {
    if (isJoined || joining || isExpired) return;
    setJoining(true);
    try {
      await activitiesApi.join(a._id);
      onJoin?.();
    } catch (err: any) {
      Alert.alert('Could not join', err.message || 'Try again.');
    } finally {
      setJoining(false);
    }
  }

  async function handleOpenChat() {
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const res = await chatApi.openActivityRoom(a._id);
      router.push(`/chat/${res.room._id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not open chat.');
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Joined accent bar */}
      {isJoined && <View style={styles.joinedAccent} />}

      {/* Top row */}
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: `${typeCfg.color}1A` }]}>
          <Ionicons name={typeCfg.icon} size={22} color={typeCfg.color} />
        </View>

        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{a.title}</Text>
            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
            </View>
          </View>

          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={11} color={c.icon} />
              <Text style={[styles.metaText, { color: timeStatus === 'live' ? '#22C55E' : c.textSecondary }]}>
                {timeStatus === 'live' ? 'Live now' : formatStartTime(a.startsAt)}
              </Text>
            </View>
            {a.distance !== undefined && a.distance !== null && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={11} color={c.icon} />
                <Text style={[styles.metaText, { color: c.textSecondary }]}>
                  {a.distance < 1000
                    ? `${Math.round(a.distance)}m`
                    : `${(a.distance / 1000).toFixed(1)}km`}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={11} color={c.icon} />
              <Text style={[styles.metaText, { color: c.textSecondary }]}>
                {count}{a.maxParticipants ? `/${a.maxParticipants}` : ''}
              </Text>
            </View>
            <View style={[styles.visChip, { borderColor: c.border }]}>
              <Ionicons name={visIcon} size={10} color={c.textSecondary} />
            </View>
          </View>
        </View>

        {/* Join / Joined */}
        {!compact && (
          <TouchableOpacity
            style={[
              styles.joinBtn,
              isJoined && styles.joinBtnDone,
              isExpired && styles.joinBtnExpired,
            ]}
            onPress={handleJoin}
            disabled={isJoined || joining || isExpired}
            activeOpacity={0.8}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : isJoined ? (
              <Ionicons name="checkmark" size={16} color={Ping.green} />
            ) : isExpired ? (
              <Text style={[styles.joinText, { color: '#6B7280', fontSize: 10 }]}>Ended</Text>
            ) : (
              <Text style={styles.joinText}>Join</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Creator */}
      {a.creator?.displayName && (
        <Text style={[styles.creator, { color: c.textSecondary }]}>
          by {a.creator.displayName}
        </Text>
      )}

      {/* Urgency */}
      {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && (
        <View style={styles.urgency}>
          <Ionicons name="flame" size={12} color={Ping.orange} />
          <Text style={[styles.urgencyText, { color: Ping.orange }]}>
            Only {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left!
          </Text>
        </View>
      )}

      {/* Actions for joined users */}
      {isJoined && !compact && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.chatBtn, { shadowColor: Ping.purple }]}
            onPress={handleOpenChat}
            disabled={openingChat}
            activeOpacity={0.8}
          >
            {openingChat ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="chatbubbles" size={14} color="#FFF" />
                <Text style={styles.chatBtnText}>Open Chat</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export { isParticipant, getMyParticipant, participantCount, getTimeStatus, formatStartTime, STATUS_CONFIG };

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  joinedAccent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: Ping.green,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  title: { ...Typography.bodyMed, flex: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...Typography.caption, fontSize: 11 },
  visChip: { borderWidth: 1, borderRadius: Radius.sm, padding: 3 },
  joinBtn: {
    backgroundColor: Ping.purple,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  joinBtnDone: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  joinBtnExpired: {
    backgroundColor: 'rgba(107,114,128,0.15)',
    shadowOpacity: 0,
    elevation: 0,
  },
  joinText: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
  creator: { ...Typography.caption, marginLeft: 60 },
  urgency: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 60 },
  urgencyText: { ...Typography.caption, fontWeight: '600' },
  actionsRow: { marginTop: Spacing.xs },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Ping.purple,
    paddingVertical: 9,
    borderRadius: Radius.md,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  chatBtnText: { ...Typography.caption, color: '#FFF', fontWeight: '700', fontSize: 13 },
});
