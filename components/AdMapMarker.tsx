import { View, Text, Image, StyleSheet } from 'react-native';
import { Ad } from '@/lib/api';

interface Props {
  ad: Ad;
  selected: boolean;
}

const PLACEHOLDER_COLORS = [
  '#7C3AED', '#F97316', '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
];

function placeholderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

export default function AdMapMarker({ ad, selected }: Props) {
  const firstImage = ad.products[0]?.imageUrl ?? null;
  const letter = ad.businessName?.[0]?.toUpperCase() ?? '?';
  const bgColor = placeholderColor(ad.businessName);
  const isPro = ad.tier === 'pro_99';

  return (
    <View style={s.root}>
      {/* Purple glow ring behind white ring when selected */}
      {selected && (
        <View style={[s.glowRing, { borderColor: 'rgba(124,58,237,0.55)', shadowColor: '#7C3AED' }]} />
      )}

      {/* White ring + circle image */}
      <View style={[s.ring, selected && s.ringSelected]}>
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={s.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.placeholder, { backgroundColor: bgColor }]}>
            <Text style={s.placeholderLetter}>{letter}</Text>
          </View>
        )}

        {/* Pro tier gold badge */}
        {isPro && (
          <View style={s.proBadge}>
            <Text style={s.proBadgeText}>★</Text>
          </View>
        )}
      </View>

      {/* Business name label */}
      <View style={s.labelWrap}>
        <Text style={s.label} numberOfLines={1}>{ad.businessName}</Text>
      </View>
    </View>
  );
}

const CIRCLE = 46;
const RING_BORDER = 2;
const RING_SIZE = CIRCLE + RING_BORDER * 2;

const s = StyleSheet.create({
  root: {
    alignItems: 'center',
    width: 70,
    height: 75,
  },
  glowRing: {
    position: 'absolute',
    top: -(6),
    width: RING_SIZE + 12,
    height: RING_SIZE + 12,
    borderRadius: (RING_SIZE + 12) / 2,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_BORDER,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  ringSelected: {
    borderColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
  image: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
  },
  placeholder: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  proBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 10,
  },
  labelWrap: {
    marginTop: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    maxWidth: 70,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
