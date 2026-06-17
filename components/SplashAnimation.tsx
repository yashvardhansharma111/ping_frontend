import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const PURPLE    = '#7C3AED';
const PURPLE_LT = '#A78BFA';
const BG        = '#080815';

// ── Sonar ripple ring ─────────────────────────────────────────────────────────
function Ripple({ delay, maxScale, color }: { delay: number; maxScale: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 1700, useNativeDriver: true }),
    ]).start();
  }, []);
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, maxScale] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.75, 0.25, 0] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 2,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// ── Floating particle dot ─────────────────────────────────────────────────────
function Particle({ delay, x, size }: { delay: number; x: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ]).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.1, 0.65, 1], outputRange: [0, 0.9, 0.5, 0] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        bottom: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PURPLE_LT,
        transform: [{ translateY }],
        opacity,
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onDone: () => void }

export default function SplashAnimation({ onDone }: Props) {
  const gridOpacity   = useRef(new Animated.Value(0)).current;
  const glowScale     = useRef(new Animated.Value(0.6)).current;
  const glowOpacity   = useRef(new Animated.Value(0)).current;
  const pinY          = useRef(new Animated.Value(-160)).current;
  const pinScale      = useRef(new Animated.Value(0.5)).current;
  const pinOpacity    = useRef(new Animated.Value(0)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const titleY        = useRef(new Animated.Value(32)).current;
  const tagOpacity    = useRef(new Animated.Value(0)).current;
  const tagY          = useRef(new Animated.Value(20)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Grid lines fade in immediately
    Animated.timing(gridOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Background glow blooms
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, damping: 10, stiffness: 60, useNativeDriver: true }),
      ]),
    ]).start();

    // Pin drops from above with spring bounce
    Animated.sequence([
      Animated.delay(320),
      Animated.timing(pinOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(320),
      Animated.spring(pinY, { toValue: 0, damping: 10, stiffness: 130, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(320),
      Animated.spring(pinScale, { toValue: 1, damping: 9, stiffness: 130, useNativeDriver: true }),
    ]).start();

    // "Ping" title slides up
    Animated.sequence([
      Animated.delay(780),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(titleY, { toValue: 0, damping: 14, stiffness: 220, useNativeDriver: true }),
      ]),
    ]).start();

    // Tagline
    Animated.sequence([
      Animated.delay(1050),
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(tagY, { toValue: 0, damping: 14, stiffness: 220, useNativeDriver: true }),
      ]),
    ]).start();

    // Fade out → done
    Animated.sequence([
      Animated.delay(2500),
      Animated.timing(screenOpacity, { toValue: 0, duration: 550, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  const PIN = 76;
  const TIP_W = 20;
  const TIP_H = 24;

  return (
    <Animated.View style={[s.root, { opacity: screenOpacity }]}>

      {/* ── Map grid ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: gridOpacity }]} pointerEvents="none">
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={`v${i}`} style={[s.gridV, { left: (W / 9) * i }]} />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={`h${i}`} style={[s.gridH, { top: (H / 17) * i }]} />
        ))}
      </Animated.View>

      {/* ── Radial background glow ── */}
      <Animated.View
        style={[s.glow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]}
        pointerEvents="none"
      />

      {/* ── Pin + ripples ── */}
      <View style={s.pinArea}>
        <Ripple delay={450}  maxScale={3.2} color={`${PURPLE}CC`} />
        <Ripple delay={720}  maxScale={4.8} color={`${PURPLE}80`} />
        <Ripple delay={980}  maxScale={6.5} color={`${PURPLE}40`} />

        <Animated.View
          style={{
            alignItems: 'center',
            transform: [{ translateY: pinY }, { scale: pinScale }],
            opacity: pinOpacity,
          }}
        >
          {/* Outer ambient ring */}
          <View
            style={{
              position: 'absolute',
              top: -8,
              width: PIN + 16,
              height: PIN + 16,
              borderRadius: (PIN + 16) / 2,
              backgroundColor: `${PURPLE}1A`,
              borderWidth: 1.5,
              borderColor: `${PURPLE}40`,
            }}
          />

          {/* Bubble */}
          <View
            style={{
              width: PIN,
              height: PIN,
              borderRadius: PIN / 2,
              backgroundColor: PURPLE,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: PURPLE,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.9,
              shadowRadius: 28,
              elevation: 28,
              borderWidth: 4,
              borderColor: '#FFF',
            }}
          >
            <Ionicons name="location" size={34} color="#FFF" />

            {/* Specular top-right highlight */}
            <View
              style={{
                position: 'absolute',
                width: PIN * 0.42,
                height: PIN * 0.28,
                top: PIN * 0.1,
                right: PIN * 0.08,
                borderRadius: 30,
                backgroundColor: 'rgba(255,255,255,0.45)',
                transform: [{ rotate: '-20deg' }],
              }}
            />
            {/* Inner bottom darkening rim for sphere depth */}
            <View
              style={{
                position: 'absolute',
                width: PIN * 0.7,
                height: PIN * 0.18,
                bottom: PIN * 0.08,
                borderRadius: PIN * 0.1,
                backgroundColor: 'rgba(0,0,0,0.12)',
              }}
            />
          </View>

          {/* Tip */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: TIP_W / 2,
              borderRightWidth: TIP_W / 2,
              borderTopWidth: TIP_H,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: PURPLE,
              marginTop: -1,
            }}
          />

          {/* Ground shadow */}
          <View
            style={{
              width: TIP_W + 14,
              height: 7,
              borderRadius: 4,
              backgroundColor: `${PURPLE}35`,
              marginTop: 2,
              shadowColor: PURPLE,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.45,
              shadowRadius: 6,
              elevation: 5,
            }}
          />
        </Animated.View>
      </View>

      {/* ── Floating particles ── */}
      <View style={s.particleZone} pointerEvents="none">
        <Particle delay={1100} x={W * 0.22} size={5} />
        <Particle delay={1220} x={W * 0.38} size={4} />
        <Particle delay={1060} x={W * 0.55} size={6} />
        <Particle delay={1180} x={W * 0.70} size={4} />
        <Particle delay={1300} x={W * 0.48} size={3} />
      </View>

      {/* ── App name + tagline ── */}
      <View style={s.textBlock}>
        <Animated.Text
          style={[s.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}
        >
          Ping
        </Animated.Text>
        <Animated.Text
          style={[s.tagline, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}
        >
          Find your vibe · Meet your tribe
        </Animated.Text>
      </View>

    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  gridV: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(167,139,250,0.065)',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(167,139,250,0.065)',
  },
  glow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: `${PURPLE}16`,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 80,
    elevation: 0,
  },
  pinArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  particleZone: {
    position: 'absolute',
    bottom: H * 0.37,
    left: 0,
    right: 0,
    height: 90,
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  title: {
    fontSize: 56,
    fontWeight: '800',
    color: '#F1F0FF',
    letterSpacing: -2,
    textShadowColor: `${PURPLE}BB`,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  tagline: {
    fontSize: 14,
    color: '#7B78A8',
    fontWeight: '500',
    letterSpacing: 0.4,
  },
});
