/**
 * Full-detail bottom sheet for a selected activity.
 * Shows: header info, participants, creator, all action buttons.
 * Used inside the map screen's selected-activity sheet.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activitiesApi, chatApi, friendsApi, reportsApi, type Activity, type ActivityParticipant } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  isParticipant,
  getMyParticipant,
  participantCount,
  getTimeStatus,
  formatStartTime,
  STATUS_CONFIG,
} from './ActivityCard';
import PingFullCelebration from './PingFullCelebration';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_OPENERS: Record<string, string> = {
  sport:   "Ready to get active! Who's in and what's the plan?",
  food:    "Food time! What are we eating today?",
  music:   "Music vibes incoming! What are we listening to?",
  study:   "Study session starting! What are you working on?",
  outdoor: "Adventure time! Ready to explore?",
  gaming:  "Game on! What are we playing?",
  meetup:  "Hey everyone! Super excited to meet you all!",
  default: "Hey! Excited to connect with everyone in this ping!",
};

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

function ParticipantAvatar({
  participant,
  index,
  onPress,
}: {
  participant: ActivityParticipant & { displayName?: string; username?: string };
  index: number;
  onPress: () => void;
}) {
  const name = participant.displayName ?? participant.username ?? null;
  const letter = name ? name[0].toUpperCase() : `${index + 1}`;
  const hasArrived = !!participant.arrivedAt;
  const onWay = !!participant.onMyWayAt && !hasArrived;
  // Cycle through accent colours so avatars don't all look identical
  const colors = ['#7C3AED', '#F97316', '#22C55E', '#3B82F6', '#EC4899', '#10B981'];
  const bg = colors[index % colors.length];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={av.wrap}>
      <View style={[av.circle, { backgroundColor: `${bg}44`, borderColor: `${bg}66`, borderWidth: 1.5 }]}>
        <Text style={[av.letter, { color: bg }]}>{letter}</Text>
        {onWay && <View style={[av.badge, { backgroundColor: Ping.orange }]} />}
        {hasArrived && <View style={[av.badge, { backgroundColor: Ping.green }]} />}
      </View>
      <Text style={av.name} numberOfLines={1}>{name ?? 'User'}</Text>
    </TouchableOpacity>
  );
}

const av = StyleSheet.create({
  wrap: { alignItems: 'center', width: 52 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Ping.purple}44`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  letter: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  badge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 11, height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#11112A',
  },
  name: { ...Typography.caption, color: '#9490C0', fontSize: 10, maxWidth: 48 },
});

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  activity: Activity;
  onRefresh: () => void;
  onDismiss: () => void;
}

export default function ActivityDetailSheet({ activity: a, onRefresh, onDismiss }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuthStore();

  const myId = user?._id ?? '';
  const isCreator = a.creatorId === myId || a.creator?._id === myId;
  const isJoined = isParticipant(a.participants, myId);
  const myParticipant = getMyParticipant(a.participants, myId);
  const count = participantCount(a.participants);
  const timeStatus = getTimeStatus(a.startsAt, a.expiresAt);
  const statusCfg = STATUS_CONFIG[timeStatus];
  const typeCfg = TYPE_META[a.type] ?? TYPE_META.default;
  const isExpired = timeStatus === 'expired';

  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leavingQuietly, setLeavingQuietly] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [onMyWayLoading, setOnMyWayLoading] = useState(false);
  const [arrivedLoading, setArrivedLoading] = useState(false);
  const [mutualCount, setMutualCount] = useState<number | null>(null);
  const [chatMsgCount, setChatMsgCount] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ names: string[]; count: number } | null>(null);

  // Fetch mutual friends count for the Safety Card (only when not creator)
  useEffect(() => {
    const cId = a.creator?._id ?? a.creatorId;
    if (!cId || cId === myId) return;
    friendsApi.mutual(cId)
      .then((r) => setMutualCount(r.count))
      .catch(() => setMutualCount(0));
  }, [a._id]);

  // Fetch chat message count for the live chat teaser (non-members)
  useEffect(() => {
    if (isJoined || isCreator) return;
    chatApi.openActivityRoom(a._id)
      .then((r) => chatApi.listMessages(r.room._id))
      .then((r) => setChatMsgCount(r.messages.length))
      .catch(() => setChatMsgCount(0));
  }, [a._id, isJoined, isCreator]);

  async function handleJoin() {
    if (joining || isExpired) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    const myName = user?.displayName ?? user?.username ?? 'Someone';
    const willBeFull = !!a.maxParticipants && (count + 1 >= a.maxParticipants);
    try {
      await activitiesApi.join(a._id);
      onRefresh();
      const res = await chatApi.openActivityRoom(a._id);
      chatApi.sendMessage(res.room._id, `${myName} joined the ping!`).catch(() => {});
      if (willBeFull) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const existingNames = (a.participants ?? []).map((p: any) => p.displayName ?? p.username ?? '').filter(Boolean);
        setCelebration({ names: [...existingNames, myName], count: a.maxParticipants! });
      } else {
        router.push(`/chat/${res.room._id}?type=${encodeURIComponent(a.type)}`);
      }
    } catch (e: any) {
      Alert.alert('Could not join', e.message);
      setJoining(false);
    }
  }

  async function handleLeave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Leave ping?', 'You can rejoin later if it\'s still open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            const name = user?.displayName ?? user?.username ?? 'Someone';
            await chatApi.openActivityRoom(a._id)
              .then((r) => chatApi.sendMessage(r.room._id, `${name} left the ping.`).catch(() => {}))
              .catch(() => {});
            await activitiesApi.leave(a._id);
            onRefresh();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setLeaving(false);
          }
        },
      },
    ]);
  }

  async function handleLeaveQuietly() {
    setLeavingQuietly(true);
    try {
      await activitiesApi.leaveQuietly(a._id);
      onRefresh();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLeavingQuietly(false);
    }
  }

  function handleReport() {
    const targetId = a._id;
    Alert.alert('Report this ping', 'What\'s the issue?', [
      { text: 'Inappropriate content', onPress: () => reportsApi.create('ping', targetId, 'inappropriate').catch(() => {}) },
      { text: 'Felt unsafe', onPress: () => reportsApi.create('ping', targetId, 'unsafe').catch(() => {}) },
      { text: 'Spam', onPress: () => reportsApi.create('ping', targetId, 'spam').catch(() => {}) },
      { text: 'Fake activity', onPress: () => reportsApi.create('ping', targetId, 'fake').catch(() => {}) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleCancel() {
    Alert.alert('Cancel ping?', 'This will end the ping for everyone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel ping',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await activitiesApi.cancel(a._id);
            onDismiss();
            onRefresh();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  async function handleOpenChat() {
    setChatLoading(true);
    try {
      const res = await chatApi.openActivityRoom(a._id);
      if (isCreator) {
        const msgRes = await chatApi.listMessages(res.room._id);
        if (msgRes.messages.length === 0) {
          const opener = TYPE_OPENERS[a.type] ?? TYPE_OPENERS.default;
          chatApi.sendMessage(res.room._id, opener).catch(() => {});
        }
      }
      router.push(`/chat/${res.room._id}?type=${encodeURIComponent(a.type)}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleOnMyWay() {
    setOnMyWayLoading(true);
    try {
      await activitiesApi.onMyWay(a._id);
      await chatApi.openActivityRoom(a._id).then((res) =>
        chatApi.sendMessage(res.room._id, 'On my way! 🚶').catch(() => {})
      );
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setOnMyWayLoading(false);
    }
  }

  async function handleArrived() {
    setArrivedLoading(true);
    try {
      await activitiesApi.arrived(a._id);
      await chatApi.openActivityRoom(a._id).then((res) =>
        chatApi.sendMessage(res.room._id, 'I\'m here! 📍').catch(() => {})
      );
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setArrivedLoading(false);
    }
  }

  const creatorId = a.creator?._id ?? a.creatorId;

  return (
    <>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
      key={a._id}
    >
      {/* Gradient header strip */}
      <View style={[styles.gradientHeader, { backgroundColor: `${typeCfg.color}18` }]}>
        <View style={[styles.gradientHeaderAccent, { backgroundColor: typeCfg.color }]} />
        <View style={[styles.headerIconWrap, { backgroundColor: `${typeCfg.color}33` }]}>
          <Ionicons name={typeCfg.icon} size={22} color={typeCfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: typeCfg.color }]} numberOfLines={1}>{a.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, alignSelf: 'flex-start' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
            <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>
        </View>
      </View>

      {/* Meta row (time / place / distance) */}
      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={c.icon} />
          <Text style={[styles.metaText, { color: timeStatus === 'live' ? '#22C55E' : c.textSecondary }]}>
            {timeStatus === 'live' ? 'Happening now' : formatStartTime(a.startsAt)}
          </Text>
        </View>
        {a.placeName ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={c.icon} />
            <Text style={[styles.metaText, { color: c.textSecondary }]}>{a.placeName}</Text>
          </View>
        ) : null}
        {a.distance !== undefined && a.distance !== null && (
          <View style={styles.metaRow}>
            <Ionicons name="navigate-outline" size={13} color={c.icon} />
            <Text style={[styles.metaText, { color: c.textSecondary }]}>
              {a.distance < 1000 ? `${Math.round(a.distance)}m away` : `${(a.distance / 1000).toFixed(1)}km away`}
            </Text>
          </View>
        )}
      </View>

      {/* Gender filter badge */}
      {a.genderFilter && a.genderFilter !== 'all' && (
        <View style={[
          styles.genderBadge,
          { backgroundColor: a.genderFilter === 'women_only' ? 'rgba(236,72,153,0.15)' : 'rgba(59,130,246,0.15)',
            borderColor: a.genderFilter === 'women_only' ? '#EC4899' : '#3B82F6' },
        ]}>
          <Ionicons
            name={a.genderFilter === 'women_only' ? 'female' : 'male'}
            size={13}
            color={a.genderFilter === 'women_only' ? '#EC4899' : '#3B82F6'}
          />
          <Text style={[styles.genderBadgeText, { color: a.genderFilter === 'women_only' ? '#EC4899' : '#3B82F6' }]}>
            {a.genderFilter === 'women_only' ? 'Women only' : 'Men only'}
          </Text>
        </View>
      )}

      {/* Description */}
      {a.description ? (
        <Text style={[styles.description, { color: c.textSecondary }]}>{a.description}</Text>
      ) : null}

      {/* Creator Safety Card (shown before joining a stranger's ping) */}
      {a.creator?.displayName && (
        <TouchableOpacity
          style={[styles.creatorRow, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => creatorId && router.push(`/user/${creatorId}`)}
          activeOpacity={0.75}
        >
          <View style={[styles.creatorAvatar, { backgroundColor: `${Ping.purple}44` }]}>
            <Text style={styles.creatorInitial}>
              {a.creator.displayName[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.creatorName, { color: c.text }]}>{a.creator.displayName}</Text>
            <View style={styles.creatorMeta}>
              {/* Trust Rate */}
              {a.creator.trustRate !== undefined && (
                <View style={styles.trustChip}>
                  <View style={[styles.trustDot, {
                    backgroundColor: a.creator.trustRate >= 70 ? '#22C55E'
                      : a.creator.trustRate >= 40 ? '#F59E0B' : '#9490C0',
                  }]} />
                  <Text style={[styles.trustText, { color: c.textSecondary }]}>
                    {a.creator.trustRate}% trust
                  </Text>
                </View>
              )}
              {/* Mutual friends */}
              {mutualCount !== null && mutualCount > 0 && (
                <View style={styles.trustChip}>
                  <Ionicons name="people-outline" size={10} color={Ping.purpleLight} />
                  <Text style={[styles.trustText, { color: c.textSecondary }]}>
                    {mutualCount} mutual
                  </Text>
                </View>
              )}
              {/* Account age */}
              {a.creator.createdAt && (
                <View style={styles.trustChip}>
                  <Ionicons name="calendar-outline" size={10} color={c.icon} />
                  <Text style={[styles.trustText, { color: c.textSecondary }]}>
                    {(() => {
                      const months = Math.floor((Date.now() - new Date(a.creator.createdAt!).getTime()) / (30 * 24 * 3600 * 1000));
                      return months < 1 ? 'New member' : `${months}mo ago`;
                    })()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {creatorId && <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />}
        </TouchableOpacity>
      )}

      {/* Participants */}
      {count > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
              {count} going{a.maxParticipants ? ` · ${a.maxParticipants - count} spots left` : ''}
            </Text>
            <View style={styles.tapHint}>
              <Ionicons name="person-add-outline" size={11} color={Ping.purpleLight} />
              <Text style={[styles.tapHintText, { color: Ping.purpleLight }]}>tap to connect</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsRow}>
            {a.participants.slice(0, 12).map((p, i) => {
              const uid = typeof p.userId === 'string' ? p.userId : (p.userId as any)?.toString();
              return (
                <ParticipantAvatar
                  key={uid ?? i}
                  index={i}
                  participant={p as any}
                  onPress={() => { if (uid) router.push(`/user/${uid}`); }}
                />
              );
            })}
            {count > 12 && (
              <View style={[av.circle, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginTop: 4 }]}>
                <Text style={[av.letter, { color: c.textSecondary, fontSize: 12 }]}>+{count - 12}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Chat teaser for non-members */}
      {!isJoined && !isCreator && chatMsgCount !== null && chatMsgCount > 0 && (
        <View style={styles.chatTeaser}>
          <View style={styles.chatTeaserLeft}>
            <View style={styles.chatTeaserIconWrap}>
              <Ionicons name="chatbubbles" size={16} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.chatTeaserTitle}>Group chat is live</Text>
              <Text style={styles.chatTeaserSub}>
                {chatMsgCount} {chatMsgCount === 1 ? 'message' : 'messages'} · Join to read
              </Text>
            </View>
          </View>
          <View style={styles.chatTeaserLock}>
            <Ionicons name="lock-closed" size={12} color="#9490C0" />
          </View>
        </View>
      )}

      {/* ── Action buttons ── */}
      <View style={styles.actionsGrid}>
        {/* Not joined yet */}
        {!isJoined && !isCreator && (
          <TouchableOpacity
            style={[styles.btnPrimary, isExpired && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={joining || isExpired}
            activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="add-circle" size={18} color="#FFF" />
                <Text style={styles.btnPrimaryText}>{isExpired ? 'Ping Ended' : 'Join Ping'}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Joined actions */}
        {isJoined && !isCreator && (
          <>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleOpenChat}
              disabled={chatLoading}
              activeOpacity={0.85}
            >
              {chatLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="chatbubbles" size={18} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>Open Chat</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.btnRow}>
              {!myParticipant?.onMyWayAt && (
                <TouchableOpacity
                  style={[styles.btnSecondary, { borderColor: c.border }]}
                  onPress={handleOnMyWay}
                  disabled={onMyWayLoading}
                  activeOpacity={0.8}
                >
                  {onMyWayLoading ? (
                    <ActivityIndicator size="small" color={Ping.purpleLight} />
                  ) : (
                    <>
                      <Text style={styles.btnSecondaryEmoji}>🚶</Text>
                      <Text style={[styles.btnSecondaryText, { color: c.text }]}>On My Way</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {!myParticipant?.arrivedAt && (
                <TouchableOpacity
                  style={[styles.btnSecondary, { borderColor: c.border }]}
                  onPress={handleArrived}
                  disabled={arrivedLoading}
                  activeOpacity={0.8}
                >
                  {arrivedLoading ? (
                    <ActivityIndicator size="small" color={Ping.purpleLight} />
                  ) : (
                    <>
                      <Text style={styles.btnSecondaryEmoji}>📍</Text>
                      <Text style={[styles.btnSecondaryText, { color: c.text }]}>I'm Here</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btnSecondary, { borderColor: c.border }]}
                onPress={handleLeave}
                disabled={leaving}
                activeOpacity={0.8}
              >
                {leaving ? (
                  <ActivityIndicator size="small" color={c.textSecondary} />
                ) : (
                  <>
                    <Ionicons name="exit-outline" size={14} color={c.textSecondary} />
                    <Text style={[styles.btnSecondaryText, { color: c.textSecondary }]}>Leave</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Discreet exit + report row */}
            <View style={styles.safetyRow}>
              <TouchableOpacity
                style={styles.safetyBtn}
                onPress={handleLeaveQuietly}
                disabled={leavingQuietly}
                activeOpacity={0.7}
              >
                {leavingQuietly ? (
                  <ActivityIndicator size="small" color="#9490C0" />
                ) : (
                  <>
                    <Ionicons name="eye-off-outline" size={13} color="#9490C0" />
                    <Text style={styles.safetyBtnText}>Leave Quietly</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.safetyBtn} onPress={handleReport} activeOpacity={0.7}>
                <Ionicons name="flag-outline" size={13} color="#9490C0" />
                <Text style={styles.safetyBtnText}>Report</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Not joined — report button */}
        {!isJoined && !isCreator && (
          <TouchableOpacity style={[styles.safetyRow, { justifyContent: 'flex-end' }]} onPress={handleReport} activeOpacity={0.7}>
            <Ionicons name="flag-outline" size={13} color="#9490C0" />
            <Text style={styles.safetyBtnText}>Report this ping</Text>
          </TouchableOpacity>
        )}

        {/* Creator actions */}
        {isCreator && (
          <>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleOpenChat}
              disabled={chatLoading}
              activeOpacity={0.85}
            >
              {chatLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="chatbubbles" size={18} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>Open Chat</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.btnRow}>
              {!myParticipant?.onMyWayAt && (
                <TouchableOpacity
                  style={[styles.btnSecondary, { borderColor: c.border }]}
                  onPress={handleOnMyWay}
                  disabled={onMyWayLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSecondaryEmoji}>🚶</Text>
                  <Text style={[styles.btnSecondaryText, { color: c.text }]}>On My Way</Text>
                </TouchableOpacity>
              )}

              {!isExpired && (
                <TouchableOpacity
                  style={[styles.btnSecondary, styles.btnDanger, { borderColor: `${Ping.red}44` }]}
                  onPress={handleCancel}
                  disabled={cancelling}
                  activeOpacity={0.8}
                >
                  {cancelling ? (
                    <ActivityIndicator size="small" color={Ping.red} />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={14} color={Ping.red} />
                      <Text style={[styles.btnSecondaryText, { color: Ping.red }]}>Cancel Ping</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>

    {celebration && (
      <PingFullCelebration
        count={celebration.count}
        names={celebration.names}
        color={typeCfg.color}
        visible={!!celebration}
        onDone={() => {
          setCelebration(null);
          chatApi.openActivityRoom(a._id)
            .then((res) => router.push(`/chat/${res.room._id}?type=${encodeURIComponent(a.type)}`))
            .catch(() => {});
        }}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: Spacing.lg, gap: Spacing.md },
  gradientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientHeaderAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 4,
  },
  headerTitle: { ...Typography.bodyMed, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaBlock: { gap: 4 },
  title: { ...Typography.bodyMed, flex: 1, fontSize: 17 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  metaText: { ...Typography.caption, fontSize: 12 },
  description: { ...Typography.bodySm, lineHeight: 20 },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  genderBadgeText: { ...Typography.caption, fontWeight: '700', fontSize: 12 },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInitial: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  creatorName: { ...Typography.bodyMed, fontSize: 14 },
  creatorLabel: { ...Typography.caption, marginTop: 1 },
  creatorMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trustDot: { width: 6, height: 6, borderRadius: 3 },
  trustText: { ...Typography.caption, fontSize: 11 },
  safetyRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 2,
  },
  safetyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(148,144,192,0.1)',
  },
  safetyBtnText: { ...Typography.caption, color: '#9490C0', fontSize: 11, fontWeight: '600' },
  section: { gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.5 },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tapHintText: { fontSize: 10, fontWeight: '600' },
  participantsRow: { gap: Spacing.sm, paddingVertical: 4 },
  actionsGrid: { gap: Spacing.sm },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Ping.purple,
    height: 50,
    borderRadius: Radius.md,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  btnPrimaryText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '700' },
  btnDisabled: { backgroundColor: '#3A3A5C', shadowOpacity: 0, elevation: 0 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  btnDanger: { backgroundColor: 'rgba(239,68,68,0.06)' },
  btnSecondaryEmoji: { fontSize: 14 },
  btnSecondaryText: { ...Typography.bodySm, fontWeight: '600' },
  chatTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  chatTeaserLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chatTeaserIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTeaserTitle: { ...Typography.bodySm, color: '#E8E0FF', fontWeight: '700', fontSize: 13 },
  chatTeaserSub: { ...Typography.caption, color: '#9490C0', fontSize: 11, marginTop: 2 },
  chatTeaserLock: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(148,144,192,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
