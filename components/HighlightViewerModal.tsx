import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Image, Animated, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Highlight } from '@/lib/api';
import { Ping, Typography, Radius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const IMAGE_DURATION = 4000;

interface Props {
  highlight: Highlight | null;
  visible: boolean;
  onClose: () => void;
}

export default function HighlightViewerModal({ highlight, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const images = highlight?.images ?? [];
  const total = Math.max(images.length, 1);

  useEffect(() => {
    if (!visible || !highlight) {
      setCurrentIndex(0);
      progress.setValue(0);
      return;
    }
    startProgress();
    return () => stopProgress();
  }, [visible, currentIndex, highlight]);

  function startProgress() {
    progress.setValue(0);
    stopProgress();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: IMAGE_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) advance();
    });
  }

  function stopProgress() {
    animRef.current?.stop();
    animRef.current = null;
  }

  function advance() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }

  function goNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }

  if (!highlight) return null;

  const dateStr = highlight.pingDate
    ? new Date(highlight.pingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : highlight.createdAt
    ? new Date(highlight.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={sv.root}>
        {/* Background */}
        {images[currentIndex] ? (
          <Image source={{ uri: images[currentIndex] }} style={sv.image} resizeMode="cover" />
        ) : (
          <View style={[sv.image, { backgroundColor: '#1A1A38', alignItems: 'center', justifyContent: 'center' }]}>
            {/^[a-z0-9-]+$/.test(highlight.emoji ?? '')
              ? <Ionicons name={highlight.emoji as any} size={80} color="rgba(255,255,255,0.6)" />
              : <Text style={{ fontSize: 80 }}>{highlight.emoji}</Text>}
          </View>
        )}

        {/* Dark overlay */}
        <View style={sv.overlay} />

        {/* Top: progress bars + Instagram-style header */}
        <View style={[sv.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={sv.progressRow}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={sv.progressTrack}>
                {i < currentIndex ? (
                  <View style={[sv.progressFill, { width: '100%' }]} />
                ) : i === currentIndex ? (
                  <Animated.View
                    style={[
                      sv.progressFill,
                      { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          {/* Story identity row */}
          <View style={sv.storyHeader}>
            <View style={sv.storyLeft}>
              <View style={sv.emojiCircle}>
                {/^[a-z0-9-]+$/.test(highlight.emoji ?? '')
                  ? <Ionicons name={highlight.emoji as any} size={20} color="#FFF" />
                  : <Text style={{ fontSize: 20 }}>{highlight.emoji}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sv.storyTitle} numberOfLines={1}>{highlight.title}</Text>
                <Text style={sv.storyMeta} numberOfLines={1}>
                  {[dateStr, highlight.location, highlight.vibe].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={sv.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tap zones */}
        <View style={sv.tapZones} pointerEvents="box-none">
          <TouchableOpacity style={sv.tapLeft} activeOpacity={1} onPress={goBack} />
          <TouchableOpacity style={sv.tapRight} activeOpacity={1} onPress={goNext} />
        </View>

        {/* Bottom: only image count */}
        {images.length > 1 && (
          <View style={[sv.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={sv.imageCount}>{currentIndex + 1} / {images.length}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const sv = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', width: W, height: H },
  overlay: { position: 'absolute', width: W, height: H, backgroundColor: 'rgba(0,0,0,0.28)' },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 12,
    gap: 10,
    zIndex: 10,
  },
  progressRow: { flexDirection: 'row', gap: 4, height: 3 },
  progressTrack: {
    flex: 1, height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 2 },

  // Instagram-style story header
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  storyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  emojiCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  storyTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  tapZones: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', zIndex: 5,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
    alignItems: 'flex-end',
  },
  imageCount: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
