import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  type: string;
  selected?: boolean;
  count?: number;
  genderFilter?: 'all' | 'women_only' | 'men_only';
  isOwn?: boolean;
}

export default function PingMarker({ selected = false, count = 0, genderFilter, isOwn = false }: Props) {
  const SIZE = selected ? 48 : isOwn ? 44 : 40;

  return (
    <View style={s.outer}>
      <View style={[s.iconWrap, selected && s.iconWrapSelected]}>
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: SIZE, height: SIZE, borderRadius: SIZE * 0.22 }}
          resizeMode="contain"
        />

        {isOwn && (
          <View style={s.countBadge}>
            <Text style={s.countText}>ME</Text>
          </View>
        )}

        {!isOwn && count > 1 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}

        {genderFilter && genderFilter !== 'all' && (
          <View
            style={[
              s.genderBadge,
              { backgroundColor: genderFilter === 'women_only' ? '#EC4899' : '#3B82F6' },
            ]}
          >
            <MaterialCommunityIcons
              name={genderFilter === 'women_only' ? 'gender-female' : 'gender-male'}
              size={9}
              color="#FFF"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'center' },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  iconWrapSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    transform: [{ scale: 1.06 }],
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
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    elevation: 3,
  },
  countText: { fontSize: 9, fontWeight: '800', lineHeight: 11, color: '#7C3AED' },
  genderBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    elevation: 3,
  },
});
