import { View, Text, StyleSheet } from 'react-native';
import type { MapPoiKind } from '@/lib/placesApi';

const KIND_STYLE: Record<MapPoiKind, { bg: string; border: string }> = {
  cafe:       { bg: '#D97706', border: '#FBBF24' },
  restaurant: { bg: '#EA580C', border: '#FB923C' },
  fast_food:  { bg: '#DC2626', border: '#F87171' },
};

interface Props {
  emoji: string;
  kind: MapPoiKind;
  selected?: boolean;
}

/** Compact map pin for cafés / restaurants (stands out vs hospital-only basemap POIs). */
export default function PlacePoiMarker({ emoji, kind, selected = false }: Props) {
  const cfg = KIND_STYLE[kind];
  const size = selected ? 36 : 28;

  return (
    <View style={s.wrap}>
      <View
        style={[
          s.bubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: cfg.bg,
            borderColor: cfg.border,
            borderWidth: selected ? 2.5 : 1.5,
          },
        ]}
      >
        <Text style={[s.emoji, { fontSize: selected ? 16 : 13 }]}>{emoji}</Text>
      </View>
      <View style={[s.tip, { borderTopColor: cfg.bg }]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  emoji: { textAlign: 'center' },
  tip: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
