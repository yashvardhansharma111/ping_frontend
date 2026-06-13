import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  TextInput,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import useAuthStore from '@/lib/stores/authStore';
import { authApi, usersApi, friendsApi } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import SafetyHubModal from '@/components/SafetyHubModal';

// ── tiny reusable components ─────────────────────────────────────────────────

function SheetHeader({
  title,
  onClose,
  c,
}: {
  title: string;
  onClose: () => void;
  c: (typeof Colors)['dark'];
}) {
  return (
    <View style={[sh.header, { borderBottomColor: c.border }]}>
      <Text style={[sh.title, { color: c.text }]}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={10}>
        <Ionicons name="close" size={22} color={c.icon} />
      </TouchableOpacity>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize,
  c,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  c: (typeof Colors)['dark'];
}) {
  return (
    <View style={sh.fieldWrap}>
      <Text style={[sh.fieldLabel, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          sh.input,
          multiline && sh.inputMulti,
          { color: c.text, backgroundColor: c.card, borderColor: c.border },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.icon}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
}

function ToggleRow({
  label,
  sublabel,
  value,
  onValueChange,
  loading,
  c,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  loading?: boolean;
  c: (typeof Colors)['dark'];
}) {
  return (
    <View style={[sh.toggleRow, { borderBottomColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[sh.toggleLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? (
          <Text style={[sh.toggleSub, { color: c.textSecondary }]}>{sublabel}</Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={Ping.purpleLight} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: c.border, true: Ping.purple }}
          thumbColor="#FFF"
        />
      )}
    </View>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
] as const;

function EditProfileModal({
  visible,
  onClose,
  c,
}: {
  visible: boolean;
  onClose: () => void;
  c: (typeof Colors)['dark'];
}) {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(user?.gender ?? '');
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  async function save() {
    const payload: Record<string, any> = {};
    if (displayName.trim()) payload.displayName = displayName.trim();
    if (username.trim()) payload.username = username.trim();
    payload.bio = bio.trim();
    if (email.trim()) payload.email = email.trim();
    if (gender) payload.gender = gender;

    if (!payload.displayName) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }
    setSaving(true);
    try {
      const res = await usersApi.updateMe(payload);
      setUser(res.user);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={sh.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[sh.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <SheetHeader title="Edit Profile" onClose={onClose} c={c} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            <Field
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              autoCapitalize="words"
              c={c}
            />
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="lowercase, letters & numbers"
              autoCapitalize="none"
              c={c}
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="A short intro..."
              multiline
              c={c}
            />
            <Field
              label="Email (optional)"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              c={c}
            />

            {/* Gender selector */}
            <View style={sh.fieldWrap}>
              <Text style={[sh.fieldLabel, { color: c.textSecondary }]}>Gender</Text>
              <View style={sh.genderRow}>
                {GENDERS.map(({ key, label }) => {
                  const active = gender === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        sh.genderChip,
                        { borderColor: active ? Ping.purple : c.border, backgroundColor: active ? `${Ping.purple}22` : c.card },
                      ]}
                      onPress={() => setGender(active ? '' : key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[sh.genderLabel, { color: active ? Ping.purpleLight : c.textSecondary }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[sh.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={sh.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Privacy Modal ─────────────────────────────────────────────────────────────

function PrivacyModal({
  visible,
  onClose,
  c,
}: {
  visible: boolean;
  onClose: () => void;
  c: (typeof Colors)['dark'];
}) {
  const { user, setUser } = useAuthStore();
  const [ghostMode, setGhostMode] = useState(user?.privacy?.ghostMode ?? false);
  const [locationSharing, setLocationSharing] = useState(user?.privacy?.locationSharing ?? true);
  const [ghostLoading, setGhostLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const insets = useSafeAreaInsets();

  async function toggleGhost(value: boolean) {
    setGhostMode(value);
    setGhostLoading(true);
    try {
      const res = await usersApi.updatePrivacy({ ghostMode: value });
      if (user) setUser({ ...user, privacy: { ...user.privacy!, ...res.privacy } });
    } catch (err: any) {
      setGhostMode(!value);
      Alert.alert('Error', err.message || 'Could not update setting.');
    } finally {
      setGhostLoading(false);
    }
  }

  async function toggleLocation(value: boolean) {
    setLocationSharing(value);
    setLocLoading(true);
    try {
      const res = await usersApi.updatePrivacy({ locationSharing: value });
      if (user) setUser({ ...user, privacy: { ...user.privacy!, ...res.privacy } });
    } catch (err: any) {
      setLocationSharing(!value);
      Alert.alert('Error', err.message || 'Could not update setting.');
    } finally {
      setLocLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sh.overlay}>
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[sh.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <SheetHeader title="Privacy & Location" onClose={onClose} c={c} />
          <View style={{ padding: Spacing.lg, gap: 0 }}>
            <ToggleRow
              label="Ghost mode"
              sublabel="Hide your dot from the map"
              value={ghostMode}
              onValueChange={toggleGhost}
              loading={ghostLoading}
              c={c}
            />
            <ToggleRow
              label="Share location"
              sublabel="Let friends see you on the map"
              value={locationSharing}
              onValueChange={toggleLocation}
              loading={locLoading}
              c={c}
            />
            <Text style={[sh.hint, { color: c.textSecondary }]}>
              Location is only shared while the app is in the foreground.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Notifications Modal ───────────────────────────────────────────────────────

function NotificationsModal({
  visible,
  onClose,
  c,
}: {
  visible: boolean;
  onClose: () => void;
  c: (typeof Colors)['dark'];
}) {
  const [activities, setActivities] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [messages, setMessages] = useState(true);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sh.overlay}>
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[sh.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <SheetHeader title="Notifications" onClose={onClose} c={c} />
          <View style={{ padding: Spacing.lg }}>
            <ToggleRow
              label="Nearby activities"
              sublabel="Pings within your radius"
              value={activities}
              onValueChange={setActivities}
              c={c}
            />
            <ToggleRow
              label="Friend requests"
              sublabel="When someone adds you"
              value={friendRequests}
              onValueChange={setFriendRequests}
              c={c}
            />
            <ToggleRow
              label="Messages"
              sublabel="Chat & activity updates"
              value={messages}
              onValueChange={setMessages}
              c={c}
            />
            <Text style={[sh.hint, { color: c.textSecondary }]}>
              Push notification setup coming soon. These preferences will be applied when ready.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Profile Screen ───────────────────────────────────────────────────────

type ModalKey = 'editProfile' | 'privacy' | 'notifications' | 'safety' | null;

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshToken, logout } = useAuthStore();
  const [openModal, setOpenModal] = useState<ModalKey>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);

  const halo1 = useRef(new Animated.Value(0)).current;
  const halo2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fetch real friend count
    friendsApi.list().then((r) => setFriendCount(r.friends?.length ?? 0)).catch(() => {});
    // Staggered halo pulses
    Animated.loop(Animated.timing(halo1, { toValue: 1, duration: 2600, useNativeDriver: true })).start();
    setTimeout(() => {
      Animated.loop(Animated.timing(halo2, { toValue: 1, duration: 2600, useNativeDriver: true })).start();
    }, 1300);
  }, []);

  const h1Scale = halo1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const h1Opacity = halo1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.45, 0.15, 0] });
  const h2Scale = halo2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const h2Opacity = halo2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.35, 0.1, 0] });

  const initials = (user?.displayName ?? user?.phone ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleLogout() {
    Alert.alert('Log out?', 'You can log back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            if (refreshToken) await authApi.logout(refreshToken);
          } catch {}
          await logout();
        },
      },
    ]);
  }

  type MenuItem = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
    danger?: boolean;
  };

  const menu: MenuItem[] = [
    {
      icon: 'person-outline',
      label: 'Edit profile',
      onPress: () => setOpenModal('editProfile'),
    },
    {
      icon: 'megaphone-outline',
      label: 'My Ads',
      onPress: () => router.push('/ads'),
    },
    {
      icon: 'eye-outline',
      label: 'Privacy & location',
      onPress: () => setOpenModal('privacy'),
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      onPress: () => setOpenModal('notifications'),
    },
    {
      icon: 'shield-outline',
      label: 'Safety & account',
      onPress: () => setOpenModal('safety'),
    },
    {
      icon: 'log-out-outline',
      label: 'Log out',
      onPress: handleLogout,
      danger: true,
    },
  ];

  return (
    <>
      <ScrollView
        style={[styles.root, { backgroundColor: c.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Animated.View style={[styles.haloRing, { transform: [{ scale: h1Scale }], opacity: h1Opacity }]} />
            <Animated.View style={[styles.haloRing, { transform: [{ scale: h2Scale }], opacity: h2Opacity }]} />
            <View style={[styles.avatarFallback, { backgroundColor: Ping.purple }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={[styles.name, { color: c.text }]}>
            {user?.displayName ?? 'No name set'}
          </Text>
          {user?.username ? (
            <Text style={[styles.username, { color: c.textSecondary }]}>@{user.username}</Text>
          ) : null}
          {user?.bio ? (
            <Text style={[styles.bio, { color: c.textSecondary }]}>{user.bio}</Text>
          ) : null}
          <Text style={[styles.phone, { color: c.icon }]}>{user?.phone}</Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: c.surface, borderColor: c.border }]}>
          {[
            { label: 'Friends', value: friendCount !== null ? String(friendCount) : '—' },
            { label: 'Activities', value: '—' },
            { label: 'Squads', value: '—' },
          ].map((s, i) => (
            <View
              key={s.label}
              style={[
                styles.statItem,
                i < 2 && { borderRightWidth: 1, borderRightColor: c.border },
              ]}
            >
              <Text style={[styles.statValue, { color: c.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={[styles.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          {menu.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                i < menu.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
              onPress={item.onPress}
              activeOpacity={0.65}
            >
              <View
                style={[
                  styles.menuIconWrap,
                  {
                    backgroundColor: item.danger
                      ? 'rgba(239,68,68,0.1)'
                      : 'rgba(124,58,237,0.1)',
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.danger ? Ping.red : c.tint}
                />
              </View>
              <Text style={[styles.menuLabel, { color: item.danger ? Ping.red : c.text }]}>
                {item.label}
              </Text>
              {!item.danger && <Ionicons name="chevron-forward" size={16} color={c.icon} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.version, { color: c.textSecondary }]}>Ping v1.0.0</Text>
      </ScrollView>

      <EditProfileModal
        visible={openModal === 'editProfile'}
        onClose={() => setOpenModal(null)}
        c={c}
      />
      <PrivacyModal
        visible={openModal === 'privacy'}
        onClose={() => setOpenModal(null)}
        c={c}
      />
      <NotificationsModal
        visible={openModal === 'notifications'}
        onClose={() => setOpenModal(null)}
        c={c}
      />
      <SafetyHubModal
        visible={openModal === 'safety'}
        onClose={() => setOpenModal(null)}
      />
    </>
  );
}

// ── Main styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  avatarWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: Spacing.xs,
  },
  haloRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Ping.purple,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  name: { ...Typography.h3 },
  username: { ...Typography.bodySm },
  bio: { ...Typography.bodySm, textAlign: 'center', maxWidth: 260 },
  phone: { ...Typography.caption, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statItem: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', gap: 2 },
  statValue: { ...Typography.h3 },
  statLabel: { ...Typography.caption },
  menuCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { ...Typography.bodyMed, flex: 1 },
  version: { ...Typography.caption, textAlign: 'center' },
});

// ── Sheet styles (shared by all modals) ───────────────────────────────────────

const sh = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  title: { ...Typography.h3 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    ...Typography.bodyMed,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Ping.purple,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  saveBtnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  genderLabel: { ...Typography.bodySm, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  toggleLabel: { ...Typography.bodyMed },
  toggleSub: { ...Typography.caption },
  hint: {
    ...Typography.caption,
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  infoText: { ...Typography.bodySm, flex: 1, lineHeight: 20 },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Ping.red,
    height: 52,
  },
  dangerBtnText: { ...Typography.bodyMed, color: Ping.red, fontWeight: '600' },
});
