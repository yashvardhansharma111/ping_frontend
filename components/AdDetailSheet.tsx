import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { adsApi, type Ad, type AdCategory } from '@/lib/api';

interface Props {
  ad: Ad;
  onClose: () => void;
}

const CATEGORY_COLOR: Record<AdCategory, string> = {
  food_drink:       '#F97316',
  fashion:          '#EC4899',
  beauty_wellness:  '#8B5CF6',
  home_services:    '#3B82F6',
  education:        '#10B981',
  entertainment:    '#F59E0B',
  other:            '#6B7280',
};

const CATEGORY_LABEL: Record<AdCategory, string> = {
  food_drink:       'Food & Drink',
  fashion:          'Fashion',
  beauty_wellness:  'Beauty',
  home_services:    'Home Services',
  education:        'Education',
  entertainment:    'Entertainment',
  other:            'Other',
};

export default function AdDetailSheet({ ad, onClose }: Props) {
  const categoryColor = CATEGORY_COLOR[ad.category] ?? '#6B7280';
  const categoryLabel = CATEGORY_LABEL[ad.category] ?? 'Other';

  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    (async () => {
      try {
        await (adsApi as any).recordEvent(ad._id, 'view');
      } catch {
        // silent — method may not exist yet
      }
    })();
  }, [ad._id]);

  async function handleCall() {
    if (!ad.contactPhone) return;
    try {
      await (adsApi as any).recordEvent(ad._id, 'contact_tap');
    } catch {
      // silent
    }
    Linking.openURL(`tel:${ad.contactPhone}`);
  }

  return (
    <View style={s.sheet}>
      {/* Handle */}
      <View style={s.handle} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.businessName} numberOfLines={1}>{ad.businessName}</Text>
          <View style={[s.categoryChip, { backgroundColor: `${categoryColor}22`, borderColor: `${categoryColor}55` }]}>
            <Text style={[s.categoryChipText, { color: categoryColor }]}>{categoryLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#9490C0" />
        </TouchableOpacity>
      </View>

      {/* Tagline */}
      {!!ad.tagline && (
        <Text style={s.tagline} numberOfLines={2}>{ad.tagline}</Text>
      )}

      {/* Product carousel */}
      {ad.products.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={212}
          decelerationRate="fast"
          contentContainerStyle={s.carouselContent}
          style={s.carousel}
        >
          {ad.products.map((product, index) => {
            const hasPrice = typeof product.priceMinor === 'number' && product.priceMinor > 0;
            return (
              <View key={index} style={s.productCard}>
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={s.productImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[s.productImage, s.productImagePlaceholder]}>
                    <Ionicons name="image-outline" size={32} color="#3A3A5C" />
                  </View>
                )}
                <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
                <Text style={hasPrice ? s.productPrice : s.productFree}>
                  {hasPrice ? `₹${(product.priceMinor! / 100).toFixed(product.priceMinor! % 100 === 0 ? 0 : 2)}` : 'Free'}
                </Text>
                {!!product.description && (
                  <Text style={s.productDesc} numberOfLines={2}>{product.description}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Call footer */}
      {!!ad.contactPhone && (
        <TouchableOpacity style={s.callBtn} onPress={handleCall} activeOpacity={0.85}>
          <Ionicons name="call" size={18} color="#FFFFFF" />
          <Text style={s.callBtnText}>Call Business</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: '#11112A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.35)',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  businessName: {
    color: '#F1F0FF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148,144,192,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tagline: {
    color: '#9490C0',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },
  carousel: {
    marginHorizontal: -20,
    marginTop: 16,
    marginBottom: 20,
  },
  carouselContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  productCard: {
    width: 200,
    backgroundColor: '#1A1A38',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.1)',
    paddingBottom: 12,
  },
  productImage: {
    width: 200,
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginBottom: 8,
  },
  productImagePlaceholder: {
    backgroundColor: '#11112A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    color: '#F1F0FF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  productPrice: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  productFree: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  productDesc: {
    color: '#9490C0',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    height: 50,
    borderRadius: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 4,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
