import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ChartBar, ShieldCheck } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi, friendsApi, uploadApi, activitiesApi } from '@/lib/api';
import HighlightsSection from '@/components/HighlightsSection';
import { Spacing, Radius, Typography, Colors, Ping } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 1.05);

function getAge(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

// ── Completion % from user object ────────────────────────────────────────────
function calcCompletion(user: any): number {
  if (!user) return 0;
  const checks = [
    !!(user.avatarUrl || (user.photos?.length ?? 0) > 0),
    !!user.displayName?.trim(),
    !!user.bio?.trim(),
    !!user.dob,
    !!user.gender,
    !!user.city?.trim(),
    !!user.email?.trim(),
    (user.hobbies?.length ?? 0) > 0 || (user.favoriteActivities?.length ?? 0) > 0,
    !!(user.instagramHandle || (user as any).snapchatHandle || user.linkedinHandle || user.spotifyHandle),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function completionQuip(pct: number): string {
  if (pct <= 15) return "Bhai, yeh profile nahi — ghost town hai 👻 Even ghosts have more presence.";
  if (pct <= 30) return "Less info here than a suspicious WhatsApp forward. Isse zyada toh aapka ration card hai.";
  if (pct <= 50) return "Halfway done. Like a half-eaten samosa — technically food, but deeply disappointing.";
  if (pct <= 65) return "You're a 5/10 with 10/10 potential. Embarrassing, honestly. Fill it up.";
  if (pct <= 80) return "Almost decent! Your future ping partners deserve the full version, not the demo.";
  if (pct <= 95) return "Itni mehnat karke ruk gaye? Commitment issues toh nahi? Bas thoda aur.";
  return "99% done and still holding back. That last 1% is personal isn't it 😭";
}

// ── Profile Completion Banner ─────────────────────────────────────────────────
function CompletionBanner({
  pct, onEdit, onDismiss, c, scheme,
}: {
  pct: number;
  onEdit: () => void;
  onDismiss: () => void;
  c: any;
  scheme: 'light' | 'dark';
}) {
  const isDark = scheme === 'dark';
  const bg = isDark ? 'rgba(139,92,246,0.13)' : 'rgba(143,99,244,0.08)';
  const border = isDark ? 'rgba(167,139,250,0.28)' : 'rgba(143,99,244,0.22)';

  return (
    <View style={[bn.card, { backgroundColor: bg, borderColor: border }]}>
      <TouchableOpacity style={bn.dismiss} onPress={onDismiss} hitSlop={10}>
        <Ionicons name="close" size={14} color={c.textSecondary} />
      </TouchableOpacity>

      <View style={bn.row}>
        <ChartBar size={22} color={Ping.purple} weight="fill" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[bn.pctText, { color: Ping.purple }]}>{pct}% complete</Text>
          <Text style={[bn.quip, { color: c.textSecondary }]} numberOfLines={2}>
            {completionQuip(pct)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[bn.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
        <View style={[bn.fill, { width: `${pct}%` as any, backgroundColor: Ping.purple }]} />
      </View>

      <TouchableOpacity style={[bn.cta, { backgroundColor: Ping.purple }]} onPress={onEdit} activeOpacity={0.85}>
        <Text style={bn.ctaText}>Complete profile →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Verification Banner ───────────────────────────────────────────────────────
function VerificationBanner({
  onVerify, onDismiss, c, scheme,
}: {
  onVerify: () => void;
  onDismiss: () => void;
  c: any;
  scheme: 'light' | 'dark';
}) {
  const isDark = scheme === 'dark';
  const bg = isDark ? 'rgba(139,92,246,0.10)' : 'rgba(139,92,246,0.07)';
  const border = isDark ? 'rgba(139,92,246,0.28)' : 'rgba(139,92,246,0.20)';
  const titleColor = isDark ? '#C4B5FD' : '#7C3AED';
  const btnColor = isDark ? '#7C3AED' : '#6D28D9';

  return (
    <View style={[bn.card, { backgroundColor: bg, borderColor: border }]}>
      <TouchableOpacity style={bn.dismiss} onPress={onDismiss} hitSlop={10}>
        <Ionicons name="close" size={14} color={c.textSecondary} />
      </TouchableOpacity>

      <View style={bn.row}>
        <View style={[bn.iconWrap, { backgroundColor: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.12)' }]}>
          <ShieldCheck size={22} color={titleColor} weight="fill" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[bn.pctText, { color: titleColor }]}>Get verified</Text>
          <Text style={[bn.quip, { color: c.textSecondary }]} numberOfLines={2}>
            You're out here unverified like a WhatsApp forward. Get the badge before someone vibes with a catfish instead.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[bn.cta, { backgroundColor: btnColor }]}
        onPress={onVerify}
        activeOpacity={0.85}
      >
        <Text style={bn.ctaText}>Verify me →</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [activityCount, setActivityCount] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [hideCompletion, setHideCompletion] = useState(false);
  const [hideVerification, setHideVerification] = useState(false);

  const completionPct = useMemo(() => calcCompletion(user), [user]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    friendsApi.list().then((r) => setFriendCount(r.friends?.length ?? 0)).catch(() => {});
    activitiesApi.mine('all').then((r) => setActivityCount(r.activities?.length ?? 0)).catch(() => {});
    Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, []);

  const photos = useMemo(() => {
    const list = [...(user?.photos ?? [])];
    if (user?.avatarUrl && !list.includes(user.avatarUrl)) list.unshift(user.avatarUrl);
    return list;
  }, [user?.photos, user?.avatarUrl]);

  const initials = (user?.displayName ?? user?.phone ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const age = getAge(user?.dob);
  const isVerified = user?.verificationStatus === 'verified';
  const hobbies = (user?.hobbies ?? []).slice(0, 8);
  const username = user?.username ? `@${user.username}` : user?.phone ? `@${user.phone.slice(-4)}` : '@user';

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'info', text1: 'Permission needed', text2: 'Allow photo access to update your picture.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'avatars');
      const nextPhotos = [...(user?.photos ?? [])];
      if (!nextPhotos.length) nextPhotos.push(url);
      const res = await usersApi.updateMe({
        avatarUrl: url,
        ...(nextPhotos.length ? { photos: nextPhotos } : {}),
      });
      setUser(res.user);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message || 'Could not update photo.' });
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Top Hero Photo Section */}
          <View style={[styles.hero, { height: HERO_H }]}>
            {photos.length > 0 ? (
              <FlatList
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                onMomentumScrollEnd={(e) =>
                  setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
                }
                keyExtractor={(uri, i) => `${uri}-${i}`}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={{ width: SCREEN_W, height: HERO_H }} resizeMode="cover" />
                )}
              />
            ) : (
              <TouchableOpacity
                style={[styles.heroEmpty, { backgroundColor: c.surface }]}
                onPress={pickAvatar}
                activeOpacity={0.85}
              >
                <Text style={[styles.heroInitials, { color: c.text }]}>{initials}</Text>
                <Text style={[styles.heroEmptyHint, { color: c.textSecondary }]}>Add a photo</Text>
              </TouchableOpacity>
            )}

            {/* Blur layer — soft frost across the whole image */}
            <BlurView
              intensity={18}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Purple-black gradient overlay — strong top + bottom, open middle */}
            <LinearGradient
              colors={[
                'rgba(8,2,20,0.88)',
                'rgba(15,5,35,0.55)',
                'rgba(15,5,35,0.10)',
                'transparent',
                'rgba(10,3,25,0.50)',
                'rgba(8,2,20,0.92)',
              ]}
              locations={[0, 0.18, 0.35, 0.50, 0.75, 1]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Top Bar Floating Controls */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <View style={styles.circleSpacer} />
              <View style={styles.topActions}>
                <TouchableOpacity style={styles.circleBtn} onPress={pickAvatar} activeOpacity={0.75}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="camera-outline" size={19} color="#FFF" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.circleBtn}
                  onPress={() => router.push('/settings' as any)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="settings-outline" size={19} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {photos.length > 1 && (
              <View style={[styles.dots, { top: insets.top + 60 }]}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>

          {/* Reference Image 1 Overlay Glass Card */}
          <View style={[styles.glassCard, { backgroundColor: scheme === 'dark' ? '#141418' : '#FFFFFF', borderColor: c.border, minHeight: SCREEN_H - HERO_H + 32 + tabBarHeight, paddingBottom: tabBarHeight + 16 }]}>
            {/* Identity Header */}
            <View style={styles.identityHeader}>
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, { color: c.text }]} numberOfLines={1}>
                  {user?.displayName ?? 'Your Name'}
                </Text>
                {isVerified && <Ionicons name="checkmark-circle" size={22} color="#BB92FF" />}
              </View>
              <Text style={[styles.handleText, { color: c.textSecondary }]}>{username}</Text>
            </View>

            {/* Bio Quote */}
            {user?.bio ? (
              <Text style={[styles.bioQuote, { color: c.text }]}>{`"${user.bio}"`}</Text>
            ) : (
              <Text style={[styles.bioQuoteMuted, { color: c.textSecondary }]}>
                {'"Add a short bio so people know your vibe."'}
              </Text>
            )}

            {/* 3-Stat Counter Grid (Reference Image 1 layout: Followers / Following / Comments) */}
            <View style={[styles.statsContainer, { borderColor: c.border }]}>
              <TouchableOpacity
                style={styles.statColumn}
                onPress={() => router.push('/(tabs)/friends' as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statNumber, { color: c.text }]}>
                  {friendCount !== null ? String(friendCount) : '0'}
                </Text>
                <Text style={[styles.statLabel, { color: c.textSecondary }]}>Friends</Text>
              </TouchableOpacity>

              <View style={[styles.statDivider, { backgroundColor: c.border }]} />

              <TouchableOpacity
                style={styles.statColumn}
                onPress={() => router.push('/my-activity' as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statNumber, { color: c.text }]}>
                  {activityCount !== null ? String(activityCount) : '0'}
                </Text>
                <Text style={[styles.statLabel, { color: c.textSecondary }]}>Pings</Text>
              </TouchableOpacity>

              <View style={[styles.statDivider, { backgroundColor: c.border }]} />

              <View style={styles.statColumn}>
                <Text style={[styles.statNumber, { color: c.text }]}>
                  {user?.ratingCount && user.ratingCount > 0 ? `${user.trustRate ?? 0}%` : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: c.textSecondary }]}>Trust Rate</Text>
              </View>
            </View>

            {/* Hashtag Interest Chips (Reference Image 1 style: #tag) */}
            {hobbies.length > 0 && (
              <View style={styles.hashtagWrap}>
                {hobbies.map((h) => {
                  const tagText = h.startsWith('#') ? h : `#${h.toLowerCase().replace(/\s+/g, '')}`;
                  return (
                    <View
                      key={h}
                      style={[
                        styles.hashtagChip,
                        {
                          backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#F4F4F6',
                          borderColor: c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.hashtagText, { color: c.text }]}>{tagText}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Capsule Action Buttons (Edit Profile + Public Preview Button) */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: Ping.purple },
                ]}
                onPress={() => router.push('/edit-profile' as any)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: '#FFFFFF' },
                  ]}
                >
                  Edit profile
                </Text>
              </TouchableOpacity>

              {user && (
                <TouchableOpacity
                  style={[
                    styles.previewBtn,
                    {
                      backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#F2F2F5',
                      borderColor: c.border,
                    },
                  ]}
                  onPress={() => router.push(`/user/${user._id}` as any)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="eye-outline" size={20} color={c.text} />
                </TouchableOpacity>
              )}
            </View>

            {/* Profile Completion Banner */}
            {!hideCompletion && completionPct < 100 && (
              <CompletionBanner
                pct={completionPct}
                onEdit={() => router.push('/edit-profile' as any)}
                onDismiss={() => setHideCompletion(true)}
                c={c}
                scheme={scheme}
              />
            )}

            {/* Verification Banner */}
            {!hideVerification && !isVerified && user?.verificationStatus !== 'pending' && (
              <VerificationBanner
                onVerify={() => router.push('/verification' as any)}
                onDismiss={() => setHideVerification(true)}
                c={c}
                scheme={scheme}
              />
            )}

            {/* User Highlights Section */}
            {user && (
              <View style={styles.highlightsContainer}>
                <HighlightsSection userId={user._id} isOwnProfile scheme={scheme} />
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    width: SCREEN_W,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  heroEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroInitials: { fontSize: 64, fontWeight: '800', letterSpacing: -1 },
  heroEmptyHint: { ...Typography.bodySm, fontWeight: '600' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  circleSpacer: { width: 40, height: 40 },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 16, backgroundColor: '#FFF' },

  glassCard: {
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 28,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  identityHeader: {
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  handleText: {
    fontSize: 15,
    fontWeight: '500',
  },
  bioQuote: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bioQuoteMuted: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  hashtagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hashtagChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hashtagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  previewBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  highlightsContainer: {
    paddingTop: 4,
  },
});

const bn = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  dismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 20,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  quip: {
    fontSize: 12,
    lineHeight: 17,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  cta: {
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.1,
  },
});
