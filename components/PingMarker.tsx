import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ping } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_CFG: Record<string, { icon: IoniconName; color: string }> = {
  sport:   { icon: 'barbell-outline',          color: '#22C55E' },
  food:    { icon: 'restaurant-outline',        color: '#F97316' },
  music:   { icon: 'musical-notes-outline',     color: '#8B5CF6' },
  study:   { icon: 'book-outline',              color: '#3B82F6' },
  outdoor: { icon: 'walk-outline',              color: '#10B981' },
  gaming:  { icon: 'game-controller-outline',   color: '#EC4899' },
  meetup:  { icon: 'people-outline',            color: Ping.purple },
  default: { icon: 'location-outline',          color: '#A78BFA' },
};

interface Props {
  type: string;
  selected?: boolean;
  count?: number;
  creatorName?: string;
  title?: string;
  genderFilter?: 'all' | 'women_only' | 'men_only';
}

export default function PingMarker({
  type,
  selected = false,
  count = 0,
  creatorName,
  title,
  genderFilter,
}: Props) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.default;
  const size = selected ? 58 : 46;
  const fontSize = selected ? 19 : 15;

  const initials = creatorName
    ? creatorName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : title
      ? title.trim()[0].toUpperCase()
      : type[0].toUpperCase();

  const label = title
    ? title.length > 18 ? title.slice(0, 17) + '…' : title
    : type;

  return (
    <View style={s.outer} pointerEvents="none">

      {/* ── Speech bubble (selected only) ── */}
      {selected && (
        <>
          <View style={[s.bubble, { borderColor: `${cfg.color}90`, backgroundColor: 'rgba(8,8,21,0.97)' }]}>
            <View style={[s.bubbleDot, { backgroundColor: cfg.color }]} />
            <Text style={s.bubbleText} numberOfLines={1}>{label}</Text>
            {count > 0 && (
              <View style={[s.bubbleCount, { backgroundColor: `${cfg.color}30` }]}>
                <Ionicons name="people" size={9} color={cfg.color} />
                <Text style={[s.bubbleCountText, { color: cfg.color }]}>{count}</Text>
              </View>
            )}
          </View>
          {/* Triangle tip pointing down to circle */}
          <View style={[s.tip, { borderTopColor: `${cfg.color}70` }]} />
        </>
      )}

      {/* ── Circle + badges container ── */}
      <View style={{ width: size, height: size }}>
        {/* Main avatar circle */}
        <View
          style={[
            s.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: selected ? '#FFF' : cfg.color,
              borderWidth: selected ? 3 : 2,
              backgroundColor: `${cfg.color}25`,
              shadowColor: cfg.color,
              shadowOpacity: selected ? 1 : 0.6,
              shadowRadius: selected ? 20 : 9,
              elevation: selected ? 16 : 7,
            },
          ]}
        >
          <Text style={[s.initials, { fontSize, color: selected ? '#FFF' : cfg.color }]}>
            {initials}
          </Text>
        </View>

        {/* Gender badge — top-left (women_only / men_only) */}
        {genderFilter && genderFilter !== 'all' && (
          <View style={[s.genderBadge, { backgroundColor: genderFilter === 'women_only' ? '#EC4899' : '#3B82F6' }]}>
            <Ionicons
              name={genderFilter === 'women_only' ? 'female' : 'male'}
              size={9}
              color="#FFF"
            />
          </View>
        )}

        {/* Participant count badge — top-right */}
        {count > 1 && (
          <View style={[s.countBadge, { backgroundColor: cfg.color }]}>
            <Text style={s.countText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}

        {/* Activity type icon — bottom-right */}
        <View style={[s.typeBadge, { backgroundColor: cfg.color }]}>
          <Ionicons name={cfg.icon} size={9} color="#FFF" />
        </View>
      </View>

      {/* ── Anchor dot ── */}
      <View style={[s.anchor, { backgroundColor: selected ? '#FFF' : cfg.color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'center' },

  // ── Speech bubble ──────────────────────────────────────────────────────────
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 0,
    maxWidth: 170,
  },
  bubbleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  bubbleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F0FF',
    flexShrink: 1,
  },
  bubbleCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  bubbleCountText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: 2,
  },

  // ── Circle ─────────────────────────────────────────────────────────────────
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Badges ─────────────────────────────────────────────────────────────────
  genderBadge: {
    position: 'absolute',
    top: -5,
    left: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#080815',
    zIndex: 2,
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#080815',
    zIndex: 2,
  },
  countText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 11,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#080815',
    zIndex: 2,
  },

  // ── Anchor ─────────────────────────────────────────────────────────────────
  anchor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 3,
  },
});
