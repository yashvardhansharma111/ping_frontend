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
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import useAuthStore from '@/lib/stores/authStore';
import { usersApi, friendsApi, uploadApi, activitiesApi } from '@/lib/api';
import HighlightsSection from '@/components/HighlightsSection';
import { Spacing, Radius, Typography, Colors, Ping } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 1.05);

function getAge(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [activityCount, setActivityCount] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

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
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
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

            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.6)']}
              locations={[0, 0.3, 1]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Top Bar Floating Controls */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <View style={styles.circleSpacer} />
              <View style={styles.topActions}>
                {user && (
                  <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={() => router.push(`/user/${user._id}` as any)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="eye-outline" size={19} color="#FFF" />
                  </TouchableOpacity>
                )}
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
          <View style={[styles.glassCard, { backgroundColor: scheme === 'dark' ? '#141418' : '#FFFFFF', borderColor: c.border }]}>
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
                  {user?.trustRate ? `${user.trustRate}%` : '100%'}
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
                  { backgroundColor: scheme === 'dark' ? '#FFFFFF' : '#111111' },
                ]}
                onPress={() => router.push('/edit-profile' as any)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: scheme === 'dark' ? '#111111' : '#FFFFFF' },
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
    paddingBottom: 24,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hashtagText: {
    fontSize: 13,
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
