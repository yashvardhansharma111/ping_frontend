import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_CFG: Record<string, { icon: IoniconName; color: string }> = {
  sport:   { icon: 'barbell',              color: '#EF4444' },
  food:    { icon: 'restaurant',           color: '#F97316' },
  music:   { icon: 'musical-notes',        color: '#8B5CF6' },
  study:   { icon: 'book',                 color: '#3B82F6' },
  outdoor: { icon: 'walk',                 color: '#10B981' },
  gaming:  { icon: 'game-controller',      color: '#EC4899' },
  meetup:  { icon: 'people',               color: '#7C3AED' },
  default: { icon: 'location',             color: '#6B7280' },
};

interface Props {
  type: string;
  selected?: boolean;
  count?: number;
  genderFilter?: 'all' | 'women_only' | 'men_only';
}

export default function PingMarker({ type, selected = false, count = 0, genderFilter }: Props) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.default;

  const SIZE  = selected ? 62 : 50;
  const ICON  = selected ? 28 : 22;
  const tipW  = selected ? 16 : 13;
  const tipH  = selected ? 20 : 16;
  const GLOW  = SIZE + 16; // outer ambient ring

  return (
    <View style={s.outer} pointerEvents="none">

      {/* Outer ambient glow ring */}
      <View
        style={{
          position: 'absolute',
          top: -(GLOW - SIZE) / 2,
          width: GLOW,
          height: GLOW,
          borderRadius: GLOW / 2,
          backgroundColor: `${cfg.color}18`,
          borderWidth: 1.5,
          borderColor: `${cfg.color}35`,
        }}
      />

      {/* Pin bubble */}
      <View
        style={[
          s.head,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: cfg.color,
            // Colored shadow for depth
            shadowColor: cfg.color,
            shadowOpacity: selected ? 0.75 : 0.55,
            shadowRadius: selected ? 16 : 10,
            elevation: selected ? 20 : 12,
            borderWidth: selected ? 3.5 : 2.5,
            borderColor: '#FFFFFF',
          },
        ]}
      >
        <Ionicons name={cfg.icon} size={ICON} color="#FFF" />

        {/* 3D specular highlight — top-right light source */}
        <View
          style={[
            s.specular,
            {
              width: SIZE * 0.42,
              height: SIZE * 0.28,
              top: SIZE * 0.1,
              right: SIZE * 0.08,
            },
          ]}
        />

        {/* Subtle inner bottom dark rim for depth */}
        <View
          style={[
            s.innerRim,
            {
              width: SIZE * 0.7,
              height: SIZE * 0.18,
              bottom: SIZE * 0.08,
              borderRadius: SIZE * 0.1,
            },
          ]}
        />

        {/* Participant count badge */}
        {count > 1 && (
          <View style={[s.countBadge, { backgroundColor: '#FFF' }]}>
            <Text style={[s.countText, { color: cfg.color }]}>
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        )}

        {/* Gender filter badge */}
        {genderFilter && genderFilter !== 'all' && (
          <View
            style={[
              s.genderBadge,
              { backgroundColor: genderFilter === 'women_only' ? '#EC4899' : '#3B82F6' },
            ]}
          >
            <Ionicons
              name={genderFilter === 'women_only' ? 'female' : 'male'}
              size={9}
              color="#FFF"
            />
          </View>
        )}
      </View>

      {/* Pin tip — pointed downward */}
      <View
        style={[
          s.tip,
          {
            borderLeftWidth: tipW / 2,
            borderRightWidth: tipW / 2,
            borderTopWidth: tipH,
            borderTopColor: cfg.color,
          },
        ]}
      />

      {/* Ground shadow ellipse */}
      <View
        style={[
          s.groundShadow,
          {
            backgroundColor: `${cfg.color}30`,
            width: tipW + 10,
            shadowColor: cfg.color,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'center' },
  head: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
  },
  specular: {
    position: 'absolute',
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.45)',
    // Slight rotation to look more natural
    transform: [{ rotate: '-20deg' }],
  },
  innerRim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  tip: {
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  groundShadow: {
    height: 5,
    borderRadius: 3,
    marginTop: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  countText: { fontSize: 10, fontWeight: '800', lineHeight: 11 },
  genderBadge: {
    position: 'absolute',
    bottom: -4,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
