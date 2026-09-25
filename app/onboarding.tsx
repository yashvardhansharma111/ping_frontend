import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, PanResponder, Image,
  AppState, type AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
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
import { Ping, Spacing, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const HERO_H = Math.round(H * 0.56);

// Ambient music — royalty-free (Mixkit free license).
// To use a bundled file: const AMBIENT_AUDIO = require('@/assets/sounds/ambient.mp3');
const AMBIENT_AUDIO = {
  uri: 'https://assets.mixkit.co/music/preview/mixkit-dreamy-lo-fi-background-2232.mp3',
};
const AMBIENT_VOLUME = 0.28;

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

// ── FloatingCircle ─────────────────────────────────────────────────────────────
// Each circle has its own Reanimated shared values and runs entirely
// on the UI thread — no JS-thread frame budget.

type FloatingCircleProps = { photo: PhotoDef; index: number };

function FloatingCircle({ photo, index }: FloatingCircleProps) {
  const ty      = useSharedValue(0);
  const tx      = useSharedValue(0);
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);

  const fp           = FLOAT_CONFIGS[index % FLOAT_CONFIGS.length];
  const entranceMs   = index * 160;

  useEffect(() => {
    // ── Staggered entrance ──
    scale.value = withDelay(
      entranceMs,
      withSpring(1, { damping: 10, stiffness: 72, mass: 1.3 })
    );
    opacity.value = withDelay(
      entranceMs,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
    );

    // ── Continuous float — starts after entrance settles ──
    const floatStart = entranceMs + 820;

    ty.value = withDelay(
      floatStart,
      withRepeat(
        withSequence(
          withTiming( fp.yAmp,          { duration: fp.yDur, easing: Easing.inOut(Easing.sin) }),
          withTiming(-fp.yAmp * 0.45,   { duration: fp.yDur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      )
    );

    tx.value = withDelay(
      floatStart,
      withRepeat(
        withSequence(
          withTiming( fp.xAmp, { duration: fp.xDur, easing: Easing.inOut(Easing.sin) }),
          withTiming(-fp.xAmp, { duration: fp.xDur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(ty);
      cancelAnimation(tx);
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: ty.value },
      { translateX: tx.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  // Resolve absolute position from fractional values
  const pos: Record<string, number> = { position: 'absolute' } as any;
  if (photo.pos.top    !== undefined) pos.top    = Math.round(HERO_H * photo.pos.top);
  if (photo.pos.bottom !== undefined) pos.bottom = Math.round(HERO_H * photo.pos.bottom);
  if (photo.pos.left   !== undefined) pos.left   = Math.round(W * photo.pos.left);
  if (photo.pos.right  !== undefined) pos.right  = Math.round(W * photo.pos.right);

  const s = photo.size;
  const ringSize = s + 7;
  const ringR    = ringSize / 2;

  return (
    <Reanimated.View style={[pos as any, animStyle, circ.shadow]}>
      {/* White-glass ring */}
      <View
        style={[
          circ.ring,
          { width: ringSize, height: ringSize, borderRadius: ringR },
        ]}
      >
        <Image
          source={{ uri: photo.uri }}
          style={{ width: s, height: s, borderRadius: s / 2 }}
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

function FloatingCircles({ slide }: { slide: SlideData }) {
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {slide.photos.map((p, i) => (
        <FloatingCircle key={p.uri} photo={p} index={i} />
      ))}

      {/* Emoji decorators */}
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [muted, setMuted] = useState(false);

  // RN Animated — used for page-level transitions (unchanged)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideX   = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  // Audio refs — avoid stale closure issues
  const soundRef  = useRef<Audio.Sound | null>(null);
  const mutedRef  = useRef(false);

  // ── Audio setup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;

    async function initAudio() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false,   // respect iOS silent switch
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          AMBIENT_AUDIO,
          { isLooping: true, volume: AMBIENT_VOLUME, shouldPlay: true }
        );

        if (!alive) { sound.unloadAsync(); return; }
        soundRef.current = sound;
      } catch {
        // Network unavailable or audio error — continue without music
      }
    }

    initAudio();

    // Pause when app goes to background; resume on foreground
    const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && !mutedRef.current) {
        soundRef.current?.playAsync().catch(() => {});
      } else if (next !== 'active') {
        soundRef.current?.pauseAsync().catch(() => {});
      }
    });

    return () => {
      alive = false;
      appSub.remove();
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) soundRef.current?.pauseAsync().catch(() => {});
    else      soundRef.current?.playAsync().catch(() => {});
  }

  // ── Slide helpers ────────────────────────────────────────────────────────────

  const cur    = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  const isDark   = true;
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
  const skipLabel  = cur.skipLabel ?? 'Skip';
  const skipAction = cur.skipLabel ? finish : () => goTo(slide + 1);

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

        {/* Top bar */}
        <View style={s.topBar}>
          {slide > 0 ? (
            <TouchableOpacity onPress={() => goTo(slide - 1)} hitSlop={14} activeOpacity={0.7} style={s.backBtn}>
              <Text style={s.backArrow}>‹</Text>
            </TouchableOpacity>
          ) : <View style={s.backBtn} />}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Mute button */}
            <TouchableOpacity onPress={toggleMute} hitSlop={10} activeOpacity={0.75} style={s.muteBtn}>
              <Ionicons
                name={muted ? 'volume-mute' : 'volume-medium'}
                size={16}
                color="rgba(255,255,255,0.65)"
              />
            </TouchableOpacity>

            {showSkip && (
              <TouchableOpacity onPress={skipAction} hitSlop={10} activeOpacity={0.7}>
                <Text style={s.skipText}>SKIP</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Floating circles — keyed by slide so entrance animation replays */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FloatingCircles key={slide} slide={cur} />
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

        {/* Progress dots */}
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

        {/* CTA button */}
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

  // Pro
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

  // Content
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

  // Dots
  dotsRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22, height: 6, borderRadius: 3 },

  // Button
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
