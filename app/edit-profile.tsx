import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, Animated, LayoutAnimation, UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import FadeInItem from '@/components/FadeInItem';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi, activitiesApi, uploadApi, type Activity } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type SectionKey = 'basic' | 'personal' | 'social' | 'hobbies' | 'personality' | 'pitch' | 'past';
type CompletionSection = SectionKey | 'photos';

const GENDERS = [
  { key: 'male',   label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other',  label: 'Prefer not to say' },
] as const;

const HOBBY_OPTIONS = [
  'Music', 'Sports', 'Gaming', 'Travel', 'Food', 'Art',
  'Reading', 'Movies', 'Fitness', 'Photography', 'Dance', 'Coding',
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

// ── Profile completion checklist (mirrors backend User.profileCompletion) ─────
type CompletionItem = {
  key: string;
  label: string;
  hint: string;
  section: CompletionSection;
  done: boolean;
};

function completionStory(pct: number, remaining: number, nextLabel?: string): { headline: string; sub: string } {
  if (pct >= 100) return { headline: 'Profile looking sharp', sub: 'You unlocked the full vibe — go explore.' };
  if (pct >= 80) return { headline: 'Final stretch', sub: nextLabel ? `Next up: ${nextLabel}` : `${remaining} left — almost ready.` };
  if (pct >= 60) return { headline: 'You’re taking shape', sub: nextLabel ? `Next up: ${nextLabel}` : `${remaining} more to feel complete.` };
  if (pct >= 40) return { headline: 'Nice momentum', sub: nextLabel ? `Keep going — ${nextLabel}` : 'Keep stacking the details that matter.' };
  if (pct >= 20) return { headline: 'Good start', sub: nextLabel ? `Next: ${nextLabel}` : 'A few more beats and your story lands.' };
  return { headline: 'Build your story', sub: nextLabel ? `Start with: ${nextLabel}` : 'Tap to see what’s still empty.' };
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function CompletionBar({
  items,
  c,
  onJump,
}: {
  items: CompletionItem[];
  c: (typeof Colors)['dark'];
  onJump: (section: CompletionSection, itemKey: string) => void;
}) {
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const remaining = items.filter((i) => !i.done);
  const nextItem = remaining[0];
  const story = completionStory(pct, remaining.length, nextItem?.label);

  const [expanded, setExpanded] = useState(false);
  const fillAnim = useRef(new Animated.Value(pct)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const countAnim = useRef(new Animated.Value(pct)).current;
  const [displayPct, setDisplayPct] = useState(pct);
  const prevPct = useRef(pct);

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: pct,
      damping: 18,
      stiffness: 120,
      mass: 0.8,
      useNativeDriver: false,
    }).start();

    const id = countAnim.addListener(({ value }) => setDisplayPct(Math.round(value)));
    Animated.timing(countAnim, {
      toValue: pct,
      duration: 420,
      useNativeDriver: false,
    }).start();
    return () => countAnim.removeListener(id);
  }, [pct, fillAnim, countAnim]);

  useEffect(() => {
    if (pct > prevPct.current) {
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.14, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      ]).start();
    }
    prevPct.current = pct;
  }, [pct, pulse]);

  if (pct >= 100 && !expanded) return null;

  const color = pct >= 80 ? Ping.green : pct >= 50 ? Ping.orange : Ping.purpleLight;
  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  function toggleExpand() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  function jump(item: CompletionItem) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(false);
    onJump(item.section, item.key);
  }

  return (
    <View style={[cb.wrap, { backgroundColor: c.surface, borderColor: expanded ? `${color}55` : c.border }]}>
      <TouchableOpacity activeOpacity={0.88} onPress={toggleExpand}>
        <View style={cb.row}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Ionicons
              name={pct >= 80 ? 'shield-checkmark-outline' : 'shield-half-outline'}
              size={20}
              color={color}
            />
          </Animated.View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[cb.label, { color: c.text }]}>
              {displayPct}% · {story.headline}
            </Text>
            <Text style={[cb.hint, { color: c.textSecondary }]} numberOfLines={2}>
              {expanded
                ? (remaining.length ? `${remaining.length} left — tap a step to jump there` : 'Everything filled in')
                : story.sub}
            </Text>
          </View>
          <View style={[cb.badge, { backgroundColor: `${color}22` }]}>
            <Text style={[cb.badgeText, { color }]}>
              {doneCount}/{items.length}
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.icon} />
        </View>

        <View style={[cb.track, { backgroundColor: c.border, marginTop: 10 }]}>
          <Animated.View style={[cb.fill, { width: fillWidth, backgroundColor: color }]} />
        </View>
      </TouchableOpacity>

      {nextItem && !expanded && (
        <TouchableOpacity
          style={[cb.nextBtn, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}
          onPress={() => jump(nextItem)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={[cb.nextEyebrow, { color }]}>Continue</Text>
            <Text style={[cb.nextLabel, { color: c.text }]} numberOfLines={1}>{nextItem.label}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={color} />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={cb.list}>
          {remaining.map((item, idx) => (
            <FadeInItem key={`${expanded}-${item.key}`} delay={idx * 50} distance={12}>
              <TouchableOpacity
                style={[cb.item, { borderColor: c.border, backgroundColor: c.card }]}
                activeOpacity={0.8}
                onPress={() => jump(item)}
              >
                <View style={[cb.step, { backgroundColor: `${color}20` }]}>
                  <Text style={[cb.stepText, { color }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[cb.itemTitle, { color: c.text }]}>{item.label}</Text>
                  <Text style={[cb.itemHint, { color: c.textSecondary }]}>{item.hint}</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={c.icon} />
              </TouchableOpacity>
            </FadeInItem>
          ))}
          {remaining.length === 0 && (
            <Text style={[cb.footerNote, { color: Ping.green }]}>All steps complete</Text>
          )}
          {remaining.length > 0 && (
            <Text style={[cb.footerNote, { color: c.textSecondary }]}>
              {doneCount} done · each step fills your story
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
const cb = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { ...Typography.bodyMed, fontWeight: '700' },
  hint: { ...Typography.caption, lineHeight: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  badgeText: { ...Typography.caption, fontWeight: '700', fontSize: 11 },
  track: { height: 6, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nextEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  nextLabel: { fontSize: 14, fontWeight: '600' },
  list: { gap: 8, marginTop: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 12, fontWeight: '800' },
  itemTitle: { ...Typography.bodySm, fontWeight: '600' },
  itemHint: { ...Typography.caption, marginTop: 2 },
  footerNote: { ...Typography.caption, textAlign: 'center', marginTop: 2 },
});

// ── Photos section ────────────────────────────────────────────────────────────
// 3 per row using percentage: 3 × 31% = 93% of container + 2 × 8px gaps fits any screen width ≥ 228px

function PhotosSection({
  c,
  highlighted,
  onLayout,
}: {
  c: (typeof Colors)['dark'];
  highlighted?: boolean;
  onLayout?: (y: number) => void;
}) {
  const { user, setUser } = useAuthStore();
  const [uploading, setUploading] = useState<number | null>(null);
  const [gridW, setGridW] = useState(0);
  const [photoMenuIdx, setPhotoMenuIdx] = useState<number | null>(null);
  const slotSize = gridW > 0 ? Math.floor((gridW - 16) / 3) : 0;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!highlighted) {
      glow.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0.35, duration: 280, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start();
  }, [highlighted, glow]);

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [c.border, `${Ping.purpleLight}AA`],
  });
  const bgTint = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [c.surface, `${Ping.purple}14`],
  });

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
    <Animated.View
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
      style={[ph.wrap, { backgroundColor: bgTint, borderColor }]}
    >
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
    </Animated.View>
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
  sectionKey, openSection, onToggle, icon, iconColor, title, summary, hasValue, children, c, highlighted, onLayout,
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
  highlighted?: boolean;
  onLayout?: (y: number) => void;
}) {
  const isOpen = openSection === sectionKey;
  const accent = isOpen || highlighted ? c.tint : c.icon;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!highlighted) {
      glow.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0.35, duration: 280, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start();
  }, [highlighted, glow]);

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [c.border, `${Ping.purpleLight}AA`],
  });
  const bgTint = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [c.surface, `${Ping.purple}14`],
  });

  return (
    <Animated.View
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
      style={[ac.wrap, { backgroundColor: bgTint, borderColor }]}
    >
      <TouchableOpacity style={ac.header} onPress={() => onToggle(sectionKey)} activeOpacity={0.75}>
        <View style={[ac.iconWrap, { backgroundColor: c.card }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ac.title, { color: c.text }]}>{title}</Text>
          {summary ? (
            <Text style={[ac.summary, { color: hasValue ? c.textSecondary : c.icon }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        {hasValue && !isOpen && <View style={[ac.dot, { backgroundColor: c.tint }]} />}
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={c.icon} />
      </TouchableOpacity>
      {isOpen && (
        <View style={[ac.body, { borderTopColor: c.border }]}>
          {children}
        </View>
      )}
    </Animated.View>
  );
}
const ac = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { ...Typography.bodyMed, fontWeight: '600' },
  summary: { ...Typography.caption, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4, flexShrink: 0 },
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
  const [highlightSection, setHighlightSection] = useState<CompletionSection | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionYs = useRef<Partial<Record<CompletionSection, number>>>({});

  const [displayName, setDisplayName]           = useState(user?.displayName ?? '');
  const [username, setUsername]                 = useState(user?.username ?? '');
  const [bio, setBio]                           = useState(user?.bio ?? '');
  const [email, setEmail]                       = useState(user?.email ?? '');
  const [gender, setGender]                     = useState<'male' | 'female' | 'other' | ''>(user?.gender ?? '');
  const [dobInput, setDobInput]                 = useState(formatDobToDisplay(user?.dob));
  const [city, setCity]                         = useState(user?.city ?? '');
  const [institute, setInstitute]               = useState(user?.institute ?? '');
  const [hobbies, setHobbies]                   = useState<string[]>(user?.hobbies ?? []);
  const [favoriteActivities, setFavoriteActivities] = useState<string[]>(user?.favoriteActivities ?? []);
  const [socialPreference, setSocialPreference] = useState<'introvert' | 'extrovert' | 'ambivert' | ''>(user?.socialPreference ?? '');
  const [instagramHandle, setInstagramHandle]   = useState(user?.instagramHandle ?? '');
  const [linkedinHandle, setLinkedinHandle]     = useState(user?.linkedinHandle ?? '');
  const [spotifyHandle, setSpotifyHandle]       = useState(user?.spotifyHandle ?? '');
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
  function toggleActivity(a: string) {
    setFavoriteActivities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function save() {
    const payload: Record<string, any> = {};
    if (displayName.trim()) payload.displayName = displayName.trim();
    if (username.trim()) payload.username = username.trim();
    payload.bio = bio.trim();
    if (email.trim()) payload.email = email.trim();
    else payload.email = '';
    if (gender) payload.gender = gender;
    else payload.gender = null;
    payload.city = city.trim();
    payload.institute = institute.trim();
    payload.hobbies = hobbies;
    payload.favoriteActivities = favoriteActivities;
    payload.socialPreference = socialPreference || null;
    payload.instagramHandle = instagramHandle.trim().replace(/^@/, '');
    payload.linkedinHandle = linkedinHandle.trim().replace(/^@/, '');
    payload.spotifyHandle = spotifyHandle.trim().replace(/^@/, '');
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

  const completionItems: CompletionItem[] = useMemo(() => {
    const hasPhoto = !!(user?.avatarUrl || (user?.photos?.length ?? 0) > 0);
    const hasSocial = !!(instagramHandle.trim() || linkedinHandle.trim() || spotifyHandle.trim());
    const hasInterests = hobbies.length > 0 || favoriteActivities.length > 0;
    return [
      { key: 'photo', label: 'Add a photo', hint: 'First impression — at least one shot', section: 'photos', done: hasPhoto },
      { key: 'name', label: 'Display name', hint: 'What should people call you?', section: 'basic', done: !!displayName.trim() },
      { key: 'username', label: 'Username', hint: 'Your unique @handle', section: 'basic', done: !!username.trim() },
      { key: 'bio', label: 'Write a bio', hint: 'One line that feels like you', section: 'basic', done: !!bio.trim() },
      { key: 'dob', label: 'Date of birth', hint: 'Helps keep the vibe age-right', section: 'personal', done: !!dobInput.trim() },
      { key: 'gender', label: 'Gender', hint: 'Optional — your call', section: 'personal', done: !!gender },
      { key: 'city', label: 'Current city', hint: 'Where you hang out now', section: 'personal', done: !!city.trim() },
      { key: 'email', label: 'Email', hint: 'For account & updates', section: 'personal', done: !!email.trim() },
      { key: 'interests', label: 'Hobbies or activities', hint: 'Pick a few you actually do', section: 'hobbies', done: hasInterests },
      { key: 'social', label: 'A social link', hint: 'Instagram, LinkedIn, or Spotify', section: 'social', done: hasSocial },
    ];
  }, [
    user?.avatarUrl, user?.photos, displayName, username, bio, dobInput, gender, city, email,
    hobbies, favoriteActivities, instagramHandle, linkedinHandle, spotifyHandle,
  ]);

  function jumpToCompletion(section: CompletionSection, _itemKey: string) {
    if (section !== 'photos') {
      setOpenSection(section);
    }
    setHighlightSection(section);

    // Wait a beat so accordion opens / layout settles, then scroll
    requestAnimationFrame(() => {
      setTimeout(() => {
        const y = sectionYs.current[section] ?? 0;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }, section === 'photos' ? 80 : 220);
    });

    setTimeout(() => setHighlightSection(null), 1600);
  }

  function rememberY(section: CompletionSection) {
    return (y: number) => {
      sectionYs.current[section] = y;
    };
  }

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
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <CompletionBar items={completionItems} c={c} onJump={jumpToCompletion} />

          {/* Photos — always visible card */}
          <PhotosSection
            c={c}
            highlighted={highlightSection === 'photos'}
            onLayout={rememberY('photos')}
          />

          {/* ── Basic Info ── */}
          <AccordionSection
            sectionKey="basic" openSection={openSection} onToggle={toggle}
            icon="person-outline" iconColor={Ping.purpleLight}
            title="Basic Info"
            summary={displayName.trim() ? `${displayName.trim()}${bio.trim() ? ' · has bio' : ''}` : 'Name, username & bio'}
            hasValue={!!(displayName.trim() || bio.trim())}
            c={c}
            highlighted={highlightSection === 'basic'}
            onLayout={rememberY('basic')}
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
              [
                gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender === 'other' ? 'Prefer not to say' : '',
                city.trim(),
                email.trim(),
              ].filter(Boolean).join(' · ') || 'DOB, gender, city & email'
            }
            hasValue={!!(gender || city.trim() || dobInput.trim() || email.trim())}
            c={c}
            highlighted={highlightSection === 'personal'}
            onLayout={rememberY('personal')}
          >
            <Field label="Date of birth" value={dobInput} onChangeText={setDobInput} placeholder="DD/MM/YYYY" autoCapitalize="none" c={c} />

            <View style={fi.wrap}>
              <Text style={[fi.label, { color: c.textSecondary }]}>Gender</Text>
              <View style={s.genderRow}>
                {GENDERS.map(({ key, label }) => {
                  const active = gender === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[s.genderChip, { borderColor: active ? Ping.purple : c.border, backgroundColor: active ? `${Ping.purple}22` : c.card }]}
                      onPress={() => setGender(active ? '' : key)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={{
                          ...Typography.bodySm,
                          fontWeight: '600',
                          fontSize: key === 'other' ? 11 : 13,
                          color: active ? Ping.purpleLight : c.textSecondary,
                          textAlign: 'center',
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Field
              label="Current city"
              value={city}
              onChangeText={setCity}
              placeholder="Where do you live right now?"
              autoCapitalize="words"
              c={c}
            />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" c={c} />
            <Field label="College / Institute" value={institute} onChangeText={setInstitute} placeholder="School, college, work — whatever applies." autoCapitalize="words" c={c} />
          </AccordionSection>

          {/* ── Social Links ── */}
          <AccordionSection
            sectionKey="social" openSection={openSection} onToggle={toggle}
            icon="share-social-outline" iconColor="#E1306C"
            title="Social Links"
            summary={
              [
                instagramHandle.trim() ? `IG @${instagramHandle}` : '',
                linkedinHandle.trim() ? 'LinkedIn' : '',
                spotifyHandle.trim() ? 'Spotify' : '',
              ].filter(Boolean).join(' · ') || 'Instagram, LinkedIn & Spotify'
            }
            hasValue={!!(instagramHandle.trim() || linkedinHandle.trim() || spotifyHandle.trim())}
            c={c}
            highlighted={highlightSection === 'social'}
            onLayout={rememberY('social')}
          >
            <View style={fi.wrap}>
              <Text style={[fi.label, { color: c.textSecondary }]}>Instagram</Text>
              <View style={[s.instaWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="logo-instagram" size={16} color="#E1306C" style={{ marginRight: 6 }} />
                <Text style={{ ...Typography.bodyMed, marginRight: 2, color: c.icon }}>@</Text>
                <TextInput
                  style={[s.instaInput, { color: c.text }]}
                  value={instagramHandle}
                  onChangeText={(t) => setInstagramHandle(t.replace(/^@/, ''))}
                  placeholder="your_handle"
                  placeholderTextColor={c.icon}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={fi.wrap}>
              <Text style={[fi.label, { color: c.textSecondary }]}>LinkedIn</Text>
              <View style={[s.instaWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="logo-linkedin" size={16} color="#0A66C2" style={{ marginRight: 6 }} />
                <TextInput
                  style={[s.instaInput, { color: c.text }]}
                  value={linkedinHandle}
                  onChangeText={(t) => setLinkedinHandle(t.replace(/^@/, '').replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/i, ''))}
                  placeholder="profile-slug or username"
                  placeholderTextColor={c.icon}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={fi.wrap}>
              <Text style={[fi.label, { color: c.textSecondary }]}>Spotify</Text>
              <View style={[s.instaWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="musical-notes" size={16} color="#1DB954" style={{ marginRight: 6 }} />
                <TextInput
                  style={[s.instaInput, { color: c.text }]}
                  value={spotifyHandle}
                  onChangeText={(t) => setSpotifyHandle(t.replace(/^@/, '').replace(/^https?:\/\/open\.spotify\.com\/user\//i, ''))}
                  placeholder="username"
                  placeholderTextColor={c.icon}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </AccordionSection>

          {/* ── Interests ── */}
          <AccordionSection
            sectionKey="hobbies" openSection={openSection} onToggle={toggle}
            icon="heart-outline" iconColor={c.tint}
            title="Interests"
            summary={
              [...hobbies, ...favoriteActivities].length > 0
                ? `${[...hobbies, ...favoriteActivities].slice(0, 3).join(', ')}${[...hobbies, ...favoriteActivities].length > 3 ? '…' : ''}`
                : 'Hobbies & activities'
            }
            hasValue={hobbies.length > 0 || favoriteActivities.length > 0}
            c={c}
            highlighted={highlightSection === 'hobbies'}
            onLayout={rememberY('hobbies')}
          >
            <SubLabel text="Hobbies" c={c} />
            <View style={s.chipGrid}>
              {HOBBY_OPTIONS.map((h) => {
                const active = hobbies.includes(h);
                return (
                  <TouchableOpacity
                    key={h}
                    style={[s.hobbyChip, { borderColor: active ? c.tint : c.border, backgroundColor: active ? `${Ping.purple}18` : c.card }]}
                    onPress={() => toggleHobby(h)} activeOpacity={0.75}
                  >
                    <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? c.tint : c.textSecondary }}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <SubLabel text="Activities" c={c} />
            <View style={s.chipGrid}>
              {ACTIVITY_OPTIONS.map((a) => {
                const active = favoriteActivities.includes(a);
                return (
                  <TouchableOpacity
                    key={a}
                    style={[s.hobbyChip, { borderColor: active ? c.tint : c.border, backgroundColor: active ? `${Ping.purple}18` : c.card }]}
                    onPress={() => toggleActivity(a)} activeOpacity={0.75}
                  >
                    <Text style={{ ...Typography.bodySm, fontWeight: '600', color: active ? c.tint : c.textSecondary }}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>

          {/* ── More about you ── */}
          <AccordionSection
            sectionKey="personality" openSection={openSection} onToggle={toggle}
            icon="sparkles-outline" iconColor={c.tint}
            title="More about you"
            summary={vibeCount > 0 ? `${vibeCount} of 8 filled in` : 'Optional lifestyle prefs'}
            hasValue={vibeCount > 0}
            c={c}
            highlighted={highlightSection === 'personality'}
            onLayout={rememberY('personality')}
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
            highlighted={highlightSection === 'pitch'}
            onLayout={rememberY('pitch')}
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
            highlighted={highlightSection === 'past'}
            onLayout={rememberY('past')}
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
