import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi, activitiesApi, uploadApi, type Activity } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type SectionKey = 'basic' | 'personal' | 'social' | 'hobbies' | 'vibes' | 'activities' | 'personality' | 'pitch' | 'past';

// ── Profile completion ────────────────────────────────────────────────────────
type CompletionItem = {
  key: string;
  label: string;
  sublabel: string;
  icon: IoniconsName;
  color: string;
  done: boolean;
  section: SectionKey | null;
  weight: number;
};

function getCompletionItems(d: {
  photoCount: number; displayName: string; bio: string; gender: string;
  dobInput: string; city: string; hobbies: string[]; vibePreferences: string[];
  vibeCount: number; pingPitch: string; email: string; instagramHandle: string; funTruth: string;
}): CompletionItem[] {
  return [
    { key: 'main_photo',  label: 'Add a main photo',        sublabel: 'First impressions matter',           icon: 'camera-outline',         color: '#EC4899', done: d.photoCount >= 1,            section: null,          weight: 15 },
    { key: 'more_photos', label: 'Add 2+ photos',           sublabel: 'Show more sides of yourself',         icon: 'images-outline',         color: '#F97316', done: d.photoCount >= 2,            section: null,          weight: 5  },
    { key: 'name',        label: 'Set your display name',   sublabel: 'Let people know who you are',         icon: 'person-outline',         color: '#A78BFA', done: d.displayName.trim().length >= 2, section: 'basic',    weight: 10 },
    { key: 'bio',         label: 'Write a bio',             sublabel: 'Say something interesting (10+ chars)',icon: 'create-outline',         color: '#A78BFA', done: d.bio.trim().length >= 10,    section: 'basic',       weight: 10 },
    { key: 'gender',      label: 'Set your gender',         sublabel: 'Helps people find you',               icon: 'person-circle-outline',  color: '#F59E0B', done: !!d.gender,                   section: 'personal',    weight: 5  },
    { key: 'dob',         label: 'Add date of birth',       sublabel: 'Required to show your age',           icon: 'calendar-outline',       color: '#F59E0B', done: !!d.dobInput.trim(),          section: 'personal',    weight: 5  },
    { key: 'city',        label: 'Add your city',           sublabel: 'Show local connections',              icon: 'location-outline',       color: '#10B981', done: !!d.city.trim(),              section: 'personal',    weight: 5  },
    { key: 'hobbies',     label: 'Pick 3+ interests',       sublabel: 'Match with like-minded people',       icon: 'heart-outline',          color: '#EF4444', done: d.hobbies.length >= 3,        section: 'hobbies',     weight: 10 },
    { key: 'vibes',       label: 'Set vibe preferences',    sublabel: 'What energy do you bring?',           icon: 'sparkles-outline',       color: '#8B5CF6', done: d.vibePreferences.length >= 1, section: 'vibes',      weight: 5  },
    { key: 'personality', label: 'Fill personality (4/8)',  sublabel: 'Sleep, food, timing, intent…',        icon: 'color-palette-outline',  color: '#A78BFA', done: d.vibeCount >= 4,             section: 'personality', weight: 10 },
    { key: 'pitch',       label: 'Write your pitch',        sublabel: 'Why should people ping you?',         icon: 'magnet-outline',         color: Ping.purpleLight, done: !!d.pingPitch.trim(),  section: 'pitch',       weight: 10 },
    { key: 'social',      label: 'Add a social link',       sublabel: 'Email or Instagram handle',           icon: 'link-outline',           color: '#E1306C', done: !!(d.email.trim() || d.instagramHandle.trim()), section: 'social', weight: 5 },
    { key: 'fun_truth',   label: 'Share a fun truth',       sublabel: 'Something true that sounds fake',     icon: 'happy-outline',          color: '#F59E0B', done: !!d.funTruth.trim(),          section: 'pitch',       weight: 5  },
  ];
}

const GENDERS = [
  { key: 'male',   label: 'Male'   },
  { key: 'female', label: 'Female' },
  { key: 'other',  label: 'Other'  },
] as const;

const HOBBY_OPTIONS = [
  'Music', 'Sports', 'Gaming', 'Travel', 'Food', 'Art',
  'Reading', 'Movies', 'Fitness', 'Photography', 'Dance', 'Coding',
];

const VIBE_OPTIONS: { key: string; label: string; icon: IoniconsName; color: string }[] = [
  { key: 'Chill',        label: 'Chill',        icon: 'leaf-outline',          color: '#10B981' },
  { key: 'Adventure',    label: 'Adventure',    icon: 'compass-outline',       color: '#F59E0B' },
  { key: 'Social',       label: 'Social',       icon: 'people-outline',        color: '#8B5CF6' },
  { key: 'Intellectual', label: 'Intellectual', icon: 'book-outline',          color: '#3B82F6' },
  { key: 'Foodie',       label: 'Foodie',       icon: 'restaurant-outline',    color: '#F97316' },
  { key: 'Night owl',    label: 'Night owl',    icon: 'moon-outline',          color: '#6366F1' },
  { key: 'Active',       label: 'Active',       icon: 'bicycle-outline',       color: '#22C55E' },
  { key: 'Creative',     label: 'Creative',     icon: 'color-palette-outline', color: '#EC4899' },
  { key: 'Romantic',     label: 'Romantic',     icon: 'heart-outline',         color: '#EF4444' },
];

const PITCH_PRESETS = [
  "Because I know a hidden chai spot you don't",
  "Because I'll actually show up on time (rare trait)",
  "Because I make boring plans fun",
  "Because I'm bored and slightly funny",
  "Because I'll hype you up for no reason",
  "Because I always know where the good food is",
];

const ACTIVITY_OPTIONS = [
  'Cricket', 'Badminton', 'Football', 'Coffee runs', 'Study sessions',
  'Hiking', 'Gaming nights', 'Movie nights', 'Road trips', 'Gym', 'Cycling', 'Reading',
];

const TYPE_CFG: Record<string, { icon: MCIName; color: string }> = {
  sport:   { icon: 'dumbbell',          color: '#EF4444' },
  food:    { icon: 'food-fork-drink',   color: '#F97316' },
  music:   { icon: 'music',             color: '#8B5CF6' },
  study:   { icon: 'book-open-variant', color: '#3B82F6' },
  outdoor: { icon: 'walk',              color: '#10B981' },
  gaming:  { icon: 'gamepad-variant',   color: '#EC4899' },
  meetup:  { icon: 'account-group',     color: '#7C3AED' },
  default: { icon: 'flash',             color: Ping.purpleLight },
};

function parseDobInput(s: string): string | null {
  const parts = s.replace(/\s/g, '').split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy || yyyy < 1900 || yyyy > new Date().getFullYear()) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (isNaN(d.getTime()) || d.getMonth() !== mm - 1) return null;
  return d.toISOString();
}

function formatDobToDisplay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, multiline, autoCapitalize, c }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  c: (typeof Colors)['dark'];
}) {
  return (
    <View style={fi.wrap}>
      <Text style={[fi.label, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        style={[fi.input, multiline && fi.inputMulti, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={c.icon} multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'} autoCorrect={false}
      />
    </View>
  );
}
const fi = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderRadius: Radius.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 12, ...Typography.bodyMed },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
});

// ── Sub-label (inside accordion body) ────────────────────────────────────────
function SubLabel({ text, c }: { text: string; c: (typeof Colors)['dark'] }) {
  return (
    <Text style={[sbl.text, { color: c.textSecondary }]}>{text}</Text>
  );
}
const sbl = StyleSheet.create({
  text: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
});

// ── Completion sheet (bottom sheet listing all items) ─────────────────────────
function CompletionSheet({ pct, items, color, c, onClose, onItemPress }: {
  pct: number; items: CompletionItem[]; color: string;
  c: (typeof Colors)['dark']; onClose: () => void;
  onItemPress: (section: SectionKey | null) => void;
}) {
  const slide    = useRef(new Animated.Value(700)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const pending  = items.filter(i => !i.done);
  const done     = items.filter(i => i.done);
  const itemAnims = useRef(pending.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide,    { toValue: 0, damping: 24, stiffness: 240, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.stagger(45, itemAnims.map(a =>
        Animated.spring(a, { toValue: 1, damping: 22, stiffness: 200, useNativeDriver: true })
      )).start();
    }, 160);
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(slide,    { toValue: 700, duration: 240, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  }

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdrop, backgroundColor: 'rgba(0,0,0,0.65)' }]} />
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
      <Animated.View style={[csh.container, { transform: [{ translateY: slide }] }]}>
        <View style={csh.handle} />
        <View style={csh.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={csh.headTitle}>Profile progress</Text>
            <Text style={[csh.headSub, { color: c.textSecondary }]}>
              {done.length} of {items.length} done · {pct}%
            </Text>
          </View>
          <TouchableOpacity onPress={dismiss} style={csh.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color="#AAA" />
          </TouchableOpacity>
        </View>
        <View style={[csh.bar, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={[csh.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={csh.scroll}>
          {pending.length > 0 && (
            <>
              <Text style={[csh.sectionLbl, { color: c.icon }]}>REMAINING · {pending.length}</Text>
              {pending.map((item, i) => (
                <Animated.View key={item.key} style={{
                  opacity: itemAnims[i] ?? 1,
                  transform: [{ translateX: (itemAnims[i] ?? new Animated.Value(1)).interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
                }}>
                  <TouchableOpacity
                    style={[csh.row, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}
                    onPress={() => onItemPress(item.section)}
                    activeOpacity={0.7}
                  >
                    <View style={[csh.rowIcon, { backgroundColor: `${item.color}18` }]}>
                      <Ionicons name={item.icon} size={18} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={csh.rowLabel}>{item.label}</Text>
                      <Text style={[csh.rowSub, { color: c.textSecondary }]}>{item.sublabel}</Text>
                    </View>
                    <View style={[csh.weightBadge, { backgroundColor: `${item.color}18` }]}>
                      <Text style={[csh.weightText, { color: item.color }]}>+{item.weight}%</Text>
                    </View>
                    {item.section !== null && <Ionicons name="chevron-forward" size={13} color={c.icon} />}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </>
          )}

          {done.length > 0 && (
            <>
              <Text style={[csh.sectionLbl, { color: c.icon, marginTop: 20 }]}>COMPLETED · {done.length}</Text>
              {done.map(item => (
                <View key={item.key} style={[csh.row, { borderBottomColor: 'rgba(255,255,255,0.04)', opacity: 0.5 }]}>
                  <View style={[csh.rowIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={Ping.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[csh.rowLabel, { textDecorationLine: 'line-through' }]}>{item.label}</Text>
                  </View>
                  <View style={[csh.weightBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                    <Text style={[csh.weightText, { color: Ping.green }]}>+{item.weight}%</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          <View style={{ height: 36 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}
const csh = StyleSheet.create({
  container: {
    backgroundColor: '#0E0E24',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.18)',
    maxHeight: '82%',
  },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(167,139,250,0.3)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  headRow:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14 },
  headTitle: { fontSize: 17, fontWeight: '700', color: '#F1F0FF' },
  headSub:   { fontSize: 12, marginTop: 2 },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  bar:       { height: 5, marginHorizontal: 20, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  barFill:   { height: '100%', borderRadius: 3 },
  scroll:    { paddingHorizontal: 20 },
  sectionLbl:{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon:   { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel:  { fontSize: 14, fontWeight: '600', color: '#F1F0FF' },
  rowSub:    { fontSize: 12, marginTop: 1 },
  weightBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  weightText:  { fontSize: 11, fontWeight: '700' },
});

// ── Completion banner (animated, tappable) ────────────────────────────────────
function CompletionBanner({ pct, items, c, onItemPress }: {
  pct: number; items: CompletionItem[];
  c: (typeof Colors)['dark'];
  onItemPress: (section: SectionKey | null) => void;
}) {
  const [showSheet, setShowSheet] = useState(false);
  const barAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const bumpAnim = useRef(new Animated.Value(1)).current;
  const prevPct  = useRef(0);

  // Animate bar fill on mount
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct / 100, duration: 900, delay: 350, useNativeDriver: false }).start();
    if (pct < 100) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.15, duration: 1600, useNativeDriver: true }),
      ])).start();
    }
  }, []);

  // Re-animate bar + bump icon when pct changes
  useEffect(() => {
    if (pct !== prevPct.current) {
      prevPct.current = pct;
      Animated.spring(barAnim, { toValue: pct / 100, damping: 18, stiffness: 120, useNativeDriver: false }).start();
      Animated.sequence([
        Animated.spring(bumpAnim, { toValue: 1.18, damping: 8, stiffness: 320, useNativeDriver: true }),
        Animated.spring(bumpAnim, { toValue: 1,    damping: 14, stiffness: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [pct]);

  if (pct >= 100) {
    return (
      <View style={[bann.wrap, { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.28)' }]}>
        <Ionicons name="shield-checkmark" size={24} color={Ping.green} />
        <View style={{ flex: 1 }}>
          <Text style={[bann.label, { color: Ping.green }]}>Profile complete!</Text>
          <Text style={[bann.hint, { color: c.textSecondary }]}>You're eligible for a Verified badge</Text>
        </View>
      </View>
    );
  }

  const color   = pct >= 80 ? Ping.green : pct >= 50 ? Ping.orange : Ping.purpleLight;
  const missing = items.filter(i => !i.done).length;

  return (
    <>
      <TouchableOpacity
        style={[bann.wrap, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={() => setShowSheet(true)}
        activeOpacity={0.8}
      >
        <View style={bann.row}>
          <Animated.View style={{ transform: [{ scale: bumpAnim }] }}>
            <View style={[bann.iconWrap, { backgroundColor: `${color}18` }]}>
              <Ionicons name="shield-half-outline" size={18} color={color} />
            </View>
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={[bann.label, { color: c.text }]}>Profile {pct}% complete</Text>
            <Text style={[bann.hint, { color: c.textSecondary }]}>
              {missing} thing{missing !== 1 ? 's' : ''} left — tap to see what
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.icon} />
        </View>

        {/* Animated progress track */}
        <View style={[bann.track, { backgroundColor: c.border }]}>
          <Animated.View style={[bann.fill, {
            width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: color,
          }]}>
            <Animated.View style={[bann.shimmer, { opacity: glowAnim }]} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {showSheet && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowSheet(false)}>
          <CompletionSheet
            pct={pct} items={items} color={color} c={c}
            onClose={() => setShowSheet(false)}
            onItemPress={(sec) => { setShowSheet(false); onItemPress(sec); }}
          />
        </Modal>
      )}
    </>
  );
}
const bann = StyleSheet.create({
  wrap:    { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label:   { ...Typography.bodyMed, fontWeight: '600' },
  hint:    { ...Typography.caption, marginTop: 1 },
  track:   { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 3, overflow: 'hidden' },
  shimmer: { position: 'absolute', right: 0, width: 20, height: '100%', backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 3 },
});

// ── Photos section ────────────────────────────────────────────────────────────
// 3 per row using percentage: 3 × 31% = 93% of container + 2 × 8px gaps fits any screen width ≥ 228px

function PhotosSection({ c }: { c: (typeof Colors)['dark'] }) {
  const { user, setUser } = useAuthStore();
  const [uploading, setUploading] = useState<number | null>(null);
  const [gridW, setGridW] = useState(0);
  const [photoMenuIdx, setPhotoMenuIdx] = useState<number | null>(null);
  // Derived from actual measured grid width — immune to padding/border guessing
  const slotSize = gridW > 0 ? Math.floor((gridW - 16) / 3) : 0;

  const photos: (string | null)[] = [
    ...(user?.photos ?? []),
    ...Array(5 - (user?.photos?.length ?? 0)).fill(null),
  ];

  function pickPhoto(idx: number) {
    const existing = photos[idx];
    if (existing) {
      setPhotoMenuIdx(idx);
    } else {
      upload(idx);
    }
  }

  async function deletePhoto(idx: number) {
    const next = (user?.photos ?? []).filter((_, i) => i !== idx);
    try {
      const res = await usersApi.updateMe({ photos: next });
      setUser(res.user);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    }
  }

  async function upload(idx: number) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'info', text1: 'Permission needed', text2: 'Allow photo access to add pictures.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 5] });
    if (result.canceled || !result.assets[0]) return;
    setUploading(idx);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'photos');
      const current = user?.photos ?? [];
      const next = [...current];
      if (idx < next.length) next[idx] = url; else next.push(url);
      const res = await usersApi.updateMe({ photos: next.slice(0, 5) });
      setUser(res.user);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: e.message || 'Could not save photo.' });
    } finally {
      setUploading(null);
    }
  }

  return (
    <View style={[ph.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={ph.titleRow}>
        <View style={[ph.iconWrap, { backgroundColor: `${Ping.purple}18` }]}>
          <Ionicons name="camera-outline" size={18} color={Ping.purpleLight} />
        </View>
        <View>
          <Text style={[ph.heading, { color: c.text }]}>My Photos</Text>
          <Text style={[ph.subheading, { color: c.textSecondary }]}>{user?.photos?.length ?? 0} of 5 added</Text>
        </View>
      </View>

      <View style={ph.grid} onLayout={e => setGridW(e.nativeEvent.layout.width)}>
        {slotSize > 0 && photos.map((url, idx) => (
          <TouchableOpacity
            key={idx}
            style={[ph.slot, { width: slotSize, height: Math.floor(slotSize * 1.25), borderColor: url ? 'transparent' : c.border, backgroundColor: url ? 'transparent' : c.card }]}
            onPress={() => pickPhoto(idx)} activeOpacity={0.8}
          >
            {uploading === idx ? (
              <ActivityIndicator color={Ping.purpleLight} />
            ) : url ? (
              <>
                <Image source={{ uri: url }} style={ph.img} />
                <View style={ph.editBadge}><Ionicons name="pencil" size={10} color="#FFF" /></View>
                {idx === 0 && (
                  <View style={ph.mainBadge}>
                    <Text style={ph.mainText}>MAIN</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={ph.addContent}>
                <View style={[ph.addCircle, { borderColor: c.border }]}>
                  <Ionicons name="add" size={22} color={c.icon} />
                </View>
                {idx === 0 && <Text style={[ph.addLabel, { color: c.icon }]}>Main photo</Text>}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[ph.hint, { color: c.icon }]}>
        Tap a photo to replace or remove · First photo is your main profile picture
      </Text>

      {/* Photo options bottom sheet */}
      <Modal
        visible={photoMenuIdx !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoMenuIdx(null)}
      >
        <TouchableOpacity style={ph.menuOverlay} activeOpacity={1} onPress={() => setPhotoMenuIdx(null)}>
          <View style={ph.menuSheet}>
            <View style={ph.menuHandle} />
            <Text style={ph.menuTitle}>Photo options</Text>
            <TouchableOpacity
              style={ph.menuBtn}
              activeOpacity={0.8}
              onPress={() => {
                const idx = photoMenuIdx!;
                setPhotoMenuIdx(null);
                upload(idx);
              }}
            >
              <Ionicons name="repeat-outline" size={18} color={Ping.purpleLight} />
              <Text style={ph.menuBtnText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ph.menuBtn, ph.menuBtnDestructive]}
              activeOpacity={0.8}
              onPress={() => {
                const idx = photoMenuIdx!;
                setPhotoMenuIdx(null);
                deletePhoto(idx);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={ph.menuBtnTextDestructive}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ph.menuCancelBtn} activeOpacity={0.8} onPress={() => setPhotoMenuIdx(null)}>
              <Text style={ph.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
const ph = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  heading: { ...Typography.bodyMed, fontWeight: '700' },
  subheading: { ...Typography.caption, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  editBadge: { position: 'absolute', bottom: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  mainBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: Ping.purple, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mainText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  addContent: { alignItems: 'center', gap: 4 },
  addCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontSize: 10, fontWeight: '600' },
  hint: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  menuSheet: {
    backgroundColor: '#11112A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 36, gap: Spacing.sm,
    alignItems: 'center',
  },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(167,139,250,0.3)', marginBottom: Spacing.sm },
  menuTitle: { ...Typography.bodyMed, fontWeight: '700', color: '#F1F0FF', marginBottom: 4 },
  menuBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  menuBtnDestructive: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)',
  },
  menuBtnText: { ...Typography.bodyMed, color: Ping.purpleLight, fontWeight: '600' },
  menuBtnTextDestructive: { ...Typography.bodyMed, color: '#EF4444', fontWeight: '600' },
  menuCancelBtn: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 4,
  },
  menuCancelText: { ...Typography.bodyMed, color: 'rgba(241,240,255,0.5)', fontWeight: '600' },
});

// ── Past pings preview ────────────────────────────────────────────────────────
function PastPingsPreview({ c }: { c: (typeof Colors)['dark'] }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    activitiesApi.past()
      .then((r) => setActivities(r.activities))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shown = activities.slice(0, 5);
  const hasMore = activities.length > 5;

  if (loading) return <ActivityIndicator color={Ping.purpleLight} style={{ padding: 20 }} />;
  if (shown.length === 0) return (
    <View style={pp.empty}>
      <Ionicons name="flash-outline" size={24} color={c.icon} />
      <Text style={[pp.emptyText, { color: c.textSecondary }]}>No past pings yet</Text>
    </View>
  );

  return (
    <View>
      {shown.map((a) => {
        const cfg = TYPE_CFG[a.type] ?? TYPE_CFG.default;
        const when = new Date(a.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return (
          <View key={a._id} style={[pp.row, { borderBottomColor: c.border }]}>
            <View style={[pp.icon, { backgroundColor: `${cfg.color}18` }]}>
              <MaterialCommunityIcons name={cfg.icon} size={18} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[pp.title, { color: c.text }]} numberOfLines={1}>{a.title}</Text>
              <Text style={[pp.meta, { color: c.textSecondary }]}>{when} · {a.participants?.length ?? 0} joined</Text>
            </View>
            <View style={[pp.badge, { backgroundColor: a.status === 'cancelled' ? 'rgba(239,68,68,0.12)' : 'rgba(107,114,128,0.12)' }]}>
              <Text style={[pp.badgeText, { color: a.status === 'cancelled' ? '#EF4444' : c.textSecondary }]}>
                {a.status === 'cancelled' ? 'Cancelled' : 'Ended'}
              </Text>
            </View>
          </View>
        );
      })}
      {hasMore && (
        <TouchableOpacity style={pp.more} onPress={() => router.push('/past-pings' as any)} activeOpacity={0.8}>
          <Text style={[pp.moreText, { color: Ping.purpleLight }]}>See all pings</Text>
          <Ionicons name="chevron-forward" size={14} color={Ping.purpleLight} />
        </TouchableOpacity>
      )}
    </View>
  );
}
const pp = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyText: { ...Typography.bodySm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyMed, fontWeight: '600' },
  meta: { ...Typography.caption, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  badgeText: { fontSize: 11, fontWeight: '600' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14 },
  moreText: { ...Typography.bodySm, fontWeight: '700' },
});

// ── Accordion Section ─────────────────────────────────────────────────────────
function AccordionSection({
  sectionKey, openSection, onToggle, icon, iconColor, title, summary, hasValue, children, c,
}: {
  sectionKey: SectionKey;
  openSection: SectionKey | null;
  onToggle: (k: SectionKey) => void;
  icon: IoniconsName;
  iconColor: string;
  title: string;
  summary?: string;
  hasValue?: boolean;
  children: any;
  c: (typeof Colors)['dark'];
}) {
  const isOpen = openSection === sectionKey;
  return (
    <View style={[ac.wrap, { backgroundColor: c.surface, borderColor: isOpen ? iconColor + '55' : c.border }]}>
      <TouchableOpacity style={ac.header} onPress={() => onToggle(sectionKey)} activeOpacity={0.75}>
        <View style={[ac.iconWrap, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ac.title, { color: c.text }]}>{title}</Text>
          {summary ? (
            <Text style={[ac.summary, { color: hasValue ? c.textSecondary : c.icon }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        {hasValue && !isOpen && <View style={[ac.dot, { backgroundColor: iconColor }]} />}
        <View style={[ac.chevronWrap, { backgroundColor: isOpen ? iconColor + '18' : c.card }]}>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={isOpen ? iconColor : c.icon} />
        </View>
      </TouchableOpacity>
      {isOpen && (
        <View style={[ac.body, { borderTopColor: c.border }]}>
          {children}
        </View>
      )}
    </View>
  );
}
const ac = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  iconWrap: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { ...Typography.bodyMed, fontWeight: '700' },
  summary: { ...Typography.caption, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 2, flexShrink: 0 },
  chevronWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { padding: Spacing.md, gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [openSection, setOpenSection] = useState<SectionKey | null>('basic');

  const [displayName, setDisplayName]           = useState(user?.displayName ?? '');
  const [username, setUsername]                 = useState(user?.username ?? '');
  const [bio, setBio]                           = useState(user?.bio ?? '');
  const [email, setEmail]                       = useState(user?.email ?? '');
  const [gender, setGender]                     = useState<'male' | 'female' | 'other' | ''>(user?.gender ?? '');
  const [dobInput, setDobInput]                 = useState(formatDobToDisplay(user?.dob));
  const [city, setCity]                         = useState(user?.city ?? '');
  const [institute, setInstitute]               = useState(user?.institute ?? '');
  const [hobbies, setHobbies]                   = useState<string[]>(user?.hobbies ?? []);
  const [vibePreferences, setVibePreferences]   = useState<string[]>(user?.vibePreferences ?? []);
  const [favoriteActivities, setFavoriteActivities] = useState<string[]>(user?.favoriteActivities ?? []);
  const [socialPreference, setSocialPreference] = useState<'introvert' | 'extrovert' | 'ambivert' | ''>(user?.socialPreference ?? '');
  const [instagramHandle, setInstagramHandle]   = useState(user?.instagramHandle ?? '');
  const [sleepType, setSleepType]               = useState<'night_owl' | 'early_bird' | ''>(user?.sleepType ?? '');
  const [spontaneity, setSpontaneity]           = useState<'planner' | 'spontaneous' | ''>(user?.spontaneity ?? '');
  const [foodPersonality, setFoodPersonality]   = useState<'street_food' | 'balanced' | 'cafe_aesthetic' | ''>(user?.foodPersonality ?? '');
  const [timeRespect, setTimeRespect]           = useState<'always_early' | 'on_time' | 'fashionably_late' | ''>(user?.timeRespect ?? '');
  const [distanceTolerance, setDistanceTolerance] = useState<'nearby' | 'up_to_5km' | 'travel_for_good_plans' | ''>(user?.distanceTolerance ?? '');
  const [availabilityPattern, setAvailabilityPattern] = useState<'weekends_only' | 'evenings_mostly' | 'random_anytime' | ''>(user?.availabilityPattern ?? '');
  const [intentSync, setIntentSync]             = useState<'just_hanging' | 'activity_partner' | 'trying_new_places' | 'networking' | ''>(user?.intentSync ?? '');
  const [pingPitch, setPingPitch]               = useState(user?.pingPitch ?? '');
  const [funTruth, setFunTruth]                 = useState(user?.funTruth ?? '');
  const [saving, setSaving]                     = useState(false);

  function toggle(k: SectionKey) {
    setOpenSection((prev) => (prev === k ? null : k));
  }

  function toggleHobby(h: string) {
    setHobbies((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  }
  function toggleVibe(v: string) {
    setVibePreferences((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }
  function toggleActivity(a: string) {
    setFavoriteActivities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function save() {
    const payload: Record<string, any> = {};
    if (displayName.trim()) payload.displayName = displayName.trim();
    if (username.trim()) payload.username = username.trim();
    payload.bio = bio.trim();
    if (email.trim()) payload.email = email.trim();
    if (gender) payload.gender = gender;
    payload.city = city.trim();
    payload.institute = institute.trim();
    payload.hobbies = hobbies;
    payload.vibePreferences = vibePreferences;
    payload.favoriteActivities = favoriteActivities;
    payload.socialPreference = socialPreference || null;
    payload.instagramHandle = instagramHandle.trim().replace(/^@/, '');
    payload.sleepType = sleepType || null;
    payload.spontaneity = spontaneity || null;
    payload.foodPersonality = foodPersonality || null;
    payload.timeRespect = timeRespect || null;
    payload.distanceTolerance = distanceTolerance || null;
    payload.availabilityPattern = availabilityPattern || null;
    payload.intentSync = intentSync || null;
    payload.pingPitch = pingPitch.trim() || null;
    payload.funTruth = funTruth.trim() || null;

    if (dobInput.trim()) {
      const iso = parseDobInput(dobInput.trim());
      if (!iso) {
        Toast.show({ type: 'error', text1: 'Invalid date', text2: 'Enter date as DD/MM/YYYY, e.g. 25/06/2001' });
        return;
      }
      payload.dob = iso;
    }
    if (!payload.displayName) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter a display name.' });
      return;
    }

    setSaving(true);
    try {
      const res = await usersApi.updateMe(payload);
      setUser(res.user);
      router.back();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not save profile.' });
    } finally { setSaving(false); }
  }

  const vibeCount = [sleepType, spontaneity, foodPersonality, timeRespect, distanceTolerance, availabilityPattern, intentSync, socialPreference].filter(Boolean).length;
  const placeholderColor = scheme === 'dark' ? '#5C5A80' : '#8B85A0';

  // Live completion calculation from local state
  const photoCount      = user?.photos?.length ?? 0;
  const completionItems = getCompletionItems({ photoCount, displayName, bio, gender, dobInput, city, hobbies, vibePreferences, vibeCount, pingPitch, email, instagramHandle, funTruth });
  const pct             = completionItems.filter(i => i.done).reduce((s, i) => s + i.weight, 0);

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={s.saveChip} activeOpacity={0.8}>
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.saveChipText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <CompletionBanner
            pct={pct}
            items={completionItems}
            c={c}
            onItemPress={(sec) => { if (sec) setOpenSection(sec); }}
          />

          {/* Photos — always visible card */}
          <PhotosSection c={c} />

          {/* ── Basic Info ── */}
          <AccordionSection
            sectionKey="basic" openSection={openSection} onToggle={toggle}
            icon="person-outline" iconColor={Ping.purpleLight}
            title="Basic Info"
            summary={displayName.trim() ? `${displayName.trim()}${bio.trim() ? ' · has bio' : ''}` : 'Name, username & bio'}
            hasValue={!!(displayName.trim() || bio.trim())}
            c={c}
          >
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" autoCapitalize="words" c={c} />
            <Field label="Username" value={username} onChangeText={setUsername} placeholder="letters, numbers, _ and ." autoCapitalize="none" c={c} />
            <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Say something. Don't just write 'hey'." multiline c={c} />
          </AccordionSection>

          {/* ── Personal Details ── */}
          <AccordionSection
            sectionKey="personal" openSection={openSection} onToggle={toggle}
            icon="calendar-outline" iconColor="#F59E0B"
            title="Personal Details"
            summary={
              [gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '', city.trim()]
                .filter(Boolean).join(' · ') || 'Date of birth, gender, city'
            }
            hasValue={!!(gender || city.trim() || dobInput.trim())}
            c={c}
          >
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Field label="Date of birth" value={dobInput} onChangeText={setDobInput} placeholder="DD/MM/YYYY" autoCapitalize="none" c={c} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={fi.wrap}>
                  <Text style={[fi.label, { color: c.textSecondary }]}>Gender</Text>
                  <View style={s.genderRow}>
                    {GENDERS.map(({ key, label }) => {
                      const active = gender === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[s.genderChip, { borderColor: active ? Ping.purple : c.border, backgroundColor: active ? `${Ping.purple}22` : c.card, flex: 1 }]}
                          onPress={() => setGender(active ? '' : key)} activeOpacity={0.8}
                        >
                          <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? Ping.purpleLight : c.textSecondary }}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
            <Field label="City / Hometown" value={city} onChangeText={setCity} placeholder="Where do you live? Actually live." autoCapitalize="words" c={c} />
            <Field label="College / Institute" value={institute} onChangeText={setInstitute} placeholder="School, college, work — whatever applies." autoCapitalize="words" c={c} />
          </AccordionSection>

          {/* ── Social Links ── */}
          <AccordionSection
            sectionKey="social" openSection={openSection} onToggle={toggle}
            icon="logo-instagram" iconColor="#E1306C"
            title="Social Links"
            summary={[email.trim(), instagramHandle.trim() ? `@${instagramHandle}` : ''].filter(Boolean).join(' · ') || 'Email & Instagram'}
            hasValue={!!(email.trim() || instagramHandle.trim())}
            c={c}
          >
            <Field label="Email (optional)" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" c={c} />
            <View style={fi.wrap}>
              <Text style={[fi.label, { color: c.textSecondary }]}>Instagram</Text>
              <View style={[s.instaWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={{ ...Typography.bodyMed, marginRight: 2, color: c.icon }}>@</Text>
                <TextInput
                  style={[s.instaInput, { color: c.text }]}
                  value={instagramHandle} onChangeText={(t) => setInstagramHandle(t.replace(/^@/, ''))}
                  placeholder="your_handle (no @ needed)" placeholderTextColor={c.icon}
                  autoCapitalize="none" autoCorrect={false}
                />
              </View>
            </View>
          </AccordionSection>

          {/* ── Hobbies ── */}
          <AccordionSection
            sectionKey="hobbies" openSection={openSection} onToggle={toggle}
            icon="heart-outline" iconColor="#EF4444"
            title="Hobbies & Interests"
            summary={hobbies.length > 0
              ? `${hobbies.slice(0, 3).join(', ')}${hobbies.length > 3 ? ` +${hobbies.length - 3} more` : ''}`
              : 'None selected yet'}
            hasValue={hobbies.length > 0}
            c={c}
          >
            <View style={s.chipGrid}>
              {HOBBY_OPTIONS.map((h) => {
                const active = hobbies.includes(h);
                return (
                  <TouchableOpacity
                    key={h}
                    style={[s.hobbyChip, { borderColor: active ? Ping.purple : c.border, backgroundColor: active ? `${Ping.purple}22` : c.card }]}
                    onPress={() => toggleHobby(h)} activeOpacity={0.75}
                  >
                    <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? Ping.purpleLight : c.textSecondary }}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>

          {/* ── Vibe Preferences ── */}
          <AccordionSection
            sectionKey="vibes" openSection={openSection} onToggle={toggle}
            icon="sparkles-outline" iconColor="#8B5CF6"
            title="Vibe Preferences"
            summary={vibePreferences.length > 0
              ? `${vibePreferences.slice(0, 3).join(', ')}${vibePreferences.length > 3 ? ` +${vibePreferences.length - 3}` : ''}`
              : 'What energy do you bring?'}
            hasValue={vibePreferences.length > 0}
            c={c}
          >
            <View style={s.chipGrid}>
              {VIBE_OPTIONS.map((v) => {
                const active = vibePreferences.includes(v.key);
                return (
                  <TouchableOpacity
                    key={v.key}
                    style={[s.iconChip, { borderColor: active ? v.color : c.border, backgroundColor: active ? `${v.color}1A` : c.card }]}
                    onPress={() => toggleVibe(v.key)} activeOpacity={0.75}
                  >
                    <Ionicons name={v.icon} size={13} color={active ? v.color : c.icon} />
                    <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? v.color : c.textSecondary }}>{v.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>

          {/* ── Favourite Activities ── */}
          <AccordionSection
            sectionKey="activities" openSection={openSection} onToggle={toggle}
            icon="bicycle-outline" iconColor="#F97316"
            title="Favourite Activities"
            summary={favoriteActivities.length > 0
              ? `${favoriteActivities.slice(0, 3).join(', ')}${favoriteActivities.length > 3 ? ` +${favoriteActivities.length - 3}` : ''}`
              : 'What do you love doing?'}
            hasValue={favoriteActivities.length > 0}
            c={c}
          >
            <View style={s.chipGrid}>
              {ACTIVITY_OPTIONS.map((a) => {
                const active = favoriteActivities.includes(a);
                return (
                  <TouchableOpacity
                    key={a}
                    style={[s.hobbyChip, { borderColor: active ? '#F97316' : c.border, backgroundColor: active ? 'rgba(249,115,22,0.15)' : c.card }]}
                    onPress={() => toggleActivity(a)} activeOpacity={0.75}
                  >
                    <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? '#FB923C' : c.textSecondary }}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>

          {/* ── Your Vibe & Style ── */}
          <AccordionSection
            sectionKey="personality" openSection={openSection} onToggle={toggle}
            icon="color-palette-outline" iconColor="#A78BFA"
            title="Your Vibe & Style"
            summary={vibeCount > 0 ? `${vibeCount} of 8 filled in` : 'Personality, schedule & intent'}
            hasValue={vibeCount > 0}
            c={c}
          >
            <View style={fi.wrap}>
              <SubLabel text="Sleep type" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'night_owl',  label: 'Night owl',  icon: 'moon-outline' as IoniconsName,   color: '#6366F1' },
                  { key: 'early_bird', label: 'Early bird', icon: 'sunny-outline' as IoniconsName,  color: '#F59E0B' },
                ]).map(({ key, label, icon, color }) => {
                  const active = sleepType === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setSleepType(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Spontaneity" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'planner',     label: 'Plans ahead',  icon: 'calendar-outline' as IoniconsName, color: '#3B82F6' },
                  { key: 'spontaneous', label: "Let's go NOW", icon: 'flash-outline' as IoniconsName,    color: '#F59E0B' },
                ]).map(({ key, label, icon, color }) => {
                  const active = spontaneity === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setSpontaneity(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Food personality" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'street_food',    label: 'Street food first', icon: 'fast-food-outline' as IoniconsName,  color: '#F97316' },
                  { key: 'balanced',       label: 'Balanced',          icon: 'nutrition-outline' as IoniconsName,  color: '#22C55E' },
                  { key: 'cafe_aesthetic', label: 'Café aesthetic',     icon: 'cafe-outline' as IoniconsName,       color: '#D97706' },
                ]).map(({ key, label, icon, color }) => {
                  const active = foodPersonality === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setFoodPersonality(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Time respect" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'always_early',     label: 'Always early',   icon: 'alarm-outline' as IoniconsName,            color: '#10B981' },
                  { key: 'on_time',          label: 'On time',        icon: 'checkmark-circle-outline' as IoniconsName,  color: '#22C55E' },
                  { key: 'fashionably_late', label: '5 min = 20 min', icon: 'hourglass-outline' as IoniconsName,         color: '#EF4444' },
                ]).map(({ key, label, icon, color }) => {
                  const active = timeRespect === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setTimeRespect(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Distance tolerance" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'nearby',                  label: 'Nearby only',           icon: 'location-outline' as IoniconsName,  color: '#A78BFA' },
                  { key: 'up_to_5km',               label: 'Up to 5 km',            icon: 'walk-outline' as IoniconsName,      color: '#3B82F6' },
                  { key: 'travel_for_good_plans',   label: 'Travel for good plans', icon: 'airplane-outline' as IoniconsName,  color: '#F59E0B' },
                ]).map(({ key, label, icon, color }) => {
                  const active = distanceTolerance === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setDistanceTolerance(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Availability" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'weekends_only',   label: 'Weekends only',   icon: 'calendar-outline' as IoniconsName, color: '#8B5CF6' },
                  { key: 'evenings_mostly', label: 'Evenings mostly', icon: 'moon-outline' as IoniconsName,     color: '#6366F1' },
                  { key: 'random_anytime',  label: 'Random anytime',  icon: 'flash-outline' as IoniconsName,    color: '#F59E0B' },
                ]).map(({ key, label, icon, color }) => {
                  const active = availabilityPattern === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setAvailabilityPattern(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Intent" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'just_hanging',      label: 'Just hanging out',  icon: 'cafe-outline' as IoniconsName,      color: '#10B981' },
                  { key: 'activity_partner',  label: 'Activity partner',  icon: 'bicycle-outline' as IoniconsName,   color: '#F97316' },
                  { key: 'trying_new_places', label: 'Trying new places', icon: 'map-outline' as IoniconsName,       color: '#3B82F6' },
                  { key: 'networking',        label: 'Networking',        icon: 'briefcase-outline' as IoniconsName, color: '#8B5CF6' },
                ]).map(({ key, label, icon, color }) => {
                  const active = intentSync === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setIntentSync(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={fi.wrap}>
              <SubLabel text="Hangout energy" c={c} />
              <View style={[s.chipGrid, { marginTop: 6 }]}>
                {([
                  { key: 'extrovert', label: 'Extrovert', icon: 'megaphone-outline' as IoniconsName,       color: '#EC4899' },
                  { key: 'introvert', label: 'Introvert', icon: 'headset-outline' as IoniconsName,         color: '#8B5CF6' },
                  { key: 'ambivert',  label: 'Ambivert',  icon: 'swap-horizontal-outline' as IoniconsName, color: '#A78BFA' },
                ]).map(({ key, label, icon, color }) => {
                  const active = socialPreference === key;
                  return (
                    <TouchableOpacity key={key} style={[s.iconChip, { borderColor: active ? color : c.border, backgroundColor: active ? `${color}1A` : c.card }]} onPress={() => setSocialPreference(active ? '' : key as any)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={13} color={active ? color : c.icon} />
                      <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? color : c.textSecondary }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </AccordionSection>

          {/* ── Ping Pitch & Fun Truth ── */}
          <AccordionSection
            sectionKey="pitch" openSection={openSection} onToggle={toggle}
            icon="magnet-outline" iconColor={Ping.purpleLight}
            title="Ping Pitch & Fun Truth"
            summary={pingPitch.trim()
              ? pingPitch.trim().slice(0, 45) + (pingPitch.length > 45 ? '…' : '')
              : 'Why should people ping you?'}
            hasValue={!!(pingPitch.trim() || funTruth.trim())}
            c={c}
          >
            <View style={fi.wrap}>
              <SubLabel text="Why people should ping you" c={c} />
              <Text style={[s.pitchHint, { color: c.textSecondary }]}>Your conversion line. Make it stick.</Text>
            </View>

            <View style={{ gap: 8 }}>
              {PITCH_PRESETS.map((preset) => {
                const active = pingPitch === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[s.presetChip, { borderColor: active ? Ping.purple : c.border, backgroundColor: active ? `${Ping.purple}18` : c.card }]}
                    onPress={() => setPingPitch(active ? '' : preset)}
                    activeOpacity={0.75}
                  >
                    {active && <Ionicons name="checkmark-circle" size={14} color={Ping.purpleLight} />}
                    <Text style={[s.presetText, { color: active ? Ping.purpleLight : c.textSecondary }]}>{preset}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[s.orDivider, { color: c.icon }]}>— or write your own —</Text>

            <View>
              <TextInput
                style={[fi.input, fi.inputMulti, { color: c.text, backgroundColor: c.card, borderColor: pingPitch && !PITCH_PRESETS.includes(pingPitch) ? Ping.purple : c.border }]}
                value={pingPitch}
                onChangeText={(t) => setPingPitch(t.slice(0, 120))}
                placeholder={`"Because I make boring plans fun"`}
                placeholderTextColor={placeholderColor}
                multiline autoCapitalize="sentences" autoCorrect={false}
              />
              <Text style={[s.charCount, { color: c.icon }]}>{pingPitch.length}/120</Text>
            </View>

            <View style={[s.divider, { backgroundColor: c.border }]} />

            <View style={fi.wrap}>
              <SubLabel text="A fun truth about you" c={c} />
              <TextInput
                style={[fi.input, fi.inputMulti, { color: c.text, backgroundColor: c.card, borderColor: c.border, marginTop: 6 }]}
                value={funTruth}
                onChangeText={(t) => setFunTruth(t.slice(0, 120))}
                placeholder="Something true but sounds fake. Go."
                placeholderTextColor={placeholderColor}
                multiline autoCapitalize="sentences" autoCorrect={false}
              />
              <Text style={[s.charCount, { color: c.icon }]}>{funTruth.length}/120</Text>
            </View>
          </AccordionSection>

          {/* ── Past Activity ── */}
          <AccordionSection
            sectionKey="past" openSection={openSection} onToggle={toggle}
            icon="time-outline" iconColor="#64748B"
            title="Past Activity"
            summary="Your ping history"
            c={c}
          >
            <PastPingsPreview c={c} />
          </AccordionSection>

          {/* Save button */}
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveBtnText}>Save changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3 },
  saveChip: { backgroundColor: Ping.purple, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8, minWidth: 64, alignItems: 'center' },
  saveChipText: { ...Typography.bodySm, color: '#FFF', fontWeight: '700' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  genderRow: { flexDirection: 'row', gap: 6 },
  genderChip: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: Radius.md, borderWidth: 1.5 },
  instaWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 48 },
  instaInput: { flex: 1, ...Typography.bodyMed },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hobbyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5 },
  iconChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5 },
  presetChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5 },
  presetText: { ...Typography.bodySm, fontWeight: '500', flex: 1, lineHeight: 18 },
  orDivider: { ...Typography.caption, textAlign: 'center' },
  pitchHint: { ...Typography.caption, marginTop: 2 },
  charCount: { ...Typography.caption, textAlign: 'right', marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  saveBtn: {
    backgroundColor: Ping.purple, borderRadius: Radius.md, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Ping.purple, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  saveBtnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '600' },
});
