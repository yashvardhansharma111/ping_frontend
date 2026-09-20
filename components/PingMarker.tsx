import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Flame, Star, Lightning, Heart, Coffee, MusicNote, Basketball, Smiley, Campfire, GameController,
} from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';

const PHOSPHOR_MAP: Record<string, Icon> = {
  flame: Flame,
  star: Star,
  lightning: Lightning,
  heart: Heart,
  coffee: Coffee,
  musicNote: MusicNote,
  basketball: Basketball,
  smiley: Smiley,
  campfire: Campfire,
  gameController: GameController,
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
}

export default function PingMarker({ markerIcon, selected = false, count = 0, genderFilter, isOwn = false }: Props) {
  const BUBBLE = selected ? 50 : isOwn ? 46 : 42;
  const TAIL_W = selected ? 10 : 8;
  const TAIL_H = selected ? 13 : 10;
  const ICON_SZ = selected ? 24 : 20;
  const EMOJI_SZ = selected ? 22 : 18;
  const DOT_SZ = selected ? 12 : 9;

  const bgColor = selected ? '#8B5CF6' : isOwn ? '#7C3AED' : '#6545D9';
  const borderColor = selected ? '#A78BFA' : isOwn ? '#9B7AFF' : '#7C3AED';

  function renderInner() {
    if (markerIcon) {
      if (isEmojiKey(markerIcon)) {
        return (
          <Text style={{ fontSize: EMOJI_SZ, lineHeight: EMOJI_SZ + 4, includeFontPadding: false }}>
            {markerIcon}
          </Text>
        );
      }
      const PhIcon = PHOSPHOR_MAP[markerIcon];
      if (PhIcon) return <PhIcon size={ICON_SZ} color="#FFF" weight="fill" />;
    }
    return (
      <View style={{ width: DOT_SZ, height: DOT_SZ, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.88)' }} />
    );
  }

  return (
    <View style={s.outer}>
      <View
        style={[
          s.bubble,
          {
            width: BUBBLE,
            height: BUBBLE,
            borderRadius: BUBBLE / 2,
            backgroundColor: bgColor,
            borderColor,
            shadowOpacity: selected ? 0.55 : 0.3,
            shadowRadius: selected ? 12 : 6,
            elevation: selected ? 14 : 7,
          },
          selected && s.selectedScale,
        ]}
      >
        {renderInner()}

        {isOwn && (
          <View style={s.badge}>
            <Text style={s.badgeText}>ME</Text>
          </View>
        )}
        {!isOwn && count > 1 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
        {genderFilter && genderFilter !== 'all' && (
          <View style={[s.genderBadge, { backgroundColor: genderFilter === 'women_only' ? '#EC4899' : '#3B82F6' }]}>
            <MaterialCommunityIcons
              name={genderFilter === 'women_only' ? 'gender-female' : 'gender-male'}
              size={9}
              color="#FFF"
            />
          </View>
        )}
      </View>

      {/* Teardrop tail */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: TAIL_W,
          borderRightWidth: TAIL_W,
          borderTopWidth: TAIL_H,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: bgColor,
          marginTop: -1,
        }}
      />
      {/* Ground shadow */}
      <View
        style={[
          s.groundShadow,
          { width: BUBBLE * 0.55, opacity: selected ? 0.18 : 0.1 },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'center' },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
  },
  selectedScale: {
    transform: [{ scale: 1.06 }],
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    elevation: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', lineHeight: 11, color: '#7C3AED' },
  genderBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    elevation: 3,
  },
  groundShadow: {
    height: 4,
    backgroundColor: '#000',
    borderRadius: 10,
    marginTop: 2,
  },
});
