import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  Dimensions, Animated, PanResponder, Image,
  AppState, type AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ping, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const HERO_H = Math.round(H * 0.56);

// ── Intro timing ──────────────────────────────────────────────────────────────
// The orb breathes for INTRO_BURST_MS, then bursts into the profile circles.
// Tune this to land the burst on the beat of the ambient track.
const INTRO_BURST_MS = 2600;
const ORB_SIZE = 96;
const ORB_CX = W / 2;                       // hero-relative orb centre
const ORB_CY = Math.round(HERO_H * 0.78);

// ── Ambient sound ─────────────────────────────────────────────────────────────
// Drop your track at frontend/assets/sounds/ambient.mp3 and swap the line below:
//   const AMBIENT_SOURCE: AudioSource = require('@/assets/sounds/ambient.mp3');
// expo-av is a native module — it only works in an APK built after it was installed.
type AudioSource = number | { uri: string };
const AMBIENT_SOURCE: AudioSource | null = null;
const AMBIENT_VOLUME = 0.35;

// ── Photo bank (square crops for clean circular display) ──────────────────────

const PX = {
  a: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=220&h=220&fit=crop&crop=faces',
  b: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
  c: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces',
  d: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=180&h=180&fit=crop&crop=faces',
  e: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&h=180&fit=crop&crop=faces',
  f: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=170&h=170&fit=crop&crop=faces',
  g: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=190&h=190&fit=crop&crop=faces',
  h: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=170&h=170&fit=crop&crop=faces',
};

// ── Float configs — unique per-circle so motion feels organic ─────────────────

const FLOAT_CONFIGS = [
  { yAmp: 14, xAmp:  5, yDur: 3400, xDur: 4600 },
  { yAmp: 10, xAmp: -4, yDur: 2800, xDur: 3800 },
  { yAmp: 12, xAmp:  6, yDur: 3200, xDur: 4200 },
  { yAmp:  8, xAmp:  3, yDur: 2600, xDur: 3600 },
];

// ── Slide data ────────────────────────────────────────────────────────────────

type PhotoDef = {
  uri: string;
  size: number; // diameter of the circle
  pos: { top?: number; bottom?: number; left?: number; right?: number };
};

type Decor = {
  emoji: string;
  top?: number; bottom?: number; left?: number; right?: number;
};

type SlideData = {
  grad:     readonly [string, string, string];
  darkGrad: readonly [string, string, string];
  photos:   PhotoDef[];
  decor?:   Decor[];
  title:    string;
  subtitle: string;
  btnLabel: string;
  skipLabel?: string;
  onAction?: () => Promise<void>;
  isPro?:   true;
};

const SLIDES: SlideData[] = [
  {
    grad:     ['#FDF6EE', '#F8EEF5', '#EEF3FB'],
    darkGrad: ['#1A1208', '#1A0C14', '#080E1A'],
    photos: [
      { uri: PX.a, size: 92, pos: { top: 0.08, left: 0.04 } },
      { uri: PX.b, size: 72, pos: { top: 0.05, right: 0.07 } },
      { uri: PX.c, size: 76, pos: { bottom: 0.08, left: 0.20 } },
      { uri: PX.d, size: 58, pos: { bottom: 0.07, right: 0.05 } },
    ],
    decor: [
      { emoji: '✨', top: 0.04, right: 0.36 },
      { emoji: '💜', bottom: 0.22, left: 0.04 },
    ],
    title:    'Discover What\'s\nHappening Near You.',
    subtitle: 'See walks, hangouts, game nights and more — happening right around you.',
    btnLabel: 'Continue',
  },
  {
    grad:     ['#EEF5FB', '#F5EEFD', '#FDF6EE'],
    darkGrad: ['#080E1A', '#0E0818', '#1A1208'],
    photos: [
      { uri: PX.e, size: 92, pos: { top: 0.06, right: 0.05 } },
      { uri: PX.f, size: 72, pos: { top: 0.10, left: 0.04 } },
      { uri: PX.g, size: 76, pos: { bottom: 0.06, right: 0.16 } },
      { uri: PX.h, size: 58, pos: { bottom: 0.08, left: 0.05 } },
    ],
    decor: [
      { emoji: '⭐', top: 0.03, left: 0.42 },
      { emoji: '🤝', bottom: 0.24, right: 0.04 },
    ],
    title:    'Meet Real People\nNear You.',
    subtitle: 'Join pings, meet your neighbours, and build your local crew one activity at a time.',
    btnLabel: 'Continue',
  },
  {
    grad:     ['#F5EEFD', '#EEF3FB', '#FDF0EE'],
    darkGrad: ['#0E0818', '#080E1A', '#1A0C08'],
    photos: [
      { uri: PX.b, size: 92, pos: { top: 0.08, left: 0.06 } },
      { uri: PX.a, size: 76, pos: { top: 0.04, right: 0.04 } },
      { uri: PX.d, size: 76, pos: { bottom: 0.07, right: 0.06 } },
      { uri: PX.h, size: 58, pos: { bottom: 0.06, left: 0.22 } },
    ],
    decor: [
      { emoji: '⚡', top: 0.04, left: 0.38 },
      { emoji: '🎯', bottom: 0.26, left: 0.04 },
    ],
    title:    'Drop a Ping.\nSee Who Shows Up.',
    subtitle: 'Host your own events. See who shows up nearby. Make something happen.',
    btnLabel: 'Continue',
  },
  {
    grad:     ['#EEF8F0', '#EEF3FB', '#F5F5EE'],
    darkGrad: ['#081408', '#080E1A', '#141408'],
    photos: [
      { uri: PX.g, size: 92, pos: { top: 0.06, right: 0.04 } },
      { uri: PX.f, size: 72, pos: { top: 0.08, left: 0.04 } },
      { uri: PX.c, size: 76, pos: { bottom: 0.07, left: 0.18 } },
      { uri: PX.e, size: 58, pos: { bottom: 0.06, right: 0.06 } },
    ],
    decor: [
      { emoji: '📍', top: 0.03, right: 0.38 },
      { emoji: '🗺️', bottom: 0.26, right: 0.04 },
    ],
    title:    'Know What\'s\nAround You.',
    subtitle: 'Location access lets us show you what\'s happening nearby — in real time.',
    btnLabel: 'Allow Location',
    onAction: async () => { await Location.requestForegroundPermissionsAsync(); },
  },
  {
    grad:     ['#F5EEFD', '#FEEEF5', '#EEF3FB'],
    darkGrad: ['#0E0818', '#180810', '#080E1A'],
    photos: [
      { uri: PX.a, size: 92, pos: { top: 0.07, left: 0.04 } },
      { uri: PX.c, size: 76, pos: { top: 0.05, right: 0.05 } },
      { uri: PX.b, size: 72, pos: { bottom: 0.07, right: 0.16 } },
      { uri: PX.f, size: 58, pos: { bottom: 0.06, left: 0.06 } },
    ],
    decor: [
      { emoji: '💌', top: 0.04, left: 0.40 },
      { emoji: '👥', bottom: 0.26, right: 0.04 },
    ],
    title:    'Find Friends\nAlready on Ping.',
    subtitle: 'See which of your contacts are already using Ping. Connect instantly.',
    btnLabel: 'Find My Friends',
    skipLabel: 'Skip for now',
  },
  {
    isPro: true,
    grad:     ['#F0EEFF', '#EAE0FF', '#E0EEFF'],
    darkGrad: ['#0C0020', '#080020', '#00081A'],
    photos: [
      { uri: PX.e, size: 92, pos: { top: 0.06, left: 0.04 } },
      { uri: PX.g, size: 76, pos: { top: 0.08, right: 0.04 } },
      { uri: PX.h, size: 76, pos: { bottom: 0.06, right: 0.05 } },
      { uri: PX.d, size: 58, pos: { bottom: 0.08, left: 0.20 } },
    ],
    decor: [
      { emoji: '💎', top: 0.04, right: 0.40 },
      { emoji: '⭐', bottom: 0.26, left: 0.04 },
    ],
    title:    'Go Pro — Free\nFor New Users.',
    subtitle: 'Get 1 month of Ping Pro with full features — on us. No payment needed today.',
    btnLabel: 'Claim Free Pro',
    skipLabel: 'Start for free',
  },
];

// ── Ambient sound hook ────────────────────────────────────────────────────────
// expo-av is required lazily inside try/catch so an APK built without the
// native module still runs this screen (just silently).

function useAmbientSound(muted: boolean) {
  const soundRef = useRef<any>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (!AMBIENT_SOURCE) return;

    let AudioMod: any;
    try {
      AudioMod = require('expo-av').Audio;
    } catch {
      return; // native module missing in this build
    }

    let alive = true;
    (async () => {
      try {
        await AudioMod.setAudioModeAsync({
          playsInSilentModeIOS: false,      // respect the iOS silent switch
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await AudioMod.Sound.createAsync(
          AMBIENT_SOURCE,
          { isLooping: true, volume: AMBIENT_VOLUME, shouldPlay: !mutedRef.current },
        );
        if (!alive) { sound.unloadAsync().catch(() => {}); return; }
        soundRef.current = sound;
      } catch {
        // audio unavailable — continue without music
      }
    })();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        if (!mutedRef.current) soundRef.current?.playAsync().catch(() => {});
      } else {
        soundRef.current?.pauseAsync().catch(() => {});
      }
    });

    return () => {
      alive = false;
      sub.remove();
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const snd = soundRef.current;
    if (!snd) return;
    (muted ? snd.pauseAsync() : snd.playAsync()).catch(() => {});
  }, [muted]);
}

// ── FloatingCircle ─────────────────────────────────────────────────────────────
// Travels from (originDX, originDY) to its resting spot with a spring, then
// floats forever. Travel and float use separate shared values so neither
// animation cancels the other. Everything runs on the UI thread.

type FloatingCircleProps = {
  photo: PhotoDef;
  index: number;
  top: number;
  left: number;
  originDX: number;
  originDY: number;
  delayMs: number;
};

function FloatingCircle({ photo, index, top, left, originDX, originDY, delayMs }: FloatingCircleProps) {
  const entX    = useSharedValue(originDX);
  const entY    = useSharedValue(originDY);
  const fx      = useSharedValue(0);
  const fy      = useSharedValue(0);
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);

  const fp = FLOAT_CONFIGS[index % FLOAT_CONFIGS.length];

  useEffect(() => {
    const travel = { damping: 13, stiffness: 68, mass: 1.1 };
    entX.value    = withDelay(delayMs, withSpring(0, travel));
    entY.value    = withDelay(delayMs, withSpring(0, travel));
    scale.value   = withDelay(delayMs, withSpring(1, { damping: 10, stiffness: 72, mass: 1.3 }));
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));

    const floatStart = delayMs + 900;
    fy.value = withDelay(
      floatStart,
      withRepeat(
        withSequence(
          withTiming( fp.yAmp,        { duration: fp.yDur, easing: Easing.inOut(Easing.sin) }),
          withTiming(-fp.yAmp * 0.45, { duration: fp.yDur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    fx.value = withDelay(
      floatStart,
      withRepeat(
        withSequence(
          withTiming( fp.xAmp, { duration: fp.xDur, easing: Easing.inOut(Easing.sin) }),
          withTiming(-fp.xAmp, { duration: fp.xDur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(entX);
      cancelAnimation(entY);
      cancelAnimation(fx);
      cancelAnimation(fy);
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: entX.value + fx.value },
      { translateY: entY.value + fy.value },
      { scale: scale.value },
    ],
  }));

  const size     = photo.size;
  const ringSize = size + 7;

  return (
    <Reanimated.View style={[{ position: 'absolute', top, left }, animStyle, circ.shadow]}>
      <View style={[circ.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        <Image
          source={{ uri: photo.uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    </Reanimated.View>
  );
}

const circ = StyleSheet.create({
  shadow: {
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 14,
  },
  ring: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

// ── FloatingCircles ───────────────────────────────────────────────────────────

function resolveTopLeft(p: PhotoDef) {
  const ringSize = p.size + 7;
  const top  = p.pos.top  !== undefined ? Math.round(HERO_H * p.pos.top)  : HERO_H - Math.round(HERO_H * (p.pos.bottom ?? 0)) - ringSize;
  const left = p.pos.left !== undefined ? Math.round(W * p.pos.left)      : W      - Math.round(W * (p.pos.right ?? 0))       - ringSize;
  return { top, left, ringSize };
}

function FloatingCircles({ slide, fromOrb }: { slide: SlideData; fromOrb: boolean }) {
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {slide.photos.map((p, i) => {
        const { top, left, ringSize } = resolveTopLeft(p);
        const originDX = fromOrb ? ORB_CX - (left + ringSize / 2) : 0;
        const originDY = fromOrb ? ORB_CY - (top  + ringSize / 2) : 0;
        return (
          <FloatingCircle
            key={p.uri}
            photo={p}
            index={i}
            top={top}
            left={left}
            originDX={originDX}
            originDY={originDY}
            delayMs={fromOrb ? i * 90 : i * 160}
          />
        );
      })}

      {(slide.decor ?? []).map((d, i) => {
        const dp: any = { position: 'absolute', zIndex: 10 };
        if (d.top    !== undefined) dp.top    = Math.round(HERO_H * d.top);
        if (d.bottom !== undefined) dp.bottom = Math.round(HERO_H * d.bottom);
        if (d.left   !== undefined) dp.left   = Math.round(W * d.left);
        if (d.right  !== undefined) dp.right  = Math.round(W * d.right);
        return <Text key={i} style={[ph.decor, dp]}>{d.emoji}</Text>;
      })}
    </View>
  );
}

const ph = StyleSheet.create({
  decor: { fontSize: 22, position: 'absolute' },
});

// ── IntroOverlay ──────────────────────────────────────────────────────────────
// Light splash with a breathing gradient orb + ripple rings. On `bursting`
// the rings blow out, the orb collapses and the overlay fades away.

function RippleRing({ delayMs, bursting, style }: { delayMs: number; bursting: boolean; style: any }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (bursting) {
      scale.value   = withTiming(3.8, { duration: 520, easing: Easing.out(Easing.quad) });
      opacity.value = withTiming(0,   { duration: 420 });
      return;
    }
    scale.value = withDelay(delayMs, withRepeat(
      withSequence(
        withTiming(1,   { duration: 0 }),
        withTiming(2.6, { duration: 1800, easing: Easing.out(Easing.quad) }),
      ), -1, false,
    ));
    opacity.value = withDelay(delayMs, withRepeat(
      withSequence(
        withTiming(0.55, { duration: 0 }),
        withTiming(0,    { duration: 1800, easing: Easing.out(Easing.quad) }),
      ), -1, false,
    ));
    return () => { cancelAnimation(scale); cancelAnimation(opacity); };
  }, [bursting]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Reanimated.View pointerEvents="none" style={[intro.ring, style, anim]} />;
}

function IntroOverlay({
  bursting, onTap, topInset, bottomInset,
}: { bursting: boolean; onTap: () => void; topInset: number; bottomInset: number }) {
  const overlayOpacity = useSharedValue(1);
  const orbScale       = useSharedValue(1);
  const glowScale      = useSharedValue(1);

  useEffect(() => {
    if (bursting) {
      overlayOpacity.value = withDelay(120, withTiming(0, { duration: 520, easing: Easing.out(Easing.quad) }));
      orbScale.value  = withSequence(
        withTiming(1.22, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0,    { duration: 320, easing: Easing.in(Easing.cubic) }),
      );
      glowScale.value = withTiming(2.4, { duration: 480, easing: Easing.out(Easing.quad) });
      return;
    }
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    return () => { cancelAnimation(orbScale); cancelAnimation(glowScale); };
  }, [bursting]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const orbStyle     = useAnimatedStyle(() => ({ transform: [{ scale: orbScale.value }] }));
  const glowStyle    = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value * 0.9,
    transform: [{ scale: glowScale.value }],
  }));

  // Orb centre in screen coordinates (hero starts at topInset)
  const cx = ORB_CX;
  const cy = topInset + ORB_CY;
  const centred = (d: number) => ({ top: cy - d / 2, left: cx - d / 2, width: d, height: d, borderRadius: d / 2 });

  return (
    <Reanimated.View
      style={[StyleSheet.absoluteFill, intro.overlay, overlayStyle]}
      pointerEvents={bursting ? 'none' : 'auto'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} />

      <Text style={[intro.wordmark, { top: topInset + 24 }]}>ping</Text>

      {/* soft glow halo */}
      <Reanimated.View pointerEvents="none" style={[intro.glow, centred(ORB_SIZE * 1.9), glowStyle]} />

      <RippleRing delayMs={0}   bursting={bursting} style={centred(ORB_SIZE)} />
      <RippleRing delayMs={900} bursting={bursting} style={centred(ORB_SIZE)} />

      <Reanimated.View pointerEvents="none" style={[intro.orbShadow, centred(ORB_SIZE), orbStyle]}>
        <LinearGradient
          colors={['#D3C6FF', '#B8A8F4', '#A9B9EE']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: ORB_SIZE / 2 }]}
        />
        <Text style={intro.plus}>+</Text>
      </Reanimated.View>

      <Text style={[intro.handle, { bottom: bottomInset + 22 }]}>@ping.official</Text>
    </Reanimated.View>
  );
}

const intro = StyleSheet.create({
  overlay:  { backgroundColor: '#F4F4F6', zIndex: 50 },
  wordmark: { position: 'absolute', left: 28, fontSize: 22, fontWeight: '500', color: '#141414', letterSpacing: -0.3 },
  handle:   { position: 'absolute', left: 28, fontSize: 11, color: '#6B6B70' },
  glow:     { position: 'absolute', backgroundColor: 'rgba(143,99,244,0.16)' },
  ring:     { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(143,99,244,0.45)' },
  orbShadow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  plus: { fontSize: 46, fontWeight: '300', color: '#FFFFFF', lineHeight: 50, marginTop: -2 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

type Phase = 'intro' | 'burst' | 'slides';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [muted, setMuted] = useState(false);

  useAmbientSound(muted);

  // RN Animated — page-level transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideX   = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const phaseRef = useRef<Phase>('intro');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  function burst() {
    if (phaseRef.current !== 'intro') return;
    phaseRef.current = 'burst';
    setPhase('burst');
    setTimeout(() => setPhase('slides'), 700);
  }

  useEffect(() => {
    const t = setTimeout(burst, INTRO_BURST_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Slide helpers ────────────────────────────────────────────────────────────

  const cur    = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  const textCol  = '#F0EAFF';
  const subCol   = 'rgba(240,230,255,0.55)';
  const dotInact = 'rgba(255,255,255,0.14)';
  const dotDone  = 'rgba(255,255,255,0.38)';

  function goTo(next: number) {
    if (next < 0 || next >= SLIDES.length) return;
    const dir = next > slide ? -24 : 24;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: dir, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      slideX.setValue(-dir);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideX,   { toValue: 0, damping: 22, stiffness: 260, useNativeDriver: true }),
      ]).start();
    });
  }

  async function finish() {
    await SecureStore.setItemAsync('onboardingDone', '1');
    router.replace('/(auth)/phone');
  }

  async function handleAction() {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, damping: 20, stiffness: 500, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1,    damping: 14, stiffness: 220, useNativeDriver: true }),
    ]).start();
    if (cur.onAction) await cur.onAction();
    if (!isLast) goTo(slide + 1);
    else await finish();
  }

  const slideRef = useRef(slide);
  useEffect(() => { slideRef.current = slide; }, [slide]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > 8,
      onPanResponderRelease: (_, g) => {
        if      (g.dx < -40 && slideRef.current < SLIDES.length - 1) goTo(slideRef.current + 1);
        else if (g.dx >  40 && slideRef.current > 0)                 goTo(slideRef.current - 1);
      },
    })
  ).current;

  const showSkip   = slide < SLIDES.length - 1;
  const skipAction = cur.skipLabel ? finish : () => goTo(slide + 1);

  // Circles only exist once the orb bursts; slide 0's first mount flies out of the orb.
  const circlesVisible = phase !== 'intro';
  const fromOrb        = slide === 0 && phase !== 'slides';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>

      {/* ── Hero: gradient + floating circles ── */}
      <View style={s.hero} {...panResponder.panHandlers}>
        <LinearGradient
          colors={cur.darkGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={s.topBar}>
          {slide > 0 ? (
            <TouchableOpacity onPress={() => goTo(slide - 1)} hitSlop={14} activeOpacity={0.7} style={s.backBtn}>
              <Text style={s.backArrow}>‹</Text>
            </TouchableOpacity>
          ) : <View style={s.backBtn} />}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {AMBIENT_SOURCE != null && (
              <TouchableOpacity onPress={() => setMuted(m => !m)} hitSlop={10} activeOpacity={0.75} style={s.muteBtn}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-medium'} size={16} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            )}
            {showSkip && (
              <TouchableOpacity onPress={skipAction} hitSlop={10} activeOpacity={0.7}>
                <Text style={s.skipText}>SKIP</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {circlesVisible && <FloatingCircles key={slide} slide={cur} fromOrb={fromOrb} />}
        </Animated.View>
      </View>

      {/* ── Content card ── */}
      <View style={s.body}>
        {cur.isPro && (
          <View style={s.proRow}>
            <View style={s.couponBadge}>
              <Text style={s.couponText}>🎁  WELCOME0 — ₹0 for 30 days</Text>
            </View>
            <Text style={s.priceRow}>
              <Text style={s.strikePrice}>₹99</Text>
              {'  '}
              <Text style={s.freePrice}>FREE</Text>
            </Text>
          </View>
        )}

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }] }}>
          <Text style={[s.title, { color: textCol }]}>{cur.title}</Text>
          <Text style={[s.subtitle, { color: subCol }]}>{cur.subtitle}</Text>
        </Animated.View>

        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={8}>
              <View
                style={[
                  s.dot,
                  i === slide
                    ? [s.dotActive, { backgroundColor: Ping.purple }]
                    : i < slide
                      ? { backgroundColor: dotDone }
                      : { backgroundColor: dotInact },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: Ping.purple }]}
            onPress={handleAction}
            activeOpacity={0.88}
          >
            <Text style={s.btnText}>{cur.btnLabel}</Text>
          </TouchableOpacity>
        </Animated.View>

        {cur.isPro && (
          <TouchableOpacity onPress={finish} hitSlop={8} activeOpacity={0.7}>
            <Text style={[s.skipAlt, { color: subCol }]}>Start for free instead</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Intro splash (sits above everything until it bursts) ── */}
      {phase !== 'slides' && (
        <IntroOverlay
          bursting={phase === 'burst'}
          onTap={burst}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080815' },

  hero: {
    height: HERO_H,
    overflow: 'hidden',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    zIndex: 20,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 28, fontWeight: '300', color: 'rgba(255,255,255,0.40)', lineHeight: 34 },
  skipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(255,255,255,0.38)' },

  muteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    gap: 0,
  },

  proRow:      { alignItems: 'flex-start', gap: 6, marginBottom: 10 },
  couponBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: `${Ping.purple}18`,
    borderWidth: 1, borderColor: `${Ping.purple}40`,
  },
  couponText:  { fontSize: 11, fontWeight: '700', color: Ping.purpleLight, letterSpacing: 0.3 },
  priceRow:    { fontSize: 17, fontWeight: '600', color: '#F0EAFF' },
  strikePrice: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.35)', fontWeight: '400' },
  freePrice:   { color: Ping.purple, fontWeight: '800' },

  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 35,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
    maxWidth: 300,
    marginBottom: 20,
  },

  dotsRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22, height: 6, borderRadius: 3 },

  btn: {
    height: 54,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.1 },
  skipAlt: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
