import { useState, useRef, useEffect, type ReactNode } from 'react';
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
import Svg, { Circle, Path } from 'react-native-svg';
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
  type SharedValue,
} from 'react-native-reanimated';
import { Ping, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const HERO_H = Math.round(H * 0.56);

// ── Orbit geometry ────────────────────────────────────────────────────────────
const D = Math.round(Math.min(W * 0.86, HERO_H * 0.84)); // outer orbit diameter
const R = D / 2;
const CENTER_SIZE = Math.round(R * 0.52);
const RING_RADIUS = { inner: R * 0.50, mid: R * 0.80, outer: R } as const;
type RingName = keyof typeof RING_RADIUS;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Where the 5 orbiting avatars sit. inner+mid revolve together; outer revolves
// the other way with the feature icons.
const AVATAR_SLOTS: { ring: RingName; angle: number; size: number }[] = [
  { ring: 'inner', angle: -120, size: 44 },
  { ring: 'inner', angle:   70, size: 40 },
  { ring: 'mid',   angle:  -30, size: 60 },
  { ring: 'mid',   angle:  150, size: 64 },
  { ring: 'outer', angle:  -20, size: 46 },
];
const ICON_ANGLES = [-95, 175, 40, 115];

// ── Ambient sound ─────────────────────────────────────────────────────────────
// Drop your track at frontend/assets/sounds/ambient.mp3 and swap the line below:
//   const AMBIENT_SOURCE: AudioSource = require('@/assets/sounds/ambient.mp3');
// expo-av is a native module — it only works in an APK built after it was installed.
type AudioSource = number | { uri: string };
const AMBIENT_SOURCE: AudioSource | null = null;
const AMBIENT_VOLUME = 0.35;

// ── Photo bank ────────────────────────────────────────────────────────────────

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

// ── Slide data ────────────────────────────────────────────────────────────────

type SlideData = {
  darkGrad: readonly [string, string, string];
  center:   string;
  orbit:    [string, string, string, string, string];
  icons:    [IoniconName, IoniconName, IoniconName, IoniconName];
  title:    string;
  accent:   string;
  subtitle: string;
  btnLabel: string;
  skipLabel?: string;
  onAction?: () => Promise<void>;
  isPro?:   true;
};

const SLIDES: SlideData[] = [
  {
    darkGrad: ['#14101F', '#0E0A1C', '#080815'],
    center: PX.a,
    orbit:  [PX.b, PX.c, PX.d, PX.e, PX.f],
    icons:  ['compass', 'location', 'sparkles', 'people'],
    title:    'Discover What\'s',
    accent:   'Happening Near You',
    subtitle: 'See walks, hangouts, game nights and more — happening right around you.',
    btnLabel: 'Continue',
  },
  {
    darkGrad: ['#0E1220', '#0E0A1C', '#080815'],
    center: PX.e,
    orbit:  [PX.g, PX.h, PX.a, PX.b, PX.c],
    icons:  ['people', 'chatbubble', 'hand-left', 'heart'],
    title:    'Meet Real People',
    accent:   'Near You',
    subtitle: 'Join pings, meet your neighbours, and build your local crew one activity at a time.',
    btnLabel: 'Continue',
  },
  {
    darkGrad: ['#160E20', '#0E0A1C', '#080815'],
    center: PX.b,
    orbit:  [PX.d, PX.f, PX.g, PX.h, PX.a],
    icons:  ['flash', 'calendar', 'megaphone', 'location'],
    title:    'Drop a Ping.',
    accent:   'See Who Shows Up',
    subtitle: 'Host your own events. See who shows up nearby. Make something happen.',
    btnLabel: 'Continue',
  },
  {
    darkGrad: ['#0C1418', '#0E0A1C', '#080815'],
    center: PX.g,
    orbit:  [PX.c, PX.e, PX.b, PX.f, PX.d],
    icons:  ['navigate', 'map', 'location', 'radio'],
    title:    'Know What\'s',
    accent:   'Around You',
    subtitle: 'Location access lets us show you what\'s happening nearby — in real time.',
    btnLabel: 'Allow Location',
    onAction: async () => { await Location.requestForegroundPermissionsAsync(); },
  },
  {
    darkGrad: ['#180E1C', '#0E0A1C', '#080815'],
    center: PX.c,
    orbit:  [PX.a, PX.d, PX.h, PX.g, PX.e],
    icons:  ['mail', 'people', 'chatbubbles', 'call'],
    title:    'Find Friends',
    accent:   'Already on Ping',
    subtitle: 'See which of your contacts are already using Ping. Connect instantly.',
    btnLabel: 'Find My Friends',
    skipLabel: 'Skip for now',
  },
  {
    isPro: true,
    darkGrad: ['#120A28', '#0E0A1C', '#080815'],
    center: PX.h,
    orbit:  [PX.e, PX.g, PX.a, PX.c, PX.b],
    icons:  ['diamond', 'star', 'sparkles', 'ribbon'],
    title:    'Go Pro — Free',
    accent:   'For New Users',
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
      return;
    }

    let alive = true;
    (async () => {
      try {
        await AudioMod.setAudioModeAsync({
          playsInSilentModeIOS: false,
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

// ── Orbit primitives ──────────────────────────────────────────────────────────

function useEntrance(delayMs: number, fromScale = 0) {
  const scale   = useSharedValue(fromScale);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value   = withDelay(delayMs, withSpring(1, { damping: 13, stiffness: 95, mass: 0.9 }));
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    return () => { cancelAnimation(scale); cancelAnimation(opacity); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { scale, opacity };
}

// Translucent filled disc that breathes slowly.
function Disc({ radius, alphaHex, delayMs, breatheMs }: { radius: number; alphaHex: string; delayMs: number; breatheMs: number }) {
  const ent     = useEntrance(delayMs, 0.6);
  const breathe = useSharedValue(1);

  useEffect(() => {
    breathe.value = withDelay(delayMs + 700, withRepeat(
      withSequence(
        withTiming(1.035, { duration: breatheMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,     { duration: breatheMs, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    ));
    return () => cancelAnimation(breathe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: ent.opacity.value,
    transform: [{ scale: ent.scale.value * breathe.value }],
  }));

  const d = radius * 2;
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: R - radius, left: R - radius, width: d, height: d, borderRadius: radius,
          backgroundColor: `${Ping.purple}${alphaHex}` },
        anim,
      ]}
    />
  );
}

function DashedRing({ delayMs }: { delayMs: number }) {
  const ent = useEntrance(delayMs, 0.85);
  const anim = useAnimatedStyle(() => ({
    opacity: ent.opacity.value,
    transform: [{ scale: ent.scale.value }],
  }));
  return (
    <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, anim]}>
      <Svg width={D} height={D}>
        <Circle cx={R} cy={R} r={R - 1} stroke={`${Ping.purpleLight}8C`} strokeWidth={1.5} strokeDasharray="5 9" fill="none" />
      </Svg>
    </Reanimated.View>
  );
}

// Rotating container. Children counter-rotate so they stay upright.
function useOrbitRotation(periodMs: number, clockwise: boolean) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(
      withTiming(clockwise ? 360 : -360, { duration: periodMs, easing: Easing.linear }),
      -1, false,
    );
    return () => cancelAnimation(rot);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return rot;
}

function OrbitGroup({ rot, children }: { rot: SharedValue<number>; children: ReactNode }) {
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, anim]}>{children}</Reanimated.View>;
}

function OrbitItem({
  rot, angle, radius, size, delayMs, bobAmp, bobMs, children,
}: {
  rot: SharedValue<number>; angle: number; radius: number; size: number;
  delayMs: number; bobAmp: number; bobMs: number; children: ReactNode;
}) {
  const ent = useEntrance(delayMs);
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withDelay(delayMs + 800, withRepeat(
      withSequence(
        withTiming( bobAmp, { duration: bobMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(-bobAmp, { duration: bobMs, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    ));
    return () => cancelAnimation(bob);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rad = (angle * Math.PI) / 180;
  const left = R + radius * Math.cos(rad) - size / 2;
  const top  = R + radius * Math.sin(rad) - size / 2;

  const anim = useAnimatedStyle(() => ({
    opacity: ent.opacity.value,
    transform: [
      { rotate: `${-rot.value}deg` },
      { translateY: bob.value },
      { scale: ent.scale.value },
    ],
  }));

  return (
    <Reanimated.View style={[{ position: 'absolute', top, left, width: size, height: size }, anim]}>
      {children}
    </Reanimated.View>
  );
}

function Avatar({ uri, size, ring = 2 }: { uri: string; size: number; ring?: number }) {
  return (
    <View style={[orb.avatarShadow, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[orb.avatarRing, { width: size, height: size, borderRadius: size / 2, borderWidth: ring }]}>
        <Image source={{ uri }} style={{ width: size - ring * 2, height: size - ring * 2, borderRadius: size / 2 }} resizeMode="cover" />
      </View>
    </View>
  );
}

function Squiggle({ color, style, flip }: { color: string; style: any; flip?: boolean }) {
  const ent = useEntrance(900, 0.6);
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withSequence(
        withTiming( 8, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    );
    return () => cancelAnimation(sway);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const anim = useAnimatedStyle(() => ({
    opacity: ent.opacity.value,
    transform: [{ rotate: `${sway.value + (flip ? 180 : 0)}deg` }, { scale: ent.scale.value }],
  }));
  return (
    <Reanimated.View pointerEvents="none" style={[{ position: 'absolute' }, style, anim]}>
      <Svg width={34} height={22} viewBox="0 0 34 22">
        <Path d="M2 11 C 6 1, 10 1, 12 11 S 18 21, 21 11 S 28 1, 32 11" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Reanimated.View>
  );
}

// ── OrbitScene ────────────────────────────────────────────────────────────────

function OrbitScene({ slide }: { slide: SlideData }) {
  const rotInner = useOrbitRotation(70000, true);
  const rotOuter = useOrbitRotation(110000, false);
  const center   = useEntrance(0);

  const centerAnim = useAnimatedStyle(() => ({
    opacity: center.opacity.value,
    transform: [{ scale: center.scale.value }],
  }));

  return (
    <View style={orb.sceneWrap}>
      <View style={{ width: D, height: D }}>
        <Disc radius={R * 0.78} alphaHex="1A" delayMs={260} breatheMs={4400} />
        <Disc radius={R * 0.55} alphaHex="2E" delayMs={170} breatheMs={3800} />
        <Disc radius={R * 0.32} alphaHex="4A" delayMs={ 80} breatheMs={3200} />
        <DashedRing delayMs={340} />

        {/* outer orbit — icons + one avatar, counter-clockwise */}
        <OrbitGroup rot={rotOuter}>
          {slide.icons.map((name, i) => (
            <OrbitItem key={`${name}-${i}`} rot={rotOuter} angle={ICON_ANGLES[i]} radius={RING_RADIUS.outer}
              size={30} delayMs={620 + i * 70} bobAmp={2} bobMs={2400 + i * 300}>
              <View style={orb.iconPill}>
                <Ionicons name={name} size={16} color={Ping.purpleLight} />
              </View>
            </OrbitItem>
          ))}
          {AVATAR_SLOTS.filter(s => s.ring === 'outer').map((s, i) => (
            <OrbitItem key={`o-${i}`} rot={rotOuter} angle={s.angle} radius={RING_RADIUS.outer}
              size={s.size} delayMs={560} bobAmp={3} bobMs={3000}>
              <Avatar uri={slide.orbit[4]} size={s.size} />
            </OrbitItem>
          ))}
        </OrbitGroup>

        {/* inner + mid orbits — clockwise */}
        <OrbitGroup rot={rotInner}>
          {AVATAR_SLOTS.filter(s => s.ring !== 'outer').map((s, i) => (
            <OrbitItem key={`i-${i}`} rot={rotInner} angle={s.angle} radius={RING_RADIUS[s.ring]}
              size={s.size} delayMs={380 + i * 90} bobAmp={3 + i} bobMs={2800 + i * 350}>
              <Avatar uri={slide.orbit[i]} size={s.size} />
            </OrbitItem>
          ))}
        </OrbitGroup>

        {/* centre */}
        <Reanimated.View style={[orb.center, centerAnim]}>
          <Avatar uri={slide.center} size={CENTER_SIZE} ring={3} />
        </Reanimated.View>
      </View>

      <Squiggle color={Ping.purpleLight} style={{ top: 18, left: 26 }} />
      <Squiggle color="#F06FA8" style={{ bottom: 30, right: 28 }} flip />
    </View>
  );
}

const orb = StyleSheet.create({
  sceneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: R - CENTER_SIZE / 2,
    left: R - CENTER_SIZE / 2,
    width: CENTER_SIZE,
    height: CENTER_SIZE,
  },
  avatarShadow: {
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarRing: {
    borderColor: Ping.purpleLight,
    backgroundColor: '#1A1230',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconPill: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(143,99,244,0.18)',
    borderWidth: 1, borderColor: 'rgba(187,146,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [muted, setMuted] = useState(false);

  useAmbientSound(muted);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideX   = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

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
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: dir, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      slideX.setValue(-dir);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideX,   { toValue: 0, damping: 22, stiffness: 240, useNativeDriver: true }),
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

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>

      {/* ── Hero: orbit scene ── */}
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
          <OrbitScene key={slide} slide={cur} />
        </Animated.View>
      </View>

      {/* ── Content ── */}
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
          <Text style={[s.title, { color: textCol }]}>
            {cur.title}{'\n'}
            <Text style={{ color: Ping.purpleLight }}>{cur.accent}</Text>
          </Text>
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
          <TouchableOpacity onPress={handleAction} activeOpacity={0.88}>
            <LinearGradient
              colors={[Ping.purpleLight, Ping.purple, Ping.purpleDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.btn}
            >
              <Text style={s.btnText}>{cur.btnLabel}</Text>
            </LinearGradient>
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
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 12,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.1 },
  skipAlt: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
