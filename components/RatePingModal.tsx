import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activitiesApi, type PendingRating, type PendingRatingUser } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TYPE_ICON: Record<string, { icon: MCIName; color: string }> = {
  sport:   { icon: 'dumbbell',          color: '#EF4444' },
  food:    { icon: 'food-fork-drink',   color: '#F97316' },
  music:   { icon: 'music',             color: '#8B5CF6' },
  study:   { icon: 'book-open-variant', color: '#3B82F6' },
  outdoor: { icon: 'walk',              color: '#10B981' },
  gaming:  { icon: 'gamepad-variant',   color: '#EC4899' },
  meetup:  { icon: 'account-group',     color: '#7C3AED' },
  default: { icon: 'flash',             color: Ping.purpleLight },
};

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scheme = useColorScheme() ?? 'dark';
  const emptyColor = scheme === 'dark' ? '#4B4B6E' : '#C4C0D8';
  return (
    <View style={s.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6} activeOpacity={0.7}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={28}
            color={n <= value ? '#FBBF24' : emptyColor}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function UserRow({ user, score, onScore, c }: {
  user: PendingRatingUser; score: number;
  onScore: (v: number) => void; c: (typeof Colors)['dark'];
}) {
  const initials = (user.displayName ?? '?')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[s.userRow, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={s.userLeft}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        )}
        <View>
          <Text style={[s.userName, { color: c.text }]}>{user.displayName ?? 'User'}</Text>
          {user.username ? (
            <Text style={[s.userHandle, { color: c.textSecondary }]}>@{user.username}</Text>
          ) : null}
        </View>
      </View>
      <Stars value={score} onChange={onScore} />
    </View>
  );
}

interface Props {
  pending: PendingRating;
  onDone: () => void;
}

export default function RatePingModal({ pending, onDone }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const cfg = TYPE_ICON[pending.activity.type] ?? TYPE_ICON.default;

  const allRated = pending.unrated.every((u) => (scores[u._id] ?? 0) > 0);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const rated = pending.unrated.filter((u) => (scores[u._id] ?? 0) > 0);
      await Promise.all(
        rated.map((u) => activitiesApi.rate(pending.activity._id, u._id, scores[u._id])),
      );
      onDone();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not submit ratings.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDone}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onDone} />
        <View style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 20 }]}>

          <View style={[s.handle, { backgroundColor: c.border }]} />

          {/* Header */}
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <View style={[s.actIcon, { backgroundColor: `${cfg.color}20` }]}>
              <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: c.text }]}>Rate your ping</Text>
              <Text style={[s.actTitle, { color: c.textSecondary }]} numberOfLines={1}>
                {pending.activity.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onDone} hitSlop={12}>
              <Ionicons name="close" size={22} color={c.icon} />
            </TouchableOpacity>
          </View>

          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            How was your experience with{' '}
            {pending.unrated.length === 1 ? 'this person' : 'these people'}?
          </Text>

          {/* Participant list */}
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ padding: Spacing.lg, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {pending.unrated.map((user) => (
              <UserRow
                key={user._id}
                user={user}
                score={scores[user._id] ?? 0}
                onScore={(v) => setScores((prev) => ({ ...prev, [user._id]: v }))}
                c={c}
              />
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={[s.actions, { paddingHorizontal: Spacing.lg }]}>
            <TouchableOpacity
              style={[s.submitBtn, (!allRated || submitting) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!allRated || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="star" size={16} color="#FFF" />
                  <Text style={s.submitText}>Submit Ratings</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={onDone} activeOpacity={0.7}>
              <Text style={[s.skipText, { color: c.icon }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 16, fontWeight: '700' },
  actTitle: { fontSize: 13, marginTop: 1 },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  userLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar:        { width: 44, height: 44, borderRadius: 22 },
  avatarFallback:{ backgroundColor: `${Ping.purple}55`, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: '#FFF', fontWeight: '700', fontSize: 16 },
  userName:      { fontWeight: '600', fontSize: 14 },
  userHandle:    { fontSize: 12, marginTop: 1 },
  stars:         { flexDirection: 'row', gap: 4 },
  actions:       { gap: 10, paddingTop: 12 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  skipBtn:    { height: 40, alignItems: 'center', justifyContent: 'center' },
  skipText:   { fontSize: 14 },
});
