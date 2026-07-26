import { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** fraction of screen height shown by default (0.62 = 62%) */
  defaultSnap?: number;
  /** fraction when dragged fully up (0.92 = 92%) */
  expandedSnap?: number;
  handleColor?: string;
  sheetColor?: string;
  borderColor?: string;
}

export default function DraggableSheet({
  visible,
  onClose,
  children,
  defaultSnap  = 0.62,
  expandedSnap = 0.92,
  handleColor  = 'rgba(167,139,250,0.35)',
  sheetColor   = '#0E0E24',
  borderColor  = 'rgba(167,139,250,0.18)',
}: Props) {
  const DEFAULT_H  = SCREEN_H * defaultSnap;
  const EXPANDED_H = SCREEN_H * expandedSnap;

  const heightAnim   = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Refs to track snap state across gesture callbacks
  const snapH  = useRef(DEFAULT_H); // current snapped height
  const startH = useRef(DEFAULT_H); // height when gesture started

  // ── Open / close animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setMounted(true);
      snapH.current = DEFAULT_H;
      Animated.parallel([
        Animated.spring(heightAnim, {
          toValue: DEFAULT_H,
          damping: 26,
          stiffness: 280,
          mass: 0.9,
          useNativeDriver: false,
        }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 210, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  function springTo(target: number, onDone?: () => void) {
    snapH.current = target;
    Animated.spring(heightAnim, {
      toValue: target,
      damping: 28,
      stiffness: 300,
      mass: 0.9,
      useNativeDriver: false,
    }).start(onDone);
  }

  function closeDismiss() {
    snapH.current = 0;
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 210, useNativeDriver: true }),
    ]).start(onClose);
  }

  // ── Pan gesture on handle ──────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,

      onPanResponderGrant: () => {
        startH.current = snapH.current;
        heightAnim.stopAnimation();
      },

      onPanResponderMove: (_, { dy }) => {
        // dy negative = dragging UP (expanding), positive = dragging DOWN (collapsing)
        const next = Math.min(EXPANDED_H + 16, Math.max(0, startH.current - dy));
        heightAnim.setValue(next);
      },

      onPanResponderRelease: (_, { dy, vy }) => {
        const finalH = startH.current - dy;

        const midExpandCollapse = (DEFAULT_H + EXPANDED_H) / 2;
        const midCloseDefault   = DEFAULT_H * 0.45;

        if (vy > 1.2 || finalH < midCloseDefault) {
          // Fast swipe down OR dragged very low → close
          closeDismiss();
        } else if (vy < -1.0 || finalH > midExpandCollapse) {
          // Fast swipe up OR dragged past midpoint → expand
          springTo(EXPANDED_H);
        } else if (vy > 0.5 && snapH.current <= DEFAULT_H + 10) {
          // Moderate swipe down from default → close
          closeDismiss();
        } else {
          // Snap back to default
          springTo(DEFAULT_H);
        }
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={s.root}>

        {/* Dimmed backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropAnim }]}
          pointerEvents="none"
        />
        {/* Dismiss tap area */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeDismiss} />

        {/* The sheet itself — height is animated */}
        <Animated.View
          style={[
            s.sheet,
            {
              height: heightAnim,
              backgroundColor: sheetColor,
              borderColor,
            },
          ]}
        >
          {/* Drag handle — PanResponder lives here */}
          <View {...pan.panHandlers} style={s.handleArea}>
            <View style={[s.handle, { backgroundColor: handleColor }]} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {children}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 28,
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
