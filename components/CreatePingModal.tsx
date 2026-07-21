import { useState, useEffect, useMemo, useRef } from 'react';
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
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { activitiesApi } from '@/lib/api';
import { scheduleStartingNotification } from '@/lib/notifications';
import {
  fetchCategorizedPlaces,
  LOCATION_CATEGORIES,
  ACTIVITY_TO_CATEGORY,
  type CategorizedPlaces,
} from '@/lib/placesApi';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LocationPickerModal from './LocationPickerModal';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TYPES: { key: string; label: string; icon: MCIName; color: string }[] = [
  { key: 'sport',   label: 'Sport',   icon: 'dumbbell',           color: '#22C55E' },
  { key: 'food',    label: 'Food',    icon: 'food-fork-drink',    color: '#F97316' },
  { key: 'music',   label: 'Music',   icon: 'music',              color: '#8B5CF6' },
  { key: 'study',   label: 'Study',   icon: 'book-open-variant',  color: '#3B82F6' },
  { key: 'outdoor', label: 'Outdoor', icon: 'walk',               color: '#10B981' },
  { key: 'gaming',  label: 'Gaming',  icon: 'gamepad-variant',    color: '#EC4899' },
  { key: 'meetup',  label: 'Meetup',  icon: 'account-group',      color: Ping.purple },
  { key: 'custom',  label: 'Custom',  icon: 'pencil-box-outline', color: '#A78BFA' },
];

const VIBES: { key: string; icon: MCIName; label: string; color: string }[] = [
  { key: 'cozy',       icon: 'coffee-outline',  label: 'Cozy',       color: '#D97706' },
  { key: 'fun',        icon: 'party-popper',    label: 'Fun',        color: '#7C3AED' },
  { key: 'exciting',   icon: 'lightning-bolt',  label: 'Exciting',   color: '#F59E0B' },
  { key: 'chill',      icon: 'leaf',            label: 'Chill',      color: '#10B981' },
  { key: 'networking', icon: 'handshake',       label: 'Networking', color: '#3B82F6' },
  { key: 'fitness',    icon: 'arm-flex',        label: 'Fitness',    color: '#22C55E' },
];

const DURATIONS: { label: string; value: number }[] = [
  { label: '30m', value: 30  },
  { label: '1h',  value: 60  },
  { label: '2h',  value: 120 },
  { label: '3h+', value: 180 },
];

// ── Time Picker ───────────────────────────────────────────────────────────────

interface TimeState {
  hour: number;
  minute: number;
  isPm: boolean;
}

function getDefaultTime(): TimeState {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const h = now.getHours();
  const raw = now.getMinutes();
  const minute = raw < 15 ? 0 : raw < 30 ? 15 : raw < 45 ? 30 : 45;
  return { hour: h % 12 === 0 ? 12 : h % 12, minute, isPm: h >= 12 };
}

function timeToDate(t: TimeState, dayOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  let h = t.hour % 12;
  if (t.isPm) h += 12;
  d.setHours(h, t.minute, 0, 0);
  if (dayOffset === 0 && d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTimeDisplay(t: TimeState, dayOffset = 0) {
  const label = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : DAY_NAMES[(() => { const d = new Date(); d.setDate(d.getDate() + dayOffset); return d.getDay(); })()];
  return `${label} · ${t.hour}:${t.minute.toString().padStart(2, '0')} ${t.isPm ? 'PM' : 'AM'}`;
}

function makeDsStyles(isDark: boolean) {
  return StyleSheet.create({
    chip: {
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      minWidth: 58,
    },
    chipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
    dayName: { ...Typography.caption, color: isDark ? '#9490C0' : '#6B6080', fontWeight: '600' },
    dayNameActive: { color: 'rgba(255,255,255,0.8)' },
    dayNum: { ...Typography.h3, color: isDark ? '#F1F0FF' : '#1A1730', marginVertical: 2 },
    dayNumActive: { color: '#FFF' },
    month: { ...Typography.caption, color: isDark ? '#5C5A80' : '#8B85A0' },
    monthActive: { color: 'rgba(255,255,255,0.7)' },
  });
}

function DateStrip({ value, onChange, isDark }: { value: number; onChange: (n: number) => void; isDark: boolean }) {
  const ds = useMemo(() => makeDsStyles(isDark), [isDark]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
        {days.map((d, i) => {
          const active = value === i;
          return (
            <TouchableOpacity
              key={i}
              style={[ds.chip, active && ds.chipActive]}
              onPress={() => onChange(i)}
              activeOpacity={0.75}
            >
              <Text style={[ds.dayName, active && ds.dayNameActive]}>
                {i === 0 ? 'Today' : DAY_NAMES[d.getDay()]}
              </Text>
              <Text style={[ds.dayNum, active && ds.dayNumActive]}>{d.getDate()}</Text>
              <Text style={[ds.month, active && ds.monthActive]}>{MONTH_NAMES[d.getMonth()]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function makeTpStyles(isDark: boolean) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    spinnerWrap: {
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(167,139,250,0.08)' : 'rgba(124,58,237,0.05)',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)',
      paddingVertical: 4,
      paddingHorizontal: 14,
      minWidth: 56,
    },
    arrow: { padding: 2 },
    value: { ...Typography.h3, color: isDark ? '#F1F0FF' : '#1A1730', marginVertical: 2 },
    colon: { ...Typography.h3, color: isDark ? '#9490C0' : '#6B6080' },
    ampmWrap: { borderRadius: Radius.md, borderWidth: 1, borderColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)', overflow: 'hidden' },
    ampmBtn: { paddingHorizontal: 14, paddingVertical: 8 },
    ampmActive: { backgroundColor: Ping.purple },
    ampmText: { ...Typography.bodyMed, color: isDark ? '#9490C0' : '#6B6080', fontWeight: '600' },
    ampmTextActive: { color: '#FFF' },
  });
}

function TimePicker({ value, onChange, isDark }: { value: TimeState; onChange: (t: TimeState) => void; isDark: boolean }) {
  const tp = useMemo(() => makeTpStyles(isDark), [isDark]);
  const MINUTES = [0, 15, 30, 45];
  function bumpHour(delta: number) {
    let h = value.hour + delta;
    if (h > 12) h = 1;
    if (h < 1)  h = 12;
    onChange({ ...value, hour: h });
  }
  function bumpMinute(delta: number) {
    const idx = MINUTES.indexOf(value.minute);
    onChange({ ...value, minute: MINUTES[(idx + delta + MINUTES.length) % MINUTES.length] });
  }
  return (
    <View style={tp.row}>
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
      <View style={tp.spinnerWrap}>
        <TouchableOpacity onPress={() => bumpMinute(1)} style={tp.arrow} hitSlop={8}>
          <Ionicons name="chevron-up" size={18} color={Ping.purpleLight} />
        </TouchableOpacity>
        <Text style={tp.value}>{value.minute.toString().padStart(2, '0')}</Text>
        <TouchableOpacity onPress={() => bumpMinute(-1)} style={tp.arrow} hitSlop={8}>
          <Ionicons name="chevron-down" size={18} color={Ping.purpleLight} />
        </TouchableOpacity>
      </View>
      <View style={tp.ampmWrap}>
        <TouchableOpacity style={[tp.ampmBtn, !value.isPm && tp.ampmActive]} onPress={() => onChange({ ...value, isPm: false })}>
          <Text style={[tp.ampmText, !value.isPm && tp.ampmTextActive]}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[tp.ampmBtn, value.isPm && tp.ampmActive]} onPress={() => onChange({ ...value, isPm: true })}>
          <Text style={[tp.ampmText, value.isPm && tp.ampmTextActive]}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Vertical Type List ────────────────────────────────────────────────────────

function makeTlStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      height: 218,
      backgroundColor: isDark ? '#1A1A38' : '#F4F0FF',
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)',
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      height: 46,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(167,139,250,0.08)' : 'rgba(124,58,237,0.06)' },
    iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    typeLabel: { flex: 1, ...Typography.bodyMed, color: isDark ? '#9490C0' : '#6B6080' },
    typeLabelActive: { color: isDark ? '#F1F0FF' : '#1A1730', fontWeight: '700' },
  });
}

function TypeList({ value, onChange, isDark }: { value: string; onChange: (k: string) => void; isDark: boolean }) {
  const tl = useMemo(() => makeTlStyles(isDark), [isDark]);
  return (
    <View style={tl.container}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {TYPES.map((t, i) => {
          const active = value === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[tl.row, active && { backgroundColor: `${t.color}18` }, i < TYPES.length - 1 && tl.rowBorder]}
              onPress={() => onChange(t.key)}
              activeOpacity={0.7}
            >
              <View style={[tl.iconCircle, { backgroundColor: `${t.color}25` }]}>
                <MaterialCommunityIcons name={t.icon} size={17} color={t.color} />
              </View>
              <Text style={[tl.typeLabel, active && tl.typeLabelActive]}>{t.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={17} color={t.color} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Vibe Grid ─────────────────────────────────────────────────────────────────

function makeVgStyles(isDark: boolean) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cell: {
      width: '31%',
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      gap: 3,
    },
    vibeLabel: { fontSize: 11, fontWeight: '600', color: isDark ? '#9490C0' : '#6B6080' },
  });
}

function VibeGrid({ value, onChange, isDark }: { value: string | null; onChange: (k: string | null) => void; isDark: boolean }) {
  const vg = useMemo(() => makeVgStyles(isDark), [isDark]);
  return (
    <View style={vg.grid}>
      {VIBES.map((v) => {
        const active = value === v.key;
        return (
          <TouchableOpacity
            key={v.key}
            style={[vg.cell, active && { backgroundColor: `${v.color}22`, borderColor: v.color }]}
            onPress={() => onChange(active ? null : v.key)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name={v.icon} size={22} color={active ? v.color : (isDark ? '#6B6B9A' : '#8B85A0')} />
            <Text style={[vg.vibeLabel, active && { color: isDark ? '#F1F0FF' : '#1A1730', fontWeight: '700' }]}>{v.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Sheet sizing ─────────────────────────────────────────────────────────────
const SCREEN_H      = Dimensions.get('window').height;
const SHEET_MIN_H   = SCREEN_H * 0.30;
const SHEET_MAX_H   = SCREEN_H * 0.92;
const SHEET_DEFAULT = SCREEN_H * 0.55;

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  lat: number;
  lng: number;
  defaultType?: string;
  defaultTitle?: string;
}

function makeStyles(isDark: boolean) {
  const inputBg  = isDark ? '#1A1A38' : '#F4F0FF';
  const border   = isDark ? 'rgba(167,139,250,0.2)'  : 'rgba(124,58,237,0.12)';
  const border10 = isDark ? 'rgba(167,139,250,0.1)'  : 'rgba(124,58,237,0.06)';
  const border15 = isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.08)';
  const text     = isDark ? '#F1F0FF' : '#1A1730';
  const muted    = isDark ? '#9490C0' : '#6B6080';
  const hint     = isDark ? '#5C5A80' : '#8B85A0';
  const chipBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const sheetBg  = isDark ? '#11112A' : '#FFFFFF';

  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
      backgroundColor: sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: border15,
      overflow: 'hidden',
    },
    handleArea: {
      width: '100%', height: 28,
      alignItems: 'center', justifyContent: 'center',
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(167,139,250,0.3)' : 'rgba(124,58,237,0.2)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: border10,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...Typography.h3, color: text },
    headerVibe: { fontSize: 11, color: muted, marginTop: 1 },
    body: { padding: Spacing.lg, gap: Spacing.lg },
    section: { gap: Spacing.sm },
    label: {
      ...Typography.caption,
      color: muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    labelOptional: {
      fontSize: 10,
      color: hint,
      textTransform: 'none',
      letterSpacing: 0,
      fontWeight: '400',
    },
    titleInput: {
      backgroundColor: inputBg,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: border,
      height: 52,
      paddingHorizontal: Spacing.md,
      ...Typography.bodyMed,
      color: text,
    },
    customTypeWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: inputBg,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(167,139,250,0.35)' : 'rgba(124,58,237,0.2)',
      paddingHorizontal: Spacing.md,
      height: 46,
      marginTop: Spacing.sm,
    },
    customTypeInput: { flex: 1, ...Typography.bodyMed, color: text, paddingVertical: 0 },
    // When
    whenRow: { flexDirection: 'row', gap: Spacing.sm },
    whenChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10,
      borderRadius: Radius.md, borderWidth: 1.5,
      borderColor: border,
      backgroundColor: chipBg,
    },
    whenChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
    whenLabel: { ...Typography.bodySm, color: muted, fontWeight: '600' },
    whenLabelActive: { color: '#FFF' },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
    timePickerWrap: {
      backgroundColor: isDark ? 'rgba(167,139,250,0.06)' : 'rgba(124,58,237,0.04)',
      borderRadius: Radius.md, borderWidth: 1,
      borderColor: border15,
      padding: Spacing.md, gap: Spacing.md,
    },
    timePickerLabel: { ...Typography.caption, color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    // Duration
    chipRow: { flexDirection: 'row', gap: Spacing.sm },
    durationChip: {
      flex: 1, alignItems: 'center', paddingVertical: 10,
      borderRadius: Radius.md, borderWidth: 1.5,
      borderColor: border,
      backgroundColor: chipBg,
    },
    durationChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
    durationLabel: { ...Typography.bodyMed, color: muted, fontWeight: '600' },
    durationLabelActive: { color: '#FFF' },
    // Icon input
    iconInput: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: inputBg,
      borderRadius: Radius.md, borderWidth: 1.5,
      borderColor: border,
      paddingHorizontal: Spacing.md,
      height: 50,
    },
    iconInputText: { flex: 1, ...Typography.bodyMed, color: text, paddingVertical: 0 },
    // Multi-line
    multiInput: {
      backgroundColor: inputBg,
      borderRadius: Radius.md, borderWidth: 1.5,
      borderColor: border,
      paddingHorizontal: Spacing.md,
      paddingTop: 12, paddingBottom: 12,
      minHeight: 90,
      ...Typography.bodyMed,
      color: text,
    },
    // Visibility
    visRow: { flexDirection: 'row', gap: Spacing.sm },
    visChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10,
      borderRadius: Radius.md, borderWidth: 1.5,
      borderColor: border,
      backgroundColor: chipBg,
    },
    visChipActive: { backgroundColor: Ping.purple, borderColor: Ping.purple },
    visLabel: { ...Typography.bodySm, color: muted, fontWeight: '600' },
    visLabelActive: { color: '#FFF' },
    // Gender
    genderRow: { flexDirection: 'row', gap: Spacing.sm },
    genderChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, paddingVertical: 10,
      borderRadius: Radius.md, borderWidth: 1.5,
    },
    genderLabel: { ...Typography.bodySm, color: muted, fontWeight: '600', fontSize: 11 },
    genderLabelActive: { color: '#FFF' },
    // Location suggestions
    locSuggestWrap: { gap: 8 },
    locCatRow: { gap: 6, paddingVertical: 2 },
    locCatChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.15)',
      backgroundColor: isDark ? 'rgba(167,139,250,0.07)' : 'rgba(124,58,237,0.05)',
    },
    locCatChipActive: {
      backgroundColor: Ping.purple,
      borderColor: Ping.purple,
    },
    locCatLabel: { ...Typography.caption, color: muted, fontWeight: '600', fontSize: 11 },
    locCatLabelActive: { color: '#FFF' },
    locLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    locLoadingText: { ...Typography.caption, color: hint, fontSize: 11 },
    locEmptyText: { ...Typography.caption, color: hint, fontSize: 11, paddingVertical: 4 },
    suggestionsRow: { gap: 8, paddingVertical: 2 },
    suggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.15)',
      backgroundColor: isDark ? 'rgba(167,139,250,0.07)' : 'rgba(124,58,237,0.05)',
      maxWidth: 180,
    },
    suggestionChipActive: {
      borderColor: Ping.purple,
      backgroundColor: `${Ping.purple}25`,
    },
    suggestionText: { ...Typography.caption, color: muted, fontWeight: '600', fontSize: 12 },
    suggestionTextActive: { color: text },
    locNote: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    locText: { ...Typography.caption, color: hint, flex: 1 },
    changeLocBtn: { fontSize: 12, color: Ping.purple, fontWeight: '700' },
    footer: {
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
      borderTopWidth: 1, borderTopColor: border10,
    },
    createBtn: {
      backgroundColor: Ping.purple, borderRadius: Radius.md,
      height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm,
      shadowColor: Ping.purple,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.55, shadowRadius: 12, elevation: 8,
    },
    createBtnDisabled: { opacity: 0.6 },
    createBtnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '700' },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    cancelBtnText: {
      fontSize: 14,
      color: hint,
      fontWeight: '600',
    },
  });
}

export default function CreatePingModal({ visible, onClose, onCreated, lat, lng, defaultType, defaultTitle }: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const s = useMemo(() => makeStyles(isDark), [isDark]);

  const [title, setTitle]             = useState('');
  const [type, setType]               = useState('meetup');
  const [customTypeName, setCustomTypeName] = useState('');
  const [vibe, setVibe]               = useState<string | null>(null);
  const [venue, setVenue]             = useState('');
  const [details, setDetails]         = useState('');
  const [notes, setNotes]             = useState('');
  const [visibility, setVisibility]   = useState<'public' | 'friends'>('public');
  const [genderFilter, setGenderFilter] = useState<'all' | 'women_only' | 'men_only'>('all');
  const [duration, setDuration]       = useState(60);
  const [maxPeople, setMaxPeople]     = useState('');
  const [isNow, setIsNow]             = useState(true);
  const [scheduledTime, setScheduledTime] = useState<TimeState>(getDefaultTime);
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [saving, setSaving]             = useState(false);
  const [categorizedPlaces, setCategorizedPlaces] = useState<CategorizedPlaces>({});
  const [activeLocCategory, setActiveLocCategory] = useState('cafes');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Draggable sheet height
  const sheetH    = useRef(new Animated.Value(SHEET_DEFAULT)).current;
  const sheetHRef = useRef(SHEET_DEFAULT);

  const sheetPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 4,
    onPanResponderMove: (_, { dy }) => {
      const next = Math.min(SHEET_MAX_H, Math.max(SHEET_MIN_H, sheetHRef.current - dy));
      sheetH.setValue(next);
    },
    onPanResponderRelease: (_, { dy }) => {
      const next = Math.min(SHEET_MAX_H, Math.max(SHEET_MIN_H, sheetHRef.current - dy));
      sheetHRef.current = next;
      Animated.spring(sheetH, { toValue: next, damping: 22, stiffness: 200, useNativeDriver: false }).start();
    },
  })).current;

  useEffect(() => {
    if (visible) {
      sheetH.setValue(SHEET_DEFAULT);
      sheetHRef.current = SHEET_DEFAULT;
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const knownKeys = TYPES.filter(t => t.key !== 'custom').map(t => t.key);
      const dt = defaultType ?? 'meetup';
      if (knownKeys.includes(dt)) {
        setType(dt);
        setCustomTypeName('');
      } else if (dt) {
        setType('custom');
        setCustomTypeName(dt);
      }
      setTitle(defaultTitle ?? '');
    }
  }, [visible]);

  // Fetch all 4 location categories once when modal opens
  useEffect(() => {
    if (!visible || !lat || !lng) return;
    let cancelled = false;
    setLoadingPlaces(true);
    setCategorizedPlaces({});
    fetchCategorizedPlaces(lat, lng)
      .then((results) => { if (!cancelled) setCategorizedPlaces(results); })
      .catch(() => { if (!cancelled) setCategorizedPlaces({}); })
      .finally(() => { if (!cancelled) setLoadingPlaces(false); });
    return () => { cancelled = true; };
  }, [visible]);

  // Auto-select best location category when activity type changes
  useEffect(() => {
    setActiveLocCategory(ACTIVITY_TO_CATEGORY[type] ?? 'cafes');
  }, [type]);

  function reset() {
    setTitle('');
    setType('meetup');
    setCustomTypeName('');
    setVibe(null);
    setVenue('');
    setDetails('');
    setNotes('');
    setVisibility('public');
    setGenderFilter('all');
    setDuration(60);
    setMaxPeople('');
    setIsNow(true);
    setScheduledTime(getDefaultTime());
    setSelectedDateOffset(0);
    setCategorizedPlaces({});
    setActiveLocCategory('cafes');
    setCustomLat(null);
    setCustomLng(null);
  }

  function handleClose() { reset(); onClose(); }

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) { Toast.show({ type: 'error', text1: 'Title required', text2: 'Give your ping a short title.' }); return; }

    const finalType = type === 'custom'
      ? customTypeName.trim().toLowerCase().replace(/\s+/g, '_')
      : type;
    if (type === 'custom' && !finalType) {
      Toast.show({ type: 'error', text1: 'Type required', text2: 'Enter a custom activity type (e.g. yoga, chess).' });
      return;
    }

    const maxP = maxPeople.trim() ? parseInt(maxPeople, 10) : undefined;
    if (maxP !== undefined && (isNaN(maxP) || maxP < 2 || maxP > 100)) {
      Toast.show({ type: 'error', text1: 'Invalid count', text2: 'Max participants must be between 2 and 100.' });
      return;
    }

    const startsAt = isNow ? undefined : timeToDate(scheduledTime, selectedDateOffset).toISOString();

    setSaving(true);
    try {
      const pingLat = customLat ?? lat;
      const pingLng = customLng ?? lng;
      const created = await activitiesApi.create({
        title: trimmed,
        type: finalType,
        visibility,
        genderFilter,
        lat: pingLat,
        lng: pingLng,
        durationMinutes: duration,
        ...(maxP ? { maxParticipants: maxP } : {}),
        ...(startsAt ? { startsAt } : {}),
        ...(venue.trim() ? { placeName: venue.trim() } : {}),
        ...(details.trim() ? { description: details.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(vibe ? { vibe } : {}),
      });
      if (created?.activity?.startsAt) {
        scheduleStartingNotification(
          created.activity._id,
          trimmed,
          new Date(created.activity.startsAt),
        );
      }
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not create ping.' });
    } finally {
      setSaving(false);
    }
  }

  const selectedType = TYPES.find((t) => t.key === type) ?? TYPES[TYPES.length - 1];
  const mutedIconColor = isDark ? '#9490C0' : '#6B6080';
  const hintColor = isDark ? '#5C5A80' : '#8B85A0';
  const placeholderColor = isDark ? '#5C5A80' : '#8B85A0';

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />

        <Animated.View style={[s.sheet, { height: sheetH }]}>
          {/* Handle */}
          <View {...sheetPan.panHandlers} style={s.handleArea}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={[s.headerIcon, { backgroundColor: `${selectedType.color}22` }]}>
                <MaterialCommunityIcons name={selectedType.icon} size={20} color={selectedType.color} />
              </View>
              <View>
                <Text style={s.headerTitle} numberOfLines={1}>{title.trim() || 'New Ping'}</Text>
                {vibe && (
                  <Text style={s.headerVibe}>
                    {VIBES.find(v => v.key === vibe)?.label} vibe
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={mutedIconColor} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
          >
            {/* ── Title ── */}
            <View style={s.section}>
              <Text style={s.label}>What's happening?</Text>
              <TextInput
                style={s.titleInput}
                placeholder="Name it. Something people will actually tap."
                placeholderTextColor={placeholderColor}
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                returnKeyType="done"
              />
            </View>

            {/* ── Type (vertical list) ── */}
            <View style={s.section}>
              <Text style={s.label}>Activity type</Text>
              <TypeList value={type} onChange={setType} isDark={isDark} />
              {type === 'custom' && (
                <View style={s.customTypeWrap}>
                  <MaterialCommunityIcons name="tag-outline" size={16} color="#A78BFA" />
                  <TextInput
                    style={s.customTypeInput}
                    placeholder="e.g. yoga, chess, cycling…"
                    placeholderTextColor={placeholderColor}
                    value={customTypeName}
                    onChangeText={setCustomTypeName}
                    maxLength={30}
                    autoFocus
                    returnKeyType="done"
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>

            {/* ── Vibe ── */}
            <View style={s.section}>
              <Text style={s.label}>Vibe  <Text style={s.labelOptional}>(optional)</Text></Text>
              <VibeGrid value={vibe} onChange={setVibe} isDark={isDark} />
            </View>

            {/* ── When ── */}
            <View style={s.section}>
              <Text style={s.label}>When?</Text>
              <View style={s.whenRow}>
                <TouchableOpacity
                  style={[s.whenChip, isNow && s.whenChipActive]}
                  onPress={() => setIsNow(true)}
                  activeOpacity={0.75}
                >
                  <View style={[s.liveDot, { opacity: isNow ? 1 : 0.3 }]} />
                  <Text style={[s.whenLabel, isNow && s.whenLabelActive]}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.whenChip, !isNow && s.whenChipActive]}
                  onPress={() => setIsNow(false)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="time-outline" size={15} color={!isNow ? '#FFF' : mutedIconColor} />
                  <Text style={[s.whenLabel, !isNow && s.whenLabelActive]}>
                    {isNow ? 'Schedule' : formatTimeDisplay(scheduledTime, selectedDateOffset)}
                  </Text>
                </TouchableOpacity>
              </View>
              {!isNow && (
                <View style={s.timePickerWrap}>
                  <Text style={s.timePickerLabel}>Date</Text>
                  <DateStrip value={selectedDateOffset} onChange={setSelectedDateOffset} isDark={isDark} />
                  <Text style={[s.timePickerLabel, { marginTop: 4 }]}>Time</Text>
                  <TimePicker value={scheduledTime} onChange={setScheduledTime} isDark={isDark} />
                </View>
              )}
            </View>

            {/* ── Duration ── */}
            <View style={s.section}>
              <Text style={s.label}>Expected duration</Text>
              <View style={s.chipRow}>
                {DURATIONS.map((d) => {
                  const active = duration === d.value;
                  return (
                    <TouchableOpacity
                      key={d.value}
                      style={[s.durationChip, active && s.durationChipActive]}
                      onPress={() => setDuration(d.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.durationLabel, active && s.durationLabelActive]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Venue ── */}
            <View style={s.section}>
              <Text style={s.label}>Preferred venue  <Text style={s.labelOptional}>(optional)</Text></Text>
              <View style={s.iconInput}>
                <Ionicons name="location-outline" size={16} color={mutedIconColor} />
                <TextInput
                  style={s.iconInputText}
                  placeholder="A park, a café, your building lobby. Anywhere."
                  placeholderTextColor={placeholderColor}
                  value={venue}
                  onChangeText={setVenue}
                  maxLength={120}
                  returnKeyType="done"
                />
              </View>

              {/* Location category tabs + place chips */}
              {(loadingPlaces || Object.keys(categorizedPlaces).length > 0) && (
                <View style={s.locSuggestWrap}>
                  {/* Category tabs */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={s.locCatRow}
                  >
                    {LOCATION_CATEGORIES.map((cat) => {
                      const active = activeLocCategory === cat.key;
                      const count = categorizedPlaces[cat.key]?.length ?? 0;
                      return (
                        <TouchableOpacity
                          key={cat.key}
                          style={[s.locCatChip, active && s.locCatChipActive]}
                          onPress={() => setActiveLocCategory(cat.key)}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name={cat.icon as any}
                            size={12}
                            color={active ? '#FFF' : mutedIconColor}
                          />
                          <Text style={[s.locCatLabel, active && s.locCatLabelActive]}>
                            {cat.label}
                            {!loadingPlaces && count > 0 ? ` (${count})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Place chips */}
                  {loadingPlaces ? (
                    <View style={s.locLoadingRow}>
                      <ActivityIndicator size="small" color={Ping.purpleLight} />
                      <Text style={s.locLoadingText}>Finding nearby places…</Text>
                    </View>
                  ) : (categorizedPlaces[activeLocCategory]?.length ?? 0) > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={s.suggestionsRow}
                    >
                      {(categorizedPlaces[activeLocCategory] ?? []).map((p) => {
                        const selected = venue === p.name;
                        const activeCat = LOCATION_CATEGORIES.find((c) => c.key === activeLocCategory);
                        return (
                          <TouchableOpacity
                            key={p.name}
                            style={[s.suggestionChip, selected && s.suggestionChipActive]}
                            onPress={() => setVenue(selected ? '' : p.name)}
                            activeOpacity={0.75}
                          >
                            <Ionicons
                              name={(activeCat?.icon ?? 'location-outline') as any}
                              size={12}
                              color={selected ? Ping.purpleLight : mutedIconColor}
                            />
                            <Text
                              style={[s.suggestionText, selected && s.suggestionTextActive]}
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={s.locEmptyText}>
                      No {LOCATION_CATEGORIES.find((c) => c.key === activeLocCategory)?.label ?? 'places'} found nearby
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* ── Activity details ── */}
            <View style={s.section}>
              <Text style={s.label}>Activity details  <Text style={s.labelOptional}>(optional)</Text></Text>
              <TextInput
                style={s.multiInput}
                placeholder="Context helps. People are confused by default."
                placeholderTextColor={placeholderColor}
                value={details}
                onChangeText={setDetails}
                maxLength={500}
                multiline
                numberOfLines={3}
                returnKeyType="default"
                textAlignVertical="top"
              />
            </View>

            {/* ── Special notes ── */}
            <View style={s.section}>
              <Text style={s.label}>Special notes  <Text style={s.labelOptional}>(optional)</Text></Text>
              <View style={s.iconInput}>
                <Ionicons name="sparkles-outline" size={16} color={mutedIconColor} />
                <TextInput
                  style={s.iconInputText}
                  placeholder="e.g. Bring your gear. Or don't — we're not your mom."
                  placeholderTextColor={placeholderColor}
                  value={notes}
                  onChangeText={setNotes}
                  maxLength={300}
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* ── Visibility ── */}
            <View style={s.section}>
              <Text style={s.label}>Who can see it?</Text>
              <View style={s.visRow}>
                {(['public', 'friends'] as const).map((v) => {
                  const active = visibility === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[s.visChip, active && s.visChipActive]}
                      onPress={() => setVisibility(v)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={v === 'public' ? 'earth-outline' : 'people-outline'} size={15} color={active ? '#FFF' : mutedIconColor} />
                      <Text style={[s.visLabel, active && s.visLabelActive]}>
                        {v === 'public' ? 'Everyone' : 'Friends only'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Gender filter ── */}
            <View style={s.section}>
              <Text style={s.label}>Who can join?</Text>
              <View style={s.genderRow}>
                {([
                  { key: 'all',        label: 'Everyone',   icon: 'earth-outline'   },
                  { key: 'women_only', label: 'Women only', icon: 'female-outline'  },
                  { key: 'men_only',   label: 'Men only',   icon: 'male-outline'    },
                ] as const).map((g) => {
                  const active = genderFilter === g.key;
                  const color = g.key === 'women_only' ? '#EC4899' : g.key === 'men_only' ? '#3B82F6' : Ping.purple;
                  return (
                    <TouchableOpacity
                      key={g.key}
                      style={[
                        s.genderChip,
                        active
                          ? { backgroundColor: color, borderColor: color }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)' },
                      ]}
                      onPress={() => setGenderFilter(g.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={g.icon as any} size={14} color={active ? '#FFF' : mutedIconColor} />
                      <Text style={[s.genderLabel, active && s.genderLabelActive]}>{g.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Max participants ── */}
            <View style={s.section}>
              <Text style={s.label}>Max participants  <Text style={s.labelOptional}>(optional)</Text></Text>
              <View style={s.iconInput}>
                <Ionicons name="people-outline" size={16} color={mutedIconColor} />
                <TextInput
                  style={s.iconInputText}
                  placeholder="Leave blank for unlimited (chaos mode)"
                  placeholderTextColor={placeholderColor}
                  value={maxPeople}
                  onChangeText={(v) => setMaxPeople(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={s.locNote}>
              <Ionicons
                name={customLat ? 'location' : 'location-outline'}
                size={13}
                color={customLat ? Ping.purple : hintColor}
              />
              <Text style={[s.locText, customLat && { color: Ping.purple, fontWeight: '600' }]}>
                {customLat ? 'Custom location set' : 'Ping is placed at your current location'}
              </Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(true)} hitSlop={8}>
                <Text style={s.changeLocBtn}>
                  {customLat ? 'Change' : 'Pick another'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[s.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <TouchableOpacity
              style={[s.createBtn, saving && s.createBtnDisabled]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name={isNow ? 'flash' : 'time'} size={20} color="#FFF" />
                  <Text style={s.createBtnText}>
                    {isNow ? 'Drop Ping Now' : `Schedule for ${formatTimeDisplay(scheduledTime, selectedDateOffset)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleClose}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={s.cancelBtnText}>Nah, never mind</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>

    <LocationPickerModal
      visible={showLocationPicker}
      initialLat={customLat ?? lat}
      initialLng={customLng ?? lng}
      onConfirm={(pickedLat, pickedLng) => {
        setCustomLat(pickedLat);
        setCustomLng(pickedLng);
        setShowLocationPicker(false);
      }}
      onClose={() => setShowLocationPicker(false)}
    />
    </>
  );
}
