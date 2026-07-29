import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import {
  Map as MapLibreMap,
  Camera,
  type CameraRef,
  type MapRef,
} from '@/lib/mapLibre';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Ping, Typography, Spacing, Radius } from '@/constants/theme';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  visible: boolean;
  initialLat: number;
  initialLng: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

function parseCenter(event: any): { lat: number; lng: number } | null {
  // MapLibre v11: NativeSyntheticEvent<ViewStateChangeEvent>
  const ne = event?.nativeEvent ?? event;
  const center = ne?.center;
  if (Array.isArray(center) && center.length >= 2) {
    const lng = Number(center[0]);
    const lat = Number(center[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  // Legacy GeoJSON shape (older maplibre)
  const coords = event?.geometry?.coordinates ?? ne?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

export default function LocationPickerModal({ visible, initialLat, initialLng, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const pickerCameraRef = useRef<CameraRef>(null);
  const centerRef = useRef({ lat: initialLat, lng: initialLng });

  // Fly to initial coords every time the picker opens
  useEffect(() => {
    if (!visible) return;
    const next = { lat: initialLat, lng: initialLng };
    centerRef.current = next;
    setCenter(next);
    setConfirming(false);
    const t = setTimeout(() => {
      pickerCameraRef.current?.flyTo({
        center: [initialLng, initialLat],
        zoom: 15,
        duration: 500,
      });
    }, 320);
    return () => clearTimeout(t);
  }, [visible, initialLat, initialLng]);

  const pulseAnim   = useRef(new Animated.Value(0.8)).current;
  const settledAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    Animated.timing(settledAnim, {
      toValue: moving ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [moving]);

  function updateCenter(next: { lat: number; lng: number }) {
    centerRef.current = next;
    setCenter(next);
  }

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    try {
      // Prefer live map center — region event payload can lag or be empty on some builds
      const live = await mapRef.current?.getCenter?.();
      if (Array.isArray(live) && live.length >= 2) {
        const lng = Number(live[0]);
        const lat = Number(live[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          onConfirm(lat, lng);
          return;
        }
      }
      onConfirm(centerRef.current.lat, centerRef.current.lng);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent={false}>
      <View style={styles.root}>
        {/* Map */}
        <MapLibreMap
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          mapStyle={STYLE_URL}
          onRegionIsChanging={(e: any) => {
            // Ignore programmatic camera moves
            if (e?.nativeEvent?.userInteraction === false) return;
            setMoving(true);
          }}
          onRegionDidChange={(e: any) => {
            setMoving(false);
            if (e?.nativeEvent?.userInteraction === false) return;
            const next = parseCenter(e);
            if (next) updateCenter(next);
          }}
          touchRotate={false}
          touchPitch={false}
          compass={false}
          logo={false}
          attribution={false}
        >
          <Camera
            ref={pickerCameraRef}
            {...({
              centerCoordinate: [initialLng, initialLat],
              zoomLevel: 15,
              animationMode: 'none',
            } as any)}
          />
        </MapLibreMap>

        {/* Center pin — fixed at screen center */}
        <View style={styles.pinWrap} pointerEvents="none">
          <Animated.View
            style={[
              styles.pulseRing,
              { opacity: settledAnim, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <View style={[styles.pinShadow, moving && { opacity: 0.3 }]} />
          <View style={[styles.pin, { transform: [{ translateY: moving ? -8 : 0 }] }]}>
            <Ionicons name="location" size={44} color={Ping.purple} />
          </View>
        </View>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#1C1040" />
          </TouchableOpacity>
          <Text style={styles.title}>Pick a location</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hint banner */}
        <View style={styles.hintWrap} pointerEvents="none">
          <View style={styles.hintPill}>
            <Ionicons name="hand-left-outline" size={13} color="#1C1040" />
            <Text style={styles.hintText}>Drag the map to move the pin</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && { opacity: 0.7 }]}
            onPress={handleConfirm}
            disabled={confirming}
            activeOpacity={0.88}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.confirmText}>Place Ping Here</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.cancelLink} activeOpacity={0.7}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8E8E8' },

  pinWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as any,
  },
  pulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: Ping.purple,
    backgroundColor: `${Ping.purple}18`,
    bottom: '50%',
    marginBottom: -26,
  },
  pinShadow: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.25)',
    bottom: '48%',
  },
  pin: {
    marginBottom: 22,
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h3,
    color: '#1C1040',
    fontSize: 16,
  },

  hintWrap: {
    position: 'absolute',
    bottom: '44%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  hintText: {
    ...Typography.caption,
    color: '#1C1040',
    fontWeight: '600',
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  confirmBtn: {
    backgroundColor: Ping.purple,
    borderRadius: Radius.md,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmText: {
    ...Typography.bodyMed,
    color: '#FFF',
    fontWeight: '700',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#7B6DAA',
    fontWeight: '600',
  },
});
