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
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: W } = Dimensions.get('window');

// ── Slide definitions ─────────────────────────────────────────────────────────

type InfoSlide = {
  kind: 'info';
  slideIcon: IoniconName;
  title: string;
  subtitle: string;
  btnLabel: string;
};

type PermSlide = {
  kind: 'perm';
  slideIcon: IoniconName;
  title: string;
  subtitle: string;
  points: { icon: IoniconName; text: string }[];
  btnLabel: string;
  skipLabel?: string;
  onAllow: () => Promise<void>;
};

type Slide = InfoSlide | PermSlide;

const SLIDES: Slide[] = [
  {
    kind: 'info',
    slideIcon: 'location',
    title: 'Discover Nearby',
    subtitle: 'See walks, hangouts, game nights and more — happening right around you.',
    btnLabel: 'Next',
  },
  {
    kind: 'info',
    slideIcon: 'people',
    title: 'Meet Real People',
    subtitle: 'Join pings, meet your neighbors, and build your local crew one activity at a time.',
    btnLabel: 'Next',
  },
  {
    kind: 'info',
    slideIcon: 'flash',
    title: 'Drop Your Ping',
    subtitle: 'Host your own events. See who shows up nearby. Make something happen.',
    btnLabel: 'Continue',
  },
  {
    kind: 'perm',
    slideIcon: 'location',
    title: 'Know What\'s Around You',
    subtitle: 'Location access lets us show you what\'s happening nearby — in real time.',
    points: [
      { icon: 'navigate-outline',        text: 'See activities within walking distance' },
      { icon: 'shield-checkmark-outline', text: 'Location never shared without your consent' },
      { icon: 'phone-portrait-outline',  text: 'Works only while the app is open' },
    ],
    btnLabel: 'Allow Location Access',
    onAllow: async () => {
      await Location.requestForegroundPermissionsAsync();
    },
  },
  {
    kind: 'perm',
    slideIcon: 'people',
    title: 'Find Friends on Ping',
    subtitle: 'See which of your contacts are already using Ping.',
    points: [
      { icon: 'person-add-outline',  text: 'Instantly connect with friends on Ping' },
      { icon: 'lock-closed-outline', text: 'Contacts are never uploaded or stored' },
      { icon: 'flash-outline',       text: 'Start pings with people you already know' },
    ],
    btnLabel: 'Find My Friends',
    skipLabel: 'Skip for now',
    onAllow: async () => {
      // expo-contacts not installed — advances automatically
    },
  },
];

// ── Hero component ─────────────────────────────────────────────────────────────

function Hero({
  p1, p2, iconScale, slideIcon, isDark,
}: {
  p1: Animated.Value;
  p2: Animated.Value;
  iconScale: Animated.Value;
  slideIcon: IoniconName;
  isDark: boolean;
}) {
  const r1Scale   = p1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const r1Opacity = p1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.22, 0.08, 0] });
  const r2Scale   = p2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const r2Opacity = p2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.14, 0.05, 0] });

  const cardBg     = isDark ? '#18182A' : '#FFFFFF';
  const badgeBg    = isDark ? 'rgba(143,99,244,0.15)' : 'rgba(143,99,244,0.1)';
  const badgeBorder = 'rgba(143,99,244,0.3)';

  return (
    <View style={hero.container}>
      {/* Pulse rings */}
      <Animated.View style={[hero.ring, { backgroundColor: Ping.purple, transform: [{ scale: r1Scale }], opacity: r1Opacity }]} />
      <Animated.View style={[hero.ring, { backgroundColor: Ping.purple, transform: [{ scale: r2Scale }], opacity: r2Opacity }]} />

      {/* Outer static ring */}
      <View style={[hero.staticRing, { borderColor: isDark ? 'rgba(143,99,244,0.12)' : 'rgba(143,99,244,0.15)' }]} />

      {/* Center card */}
      <Animated.View
        style={[
          hero.card,
          {
            backgroundColor: cardBg,
            transform: [{ scale: iconScale }],
            shadowColor: Ping.purple,
          },
        ]}
      >
        <Image source={require('../assets/images/icon.png')} style={hero.icon} resizeMode="contain" />
        {/* Slide-specific icon badge */}
        <View style={[hero.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <Ionicons name={slideIcon} size={14} color={Ping.purpleLight} />
        </View>
      </Animated.View>
    </View>
  );
}

const hero = StyleSheet.create({
  container: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  staticRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
  },
  card: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
    overflow: 'visible',
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  badge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const scheme    = useColorScheme() ?? 'dark';
  const isDark    = scheme === 'dark';
  const [slide, setSlide] = useState(0);

  const opacity   = useRef(new Animated.Value(1)).current;
  const slideX    = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const p1        = useRef(new Animated.Value(0)).current;
  const p2        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(p1, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.timing(p2, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ).start();
    }, 1600);
  }, []);

  const bg      = isDark ? '#0C0C14' : '#F5F4FF';
  const textCol = isDark ? '#F1F0FF' : '#0D0B1E';
  const muted   = isDark ? 'rgba(209,207,240,0.5)' : 'rgba(26,23,80,0.45)';
  const pointTextCol = isDark ? 'rgba(209,207,240,0.75)' : 'rgba(26,23,80,0.7)';
  const iconBg  = isDark ? 'rgba(143,99,244,0.14)' : 'rgba(143,99,244,0.1)';
  const skipCol = isDark ? 'rgba(187,146,255,0.35)' : 'rgba(100,69,217,0.35)';
  const dotInactive = isDark ? 'rgba(187,146,255,0.18)' : 'rgba(100,69,217,0.18)';
  const dotDone     = isDark ? 'rgba(187,146,255,0.45)' : 'rgba(100,69,217,0.4)';

  function goTo(next: number) {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: -24, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      slideX.setValue(24);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(slideX,  { toValue: 0, damping: 24, stiffness: 260, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 0.82, damping: 20, stiffness: 500, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }),
      ]).start();
    });
  }

  async function finish() {
    await SecureStore.setItemAsync('onboardingDone', '1');
    router.replace('/(auth)/phone');
  }

  async function handleAction() {
    const cur = SLIDES[slide];
    if (cur.kind === 'perm') await cur.onAllow();
    if (slide < SLIDES.length - 1) goTo(slide + 1);
    else await finish();
  }

  const cur    = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;
  const showSkip = cur.kind === 'info' ? slide < 2 : !!(cur as PermSlide).skipLabel;
  const skipAction = cur.kind === 'perm' && (cur as PermSlide).skipLabel
    ? finish
    : () => (isLast ? finish() : goTo(slide + 1));
  const skipText = cur.kind === 'perm' && (cur as PermSlide).skipLabel
    ? (cur as PermSlide).skipLabel!
    : cur.kind === 'info' ? 'Skip' : 'Maybe later';

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Hero */}
      <View style={s.heroWrap}>
        <Hero p1={p1} p2={p2} iconScale={iconScale} slideIcon={cur.slideIcon} isDark={isDark} />
      </View>

      {/* Content */}
      <Animated.View style={[s.content, { opacity, transform: [{ translateX: slideX }] }]}>
        <Text style={[s.eyebrow, { color: Ping.purpleLight }]}>PING</Text>
        <Text style={[s.title, { color: textCol }]}>{cur.title}</Text>
        <Text style={[s.subtitle, { color: muted }]}>{cur.subtitle}</Text>

        {cur.kind === 'perm' && (
          <View style={s.points}>
            {(cur as PermSlide).points.map((pt, i) => (
              <View key={i} style={s.pointRow}>
                <View style={[s.pointIconWrap, { backgroundColor: iconBg }]}>
                  <Ionicons name={pt.icon} size={16} color={Ping.purpleLight} />
                </View>
                <Text style={[s.pointText, { color: pointTextCol }]}>{pt.text}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => i < slide && goTo(i)} activeOpacity={0.7}>
            <View
              style={[
                s.dot,
                i === slide
                  ? [s.dotActive, { backgroundColor: Ping.purple }]
                  : i < slide
                    ? { width: 8, height: 6, borderRadius: 3, backgroundColor: dotDone }
                    : { width: 6, height: 6, borderRadius: 3, backgroundColor: dotInactive },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity style={s.btn} onPress={handleAction} activeOpacity={0.86}>
          {cur.kind === 'perm' && <Ionicons name={cur.slideIcon} size={18} color="#FFF" />}
          <Text style={s.btnText}>{cur.btnLabel}</Text>
          {cur.kind === 'info' && <Ionicons name="arrow-forward" size={16} color="#FFF" />}
        </TouchableOpacity>

        {showSkip && (
          <TouchableOpacity onPress={skipAction} activeOpacity={0.6} style={s.skipBtn}>
            <Text style={[s.skipText, { color: skipCol }]}>{skipText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },

  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    width: W,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
    marginTop: 4,
  },

  // Permission points
  points: {
    width: '100%',
    gap: 10,
    marginTop: Spacing.md,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pointText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginVertical: Spacing.md,
  },
  dot: { borderRadius: 3 },
  dotActive: { width: 22, height: 6 },

  // Footer
  footer: {
    width: W,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  btn: {
    width: '100%',
    height: 54,
    borderRadius: Radius.full,
    backgroundColor: Ping.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
