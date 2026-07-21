import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usersApi, uploadApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing } from '@/constants/theme';

// Light premium palette
const BG     = '#FFFFFF';
const TEXT   = '#1C1040';
const MUTED  = '#7B6DAA';
const DIM    = '#B8AECE';
const PURPLE = Ping.purple;
const SURF   = '#F7F5FF';
const BORDER = 'rgba(124,58,237,0.14)';

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

const GENDERS = [
  { key: 'male',   label: 'Male'   },
  { key: 'female', label: 'Female' },
  { key: 'other',  label: 'Other'  },
] as const;

const OCCUPATIONS = [
  { key: 'job',        label: 'Job'        },
  { key: 'student',    label: 'Student'    },
  { key: 'founder',    label: 'Founder'    },
  { key: 'business',   label: 'Business'   },
  { key: 'freelancer', label: 'Freelancer' },
  { key: 'exploring',  label: 'Exploring'  },
] as const;

const INTERESTS = [
  { label: 'Aviation',      emoji: '✈️' }, { label: 'Art',           emoji: '🎨' },
  { label: 'Crypto',        emoji: '🪙' }, { label: 'Baking',        emoji: '🥐' },
  { label: 'Botany',        emoji: '🌿' }, { label: 'Cars',          emoji: '🚗' },
  { label: 'Real Estate',   emoji: '🏠' }, { label: 'Technology',    emoji: '💻' },
  { label: 'Fashion',       emoji: '👗' }, { label: 'Dogs',          emoji: '🐕' },
  { label: 'Birds',         emoji: '🐦' }, { label: 'Health care',   emoji: '🏥' },
  { label: 'Geography',     emoji: '🗺️' }, { label: 'Finance',       emoji: '💵' },
  { label: 'Cats',          emoji: '🐈' }, { label: 'LGBTQ',         emoji: '🏳️‍🌈' },
  { label: 'Mental Health', emoji: '🧠' }, { label: 'Programming',   emoji: '⌨️' },
  { label: 'Cinema',        emoji: '🎬' }, { label: 'Sports',        emoji: '🏀' },
  { label: 'Travel',        emoji: '✈️' }, { label: 'Gaming',        emoji: '🎮' },
  { label: 'Photography',   emoji: '📷' }, { label: 'Design',        emoji: '✏️' },
  { label: 'UFO',           emoji: '🛸' }, { label: 'Music',         emoji: '🎵' },
  { label: 'Food',          emoji: '🍕' }, { label: 'Fitness',       emoji: '💪' },
  { label: 'Coffee',        emoji: '☕' }, { label: 'Yoga',          emoji: '🧘' },
  { label: 'Cooking',       emoji: '👨‍🍳' }, { label: 'Reading',       emoji: '📚' },
  { label: 'Dancing',       emoji: '💃' }, { label: 'Anime',         emoji: '🎌' },
];

// ── Progress dots ─────────────────────────────────────────────────────────────
function StepDots({ step }: { step: number }) {
  return (
    <View style={pd.row}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            pd.dot,
            n < step  && pd.dotDone,
            n === step && pd.dotActive,
          ]}
        />
      ))}
    </View>
  );
}
const pd = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(124,58,237,0.14)' },
  dotDone:   { backgroundColor: 'rgba(124,58,237,0.4)' },
  dotActive: { width: 24, borderRadius: 4, backgroundColor: PURPLE },
});

// ── Shared section label ──────────────────────────────────────────────────────
function FieldLabel({ text }: { text: string }) {
  return <Text style={s.label}>{text}</Text>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SetupScreen() {
  const insets    = useSafeAreaInsets();
  const [step, setStep] = useState(1);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');
  const [gender, setGender]           = useState<'male'|'female'|'other'|''>('');
  const [dobDay, setDobDay]           = useState('');
  const [dobMonth, setDobMonth]       = useState('');
  const [dobYear, setDobYear]         = useState('');
  const [email, setEmail]             = useState('');
  const [occupation, setOccupation]   = useState('');
  const [hobbies, setHobbies]         = useState<string[]>([]);
  const [photos, setPhotos]           = useState<string[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [loading, setLoading]         = useState(false);

  const router     = useRouter();
  const { setUser} = useAuthStore();

  function onNameChange(v: string) {
    setDisplayName(v);
    if (!username || username === slugify(displayName)) setUsername(slugify(v));
  }

  function toggleHobby(label: string) {
    setHobbies((p) => p.includes(label) ? p.filter((x) => x !== label) : [...p, label]);
  }

  async function pickPhoto() {
    if (photos.length >= 2) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Toast.show({ type: 'info', text1: 'Permission needed', text2: 'Allow photo access.' }); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 5],
    });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadApi.uploadImage(res.assets[0].uri, 'avatars');
      setPhotos((p) => [...p, url]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: e.message || 'Could not upload photo.' });
    } finally { setUploading(false); }
  }

  function removePhoto(idx: number) { setPhotos((p) => p.filter((_, i) => i !== idx)); }

  async function handleFinish() {
    if (photos.length === 0) { Toast.show({ type: 'error', text1: 'Photo required', text2: 'Add at least one photo.' }); return; }
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        displayName: displayName.trim(),
        hobbies,
        avatarUrl: photos[0],
        photos: photos.slice(1),
      };
      if (username.trim()) payload.username = username.trim().toLowerCase();
      if (gender)          payload.gender   = gender;
      if (occupation)      payload.occupation = occupation;
      payload.email = email.trim();
      if (dobDay && dobMonth && dobYear) {
        const dd = Number(dobDay), mm = Number(dobMonth), yyyy = Number(dobYear);
        if (dd && mm && yyyy && yyyy >= 1900 && yyyy <= new Date().getFullYear()) {
          const d = new Date(yyyy, mm - 1, dd);
          if (!isNaN(d.getTime()) && d.getMonth() === mm - 1) payload.dob = d.toISOString();
        }
      }
      const result = await usersApi.updateMe(payload);
      setUser(result.user);
      router.replace('/verification' as any);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not save profile.' });
    } finally { setLoading(false); }
  }

  const canStep1 = displayName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canStep2 = hobbies.length >= 3;
  const canStep3 = photos.length >= 1;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Sticky header ── */}
      <View style={s.stickyHeader}>
        {step > 1 ? (
          <TouchableOpacity style={s.backBtn} onPress={() => setStep((p) => p - 1)} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <StepDots step={step} />
        <View style={{ width: 40 }} />
      </View>

      {/* ── Scrollable body ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Step 1: Basics ── */}
          {step === 1 && (
            <View style={s.stepWrap}>
              <View style={s.stepHead}>
                <Text style={s.stepTitle}>Let's set up{'\n'}your profile.</Text>
                <Text style={s.stepSub}>Tell us a bit about yourself.</Text>
              </View>

              {/* Display name */}
              <View style={s.field}>
                <FieldLabel text="Display name  *" />
                <TextInput
                  style={s.input}
                  placeholder="Your actual name"
                  placeholderTextColor={DIM}
                  value={displayName}
                  onChangeText={onNameChange}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {/* Username */}
              <View style={s.field}>
                <FieldLabel text="Username" />
                <View style={s.usernameRow}>
                  <Text style={s.at}>@</Text>
                  <TextInput
                    style={[s.input, s.usernameInput]}
                    placeholder="your_handle"
                    placeholderTextColor={DIM}
                    value={username}
                    onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24))}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Gender */}
              <View style={s.field}>
                <FieldLabel text="Gender" />
                <View style={s.pillRow}>
                  {GENDERS.map(({ key, label }) => {
                    const active = gender === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[s.pill, active && s.pillActive]}
                        onPress={() => setGender(active ? '' : key)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* DOB */}
              <View style={s.field}>
                <FieldLabel text="Date of birth" />
                <View style={s.dobRow}>
                  <TextInput
                    style={[s.input, s.dobPart]}
                    placeholder="DD"
                    placeholderTextColor={DIM}
                    value={dobDay}
                    onChangeText={(v) => setDobDay(v.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                  />
                  <Text style={s.dobSlash}>/</Text>
                  <TextInput
                    style={[s.input, s.dobPart]}
                    placeholder="MM"
                    placeholderTextColor={DIM}
                    value={dobMonth}
                    onChangeText={(v) => setDobMonth(v.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                  />
                  <Text style={s.dobSlash}>/</Text>
                  <TextInput
                    style={[s.input, s.dobYear]}
                    placeholder="YYYY"
                    placeholderTextColor={DIM}
                    value={dobYear}
                    onChangeText={(v) => setDobYear(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                    textAlign="center"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={s.field}>
                <FieldLabel text="Email  *" />
                <TextInput
                  style={s.input}
                  placeholder="hello@example.com"
                  placeholderTextColor={DIM}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* Occupation */}
              <View style={s.field}>
                <FieldLabel text="Occupation" />
                <View style={s.chipGrid}>
                  {OCCUPATIONS.map(({ key, label }) => {
                    const active = occupation === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => setOccupation(active ? '' : key)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={[s.btn, !canStep1 && s.btnDisabled]}
                onPress={() => setStep(2)}
                disabled={!canStep1}
                activeOpacity={0.88}
              >
                <Text style={s.btnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Interests ── */}
          {step === 2 && (
            <View style={s.stepWrap}>
              <View style={s.stepHead}>
                <Text style={s.stepTitle}>What are{'\n'}you into?</Text>
                <Text style={s.stepSub}>Pick at least 3 — we'll use this to find your people.</Text>
              </View>

              <View style={s.interestGrid}>
                {INTERESTS.map(({ label, emoji }) => {
                  const active = hobbies.includes(label);
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[s.interestChip, active && s.interestChipActive]}
                      onPress={() => toggleHobby(label)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.interestEmoji}>{emoji}</Text>
                      <Text style={[s.interestLabel, active && s.interestLabelActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {hobbies.length < 3 && (
                <View style={s.hintRow}>
                  <Ionicons name="information-circle-outline" size={14} color={MUTED} />
                  <Text style={s.minHint}>Pick {3 - hobbies.length} more to continue</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.btn, !canStep2 && s.btnDisabled]}
                onPress={() => setStep(3)}
                disabled={!canStep2}
                activeOpacity={0.88}
              >
                <Text style={s.btnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 3: Photos ── */}
          {step === 3 && (
            <View style={s.stepWrap}>
              <View style={s.stepHead}>
                <Text style={s.stepTitle}>Add your{'\n'}photos.</Text>
                <Text style={s.stepSub}>At least one. Of you, ideally.</Text>
              </View>

              {/* Privacy note */}
              <View style={s.privacyNote}>
                <Ionicons name="shield-checkmark" size={14} color={Ping.green} />
                <Text style={s.privacyNoteText}>Never shared without your permission</Text>
              </View>

              {/* Photo slots */}
              <View style={s.photoRow}>
                {photos.map((uri, idx) => (
                  <View key={idx} style={s.photoSlot}>
                    <Image source={{ uri }} style={s.photoImg} />
                    <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(idx)}>
                      <Ionicons name="close-circle" size={24} color="#FFF" />
                    </TouchableOpacity>
                    {idx === 0 && (
                      <View style={s.mainBadge}>
                        <Text style={s.mainBadgeText}>Main</Text>
                      </View>
                    )}
                  </View>
                ))}
                {photos.length < 2 && (
                  <TouchableOpacity style={s.photoAdd} onPress={pickPhoto} disabled={uploading} activeOpacity={0.8}>
                    {uploading ? (
                      <ActivityIndicator color={PURPLE} />
                    ) : (
                      <>
                        <View style={s.photoAddIcon}>
                          <Ionicons name="add" size={26} color={PURPLE} />
                        </View>
                        <Text style={s.photoAddLabel}>Add photo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[s.btn, (!canStep3 || loading) && s.btnDisabled]}
                onPress={handleFinish}
                disabled={!canStep3 || loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={s.btnText}>Create my profile</Text>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  stepWrap: { gap: Spacing.lg },
  stepHead: { gap: 6 },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  stepSub: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 21,
    marginTop: 2,
  },

  // Field
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: SURF,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    height: 52,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT,
  },

  // Username
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURF,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    height: 52,
    overflow: 'hidden',
    paddingLeft: 14,
  },
  at: { fontSize: 15, fontWeight: '700', color: PURPLE, marginRight: 2 },
  usernameInput: {
    flex: 1, height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingLeft: 0,
  },

  // Gender pills
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURF,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  pillText: { fontSize: 14, fontWeight: '600', color: MUTED },
  pillTextActive: { color: '#FFF' },

  // DOB
  dobRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dobPart: { flex: 1 },
  dobYear: { flex: 1.8 },
  dobSlash: { fontSize: 18, color: DIM, fontWeight: '300' },

  // Occupation chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURF,
  },
  chipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  chipText: { fontSize: 13, fontWeight: '600', color: MUTED },
  chipTextActive: { color: '#FFF' },

  // Interests
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURF,
  },
  interestChipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  interestEmoji: { fontSize: 14 },
  interestLabel: { fontSize: 13, fontWeight: '600', color: MUTED },
  interestLabelActive: { color: '#FFF' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  minHint: { fontSize: 13, color: MUTED },

  // Photos
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  privacyNoteText: { fontSize: 12, color: Ping.green, fontWeight: '600' },
  photoRow: { flexDirection: 'row', gap: 14 },
  photoSlot: {
    width: 130,
    height: 168,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  mainBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: PURPLE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mainBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  photoAdd: {
    width: 130,
    height: 168,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: BORDER,
    borderStyle: 'dashed',
    backgroundColor: SURF,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoAddIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddLabel: { fontSize: 12, fontWeight: '600', color: MUTED },

  // Button
  btn: {
    backgroundColor: PURPLE,
    borderRadius: 9999,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 6,
    marginTop: 4,
  },
  btnDisabled: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
});
