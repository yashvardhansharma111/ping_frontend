import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Flame, Star, Lightning, Heart, Coffee, MusicNote, Basketball, Smiley, Campfire, GameController,
} from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';

// Same marker icons + colours the ping creator offers
const PHOSPHOR_MAP: Record<string, { Icon: Icon; color: string }> = {
  flame:          { Icon: Flame,          color: '#EF4444' },
  star:           { Icon: Star,           color: '#F59E0B' },
  lightning:      { Icon: Lightning,      color: '#8B5CF6' },
  heart:          { Icon: Heart,          color: '#EC4899' },
  coffee:         { Icon: Coffee,         color: '#D97706' },
  musicNote:      { Icon: MusicNote,      color: '#7C3AED' },
  basketball:     { Icon: Basketball,     color: '#F97316' },
  smiley:         { Icon: Smiley,         color: '#22C55E' },
  campfire:       { Icon: Campfire,       color: '#EA580C' },
  gameController: { Icon: GameController, color: '#3B82F6' },
};

// Fallback when the creator picked no marker icon
const TYPE_EMOJI: Record<string, string> = {
  sport: '🏃', food: '🍜', music: '🎧', study: '📚',
  outdoor: '🌿', gaming: '🎮', meetup: '👋', custom: '✨',
};

function isEmojiKey(str: string) {
  return !/^[a-zA-Z]/.test(str);
}

interface Props {
  type: string;
  markerIcon?: string | null;
  selected?: boolean;
  count?: number;
  genderFilter?: 'all' | 'women_only' | 'men_only';
  isOwn?: boolean;
  isDark?: boolean;
  /** Creator's photo, shown as a small badge on the top-right of the bubble */
  avatarUrl?: string | null;
  avatarName?: string | null;
}

// Round bubble (white in light, near-black in dark) with the chosen emoji /
// icon inside and the creator's dp pinned to the corner — no tail, so the
// marker is anchored at its centre.
export default function PingMarker({
  type, markerIcon, selected = false, count = 0, genderFilter, isOwn = false, isDark = true, avatarUrl, avatarName,
}: Props) {
  const SIZE = selected ? 52 : 46;
  const EMOJI = selected ? 24 : 21;
  const ICON = selected ? 26 : 22;
  const DP = 20;

  const bubbleBg = isDark ? '#111114' : '#FFFFFF';
  const bubbleBorder = selected ? '#8B5CF6' : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.10)';
  const initial = (avatarName || '?').trim()[0]?.toUpperCase() ?? '?';

  function renderInner() {
    if (markerIcon) {
      if (isEmojiKey(markerIcon)) {
        return <Text style={{ fontSize: EMOJI, lineHeight: EMOJI + 6, includeFontPadding: false }}>{markerIcon}</Text>;
      }
      const m = PHOSPHOR_MAP[markerIcon];
      if (m) return <m.Icon size={ICON} color={m.color} weight="fill" />;
    }
    const emoji = TYPE_EMOJI[type] ?? '📍';
    return <Text style={{ fontSize: EMOJI, lineHeight: EMOJI + 6, includeFontPadding: false }}>{emoji}</Text>;
  }

  return (
    <View style={[s.outer, { width: SIZE + DP / 2, height: SIZE + DP / 2 }]}>
      <View
        style={[
          s.bubble,
          {
            width: SIZE, height: SIZE, borderRadius: SIZE / 2,
            backgroundColor: bubbleBg, borderColor: bubbleBorder, borderWidth: selected ? 2.5 : 1.5,
            shadowOpacity: selected ? 0.45 : 0.28,
            elevation: selected ? 12 : 7,
          },
        ]}
      >
        {renderInner()}

        {!isOwn && count > 1 && (
          <View style={[s.countBadge, { backgroundColor: isDark ? '#F1F0FF' : '#111114', borderColor: bubbleBg }]}>
            <Text style={[s.countText, { color: isDark ? '#111' : '#FFF' }]}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
        {genderFilter && genderFilter !== 'all' && (
          <View style={[s.genderBadge, { backgroundColor: genderFilter === 'women_only' ? '#EC4899' : '#3B82F6', borderColor: bubbleBg }]}>
            <MaterialCommunityIcons name={genderFilter === 'women_only' ? 'gender-female' : 'gender-male'} size={9} color="#FFF" />
          </View>
        )}
      </View>

      {/* Creator dp on the top-right corner */}
      {(avatarUrl || avatarName) && (
        <View style={[s.dp, { width: DP, height: DP, borderRadius: DP / 2, borderColor: bubbleBg, backgroundColor: isOwn ? '#7C3AED' : '#6545D9' }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={s.dpInitial}>{initial}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'flex-start', justifyContent: 'flex-end' },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  dp: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9,
  },
  dpInitial: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  countBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  countText: { fontSize: 9, fontWeight: '800', lineHeight: 11 },
  genderBadge: {
    position: 'absolute',
    bottom: -3,
    left: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
