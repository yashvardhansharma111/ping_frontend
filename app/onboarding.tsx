import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, PanResponder, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ping, Spacing, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const HERO_H = Math.round(H * 0.56);

// ── Photo bank ────────────────────────────────────────────────────────────────

const PX = {
  a: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=220&h=280&fit=crop&crop=faces',
  b: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=190&h=245&fit=crop&crop=faces',
  c: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=190&h=245&fit=crop&crop=faces',
  d: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=170&h=215&fit=crop&crop=faces',
  e: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=170&h=215&fit=crop&crop=faces',
  f: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&h=205&fit=crop&crop=faces',
  g: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=180&h=230&fit=crop&crop=faces',
  h: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=160&h=205&fit=crop&crop=faces',
};

// ── Slide data ────────────────────────────────────────────────────────────────

type PhotoDef = {
  uri: string;
  w: number; h: number; rot: number;
  pos: { top?: number; bottom?: number; left?: number; right?: number };
};
type Decor = { emoji: string; top?: number; bottom?: number; left?: number; right?: number };

type SlideData = {
  grad: readonly [string, string, string];
  darkGrad: readonly [string, string, string];
  photos: PhotoDef[];
  decor?: Decor[];
  title: string;
  subtitle: string;
  btnLabel: string;
  skipLabel?: string;
  onAction?: () => Promise<void>;
  isPro?: true;
};

const SLIDES: SlideData[] = [
  {
    grad:     ['#FDF6EE', '#F8EEF5', '#EEF3FB'],
    darkGrad: ['#1A1208', '#1A0C14', '#080E1A'],
    photos: [
      { uri: PX.a, w: 118, h: 152, rot: -8,  pos: { top: 0.08, left: 0.03 } },
      { uri: PX.b, w:  96, h: 124, rot:  6,  pos: { top: 0.05, right: 0.08 } },
      { uri: PX.c, w:  96, h: 124, rot:  9,  pos: { bottom: 0.08, left: 0.22 } },
      { uri: PX.d, w:  82, h: 105, rot: -5,  pos: { bottom: 0.06, right: 0.04 } },
    ],
    decor: [
      { emoji: '✨', top: 0.04, right: 0.36 },
      { emoji: '💜', bottom: 0.22, left: 0.04 },
    ],
    title: 'Discover What\'s\nHappening Near You.',
    subtitle: 'See walks, hangouts, game nights and more — happening right around you.',
    btnLabel: 'Continue',
  },
  {
    grad:     ['#EEF5FB', '#F5EEFD', '#FDF6EE'],
    darkGrad: ['#080E1A', '#0E0818', '#1A1208'],
    photos: [
      { uri: PX.e, w: 118, h: 152, rot:  5,  pos: { top: 0.06, right: 0.06 } },
      { uri: PX.f, w:  96, h: 124, rot: -7,  pos: { top: 0.10, left: 0.05 } },
      { uri: PX.g, w:  96, h: 124, rot:  8,  pos: { bottom: 0.06, right: 0.18 } },
      { uri: PX.h, w:  82, h: 105, rot: -4,  pos: { bottom: 0.08, left: 0.04 } },
    ],
    decor: [
      { emoji: '⭐', top: 0.03, left: 0.42 },
      { emoji: '🤝', bottom: 0.24, right: 0.04 },
    ],
    title: 'Meet Real People\nNear You.',
    subtitle: 'Join pings, meet your neighbours, and build your local crew one activity at a time.',
    btnLabel: 'Continue',
  },
  {
    grad:     ['#F5EEFD', '#EEF3FB', '#FDF0EE'],
    darkGrad: ['#0E0818', '#080E1A', '#1A0C08'],
    photos: [
      { uri: PX.b, w: 118, h: 152, rot: -6,  pos: { top: 0.08, left: 0.06 } },
      { uri: PX.a, w:  96, h: 124, rot:  7,  pos: { top: 0.04, right: 0.05 } },
      { uri: PX.d, w:  96, h: 124, rot: -9,  pos: { bottom: 0.07, right: 0.06 } },
      { uri: PX.h, w:  82, h: 105, rot:  5,  pos: { bottom: 0.06, left: 0.24 } },
    ],
    decor: [
      { emoji: '⚡', top: 0.04, left: 0.38 },
      { emoji: '🎯', bottom: 0.26, left: 0.04 },
    ],
    title: 'Drop a Ping.\nSee Who Shows Up.',
    subtitle: 'Host your own events. See who shows up nearby. Make something happen.',
    btnLabel: 'Continue',
  },
  {
    grad:     ['#EEF8F0', '#EEF3FB', '#F5F5EE'],
    darkGrad: ['#081408', '#080E1A', '#141408'],
    photos: [
      { uri: PX.g, w: 118, h: 152, rot:  7,  pos: { top: 0.06, right: 0.05 } },
      { uri: PX.f, w:  96, h: 124, rot: -8,  pos: { top: 0.08, left: 0.04 } },
      { uri: PX.c, w:  96, h: 124, rot:  6,  pos: { bottom: 0.07, left: 0.20 } },
      { uri: PX.e, w:  82, h: 105, rot: -5,  pos: { bottom: 0.06, right: 0.06 } },
    ],
    decor: [
      { emoji: '📍', top: 0.03, right: 0.38 },
      { emoji: '🗺️', bottom: 0.26, right: 0.04 },
    ],
    title: 'Know What\'s\nAround You.',
    subtitle: 'Location access lets us show you what\'s happening nearby — in real time.',
    btnLabel: 'Allow Location',
    onAction: async () => { await Location.requestForegroundPermissionsAsync(); },
  },
  {
    grad:     ['#F5EEFD', '#FEEEF5', '#EEF3FB'],
    darkGrad: ['#0E0818', '#180810', '#080E1A'],
    photos: [
      { uri: PX.a, w: 118, h: 152, rot: -7,  pos: { top: 0.07, left: 0.04 } },
      { uri: PX.c, w:  96, h: 124, rot:  6,  pos: { top: 0.05, right: 0.06 } },
      { uri: PX.b, w:  96, h: 124, rot:  8,  pos: { bottom: 0.07, right: 0.18 } },
      { uri: PX.f, w:  82, h: 105, rot: -4,  pos: { bottom: 0.06, left: 0.06 } },
    ],
    decor: [
      { emoji: '💌', top: 0.04, left: 0.40 },
      { emoji: '👥', bottom: 0.26, right: 0.04 },
    ],
    title: 'Find Friends\nAlready on Ping.',
    subtitle: 'See which of your contacts are already using Ping. Connect instantly.',
    btnLabel: 'Find My Friends',
    skipLabel: 'Skip for now',
  },
  {
    isPro: true,
    grad:     ['#F0EEFF', '#EAE0FF', '#E0EEFF'],
    darkGrad: ['#0C0020', '#080020', '#00081A'],
    photos: [
      { uri: PX.e, w: 118, h: 152, rot:  5,  pos: { top: 0.06, left: 0.05 } },
      { uri: PX.g, w:  96, h: 124, rot: -8,  pos: { top: 0.08, right: 0.05 } },
      { uri: PX.h, w:  96, h: 124, rot:  7,  pos: { bottom: 0.06, right: 0.06 } },
      { uri: PX.d, w:  82, h: 105, rot: -6,  pos: { bottom: 0.08, left: 0.22 } },
    ],
    decor: [
      { emoji: '💎', top: 0.04, right: 0.40 },
      { emoji: '⭐', bottom: 0.26, left: 0.04 },
    ],
    title: 'Go Pro — Free\nFor New Users.',
    subtitle: 'Get 1 month of Ping Pro with full features — on us. No payment needed today.',
    btnLabel: 'Claim Free Pro',
    skipLabel: 'Start for free',
  },
];

// ── PhotoCollage ──────────────────────────────────────────────────────────────

function PhotoCollage({ slide, isDark, floatAnim }: { slide: SlideData; isDark: boolean; floatAnim: Animated.Value }) {
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {/* Photos */}
      {slide.photos.map((p, i) => {
        const pos: any = {};
        if (p.pos.top    !== undefined) pos.top    = Math.round(HERO_H * p.pos.top);
        if (p.pos.bottom !== undefined) pos.bottom = Math.round(HERO_H * p.pos.bottom);
        if (p.pos.left   !== undefined) pos.left   = Math.round(W * p.pos.left);
        if (p.pos.right  !== undefined) pos.right  = Math.round(W * p.pos.right);

        const ty = floatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [i % 2 === 0 ? 0 : 5, i % 2 === 0 ? -8 : -3],
        });

        return (
          <Animated.View
            key={i}
            style={[
              ph.frame,
              pos,
              {
                width: p.w + 8,
                height: p.h + 8,
                transform: [{ rotate: `${p.rot}deg` }, { translateY: ty }],
                shadowColor: isDark ? '#000' : '#2A1850',
                zIndex: i === 0 ? 4 : i === 1 ? 3 : i === 2 ? 2 : 1,
              },
            ]}
          >
            <Image
              source={{ uri: p.uri }}
              style={{ width: p.w, height: p.h, borderRadius: 18 }}
              resizeMode="cover"
            />
          </Animated.View>
        );
      })}

      {/* Decorators */}
      {(slide.decor ?? []).map((d, i) => {
        const pos: any = { position: 'absolute', zIndex: 10 };
        if (d.top    !== undefined) pos.top    = Math.round(HERO_H * d.top);
        if (d.bottom !== undefined) pos.bottom = Math.round(HERO_H * d.bottom);
        if (d.left   !== undefined) pos.left   = Math.round(W * d.left);
        if (d.right  !== undefined) pos.right  = Math.round(W * d.right);
        return (
          <Text key={i} style={[ph.decor, pos]}>{d.emoji}</Text>
        );
      })}
    </View>
  );
}

const ph = StyleSheet.create({
  frame: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  decor: { fontSize: 22, position: 'absolute' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideX    = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const cur    = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  // Detect dark background based on slide grad
  const isDark = cur.grad[0].startsWith('#F') ? false : true;
  // Always use light mode visuals — the gradients are all light
  const bgIsDark = false;

  const textCol  = '#0D0B1E';
  const subCol   = 'rgba(26,23,60,0.5)';
  const dotInact = 'rgba(0,0,0,0.12)';
  const dotDone  = 'rgba(0,0,0,0.32)';

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
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40 && slideRef.current < SLIDES.length - 1) goTo(slideRef.current + 1);
        else if (g.dx > 40 && slideRef.current > 0) goTo(slideRef.current - 1);
      },
    })
  ).current;

  const showSkip  = slide < SLIDES.length - 1;
  const skipLabel = cur.skipLabel ?? 'Skip';
  const skipAction = cur.skipLabel ? finish : () => goTo(slide + 1);

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>

      {/* ── Hero: full-width gradient with floating photos ── */}
      <View style={s.hero} {...panResponder.panHandlers}>
        <LinearGradient
          colors={cur.grad}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top bar */}
        <View style={s.topBar}>
          {slide > 0 ? (
            <TouchableOpacity onPress={() => goTo(slide - 1)} hitSlop={14} activeOpacity={0.7} style={s.backBtn}>
              <Text style={s.backArrow}>‹</Text>
            </TouchableOpacity>
          ) : <View style={s.backBtn} />}

          {showSkip && (
            <TouchableOpacity onPress={skipAction} hitSlop={10} activeOpacity={0.7}>
              <Text style={s.skipText}>SKIP</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Photos */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <PhotoCollage slide={cur} isDark={false} floatAnim={floatAnim} />
        </Animated.View>
      </View>

      {/* ── Content ── */}
      <View style={s.body}>
        {/* Pro coupon */}
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

        {/* Dots */}
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

        {/* Button */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: cur.isPro ? Ping.purple : '#111111' }]}
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
  root: { flex: 1, backgroundColor: '#FAFAFA' },

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
  backArrow: { fontSize: 28, fontWeight: '300', color: 'rgba(0,0,0,0.40)', lineHeight: 34 },
  skipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(0,0,0,0.38)' },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    gap: 0,
  },

  // Pro
  proRow:      { alignItems: 'flex-start', gap: 6, marginBottom: 10 },
  couponBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: `${Ping.purple}18`, borderWidth: 1, borderColor: `${Ping.purple}40` },
  couponText:  { fontSize: 11, fontWeight: '700', color: Ping.purpleLight, letterSpacing: 0.3 },
  priceRow:    { fontSize: 17, fontWeight: '600', color: '#111' },
  strikePrice: { textDecorationLine: 'line-through', color: '#999', fontWeight: '400' },
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
