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
const HERO_H = Math.round(SCREEN_W * 1.2);

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
  const hobbies = (user?.hobbies ?? []).slice(0, 6);
  const metaLine = [age ? String(age) : null, user?.city || null].filter(Boolean).join(' · ');

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
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
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
              colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', 'rgba(0,0,0,0.82)']}
              locations={[0, 0.22, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <Text style={styles.topTitle}>Profile</Text>
              <View style={styles.topActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={pickAvatar} activeOpacity={0.75}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="camera-outline" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => router.push('/settings' as any)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="settings-outline" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {photos.length > 1 && (
              <View style={[styles.dots, { top: insets.top + 56 }]}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                ))}
              </View>
            )}

            <View style={styles.heroIdentity} pointerEvents="none">
              <View style={styles.nameRow}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {user?.displayName ?? 'Your name'}
                </Text>
                {isVerified && <Ionicons name="checkmark-circle" size={20} color="#BB92FF" />}
              </View>
              {metaLine ? <Text style={styles.heroMeta}>{metaLine}</Text> : null}
            </View>
          </View>

          <View style={styles.body}>
            {user?.bio ? (
              <Text style={[styles.bio, { color: c.text }]}>{user.bio}</Text>
            ) : (
              <Text style={[styles.bioMuted, { color: c.textSecondary }]}>
                Add a short bio so people know your vibe.
              </Text>
            )}

            <View style={[styles.statsRow, { borderColor: c.border }]}>
              {[
                { label: 'Friends', value: friendCount !== null ? String(friendCount) : '—' },
                { label: 'Pings', value: activityCount !== null ? String(activityCount) : '—' },
              ].map((stat, i) => (
                <View
                  key={stat.label}
                  style={[
                    styles.statItem,
                    i === 0 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
                  ]}
                >
                  <Text style={[styles.statValue, { color: c.text }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {hobbies.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Interests</Text>
                <View style={styles.chipWrap}>
                  {hobbies.map((h) => (
                    <View key={h} style={[styles.chip, { borderColor: Ping.lavender, backgroundColor: scheme === 'dark' ? c.soft : Ping.soft }]}>
                      <Text style={[styles.chipText, { color: c.text }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: Ping.purple }]}
              onPress={() => router.push('/edit-profile' as any)}
              activeOpacity={0.88}
            >
              <Text style={[styles.editBtnText, { color: '#FFF' }]}>Edit profile</Text>
            </TouchableOpacity>

            {user && (
              <View style={styles.section}>
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
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

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
  heroIdentity: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
    lineHeight: 36,
    flexShrink: 1,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  bio: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bioMuted: {
    fontSize: 14,
    lineHeight: 20,
  },

  statsRow: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 3,
  },
  statValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  statLabel: { fontSize: 12, fontWeight: '500' },

  section: { gap: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },

  editBtn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});
