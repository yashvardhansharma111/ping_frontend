import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { Ping } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

// Sonar rings burst out on icon landing (delays offset by ~300ms for icon drop)
const RINGS = [
  { color: Ping.purple,      delay: 300, duration: 1800, width: 3 },
  { color: '#A78BFA',        delay: 460, duration: 1800, width: 2 },
  { color: Ping.purpleLight, delay: 620, duration: 1800, width: 2.5 },
  { color: '#7C3AED',        delay: 780, duration: 1800, width: 1.5 },
];

// 12 particles at 30° intervals
const PARTICLE_COUNT = 12;
const PARTICLE_META = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (i * (360 / PARTICLE_COUNT) * Math.PI) / 180,
  dist:  70 + (i % 3) * 30,
  size:  i % 3 === 0 ? 9 : i % 3 === 1 ? 6 : 4,
  color: i % 4 === 0 ? Ping.purple
       : i % 4 === 1 ? Ping.purpleLight
       : i % 4 === 2 ? '#C4B5FD'
       : Ping.orange,
  delay: 300 + i * 28,
}));

export default function PingDropAnimation({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  // Icon drop
  const iconY     = useRef(new Animated.Value(-180)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const iconOp    = useRef(new Animated.Value(0)).current;
  // Glow ring under icon after landing
  const glowScale = useRef(new Animated.Value(0)).current;
  const glowOp    = useRef(new Animated.Value(0)).current;
  // Existing effects
  const flash        = useRef(new Animated.Value(0)).current;
  const rings        = useRef(RINGS.map(() => new Animated.Value(0))).current;
  const particles    = useRef(PARTICLE_META.map(() => new Animated.Value(0))).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelY       = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!visible) {
      // Reset all
      [iconY, iconScale, iconOp, glowScale, glowOp, flash, labelOpacity, labelY].forEach((a, i) => {
        const defaults = [-180, 0.5, 0, 0, 0, 0, 0, 16];
        a.setValue(defaults[i]);
      });
      rings.forEach(r => r.setValue(0));
      particles.forEach(p => p.setValue(0));
      return;
    }

    // ── 1. Screen flash ────────────────────────────────────────────────────
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.14, duration: 80, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0,    duration: 520, useNativeDriver: true }),
    ]).start();

    // ── 2. Icon drops with spring bounce ──────────────────────────────────
    Animated.parallel([
      Animated.timing(iconOp, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.spring(iconY, {
        toValue: 0,
        damping: 11,
        stiffness: 160,
        mass: 0.85,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        damping: 11,
        stiffness: 160,
        mass: 0.85,
        useNativeDriver: true,
      }),
    ]).start();

    // ── 3. Glow ring pulses after icon lands ──────────────────────────────
    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.spring(glowScale, { toValue: 1, damping: 8, stiffness: 140, useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 0.55, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(glowScale, { toValue: 1.6, duration: 500, useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    // ── 4. Sonar rings (start after icon lands) ───────────────────────────
    const ringAnims = rings.map((r, i) =>
      Animated.sequence([
        Animated.delay(RINGS[i].delay),
        Animated.timing(r, { toValue: 1, duration: RINGS[i].duration, useNativeDriver: true }),
      ])
    );
    Animated.parallel(ringAnims).start(() => onDone());

    // ── 5. Spark particles ─────────────────────────────────────────────────
    Animated.parallel(
      particles.map((p, i) =>
        Animated.sequence([
          Animated.delay(PARTICLE_META[i].delay),
          Animated.timing(p, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      )
    ).start();

    // ── 6. "PING DROPPED" label floats up ─────────────────────────────────
    Animated.sequence([
      Animated.delay(320),
      Animated.parallel([
        Animated.timing(labelOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(labelY, { toValue: -60, duration: 900, useNativeDriver: true }),
      ]),
      Animated.delay(280),
      Animated.timing(labelOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Full-screen flash */}
      <Animated.View style={[StyleSheet.absoluteFill, s.flash, { opacity: flash }]} />

      {/* All animations anchored to map center */}
      <View style={s.anchor} pointerEvents="none">

        {/* Sonar rings */}
        {rings.map((r, i) => (
          <Animated.View
            key={`ring-${i}`}
            style={[
              s.ring,
              {
                borderColor: RINGS[i].color,
                borderWidth: RINGS[i].width,
                opacity: r.interpolate({
                  inputRange: [0, 0.08, 0.75, 1],
                  outputRange: [0,    1,    0.55, 0],
                }),
                transform: [{
                  scale: r.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.04, 16],
                  }),
                }],
              },
            ]}
          />
        ))}

        {/* Spark particles */}
        {particles.map((p, i) => {
          const m = PARTICLE_META[i];
          return (
            <Animated.View
              key={`p-${i}`}
              style={[
                s.particle,
                {
                  width: m.size,
                  height: m.size,
                  borderRadius: m.size / 2,
                  backgroundColor: m.color,
                  opacity: p.interpolate({
                    inputRange: [0, 0.12, 0.65, 1],
                    outputRange: [0, 1,    0.9,  0],
                  }),
                  transform: [
                    { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.angle) * m.dist] }) },
                    { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.angle) * m.dist] }) },
                    { scale: p.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 2.2, 1.1, 0.2] }) },
                  ],
                },
              ]}
            />
          );
        })}

        {/* Glow ring (appears on landing) */}
        <Animated.View
          style={[
            s.glowRing,
            {
              opacity: glowOp,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Brand icon dropping */}
        <Animated.View
          style={{
            position: 'absolute',
            transform: [{ translateY: iconY }, { scale: iconScale }],
            opacity: iconOp,
          }}
        >
          <Image
            source={require('../assets/images/icon.png')}
            style={s.iconImg}
            resizeMode="contain"
          />
        </Animated.View>

        {/* "PING DROPPED" label */}
        <Animated.View
          style={[s.labelWrap, { opacity: labelOpacity, transform: [{ translateY: labelY }] }]}
        >
          <Text style={s.labelText}>PING DROPPED</Text>
        </Animated.View>

      </View>
    </View>
  );
}

const RING_SIZE = 64;

const s = StyleSheet.create({
  flash: {
    backgroundColor: Ping.purple,
  },
  anchor: {
    position: 'absolute',
    top: '44%',
    left: W / 2,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  particle: {
    position: 'absolute',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  glowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Ping.purpleLight,
    opacity: 0,
  },
  iconImg: {
    width: 68,
    height: 68,
  },
  labelWrap: {
    position: 'absolute',
    top: -28,
    backgroundColor: 'rgba(124,58,237,0.88)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 20,
  },
  labelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
});
