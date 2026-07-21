import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { adsApi, type Ad, type AdCategory } from '@/lib/api';
import { Ping, Spacing, Radius } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: W } = Dimensions.get('window');

// ── Category meta ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<AdCategory, { label: string; color: string; icon: IoniconName }> = {
  food_drink:       { label: 'Food & Drink',   color: '#F97316', icon: 'restaurant-outline' },
  fashion:          { label: 'Fashion',         color: '#EC4899', icon: 'shirt-outline' },
  beauty_wellness:  { label: 'Beauty',          color: '#8B5CF6', icon: 'sparkles-outline' },
  home_services:    { label: 'Home Services',   color: '#3B82F6', icon: 'home-outline' },
  education:        { label: 'Education',       color: '#10B981', icon: 'school-outline' },
  entertainment:    { label: 'Entertainment',   color: '#F59E0B', icon: 'musical-notes-outline' },
  other:            { label: 'Other',           color: '#6B7280', icon: 'grid-outline' },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  ad: Ad;
  onClose: () => void;
}

export default function AdDetailSheet({ ad, onClose }: Props) {
  const meta = CATEGORY_META[ad.category] ?? CATEGORY_META.other;
  const isPro = ad.tier === 'pro_99';

  const [thumbsUp, setThumbsUp] = useState(false);
  const [saved, setSaved]       = useState(false);

  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    adsApi.recordEvent(ad._id, 'view').catch(() => {});
  }, [ad._id]);

  async function handleCall() {
    if (!ad.contactPhone) return;
    adsApi.recordEvent(ad._id, 'contact_tap').catch(() => {});
    Linking.openURL(`tel:${ad.contactPhone}`);
  }

  async function handleWebsite() {
    if (!ad.website) return;
    const url = ad.website.startsWith('http') ? ad.website : `https://${ad.website}`;
    Linking.openURL(url).catch(() => {});
  }

  async function handleThumbsUp() {
    if (thumbsUp) return;
    setThumbsUp(true);
    adsApi.recordEvent(ad._id, 'thumbs_up').catch(() => {});
  }

  async function handleSave() {
    setSaved(v => !v);
    adsApi.recordEvent(ad._id, 'want_to_visit').catch(() => {});
  }

  const coverSrc = ad.coverImageUrl || ad.products[0]?.imageUrl || null;
  const hasActions = !!(ad.contactPhone || ad.website);

  return (
    <View style={s.sheet}>
      {/* Drag handle */}
      <View style={s.handle} />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Cover image ── */}
        <View style={s.coverWrap}>
          {coverSrc ? (
            <Image source={{ uri: coverSrc }} style={s.coverImage} contentFit="cover" />
          ) : (
            <View style={[s.coverImage, s.coverPlaceholder, { backgroundColor: `${meta.color}22` }]}>
              <Ionicons name={meta.icon} size={48} color={meta.color} />
            </View>
          )}

          {/* Dark gradient overlay at bottom */}
          <View style={s.coverGradient} />

          {/* Category + tier badge overlay */}
          <View style={s.coverBadges}>
            <View style={[s.catBadge, { backgroundColor: `${meta.color}DD` }]}>
              <Ionicons name={meta.icon} size={11} color="#FFF" />
              <Text style={s.catBadgeText}>{meta.label}</Text>
            </View>
            {isPro && (
              <View style={s.proBadge}>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text style={s.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>

          {/* Close button */}
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* ── Info section ── */}
        <View style={s.info}>
          {/* Name row */}
          <View style={s.nameRow}>
            <Text style={s.businessName} numberOfLines={2}>{ad.businessName}</Text>
            {/* Thumbs up + Save */}
            <View style={s.quickActions}>
              <TouchableOpacity
                style={[s.quickBtn, thumbsUp && s.quickBtnActive]}
                onPress={handleThumbsUp}
                activeOpacity={0.8}
              >
                <Ionicons name={thumbsUp ? 'thumbs-up' : 'thumbs-up-outline'} size={17} color={thumbsUp ? Ping.purple : '#9490C0'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.quickBtn, saved && s.quickBtnActive]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? Ping.purple : '#9490C0'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tagline */}
          {!!ad.tagline && (
            <Text style={s.tagline}>{ad.tagline}</Text>
          )}

          {/* Address */}
          {!!ad.address && (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={14} color="#9490C0" />
              <Text style={s.metaText}>{ad.address}</Text>
            </View>
          )}

          {/* Website */}
          {!!ad.website && (
            <TouchableOpacity style={s.metaRow} onPress={handleWebsite} activeOpacity={0.7}>
              <Ionicons name="globe-outline" size={14} color={Ping.purpleLight} />
              <Text style={[s.metaText, { color: Ping.purpleLight }]} numberOfLines={1}>{ad.website}</Text>
            </TouchableOpacity>
          )}

          {/* Amenity tags */}
          {ad.tags && ad.tags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.tagsScroll}
              contentContainerStyle={s.tagsContent}
            >
              {ad.tags.map(tag => (
                <View key={tag} style={s.tagPill}>
                  <Text style={s.tagPillText}>{tag.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Divider ── */}
        {ad.products.length > 0 && <View style={s.divider} />}

        {/* ── Products ── */}
        {ad.products.length > 0 && (
          <View style={s.productsSection}>
            <Text style={s.sectionTitle}>Products</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={196}
              decelerationRate="fast"
              contentContainerStyle={s.productsRow}
              onScrollBeginDrag={() => adsApi.recordEvent(ad._id, 'product_swipe').catch(() => {})}
            >
              {ad.products.map((product, i) => {
                const hasPrice = typeof product.priceMinor === 'number' && product.priceMinor > 0;
                return (
                  <View key={i} style={s.productCard}>
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={s.productImg} contentFit="cover" />
                    ) : (
                      <View style={[s.productImg, s.productImgEmpty]}>
                        <Ionicons name="image-outline" size={28} color="#3A3A5C" />
                      </View>
                    )}
                    <View style={s.productBody}>
                      <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
                      <Text style={hasPrice ? s.productPrice : s.productFree}>
                        {hasPrice
                          ? `₹${(product.priceMinor! / 100).toFixed(product.priceMinor! % 100 === 0 ? 0 : 2)}`
                          : 'Free'}
                      </Text>
                      {!!product.description && (
                        <Text style={s.productDesc} numberOfLines={2}>{product.description}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Action buttons ── */}
        {hasActions && (
          <View style={s.actionsSection}>
            {!!ad.contactPhone && (
              <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={handleCall} activeOpacity={0.85}>
                <Ionicons name="call" size={17} color="#FFF" />
                <Text style={s.actionBtnText}>Call Business</Text>
              </TouchableOpacity>
            )}
            {!!ad.website && (
              <TouchableOpacity style={[s.actionBtn, s.actionBtnSecondary]} onPress={handleWebsite} activeOpacity={0.85}>
                <Ionicons name="globe-outline" size={17} color={Ping.purpleLight} />
                <Text style={[s.actionBtnText, { color: Ping.purpleLight }]}>Visit Website</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sheet: {
    backgroundColor: '#11112A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.3)',
    marginTop: 10, marginBottom: 0,
    zIndex: 10,
  },

  // ── Cover ─────────────────────────────────────────────────────────────────────
  coverWrap: { position: 'relative', height: 180 },
  coverImage: { width: W, height: 180 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(6,6,18,0.65)',
  },
  coverBadges: {
    position: 'absolute', bottom: Spacing.sm, left: Spacing.md,
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1, borderColor: '#F59E0B',
  },
  proBadgeText: { fontSize: 10, fontWeight: '800', color: '#F59E0B' },
  closeBtn: {
    position: 'absolute', top: Spacing.sm, right: Spacing.md,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Info ──────────────────────────────────────────────────────────────────────
  info: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: 8 },
  nameRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: Spacing.sm,
  },
  businessName: {
    flex: 1, fontSize: 20, fontWeight: '800', color: '#F1F0FF', lineHeight: 26,
  },
  quickActions: { flexDirection: 'row', gap: 6, paddingTop: 2 },
  quickBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(148,144,192,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  quickBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderColor: Ping.purple,
  },
  tagline: { fontSize: 14, color: '#9490C0', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#9490C0', flex: 1 },
  tagsScroll: { marginHorizontal: -Spacing.md, marginTop: 2 },
  tagsContent: { paddingHorizontal: Spacing.md, gap: 6, flexDirection: 'row' },
  tagPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  tagPillText: { fontSize: 11, fontWeight: '600', color: '#9490C0', textTransform: 'capitalize' },

  // ── Divider ───────────────────────────────────────────────────────────────────
  divider: {
    height: 1, backgroundColor: 'rgba(167,139,250,0.1)',
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
  },

  // ── Products ──────────────────────────────────────────────────────────────────
  productsSection: { paddingTop: Spacing.md },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#9490C0',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  productsRow: { paddingHorizontal: Spacing.md, gap: 12 },
  productCard: {
    width: 184,
    backgroundColor: '#1A1A38',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.12)',
  },
  productImg: { width: 184, height: 110 },
  productImgEmpty: { backgroundColor: '#11112A', alignItems: 'center', justifyContent: 'center' },
  productBody: { padding: 10, gap: 3 },
  productName: { fontSize: 13, fontWeight: '700', color: '#F1F0FF' },
  productPrice: { fontSize: 13, fontWeight: '700', color: Ping.purpleLight },
  productFree: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  productDesc: { fontSize: 11, color: '#9490C0', lineHeight: 16 },

  // ── Actions ───────────────────────────────────────────────────────────────────
  actionsSection: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: Radius.md,
  },
  actionBtnPrimary: {
    backgroundColor: Ping.purple,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
