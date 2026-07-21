import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';

const { height: H } = Dimensions.get('window');

const PURPLE = '#7C3AED';
const TEXT   = '#1C1040';
const MUTED  = '#9B8FC0';

// Ripple ring timed from splash sequence start
function Ripple({ delay, maxScale }: { delay: number; maxScale: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
    ]).start();
  }, []);
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, maxScale] });
  const opacity = anim.interpolate({ inputRange: [0, 0.06, 0.6, 1], outputRange: [0, 0.28, 0.06, 0] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: PURPLE,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

interface Props { onDone: () => void }

export default function SplashAnimation({ onDone }: Props) {
  // Icon drop + landing
  const dropY      = useRef(new Animated.Value(-H * 0.42)).current;
  const iconScale  = useRef(new Animated.Value(0.6)).current;
  const iconOp     = useRef(new Animated.Value(0)).current;
  // Ground shadow that grows after landing
  const shadowOp   = useRef(new Animated.Value(0)).current;
  const shadowScaleX = useRef(new Animated.Value(0.3)).current;
  // Text
  const titleY     = useRef(new Animated.Value(22)).current;
  const titleOp    = useRef(new Animated.Value(0)).current;
  const tagY       = useRef(new Animated.Value(14)).current;
  const tagOp      = useRef(new Animated.Value(0)).current;
  // Bottom dots
  const dotOp1     = useRef(new Animated.Value(0)).current;
  const dotOp2     = useRef(new Animated.Value(0)).current;
  const dotOp3     = useRef(new Animated.Value(0)).current;
  // Screen exit
  const screenOp   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // ── 1. Icon drops with natural spring bounce ───────────────────────────
    Animated.parallel([
      Animated.timing(iconOp, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(dropY, {
        toValue: 0,
        damping: 10,
        stiffness: 100,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        damping: 10,
        stiffness: 100,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();

    // ── 2. Ground shadow grows on landing ─────────────────────────────────
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(shadowOp, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(shadowScaleX, { toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true }),
      ]),
    ]).start();

    // ── 3. Title slides up after landing ──────────────────────────────────
    Animated.sequence([
      Animated.delay(660),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(titleY, { toValue: 0, damping: 14, stiffness: 200, useNativeDriver: true }),
      ]),
    ]).start();

    // ── 4. Tagline ────────────────────────────────────────────────────────
    Animated.sequence([
      Animated.delay(860),
      Animated.parallel([
        Animated.timing(tagOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(tagY, { toValue: 0, damping: 14, stiffness: 200, useNativeDriver: true }),
      ]),
    ]).start();

    // ── 5. Dots stagger ───────────────────────────────────────────────────
    [[1060, dotOp1], [1210, dotOp2], [1360, dotOp3]].forEach(([d, a]) => {
      Animated.sequence([
        Animated.delay(d as number),
        Animated.timing(a as Animated.Value, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    });

    // ── 6. Exit ───────────────────────────────────────────────────────────
    Animated.sequence([
      Animated.delay(2800),
      Animated.timing(screenOp, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  const ICON = 108;

  return (
    <Animated.View style={[s.root, { opacity: screenOp }]}>

      {/* ── Icon area ─────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.iconArea,
          { opacity: iconOp, transform: [{ translateY: dropY }, { scale: iconScale }] },
        ]}
      >
        {/* Ripple rings — delays include the ~500ms until icon lands */}
        <Ripple delay={500} maxScale={2.2} />
        <Ripple delay={720} maxScale={3.6} />
        <Ripple delay={940} maxScale={5.2} />

        {/* Brand icon */}
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: ICON, height: ICON }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Ground shadow — appears after landing */}
      <Animated.View
        style={[
          s.groundShadow,
          {
            opacity: shadowOp,
            transform: [{ scaleX: shadowScaleX }],
            marginTop: -4,
          },
        ]}
      />

      {/* ── Text block ────────────────────────────────────────────────────── */}
      <View style={s.textBlock}>
        <Animated.Text style={[s.title, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          Ping
        </Animated.Text>
        <Animated.Text style={[s.tagline, { opacity: tagOp, transform: [{ translateY: tagY }] }]}>
          Drop a ping · Meet your tribe
        </Animated.Text>
      </View>

      {/* ── Bottom dots ───────────────────────────────────────────────────── */}
      <View style={s.dots}>
        <Animated.View style={[s.dot, s.dotActive, { opacity: dotOp1 }]} />
        <Animated.View style={[s.dot, { opacity: dotOp2 }]} />
        <Animated.View style={[s.dot, { opacity: dotOp3 }]} />
      </View>

    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    gap: 8,
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  groundShadow: {
    width: 56,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(124,58,237,0.13)',
  },
  textBlock: {
    alignItems: 'center',
    gap: 7,
    marginTop: 20,
  },
  title: {
    fontSize: 46,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -1.8,
  },
  tagline: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  dots: {
    position: 'absolute',
    bottom: 56,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(124,58,237,0.16)',
  },
  dotActive: {
    width: 22,
    borderRadius: 3,
    backgroundColor: PURPLE,
  },
});
