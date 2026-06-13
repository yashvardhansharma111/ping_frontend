import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_CFG: Record<string, { icon: IoniconName; color: string }> = {
  sport:   { icon: 'barbell-outline',        color: '#EF4444' },
  food:    { icon: 'restaurant-outline',     color: '#F97316' },
  music:   { icon: 'musical-notes-outline',  color: '#8B5CF6' },
  study:   { icon: 'book-outline',           color: '#3B82F6' },
  outdoor: { icon: 'walk-outline',           color: '#10B981' },
  gaming:  { icon: 'game-controller-outline',color: '#EC4899' },
  meetup:  { icon: 'people-outline',         color: '#7C3AED' },
  default: { icon: 'location-outline',       color: '#6B7280' },
};

interface Props {
  type: string;
  selected?: boolean;
  count?: number;
  genderFilter?: 'all' | 'women_only' | 'men_only';
}

export default function PingMarker({
  type,
  selected = false,
  count = 0,
  genderFilter,
}: Props) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.default;
  const SIZE = selected ? 46 : 36;
  const ICON = selected ? 20 : 15;
  const tipW = selected ? 11 : 9;
  const tipH = selected ? 13 : 10;

  return (
    <View style={s.outer} pointerEvents="none">
      {/* Pin bubble */}
      <View
        style={[
          s.head,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: cfg.color,
            shadowColor: '#000',
            shadowOpacity: selected ? 0.55 : 0.38,
            shadowRadius: selected ? 12 : 7,
            elevation: selected ? 14 : 7,
            borderWidth: selected ? 3 : 2,
            borderColor: '#FFFFFF',
          },
        ]}
      >
        <Ionicons name={cfg.icon} size={ICON} color="#FFF" />

        {/* 3D specular highlight — simulates light source from top-right */}
        <View
          style={[
            s.specular,
            {
              width: SIZE * 0.34,
              height: SIZE * 0.22,
              top: SIZE * 0.11,
              right: SIZE * 0.11,
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
              size={8}
              color="#FFF"
            />
          </View>
        )}
      </View>

      {/* Pin tip */}
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

      {/* Base shadow ellipse */}
      <View style={[s.baseShadow, { backgroundColor: `${cfg.color}35`, width: tipW + 4 }]} />
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'center' },
  head: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
  },
  specular: {
    position: 'absolute',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  tip: {
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  baseShadow: {
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  countText: { fontSize: 9, fontWeight: '800', lineHeight: 10 },
  genderBadge: {
    position: 'absolute',
    bottom: -3,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
});
