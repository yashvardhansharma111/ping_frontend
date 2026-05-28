import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { activitiesApi } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPES: { key: string; label: string; icon: IoniconName; color: string }[] = [
  { key: 'sport',   label: 'Sport',   icon: 'barbell-outline',          color: '#22C55E' },
  { key: 'food',    label: 'Food',    icon: 'restaurant-outline',        color: '#F97316' },
  { key: 'music',   label: 'Music',   icon: 'musical-notes-outline',     color: '#8B5CF6' },
  { key: 'study',   label: 'Study',   icon: 'book-outline',              color: '#3B82F6' },
  { key: 'outdoor', label: 'Outdoor', icon: 'walk-outline',              color: '#10B981' },
  { key: 'gaming',  label: 'Gaming',  icon: 'game-controller-outline',   color: '#EC4899' },
  { key: 'meetup',  label: 'Meetup',  icon: 'people-outline',            color: Ping.purple },
];

const DURATIONS: { label: string; value: number }[] = [
  { label: '30m', value: 30  },
  { label: '1h',  value: 60  },
  { label: '2h',  value: 120 },
  { label: '3h',  value: 180 },
];

// ── Time Picker ───────────────────────────────────────────────────────────────

interface TimeState {
  hour: number;   // 1–12
  minute: number; // 0, 15, 30, 45
  isPm: boolean;
}

function getDefaultTime(): TimeState {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30); // suggest 30 min from now
  const h = now.getHours();
  const raw = now.getMinutes();
  const minute = raw < 15 ? 0 : raw < 30 ? 15 : raw < 45 ? 30 : 45;
  return {
    hour: h % 12 === 0 ? 12 : h % 12,
    minute,
    isPm: h >= 12,
  };
}

function timeToDate(t: TimeState): Date {
  const d = new Date();
  let h = t.hour % 12;
  if (t.isPm) h += 12;
  d.setHours(h, t.minute, 0, 0);
  // if the time is in the past today, bump to tomorrow
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

function formatTimeDisplay(t: TimeState) {
  const min = t.minute.toString().padStart(2, '0');
  return `${t.hour}:${min} ${t.isPm ? 'PM' : 'AM'}`;
}

function TimePicker({ value, onChange }: { value: TimeState; onChange: (t: TimeState) => void }) {
  const MINUTES = [0, 15, 30, 45];

  function bumpHour(delta: number) {
    let h = value.hour + delta;
    if (h > 12) h = 1;
    if (h < 1)  h = 12;
    onChange({ ...value, hour: h });
  }

  function bumpMinute(delta: number) {
    const idx = MINUTES.indexOf(value.minute);
    const next = (idx + delta + MINUTES.length) % MINUTES.length;
    onChange({ ...value, minute: MINUTES[next] });
  }

  return (
    <View style={tp.row}>
      {/* Hour */}
      <View style={tp.spinnerWrap}>
        <TouchableOpacity onPress={() => bumpHour(1)} style={tp.arrow} hitSlop={8}>
          <Ionicons name="chevron-up" size={18} color={Ping.purpleLight} />
        </TouchableOpacity>
        <Text style={tp.value}>{value.hour}</Text>
        <TouchableOpacity onPress={() => bumpHour(-1)} style={tp.arrow} hitSlop={8}>
          <Ionicons name="chevron-down" size={18} color={Ping.purpleLight} />
        </TouchableOpacity>
      </View>

      <Text style={tp.colon}>:</Text>

      {/* Minute */}
      <View style={tp.spinnerWrap}>
        <TouchableOpacity onPress={() => bumpMinute(1)} style={tp.arrow} hitSlop={8}>
          <Ionicons name="chevron-up" size={18} color={Ping.purpleLight} />
        </TouchableOpacity>
        <Text style={tp.value}>{value.minute.toString().padStart(2, '0')}</Text>
        <TouchableOpacity onPress={() => bumpMinute(-1)} style={tp.arrow} hitSlop={8}>
          <Ionicons name="chevron-down" size={18} color={Ping.purpleLight} />
        </TouchableOpacity>
      </View>

      {/* AM / PM */}
      <View style={tp.ampmWrap}>
        <TouchableOpacity
          style={[tp.ampmBtn, !value.isPm && tp.ampmActive]}
          onPress={() => onChange({ ...value, isPm: false })}
        >
          <Text style={[tp.ampmText, !value.isPm && tp.ampmTextActive]}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tp.ampmBtn, value.isPm && tp.ampmActive]}
          onPress={() => onChange({ ...value, isPm: true })}
        >
          <Text style={[tp.ampmText, value.isPm && tp.ampmTextActive]}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tp = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spinnerWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 14,
    minWidth: 56,
  },
  arrow: { padding: 2 },
  value: { ...Typography.h3, color: '#F1F0FF', marginVertical: 2 },
  colon: { ...Typography.h3, color: '#9490C0' },
  ampmWrap: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    overflow: 'hidden',
  },
  ampmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ampmActive: { backgroundColor: Ping.purple },
  ampmText: { ...Typography.bodyMed, color: '#9490C0', fontWeight: '600' },
  ampmTextActive: { color: '#FFF' },
});

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  lat: number;
  lng: number;
}

export default function CreatePingModal({ visible, onClose, onCreated, lat, lng }: Props) {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('meetup');
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [duration, setDuration] = useState(60);
  const [maxPeople, setMaxPeople] = useState('');
  const [isNow, setIsNow] = useState(true);
  const [scheduledTime, setScheduledTime] = useState<TimeState>(getDefaultTime);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle('');
    setType('meetup');
    setVisibility('public');
    setDuration(60);
    setMaxPeople('');
    setIsNow(true);
    setScheduledTime(getDefaultTime());
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Give your ping a short title.');
      return;
    }

    const maxP = maxPeople.trim() ? parseInt(maxPeople, 10) : undefined;
    if (maxP !== undefined && (isNaN(maxP) || maxP < 2 || maxP > 100)) {
      Alert.alert('Invalid count', 'Max participants must be between 2 and 100.');
      return;
    }

    const startsAt = isNow ? undefined : timeToDate(scheduledTime).toISOString();

    setSaving(true);
    try {
      await activitiesApi.create({
        title: trimmed,
        type,
        visibility,
        lat,
        lng,
        durationMinutes: duration,
        ...(maxP ? { maxParticipants: maxP } : {}),
        ...(startsAt ? { startsAt } : {}),
      });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create ping.');
    } finally {
      setSaving(false);
    }
  }

  const selectedType = TYPES.find((t) => t.key === type)!;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: `${selectedType.color}22` }]}>
                <Ionicons name={selectedType.icon} size={20} color={selectedType.color} />
              </View>
              <Text style={styles.headerTitle}>New Ping</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#9490C0" />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {/* Title */}
            <View style={styles.section}>
              <Text style={styles.label}>What's happening?</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="e.g. Football at the park"
                placeholderTextColor="#5C5A80"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                autoFocus
                returnKeyType="done"
              />
            </View>

            {/* Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.chipRow}>
                  {TYPES.map((t) => {
                    const active = type === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={[
                          styles.typeChip,
                          active
                            ? { backgroundColor: t.color, borderColor: t.color }
                            : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(167,139,250,0.2)' },
                        ]}
                        onPress={() => setType(t.key)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={t.icon} size={15} color={active ? '#FFF' : '#9490C0'} />
                        <Text style={[styles.typeLabel, { color: active ? '#FFF' : '#9490C0' }]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* When */}
            <View style={styles.section}>
              <Text style={styles.label}>When?</Text>
              <View style={styles.whenRow}>
                <TouchableOpacity
                  style={[styles.whenChip, isNow && styles.whenChipActive]}
                  onPress={() => setIsNow(true)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.liveDot, { opacity: isNow ? 1 : 0.3 }]} />
                  <Text style={[styles.whenLabel, isNow && styles.whenLabelActive]}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.whenChip, !isNow && styles.whenChipActive]}
                  onPress={() => setIsNow(false)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="time-outline" size={15} color={!isNow ? '#FFF' : '#9490C0'} />
                  <Text style={[styles.whenLabel, !isNow && styles.whenLabelActive]}>
                    {isNow ? 'Schedule' : formatTimeDisplay(scheduledTime)}
                  </Text>
                </TouchableOpacity>
              </View>

              {!isNow && (
                <View style={styles.timePickerWrap}>
                  <Text style={styles.timePickerHint}>
                    Today or tomorrow · participants can join early
                  </Text>
                  <TimePicker value={scheduledTime} onChange={setScheduledTime} />
                </View>
              )}
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <Text style={styles.label}>Duration</Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((d) => {
                  const active = duration === d.value;
                  return (
                    <TouchableOpacity
                      key={d.value}
                      style={[styles.durationChip, active && styles.durationChipActive]}
                      onPress={() => setDuration(d.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.durationLabel, active && styles.durationLabelActive]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Visibility */}
            <View style={styles.section}>
              <Text style={styles.label}>Who can see it?</Text>
              <View style={styles.visRow}>
                {(['public', 'friends'] as const).map((v) => {
                  const active = visibility === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.visChip, active && styles.visChipActive]}
                      onPress={() => setVisibility(v)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={v === 'public' ? 'earth-outline' : 'people-outline'}
                        size={15}
                        color={active ? '#FFF' : '#9490C0'}
                      />
                      <Text style={[styles.visLabel, active && styles.visLabelActive]}>
                        {v === 'public' ? 'Everyone' : 'Friends only'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Max participants */}
            <View style={styles.section}>
              <Text style={styles.label}>Max participants (optional)</Text>
              <TextInput
                style={styles.numberInput}
                placeholder="Leave blank for unlimited"
                placeholderTextColor="#5C5A80"
                value={maxPeople}
                onChangeText={(v) => setMaxPeople(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <View style={styles.locNote}>
              <Ionicons name="location-outline" size={14} color="#5C5A80" />
              <Text style={styles.locText}>Ping is placed at your current location</Text>
            </View>
          </ScrollView>

          {/* Create button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.createBtn, saving && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons
                    name={isNow ? 'flash' : 'time'}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.createBtnText}>
                    {isNow ? 'Drop Ping Now' : `Schedule for ${formatTimeDisplay(scheduledTime)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#11112A',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.3)',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3, color: '#F1F0FF' },
  body: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  label: {
    ...Typography.caption,
    color: '#9490C0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titleInput: {
    backgroundColor: '#1A1A38',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    height: 52,
    paddingHorizontal: Spacing.md,
    ...Typography.bodyMed,
    color: '#F1F0FF',
  },
  chipScroll: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  typeLabel: { ...Typography.bodySm, fontWeight: '600' },
  // When
  whenRow: { flexDirection: 'row', gap: Spacing.sm },
  whenChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  whenChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  whenLabel: { ...Typography.bodySm, color: '#9490C0', fontWeight: '600' },
  whenLabelActive: { color: '#FFF' },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  timePickerWrap: {
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  timePickerHint: { ...Typography.caption, color: '#9490C0' },
  // Duration
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  durationChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  durationLabel: { ...Typography.bodyMed, color: '#9490C0', fontWeight: '600' },
  durationLabelActive: { color: '#FFF' },
  // Visibility
  visRow: { flexDirection: 'row', gap: Spacing.sm },
  visChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  visChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
  visLabel: { ...Typography.bodySm, color: '#9490C0', fontWeight: '600' },
  visLabelActive: { color: '#FFF' },
  numberInput: {
    backgroundColor: '#1A1A38',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    height: 48,
    paddingHorizontal: Spacing.md,
    ...Typography.bodyMed,
    color: '#F1F0FF',
  },
  locNote: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locText: { ...Typography.caption, color: '#5C5A80' },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.1)',
  },
  createBtn: {
    backgroundColor: Ping.purple,
    borderRadius: Radius.md,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '700' },
});
