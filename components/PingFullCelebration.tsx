import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const AVATAR_COLORS = ['#7C3AED', '#F97316', '#22C55E', '#3B82F6', '#EC4899', '#10B981', '#EF4444', '#8B5CF6'];
const RING_RADIUS = 110;
const AVATAR_SIZE = 50;
const CONTAINER  = (RING_RADIUS + AVATAR_SIZE) * 2;
const CENTER     = CONTAINER / 2;

const PARTICLE_COUNT = 12;
const PARTICLE_ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => (2 * Math.PI * i) / PARTICLE_COUNT);
const PARTICLE_DISTS  = [92, 112, 96, 118, 88, 115, 100, 108, 94, 120, 102, 110];

interface Props {
  count: number;
  names: string[];
  color: string;
  visible: boolean;
  onDone: () => void;
}

export default function PingFullCelebration({ count, names, color, visible, onDone }: Props) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const centerScale    = useRef(new Animated.Value(0)).current;
  const centerOpacity  = useRef(new Animated.Value(0)).current;
  const glowScale      = useRef(new Animated.Value(0.7)).current;
  const glowOpacity    = useRef(new Animated.Value(0)).current;
  const ringScale      = useRef(new Animated.Value(0.7)).current;
  const ringOpacity    = useRef(new Animated.Value(0)).current;
  const textY          = useRef(new Animated.Value(28)).current;
  const textOpacity    = useRef(new Animated.Value(0)).current;

  const displayNames = names.slice(0, 8);
  const n = displayNames.length || 1;

  // Always allocate 8 slots to avoid re-init
  const avatarAnims = useRef(
    Array.from({ length: 8 }, () => ({ scale: new Animated.Value(0), opacity: new Animated.Value(0) }))
  ).current;

  const particleAnims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      opacity: new Animated.Value(0), scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // ── Reset ──
    overlayOpacity.setValue(0);
    centerScale.setValue(0);
    centerOpacity.setValue(0);
    glowScale.setValue(0.7);
    glowOpacity.setValue(0);
    ringScale.setValue(0.7);
    ringOpacity.setValue(0);
    textY.setValue(28);
    textOpacity.setValue(0);
    avatarAnims.forEach(a => { a.scale.setValue(0); a.opacity.setValue(0); });
    particleAnims.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0); p.scale.setValue(0); });

    // ── 1. Overlay ──
    Animated.timing(overlayOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();

    // ── 2. Center badge ──
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(centerScale, { toValue: 1, damping: 10, stiffness: 160, useNativeDriver: true }),
        Animated.timing(centerOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }, 80);

    // ── 3. Glow ring pulse (loops) ──
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowScale,   { toValue: 1.5,  duration: 1000, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.45, duration: 500,  useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowScale,   { toValue: 0.85, duration: 1000, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.1,  duration: 500,  useNativeDriver: true }),
          ]),
        ])
      ).start();
      // Outer faint ring
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 1.9,  duration: 1400, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0.2,  duration: 700,  useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 0.7,  duration: 1400, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0.0,  duration: 700,  useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 160);

    // ── 4. Particles burst ──
    particleAnims.forEach((p, i) => {
      const angle = PARTICLE_ANGLES[i];
      const dist  = PARTICLE_DISTS[i];
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 650, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: Math.sin(angle) * dist, duration: 650, useNativeDriver: true }),
          Animated.spring(p.scale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.delay(380),
            Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        ]).start();
      }, 130 + i * 22);
    });

    // ── 5. Avatars pop in with stagger ──
    displayNames.forEach((_, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(avatarAnims[i].scale,   { toValue: 1, damping: 12, stiffness: 220, useNativeDriver: true }),
          Animated.timing(avatarAnims[i].opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start();
      }, 220 + i * 95);
    });

    // ── 6. Text ──
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(textY,      { toValue: 0, damping: 16, stiffness: 200, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 280 + n * 95);

    // ── 7. Auto-dismiss ──
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(textOpacity,    { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 3200);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDone}>
      <TouchableWithoutFeedback onPress={onDone}>
        <Animated.View style={[s.overlay, { opacity: overlayOpacity }]}>
          <View style={s.stage}>

            {/* Particles (absolute, centered on stage) */}
            {particleAnims.map((p, i) => (
              <Animated.View
                key={i}
                style={[s.particle, {
                  backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  opacity: p.opacity,
                  transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                }]}
              />
            ))}

            {/* Ring container */}
            <View style={s.ring}>

              {/* Outer faint ring */}
              <Animated.View style={[s.outerRing, { borderColor: color, transform: [{ scale: ringScale }], opacity: ringOpacity }]} />

              {/* Glow ring */}
              <Animated.View style={[s.glow, { borderColor: color, shadowColor: color, transform: [{ scale: glowScale }], opacity: glowOpacity }]} />

              {/* Avatar positions in ring */}
              {displayNames.map((name, i) => {
                const angle = (2 * Math.PI * i) / n - Math.PI / 2;
                const left  = CENTER + RING_RADIUS * Math.cos(angle) - AVATAR_SIZE / 2;
                const top   = CENTER + RING_RADIUS * Math.sin(angle) - AVATAR_SIZE / 2;
                const bg    = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const letter = name ? name[0].toUpperCase() : `${i + 1}`;
                return (
                  <Animated.View
                    key={i}
                    style={[s.avatarWrap, { left, top, transform: [{ scale: avatarAnims[i].scale }], opacity: avatarAnims[i].opacity }]}
                  >
                    <View style={[s.avatar, { backgroundColor: `${bg}2A`, borderColor: bg }]}>
                      <Text style={[s.avatarLetter, { color: bg }]}>{letter}</Text>
                    </View>
                    {/* Connector line to center */}
                    <View style={[s.connector, {
                      backgroundColor: `${bg}30`,
                      width: RING_RADIUS - AVATAR_SIZE / 2,
                      transform: [
                        { translateX: AVATAR_SIZE / 2 },
                        { translateY: AVATAR_SIZE / 2 - 1 },
                        { rotate: `${(angle + Math.PI) * (180 / Math.PI)}deg` },
                        { translateX: -(RING_RADIUS - AVATAR_SIZE / 2) / 2 },
                      ],
                    }]} />
                  </Animated.View>
                );
              })}

              {/* Center badge */}
              <Animated.View
                style={[s.center, { backgroundColor: color, shadowColor: color },
                  { transform: [{ scale: centerScale }], opacity: centerOpacity }]}
              >
                <MaterialCommunityIcons name="account-group" size={24} color="#FFF" />
                <Text style={s.centerCount}>{count}</Text>
              </Animated.View>

            </View>

            {/* Headline */}
            <Animated.View style={[s.textBlock, { transform: [{ translateY: textY }], opacity: textOpacity }]}>
              <Text style={s.headline}>Full Squad</Text>
              <Text style={s.sub}>All {count} members have joined</Text>
              <View style={s.tapHint}>
                <MaterialCommunityIcons name="gesture-tap" size={13} color="rgba(255,255,255,0.3)" />
                <Text style={s.tapText}>tap to continue</Text>
              </View>
            </Animated.View>

          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6,6,20,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: CONTAINER,
    height: CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 8,
  },
  avatarWrap: { position: 'absolute' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 19, fontWeight: '800' },
  connector: {
    position: 'absolute',
    height: 1,
    transformOrigin: 'left center',
  },
  center: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 22,
    elevation: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 1,
  },
  centerCount: { color: '#FFF', fontSize: 24, fontWeight: '900', lineHeight: 24 },
  particle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  textBlock: { alignItems: 'center', marginTop: 28, gap: 6 },
  headline: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '500' },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  tapText: { color: 'rgba(255,255,255,0.28)', fontSize: 11 },
});
