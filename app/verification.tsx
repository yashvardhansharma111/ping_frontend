import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { verificationApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Ping } from '@/constants/theme';

const GREEN = '#22C55E';

type ThemeColors = typeof Colors.dark;
type Step = 'loading' | 'intro' | 'pose' | 'preview' | 'pending' | 'verified' | 'rejected';

const POSES = [
  'Turn your head slightly left',
  'Turn your head slightly right',
  'Look straight at the camera and smile',
  'Raise your eyebrows — look surprised',
  'Give a thumbs up next to your face',
  'Look slightly upward at the camera',
  'Wink at the camera',
  'Show a big open smile',
  'Tilt your head slightly to the left',
  'Hold up two fingers next to your face',
];

function pickRandomPose() {
  return POSES[Math.floor(Math.random() * POSES.length)];
}

// ── Intro ─────────────────────────────────────────────────────────────────────

function IntroStep({ onStart, onSkip, c, isDark }: { onStart: () => void; onSkip: () => void; c: ThemeColors; isDark: boolean }) {
  const pulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={s.fill}>
      <View style={intro.iconWrap}>
        <Animated.View style={[intro.pulseRing, { opacity: pulse }]} />
        <View style={[intro.outerRing, { borderColor: `${Ping.purple}50`, backgroundColor: `${Ping.purple}12` }]}>
          <View style={[intro.iconCircle, { backgroundColor: Ping.purple }]}>
            <Ionicons name="shield-checkmark" size={38} color="#FFF" />
          </View>
        </View>
      </View>

      <Text style={[intro.title, { color: c.text }]}>Get your Verified badge</Text>
      <Text style={[intro.sub, { color: c.textSecondary }]}>
        Take a quick selfie to confirm it's really you. Verified profiles get more trust and access to women-only pings.
      </Text>

      <View style={[intro.bullets, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(143,99,244,0.05)', borderColor: isDark ? 'rgba(167,139,250,0.12)' : 'rgba(143,99,244,0.1)' }]}>
        <BulletRow text="Takes less than 30 seconds" c={c} />
        <BulletRow text="Selfie is deleted after verification" c={c} />
        <BulletRow text="Only your verified status is stored" c={c} />
      </View>

      <View style={intro.actions}>
        <TouchableOpacity
          style={intro.startBtn}
          onPress={onStart}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={18} color="#FFF" />
          <Text style={intro.startText}>Start Verification</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={intro.skipBtn} activeOpacity={0.6}>
          <Text style={[intro.skipText, { color: c.textSecondary }]}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BulletRow({ text, c }: { text: string; c: ThemeColors }) {
  return (
    <View style={intro.bulletRow}>
      <Ionicons name="checkmark-circle" size={15} color={GREEN} />
      <Text style={[intro.bulletText, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const intro = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  pulseRing: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: `${Ping.purple}14`,
  },
  outerRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 82, height: 82, borderRadius: 41,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Ping.purple, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10, paddingHorizontal: 16, letterSpacing: -0.5 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 24, opacity: 0.8 },
  bullets: {
    width: '100%', paddingHorizontal: 20, paddingVertical: 16,
    gap: 12, marginBottom: 36,
    borderRadius: 16, borderWidth: 1,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletText: { fontSize: 14, flex: 1 },
  actions: { width: '100%', paddingHorizontal: 20, gap: 10 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16,
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  startText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14 },
});

// ── Pose / Camera ─────────────────────────────────────────────────────────────

function PoseStep({ pose, onCapture, c }: { pose: string; onCapture: (uri: string) => void; c: ThemeColors }) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function pulse(dot: Animated.Value, delay: number) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.delay(Math.max(0, 800 - delay)),
        ])
      ).start();
    }
    pulse(dot1, 0);
    pulse(dot2, 220);
    pulse(dot3, 440);
  }, []);

  async function capture() {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) onCapture(photo.uri);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Capture failed', text2: err.message });
    } finally {
      setCapturing(false);
    }
  }

  // Still requesting permissions
  if (!permission) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={s.centered}>
        <View style={[s.iconCircle, { backgroundColor: c.primary + '22' }]}>
          <Ionicons name="camera-outline" size={44} color={c.primary} />
        </View>
        <Text style={[s.h1, { color: c.text }]}>Camera access needed</Text>
        <Text style={[s.sub, { color: c.textSecondary }]}>
          Allow camera access to take your verification selfie.
        </Text>
        <TouchableOpacity
          style={[pose_s.btn, { backgroundColor: c.primary, width: '100%' }]}
          onPress={requestPermission}
          activeOpacity={0.85}
        >
          <Text style={pose_s.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={pose_s.wrap}>
      {/* Instruction pill */}
      <View style={pose_s.pillWrap}>
        <View style={pose_s.pill}>
          <Text style={pose_s.pillText}>{pose}</Text>
        </View>
      </View>

      {/* Live camera inside oval */}
      <View style={pose_s.ovalArea}>
        <View style={pose_s.ovalBorder}>
          <View style={pose_s.ovalClip}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
            />
          </View>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={pose_s.bottom}>
        <Text style={[pose_s.holdText, { color: c.textSecondary }]}>
          Position your face in the oval
        </Text>
        <View style={pose_s.dotsRow}>
          <Animated.View style={[pose_s.dot, { opacity: dot1 }]} />
          <Animated.View style={[pose_s.dot, { opacity: dot2 }]} />
          <Animated.View style={[pose_s.dot, { opacity: dot3 }]} />
        </View>

        {/* Shutter button */}
        <TouchableOpacity
          style={pose_s.shutterRing}
          onPress={capture}
          disabled={capturing}
          activeOpacity={0.8}
        >
          {capturing
            ? <ActivityIndicator color={GREEN} />
            : <View style={[pose_s.shutterInner, { backgroundColor: c.primary }]} />
          }
        </TouchableOpacity>

        <Text style={[pose_s.tapHint, { color: c.textSecondary }]}>Tap to capture</Text>
      </View>
    </View>
  );
}

const pose_s = StyleSheet.create({
  wrap: { flex: 1 },
  pillWrap: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 24 },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 22,
    paddingHorizontal: 20, paddingVertical: 11,
  },
  pillText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  ovalArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ovalBorder: {
    width: 230, height: 300, borderRadius: 121,
    borderWidth: 2.5, borderColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ovalClip: {
    width: 224, height: 294, borderRadius: 118,
    overflow: 'hidden',
  },
  bottom: { paddingHorizontal: 24, paddingBottom: 28, alignItems: 'center', gap: 10 },
  holdText: { fontSize: 13 },
  dotsRow: { flexDirection: 'row', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GREEN },
  shutterRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 6,
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28 },
  tapHint: { fontSize: 12, marginTop: 2 },
  // used in permission-denied state
  btn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: Ping.purple, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

// ── Preview ───────────────────────────────────────────────────────────────────

function PreviewStep({
  uri, pose, submitting, onSubmit, onRetake, c,
}: {
  uri: string; pose: string; submitting: boolean; onSubmit: () => void; onRetake: () => void; c: ThemeColors;
}) {
  return (
    <View style={prev_s.wrap}>
      <View style={prev_s.center}>
        <View style={prev_s.photoWrap}>
          <Image source={{ uri }} style={prev_s.photo} resizeMode="cover" />
        </View>
        <View style={prev_s.poseTag}>
          <Text style={prev_s.poseTagText} numberOfLines={2}>{pose}</Text>
        </View>
      </View>

      <View style={prev_s.actions}>
        <TouchableOpacity
          style={[prev_s.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#FFF" />
            : <Text style={prev_s.submitText}>Submit for Review</Text>
          }
        </TouchableOpacity>
        {!submitting && (
          <TouchableOpacity style={prev_s.retakeBtn} onPress={onRetake} activeOpacity={0.6}>
            <Text style={[prev_s.retakeText, { color: c.textSecondary }]}>Retake</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const prev_s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'space-between', padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  photoWrap: { borderWidth: 2.5, borderColor: GREEN, borderRadius: 130, overflow: 'hidden' },
  photo: { width: 225, height: 285 },
  poseTag: {
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
  },
  poseTagText: { fontSize: 13, color: GREEN, textAlign: 'center', fontWeight: '600' },
  actions: { gap: 10 },
  submitBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  retakeBtn: { alignItems: 'center', paddingVertical: 10 },
  retakeText: { fontSize: 14 },
});

// ── Pending ───────────────────────────────────────────────────────────────────

function PendingStep({ onBack, c, isDark }: { onBack: () => void; c: ThemeColors; isDark: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.centered}>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Animated.View style={[pend_s.spinRing, { transform: [{ rotate }] }]} />
        <View style={[s.iconCircle, { backgroundColor: 'rgba(245,158,11,0.12)', marginBottom: 0 }]}>
          <Ionicons name="time-outline" size={44} color="#F59E0B" />
        </View>
      </View>
      <Text style={[s.h1, { color: c.text }]}>Under Review</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>
        Your selfie has been submitted and is being reviewed by our team. This typically takes a few hours.
        You'll be notified once it's done.
      </Text>
      <View style={[pend_s.infoCard, {
        backgroundColor: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.05)',
        borderColor: 'rgba(245,158,11,0.18)',
      }]}>
        <Ionicons name="notifications-outline" size={16} color="#F59E0B" />
        <Text style={[pend_s.infoText, { color: c.textSecondary }]}>We'll notify you when your verification is complete.</Text>
      </View>
      <TouchableOpacity onPress={onBack} style={pend_s.backBtn} activeOpacity={0.85}>
        <Text style={pend_s.backBtnText}>Back to Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const pend_s = StyleSheet.create({
  spinRing: {
    position: 'absolute',
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 2, borderColor: '#F59E0B',
    borderTopColor: 'transparent', borderLeftColor: 'transparent',
    opacity: 0.45,
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, marginBottom: 28, width: '100%',
    borderWidth: 1,
  },
  infoText: { fontSize: 13, lineHeight: 20, flex: 1 },
  backBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  backBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

// ── Verified ──────────────────────────────────────────────────────────────────

function VerifiedStep({ onBack, userName, userAvatar, c, isDark }: {
  onBack: () => void; userName?: string; userAvatar?: string | null; c: ThemeColors; isDark: boolean;
}) {
  const pulse1 = useRef(new Animated.Value(0.55)).current;
  const pulse2 = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 0.55, duration: 1300, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: 1, duration: 1300, useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 0.35, duration: 1300, useNativeDriver: true }),
        ])
      ).start();
    }, 500);
  }, []);

  const letter = (userName ?? 'U')[0].toUpperCase();

  return (
    <View style={s.centered}>
      {/* Layered pulse rings + check icon */}
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Animated.View style={[ver_s.pulseRing2, { opacity: pulse2 }]} />
        <Animated.View style={[ver_s.pulseRing1, { opacity: pulse1 }]} />
        <View style={ver_s.outerCircle}>
          <View style={ver_s.innerCircle}>
            <Ionicons name="checkmark" size={44} color="#FFF" />
          </View>
        </View>
      </View>

      <Text style={[s.h1, { color: c.text }]}>You're verified!</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>
        Your profile now shows the Verified badge. This unlocks women-only pings and boosts trust with people nearby.
      </Text>

      {/* User card */}
      <View style={[ver_s.userCard, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(167,139,250,0.22)' : 'rgba(143,99,244,0.18)',
      }]}>
        <View style={ver_s.avatarWrap}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={ver_s.avatarImg} />
          ) : (
            <View style={[ver_s.avatarFallback, { backgroundColor: `${Ping.purple}33` }]}>
              <Text style={[ver_s.avatarLetter, { color: Ping.purpleLight }]}>{letter}</Text>
            </View>
          )}
          <View style={ver_s.verifiedDot}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ver_s.userName, { color: c.text }]}>{userName ?? 'You'}</Text>
          <View style={ver_s.verifiedPill}>
            <View style={ver_s.greenDot} />
            <Text style={ver_s.verifiedPillText}>Verified</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={ver_s.doneBtn} onPress={onBack} activeOpacity={0.85}>
        <Text style={ver_s.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const ver_s = StyleSheet.create({
  pulseRing1: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: `${Ping.purple}18`,
  },
  pulseRing2: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: `${Ping.purple}0C`,
  },
  outerCircle: {
    width: 114, height: 114, borderRadius: 57,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: {
    width: 82, height: 82, borderRadius: 41, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: GREEN, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, padding: 16, marginTop: 22, marginBottom: 32,
    borderWidth: 1, width: '100%',
  },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '800' },
  verifiedDot: { position: 'absolute', bottom: -3, right: -3 },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  verifiedPillText: { fontSize: 12, fontWeight: '700', color: GREEN },
  doneBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

// ── Rejected ──────────────────────────────────────────────────────────────────

function RejectedStep({ reason, onTryAgain, c }: { reason: string | null; onTryAgain: () => void; c: ThemeColors }) {
  return (
    <View style={s.centered}>
      <View style={[s.iconCircle, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
        <Ionicons name="close" size={44} color="#EF4444" />
      </View>
      <Text style={[s.h1, { color: c.text }]}>Verification Failed</Text>
      {reason ? (
        <View style={rej_s.reasonCard}>
          <Text style={rej_s.reasonLabel}>Reason from our team</Text>
          <Text style={[rej_s.reasonText, { color: c.textSecondary }]}>{reason}</Text>
        </View>
      ) : (
        <Text style={[s.sub, { color: c.textSecondary }]}>
          Your selfie didn't meet our requirements. Try again with better lighting and follow the pose exactly.
        </Text>
      )}
      <TouchableOpacity style={rej_s.tryBtn} onPress={onTryAgain} activeOpacity={0.85}>
        <Ionicons name="camera-outline" size={18} color="#FFF" />
        <Text style={rej_s.tryBtnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const rej_s = StyleSheet.create({
  reasonCard: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)',
    marginBottom: 28, width: '100%',
  },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  reasonText: { fontSize: 14, lineHeight: 22 },
  tryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', borderRadius: 14, paddingVertical: 16, marginTop: 8,
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  tryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

// ── Shared ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, width: '100%' },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  h1: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 300 },
  ghostBtn: { paddingVertical: 12, marginTop: 16 },
  ghostText: { fontSize: 14 },
});

// ── Root ──────────────────────────────────────────────────────────────────────

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';

  const [step, setStep] = useState<Step>('loading');
  const [pose, setPose] = useState('');
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => { checkStatus(); }, []);

  async function checkStatus() {
    setStep('loading');
    try {
      const res = await verificationApi.status();
      const vs = res.verificationStatus;
      if (vs === 'verified') {
        // Sync local store so FAB gate works without requiring re-login
        if (user && (user as any).verificationStatus !== 'verified') {
          setUser({ ...user, verificationStatus: 'verified' } as any);
        }
        setStep('verified');
      } else if (vs === 'pending') {
        setStep('pending');
      } else if (vs === 'rejected') {
        setRejectionReason(res.rejectionReason);
        setStep('rejected');
      } else {
        setStep('intro');
      }
    } catch {
      setStep('intro');
    }
  }

  function startFlow() {
    setPose(pickRandomPose());
    setSelfieUri(null);
    setStep('pose');
  }

  async function handleSubmit() {
    if (!selfieUri || !pose) return;
    setSubmitting(true);
    try {
      await verificationApi.request(selfieUri, pose);
      if (user) setUser({ ...user, verificationStatus: 'pending' } as any);
      setStep('pending');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Submission failed', text2: err.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  const showBack = step === 'intro' || step === 'pose' || step === 'preview';

  function handleBack() {
    if (step === 'intro') goBack();
    else if (step === 'pose') setStep('intro');
    else setStep('pose');
  }

  return (
    <View style={[root.wrap, { backgroundColor: c.background }]}>
      <View style={[root.header, { paddingTop: insets.top + 6 }]}>
        {showBack ? (
          <TouchableOpacity onPress={handleBack} style={root.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
        ) : (
          <View style={root.backBtn} />
        )}
        <Text style={[root.headerTitle, { color: c.text }]}>Verify Profile</Text>
        <View style={root.backBtn} />
      </View>

      {step === 'loading' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      )}
      {step === 'intro' && <IntroStep onStart={startFlow} onSkip={goBack} c={c} isDark={isDark} />}
      {step === 'pose' && (
        <PoseStep
          pose={pose}
          onCapture={(uri) => { setSelfieUri(uri); setStep('preview'); }}
          c={c}
        />
      )}
      {step === 'preview' && selfieUri && (
        <PreviewStep
          uri={selfieUri}
          pose={pose}
          submitting={submitting}
          onSubmit={handleSubmit}
          onRetake={() => setStep('pose')}
          c={c}
        />
      )}
      {step === 'pending' && <PendingStep onBack={goBack} c={c} isDark={isDark} />}
      {step === 'verified' && (
        <VerifiedStep
          onBack={goBack}
          userName={user?.displayName || user?.username}
          userAvatar={(user as any)?.avatarUrl ?? null}
          c={c}
          isDark={isDark}
        />
      )}
      {step === 'rejected' && (
        <RejectedStep
          reason={rejectionReason}
          onTryAgain={() => { setPose(pickRandomPose()); setSelfieUri(null); setStep('pose'); }}
          c={c}
        />
      )}
    </View>
  );
}

const root = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: { width: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
});
