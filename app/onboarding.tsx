import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ping, Spacing, Radius } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: W } = Dimensions.get('window');

// ── Slide definitions ─────────────────────────────────────────────────────────

type OrbitSlide = {
  kind: 'orbit';
  title: string;
  subtitle: string;
  icon: IoniconName;
  color: string;
  accent: string;
};

type PermSlide = {
  kind: 'perm';
  icon: IoniconName;
  color: string;
  accent: string;
  title: string;
  subtitle: string;
  points: { icon: IoniconName; text: string }[];
  btnLabel: string;
  skipLabel?: string;
  onAllow: () => Promise<void>;
};

type Slide = OrbitSlide | PermSlide;

// ── Orbit items ───────────────────────────────────────────────────────────────

const ORBIT_ITEMS: {
  icon: IoniconName; color: string; bg: string;
  radius: number; duration: number; startAngle: number; ccw?: boolean;
}[] = [
  { icon: 'walk-outline',            color: '#10B981', bg: '#10B98128', radius: 118, duration: 10000, startAngle: 0 },
  { icon: 'restaurant-outline',      color: '#F97316', bg: '#F9731628', radius: 140, duration: 14000, startAngle: 60,  ccw: true },
  { icon: 'musical-notes-outline',   color: '#8B5CF6', bg: '#8B5CF628', radius: 106, duration: 11500, startAngle: 130 },
  { icon: 'game-controller-outline', color: '#EC4899', bg: '#EC489928', radius: 132, duration: 15000, startAngle: 200, ccw: true },
  { icon: 'book-outline',            color: '#3B82F6', bg: '#3B82F628', radius: 114, duration: 12500, startAngle: 270 },
  { icon: 'chatbubble-outline',      color: '#A78BFA', bg: '#A78BFA28', radius: 145, duration: 13500, startAngle: 340, ccw: true },
];

const ORBIT_CENTER = 170;

// ── OrbitItem ─────────────────────────────────────────────────────────────────

function OrbitItem({ icon, color, bg, radius, duration, startAngle, ccw }: typeof ORBIT_ITEMS[0]) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, []);

  const d = ccw ? -1 : 1;
  const spin    = anim.interpolate({ inputRange: [0, 1], outputRange: [`${startAngle}deg`,  `${startAngle + d * 360}deg`] });
  const counter = anim.interpolate({ inputRange: [0, 1], outputRange: [`${-startAngle}deg`, `${-startAngle - d * 360}deg`] });

  return (
    <Animated.View style={[s.orbitArm, { transform: [{ rotate: spin }, { translateX: radius }] }]}>
      <Animated.View style={{ transform: [{ rotate: counter }] }}>
        <View style={[s.orbitBubble, { backgroundColor: bg, borderColor: `${color}44` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);

  const opacity   = useRef(new Animated.Value(1)).current;
  const slideX    = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  // Orbit pulse rings
  const p1 = useRef(new Animated.Value(0)).current;
  const p2 = useRef(new Animated.Value(0)).current;

  // Permission slide icon bounce
  const permBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(p1, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
    setTimeout(() => {
      Animated.loop(Animated.timing(p2, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
    }, 1300);
    // Permission icon idle float
    Animated.loop(Animated.sequence([
      Animated.spring(permBounce, { toValue: 1.06, damping: 8, stiffness: 80, useNativeDriver: true }),
      Animated.spring(permBounce, { toValue: 0.96, damping: 8, stiffness: 80, useNativeDriver: true }),
    ])).start();
  }, []);

  const r1Scale   = p1.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const r1Opacity = p1.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.38, 0.1, 0] });
  const r2Scale   = p2.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const r2Opacity = p2.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.26, 0.06, 0] });

  const SLIDES: Slide[] = [
    {
      kind: 'orbit', icon: 'location', color: Ping.purple, accent: '#C4B5FD',
      title: 'Discover Nearby',
      subtitle: 'See walks, hangouts, game nights and more — happening right around you.',
    },
    {
      kind: 'orbit', icon: 'people', color: '#2563EB', accent: '#93C5FD',
      title: 'Meet Real People',
      subtitle: 'Join pings, meet your neighbors, and build your local crew one activity at a time.',
    },
    {
      kind: 'orbit', icon: 'flash', color: Ping.purple, accent: '#A78BFA',
      title: 'Drop Your Ping',
      subtitle: 'Host your own events. See who shows up nearby. Make something happen.',
    },
    {
      kind: 'perm',
      icon: 'location',
      color: '#10B981',
      accent: '#6EE7B7',
      title: 'Know What\'s Around You',
      subtitle: 'Location access lets us show you what\'s happening nearby — in real time.',
      points: [
        { icon: 'navigate-outline',       text: 'See activities within walking distance' },
        { icon: 'shield-checkmark-outline', text: 'Location never shared without your consent' },
        { icon: 'phone-portrait-outline', text: 'Works only while the app is open' },
      ],
      btnLabel: 'Allow Location Access',
      onAllow: async () => {
        await Location.requestForegroundPermissionsAsync();
      },
    },
    {
      kind: 'perm',
      icon: 'people',
      color: '#3B82F6',
      accent: '#93C5FD',
      title: 'Find Friends on Ping',
      subtitle: 'See which of your contacts are already using Ping.',
      points: [
        { icon: 'person-add-outline',   text: 'Instantly connect with friends on Ping' },
        { icon: 'lock-closed-outline',  text: 'Contacts are never uploaded or stored' },
        { icon: 'flash-outline',        text: 'Start pings with people you already know' },
      ],
      btnLabel: 'Find My Friends',
      skipLabel: 'Skip for now',
      onAllow: async () => {
        // expo-contacts not installed — navigates to next slide automatically
      },
    },
  ];

  const total = SLIDES.length;

  function goTo(next: number) {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: -28, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      slideX.setValue(28);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideX,  { toValue: 0, damping: 22, stiffness: 240, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 0.76, damping: 20, stiffness: 500, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, damping: 11, stiffness: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  async function finish() {
    await SecureStore.setItemAsync('onboardingDone', '1');
    router.replace('/(auth)/phone');
  }

  async function handleAllow() {
    const cur = SLIDES[slide];
    if (cur.kind === 'perm') {
      await cur.onAllow();
    }
    if (slide < total - 1) {
      goTo(slide + 1);
    } else {
      await finish();
    }
  }

  const cur    = SLIDES[slide];
  const isLast = slide === total - 1;

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Background blob */}
      <View style={[s.bgBlob, { backgroundColor: cur.color }]} />

      {/* ── Hero ── */}
      <View style={s.hero}>
        {cur.kind === 'orbit' ? (
          // Orbit hero (slides 1–3)
          <View style={s.orbitContainer}>
            <View style={[s.glowDisc, { backgroundColor: cur.color }]} />
            {ORBIT_ITEMS.map((item, i) => <OrbitItem key={i} {...item} />)}
            <Animated.View style={[s.pulseRing, { backgroundColor: cur.color, transform: [{ scale: r1Scale }], opacity: r1Opacity }]} />
            <Animated.View style={[s.pulseRing, { backgroundColor: cur.color, transform: [{ scale: r2Scale }], opacity: r2Opacity }]} />
            <Animated.View style={[s.centerWrap, { transform: [{ scale: iconScale }] }]}>
              <Image source={require('../assets/images/icon.png')} style={s.centerIcon} resizeMode="contain" />
              <View style={s.centerSheen} />
            </Animated.View>
          </View>
        ) : (
          // Permission hero (slides 4–5)
          <View style={s.permHero}>
            {/* Outer glow rings */}
            <Animated.View style={[s.permRing, s.permRing1, { borderColor: `${cur.color}30` }]} />
            <Animated.View style={[s.permRing, s.permRing2, { borderColor: `${cur.color}20` }]} />
            {/* Icon bubble */}
            <Animated.View style={[s.permIconWrap, { transform: [{ scale: permBounce }] }]}>
              <Image source={require('../assets/images/icon.png')} style={s.permCenterIcon} resizeMode="contain" />
              <View style={s.centerSheen} />
            </Animated.View>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      <Animated.View style={[s.content, { opacity, transform: [{ translateX: slideX }] }]}>
        <Text style={s.brandLabel}>ping</Text>
        <Text style={[s.title, { color: cur.accent }]}>{cur.title}</Text>
        <Text style={s.subtitle}>{cur.subtitle}</Text>

        {/* Permission benefit points */}
        {cur.kind === 'perm' && (
          <View style={s.points}>
            {cur.points.map((pt, i) => (
              <View key={i} style={s.pointRow}>
                <View style={[s.pointIconWrap, { backgroundColor: `${cur.color}20` }]}>
                  <Ionicons name={pt.icon} size={16} color={cur.color} />
                </View>
                <Text style={s.pointText}>{pt.text}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* ── Dots ── */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => i < slide && goTo(i)} activeOpacity={0.7}>
            <View style={[
              s.dot,
              i === slide
                ? [s.dotActive, { backgroundColor: cur.accent }]
                : i < slide
                  ? [s.dotDone, { backgroundColor: `${cur.accent}60` }]
                  : s.dotInactive,
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        {cur.kind === 'orbit' ? (
          // Orbit slides: Next / Get Started
          <>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: cur.color }]}
              onPress={() => (slide === 2 ? goTo(3) : isLast ? finish() : goTo(slide + 1))}
              activeOpacity={0.86}
            >
              <Text style={s.btnText}>{slide === 2 ? 'Continue' : 'Next'}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
            {slide < 2 && (
              <TouchableOpacity onPress={finish} activeOpacity={0.6} style={s.skipBtn}>
                <Text style={s.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          // Permission slides
          <>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: cur.color }]}
              onPress={handleAllow}
              activeOpacity={0.86}
            >
              <Ionicons name={slide === 3 ? 'location' : 'people'} size={18} color="#FFF" />
              <Text style={s.btnText}>{isLast ? (cur as PermSlide).btnLabel : (cur as PermSlide).btnLabel}</Text>
            </TouchableOpacity>

            {/* Skip for contacts slide */}
            {(cur as PermSlide).skipLabel && (
              <TouchableOpacity onPress={finish} activeOpacity={0.6} style={s.skipBtn}>
                <Text style={s.skipText}>{(cur as PermSlide).skipLabel}</Text>
              </TouchableOpacity>
            )}
            {/* For location (no skip), offer "Maybe later" that still advances */}
            {!(cur as PermSlide).skipLabel && (
              <TouchableOpacity
                onPress={() => (isLast ? finish() : goTo(slide + 1))}
                activeOpacity={0.6}
                style={s.skipBtn}
              >
                <Text style={s.skipText}>Maybe later</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ORBIT_C = 170;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060612', alignItems: 'center' },
  bgBlob: {
    position: 'absolute', width: W * 1.4, height: W * 1.4,
    borderRadius: W * 0.7, top: -W * 0.5, left: -(W * 0.2), opacity: 0.07,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Orbit
  orbitContainer: { width: 340, height: 340, alignItems: 'center', justifyContent: 'center' },
  glowDisc: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.1 },
  orbitArm: { position: 'absolute', top: ORBIT_C, left: ORBIT_C, width: 0, height: 0 },
  orbitBubble: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginLeft: -19, marginTop: -19,
  },
  pulseRing: { position: 'absolute', width: 82, height: 82, borderRadius: 41 },
  centerWrap: {
    width: 82, height: 82, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: '#11112A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55, shadowRadius: 22, elevation: 18,
  },
  centerIcon: { width: 64, height: 64 },
  centerSheen: {
    position: 'absolute', top: -16, left: -8, width: 36, height: 110,
    backgroundColor: 'rgba(255,255,255,0.14)', transform: [{ rotate: '28deg' }],
  },

  // Permission hero
  permHero: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  permRing: { position: 'absolute', borderWidth: 1.5, borderRadius: 999 },
  permRing1: { width: 200, height: 200 },
  permRing2: { width: 260, height: 260 },
  permIconWrap: {
    width: 110, height: 110, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: '#11112A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  permCenterIcon: { width: 86, height: 86 },

  // ── Content ───────────────────────────────────────────────────────────────────
  content: {
    width: W, paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm, alignItems: 'center', gap: Spacing.xs,
  },
  brandLabel: {
    fontSize: 11, fontWeight: '700', color: Ping.purpleLight,
    letterSpacing: 4, textTransform: 'uppercase', opacity: 0.6, marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4, lineHeight: 34 },
  subtitle: { fontSize: 14, color: 'rgba(212,207,255,0.55)', textAlign: 'center', lineHeight: 21, maxWidth: 300, marginTop: 4 },

  // Permission points
  points: { width: '100%', gap: 10, marginTop: Spacing.md },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pointText: { fontSize: 14, color: 'rgba(212,207,255,0.75)', flex: 1, lineHeight: 20 },

  // ── Dots ──────────────────────────────────────────────────────────────────────
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginVertical: Spacing.md },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22 },
  dotDone: { width: 8 },
  dotInactive: { width: 6, backgroundColor: 'rgba(167,139,250,0.18)' },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: { width: W, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  btn: {
    width: '100%', height: 54, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Ping.purple, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55, shadowRadius: 16, elevation: 10,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  skipText: { fontSize: 14, color: 'rgba(167,139,250,0.4)', fontWeight: '600' },
});
