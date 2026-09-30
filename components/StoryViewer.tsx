import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Image, Pressable, TouchableOpacity,
  Animated, Easing, PanResponder, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { storiesApi, type StoryGroup } from '@/lib/api';
import AppAvatar from '@/components/AppAvatar';
import ConfirmSheet from '@/components/ConfirmSheet';
import { Ping } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
const STORY_MS = 5000;

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

interface Props {
  visible: boolean;
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
  onViewed?: (storyId: string) => void;
  onDeleted?: (storyId: string) => void;
}

export default function StoryViewer({ visible, groups, startGroup, onClose, onViewed, onDeleted }: Props) {
  const insets = useSafeAreaInsets();
  const [gi, setGi] = useState(startGroup);
  const [si, setSi] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const paused = useRef(false);
  const remaining = useRef(1); // fraction of the current story left to play

  const group = groups[gi];
  const story = group?.stories[si];

  useEffect(() => {
    if (visible) { setGi(startGroup); setSi(0); }
  }, [visible, startGroup]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (si < group.stories.length - 1) { setSi(si + 1); return; }
    if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); return; }
    onClose();
  }, [gi, si, group, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (si > 0) { setSi(si - 1); return; }
    if (gi > 0) { const g = gi - 1; setGi(g); setSi(Math.max(0, groups[g].stories.length - 1)); return; }
    // first story of first group: restart it
    progress.setValue(0);
    remaining.current = 1;
    play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, groups]);

  function play() {
    const dur = STORY_MS * remaining.current;
    Animated.timing(progress, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: false })
      .start(({ finished }) => { if (finished && !paused.current) goNext(); });
  }

  // Start / restart the timer whenever the story changes (only once the image is ready)
  useEffect(() => {
    if (!visible || !story) return;
    progress.setValue(0);
    remaining.current = 1;
    paused.current = false;
    setImgLoaded(false);
    if (!group.isSelf) {
      storiesApi.view(story._id).catch(() => {});
      onViewed?.(story._id);
    }
    // prefetch the next image so transitions don't stall
    const next = group.stories[si + 1] ?? groups[gi + 1]?.stories[0];
    if (next) Image.prefetch(next.mediaUrl).catch(() => {});
    return () => progress.stopAnimation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, gi, si]);

  useEffect(() => {
    if (imgLoaded && visible) play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  function pause() {
    paused.current = true;
    progress.stopAnimation((v) => { remaining.current = 1 - v; });
  }
  function resume() {
    if (!paused.current) return;
    paused.current = false;
    play();
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderGrant: pause,
      onPanResponderRelease: (_, g) => { if (g.dy > 80) onClose(); else resume(); },
      onPanResponderTerminate: resume,
    }),
  ).current;

  async function deleteCurrent() {
    if (!story) return;
    try {
      await storiesApi.remove(story._id);
      onDeleted?.(story._id);
      // move on; if this was the only story in the group the parent will drop it
      if (group.stories.length <= 1) onClose();
      else if (si >= group.stories.length - 1) setSi(si - 1);
      else setSi(si); // same index now shows the next story
    } catch {
      /* toast handled by parent if needed */
    }
  }

  if (!visible || !group || !story) return null;

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.root} {...pan.panHandlers}>
        {/* media */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={pause}
          onPressOut={resume}
          onPress={(e) => { e.nativeEvent.locationX < W * 0.3 ? goPrev() : goNext(); }}
          delayLongPress={150}
        >
          <Image
            key={story._id}
            source={{ uri: story.mediaUrl }}
            style={s.media}
            resizeMode="contain"
            onLoadEnd={() => setImgLoaded(true)}
          />
          {!imgLoaded && (
            <View style={s.loader}><ActivityIndicator color="#FFF" /></View>
          )}
        </Pressable>

        <LinearGradient colors={['rgba(0,0,0,0.65)', 'transparent']} style={[s.topShade, { height: insets.top + 110 }]} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={[s.bottomShade, { height: insets.bottom + 140 }]} pointerEvents="none" />

        {/* progress bars */}
        <View style={[s.bars, { top: insets.top + 8 }]} pointerEvents="none">
          {group.stories.map((st, i) => (
            <View key={st._id} style={s.barTrack}>
              {i < si ? (
                <View style={[s.barFill, { width: '100%' }]} />
              ) : i === si ? (
                <Animated.View style={[s.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              ) : null}
            </View>
          ))}
        </View>

        {/* header */}
        <View style={[s.header, { top: insets.top + 20 }]}>
          <AppAvatar uri={group.user.avatarUrl} name={group.user.displayName || group.user.username} size={34} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{group.isSelf ? 'Your story' : (group.user.displayName || group.user.username)}</Text>
            <Text style={s.time}>{timeAgo(story.createdAt)}</Text>
          </View>
          {group.isSelf && (
            <>
              <View style={s.viewsPill}>
                <Ionicons name="eye" size={13} color="#FFF" />
                <Text style={s.viewsText}>{story.viewCount ?? 0}</Text>
              </View>
              <TouchableOpacity onPress={() => { pause(); setConfirmDelete(true); }} hitSlop={10} style={s.iconBtn}>
                <Ionicons name="trash-outline" size={19} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={10} style={s.iconBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {!!story.caption && (
          <View style={[s.captionWrap, { bottom: insets.bottom + 28 }]} pointerEvents="none">
            <Text style={s.caption}>{story.caption}</Text>
          </View>
        )}
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => { setConfirmDelete(false); resume(); }}
        title="Delete this story?"
        subtitle="It will disappear for everyone right away."
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onConfirm={deleteCurrent}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bars: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FFF' },
  header: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  viewsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  viewsText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  captionWrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  caption: {
    color: '#FFF', fontSize: 15, lineHeight: 21, textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    overflow: 'hidden',
  },
});

export const STORY_RING = { unseen: Ping.purple, seen: 'rgba(148,144,192,0.45)' };
