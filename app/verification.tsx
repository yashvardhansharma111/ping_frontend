import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '@/lib/stores/authStore';
import { uploadApi, usersApi } from '@/lib/api';
import { Ping, Spacing, Radius, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const GREEN = '#22C55E';

const PERKS = [
  { icon: 'shield-checkmark-outline' as const, label: 'Verified Badge on your profile' },
  { icon: 'flash-outline' as const,            label: 'Create and join Pings' },
  { icon: 'people-outline' as const,           label: 'Trusted by the community' },
];

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];

  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  const badgeScale   = useRef(new Animated.Value(0.7)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  const cardSlide    = useRef(new Animated.Value(32)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(badgeScale,   { toValue: 1, damping: 14, stiffness: 160, useNativeDriver: true }),
      Animated.timing(badgeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardSlide,    { toValue: 0, duration: 480, delay: 120, useNativeDriver: true }),
      Animated.timing(cardOpacity,  { toValue: 1, duration: 480, delay: 120, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  function pressBtn() {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.93, damping: 20, stiffness: 500, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1,    damping: 14, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }

  function showSuccess() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(successScale, { toValue: 1, damping: 10, stiffness: 140, useNativeDriver: true }).start();
  }

  async function handleSelfie() {
    pressBtn();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setStatus('loading');
    try {
      const selfieUrl = await uploadApi.uploadImage(result.assets[0].uri, 'photos');
      const res = await usersApi.submitVerification(selfieUrl);
      if (res.verificationStatus === 'verified') {
        setUser({ ...user!, verificationStatus: 'verified' } as any);
        setStatus('done');
        showSuccess();
      }
    } catch {
      setStatus('idle');
    }
  }

  const glowSize    = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 148] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] });

  const borderColor = scheme === 'dark' ? 'rgba(167,139,250,0.18)' : 'rgba(124,58,237,0.12)';
  const accentIcon  = scheme === 'dark' ? Ping.purpleLight : Ping.purple;

  return (
    <View style={[sv.root, { backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Badge hero */}
      <View style={sv.hero}>
        <Animated.View
          style={[
            sv.glowRing,
            { width: glowSize, height: glowSize, opacity: glowOpacity, borderRadius: 74,
              backgroundColor: status === 'done' ? GREEN : Ping.purple },
          ]}
        />
        <Animated.View
          style={[
            sv.badgeCircle,
            { transform: [{ scale: badgeScale }], opacity: badgeOpacity,
              backgroundColor: c.surface, borderColor },
            status === 'done' && { borderColor: GREEN + '66', backgroundColor: GREEN + '15' },
          ]}
        >
          <Ionicons
            name={status === 'done' ? 'shield-checkmark' : 'shield-outline'}
            size={64}
            color={status === 'done' ? GREEN : accentIcon}
          />
        </Animated.View>
      </View>

      {/* Content card */}
      <Animated.View
        style={[
          sv.card,
          { backgroundColor: c.card, borderColor,
            opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
        ]}
      >
        {status !== 'done' ? (
          <>
            <Text style={[sv.heading, { color: c.text }]}>Almost there.</Text>
            <Text style={[sv.sub, { color: c.textSecondary }]}>
              Take a quick selfie so we know you're a real human and not a golden retriever with a phone.
            </Text>

            <View style={sv.perks}>
              {PERKS.map((p) => (
                <View key={p.label} style={sv.perkRow}>
                  <View style={[sv.perkIcon, { backgroundColor: Ping.purple + '22' }]}>
                    <Ionicons name={p.icon} size={16} color={accentIcon} />
                  </View>
                  <Text style={[sv.perkText, { color: c.text }]}>{p.label}</Text>
                </View>
              ))}
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable
                style={[sv.selfieBtn, status === 'loading' && sv.selfieBtnLoading]}
                onPress={handleSelfie}
                disabled={status === 'loading'}
              >
                <Ionicons
                  name={status === 'loading' ? 'hourglass-outline' : 'camera'}
                  size={20}
                  color="#fff"
                  style={{ marginRight: 10 }}
                />
                <Text style={sv.selfieBtnText}>
                  {status === 'loading' ? 'Verifying…' : 'Take Selfie'}
                </Text>
              </Pressable>
            </Animated.View>

            <Text style={[sv.hint, { color: c.textSecondary }]}>
              <Ionicons name="lock-closed-outline" size={12} color={c.textSecondary} />
              {'  '}Your selfie is only used to verify you're real. It won't appear on your profile.
            </Text>
          </>
        ) : (
          <Animated.View style={[sv.successWrap, { transform: [{ scale: successScale }] }]}>
            <Text style={[sv.successHeading, { color: c.text }]}>You're Verified!</Text>
            <Text style={[sv.successSub, { color: c.textSecondary }]}>
              Your Verified Badge is live. Go find some Pings.
            </Text>

            <View style={sv.badgePill}>
              <Ionicons name="shield-checkmark" size={16} color={GREEN} style={{ marginRight: 6 }} />
              <Text style={sv.badgePillText}>Verified</Text>
            </View>

            <Pressable
              style={sv.continueBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace('/(tabs)');
              }}
            >
              <Ionicons name="map-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
              <Text style={sv.continueBtnText}>Open Map</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const sv = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  glowRing: { position: 'absolute' },
  badgeCircle: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  heading: { fontSize: 26, fontWeight: '700', marginBottom: Spacing.xs },
  sub:     { fontSize: 14, lineHeight: 21, marginBottom: Spacing.lg },
  perks:   { gap: 10, marginBottom: Spacing.lg },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  perkIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  perkText: { fontSize: 14, fontWeight: '500' },
  selfieBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Ping.purple, borderRadius: Radius.md,
    paddingVertical: 16, marginBottom: Spacing.md,
  },
  selfieBtnLoading: { opacity: 0.6 },
  selfieBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  hint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  successWrap: { alignItems: 'center' },
  successHeading: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.xs },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: Spacing.lg },
  badgePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: GREEN + '22', borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: GREEN + '44', marginBottom: Spacing.lg,
  },
  badgePillText: { fontSize: 14, fontWeight: '700', color: GREEN },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN, borderRadius: Radius.md,
    paddingVertical: 16, paddingHorizontal: 32, width: '100%',
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
