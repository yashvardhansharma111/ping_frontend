import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { adsApi, uploadApi, type AdTier, type AdCategory, type AdProduct /*, WEB_BASE */ } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Static config ─────────────────────────────────────────────────────────────

const TIERS: {
  key: AdTier; label: string; price: string; radius: string; duration: string;
  maxProducts: number; color: string; perks: string[];
}[] = [
  {
    key: 'basic_49', label: 'Basic', price: '₹49', radius: '200m', duration: '24 hrs',
    maxProducts: 1, color: '#3B82F6',
    perks: ['1 product', '200m reach', '24 hours'],
  },
  {
    key: 'pro_99', label: 'Pro', price: '₹99', radius: '1 km', duration: '24 hrs',
    maxProducts: 6, color: '#8B5CF6',
    perks: ['6 products', '1km reach', '24 hours'],
  },
];

const CATEGORIES: { key: AdCategory; label: string; icon: IoniconName }[] = [
  { key: 'food_drink',      label: 'Food & Drink',   icon: 'restaurant-outline' },
  { key: 'fashion',         label: 'Fashion',        icon: 'shirt-outline' },
  { key: 'beauty_wellness', label: 'Beauty',         icon: 'sparkles-outline' },
  { key: 'home_services',   label: 'Home Services',  icon: 'home-outline' },
  { key: 'education',       label: 'Education',      icon: 'school-outline' },
  { key: 'entertainment',   label: 'Entertainment',  icon: 'musical-notes-outline' },
  { key: 'other',           label: 'Other',          icon: 'grid-outline' },
];

const AMENITY_TAGS: { key: string; label: string; icon: IoniconName }[] = [
  { key: 'wifi',         label: 'WiFi',         icon: 'wifi-outline' },
  { key: 'outdoor',      label: 'Outdoor',      icon: 'sunny-outline' },
  { key: 'delivery',     label: 'Delivery',     icon: 'bicycle-outline' },
  { key: 'takeaway',     label: 'Takeaway',     icon: 'bag-handle-outline' },
  { key: 'dine_in',      label: 'Dine-in',      icon: 'restaurant-outline' },
  { key: 'parking',      label: 'Parking',      icon: 'car-outline' },
  { key: 'veg_friendly', label: 'Veg-Friendly', icon: 'leaf-outline' },
  { key: 'pet_friendly', label: 'Pet-Friendly', icon: 'paw-outline' },
  { key: 'ac',           label: 'AC',           icon: 'snow-outline' },
  { key: 'open_late',    label: 'Open Late',    icon: 'moon-outline' },
  { key: 'cash_only',    label: 'Cash Only',    icon: 'cash-outline' },
  { key: '24h',          label: '24 Hours',     icon: 'time-outline' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Chip({
  active, color = Ping.purple, onPress, children,
}: { active: boolean; color?: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active ? { backgroundColor: color, borderColor: color } : styles.chipInactive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {children}
    </TouchableOpacity>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  lat: number;
  lng: number;
}

export default function CreateAdModal({ visible, onClose, onCreated, lat, lng }: Props) {
  const insets = useSafeAreaInsets();

  // Step 1 — plan
  const [tier, setTier] = useState<AdTier>('basic_49');

  // Step 2 — business identity
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<AdCategory>('food_drink');
  const [tagline, setTagline] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [uploadingCover, setUploadingCover] = useState(false);

  // Step 3 — products
  const [products, setProducts] = useState<AdProduct[]>([{ imageUrl: '', name: '', priceMinor: null, description: '' }]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Nav
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  const maxProducts = TIERS.find(t => t.key === tier)!.maxProducts;

  function reset() {
    setTier('basic_49');
    setBusinessName('');
    setCategory('food_drink');
    setTagline('');
    setCoverImageUrl('');
    setAddress('');
    setWebsite('');
    setContactPhone('');
    setSelectedTags(new Set());
    setProducts([{ imageUrl: '', name: '', priceMinor: null, description: '' }]);
    setStep(1);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function goToStep2() { setStep(2); }

  function goToStep3() {
    if (!businessName.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Enter your business name.' });
      return;
    }
    setStep(3);
  }

  // ── Cover image ──────────────────────────────────────────────────────────────

  async function pickCoverImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow photo access to upload a cover image.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingCover(true);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'ads');
      setCoverImageUrl(url);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message || 'Could not upload cover image.' });
    } finally {
      setUploadingCover(false);
    }
  }

  // ── Product management ────────────────────────────────────────────────────────

  function updateProduct(index: number, field: keyof AdProduct, value: string) {
    setProducts(prev => {
      const next = [...prev];
      if (field === 'priceMinor') {
        const num = parseInt(value.replace(/\D/g, ''), 10);
        next[index] = { ...next[index], priceMinor: isNaN(num) ? null : num * 100 };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  }

  function addProduct() {
    if (products.length >= maxProducts) return;
    setProducts(prev => [...prev, { imageUrl: '', name: '', priceMinor: null, description: '' }]);
  }

  function removeProduct(index: number) {
    if (products.length <= 1) return;
    setProducts(prev => prev.filter((_, i) => i !== index));
  }

  async function pickProductImage(index: number) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow photo access to upload product images.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingIdx(index);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'ads');
      setProducts(prev => {
        const next = [...prev];
        next[index] = { ...next[index], imageUrl: url };
        return next;
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message || 'Could not upload image.' });
    } finally {
      setUploadingIdx(null);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function createAndLaunch() {
    const validProducts = products.filter(p => p.name.trim() && p.imageUrl.trim());
    if (validProducts.length === 0) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Add at least one product with a name and image.' });
      return;
    }
    setSaving(true);
    try {
      const draftRes = await adsApi.create({
        tier,
        businessName: businessName.trim(),
        category,
        tagline: tagline.trim() || undefined,
        coverImageUrl: coverImageUrl || undefined,
        address: address.trim() || undefined,
        website: website.trim() || undefined,
        tags: selectedTags.size > 0 ? [...selectedTags] : undefined,
        lat,
        lng,
        contactPhone: contactPhone.trim() || undefined,
        products: validProducts,
      });
      // MOCK: activate instantly — uncomment Razorpay block below to restore real payment
      await adsApi.mockActivate(draftRes.ad._id);
      setSaving(false);
      onCreated();
      handleClose();
    } catch (err: any) {
      setSaving(false);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not create ad.' });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const selectedTier = TIERS.find(t => t.key === tier)!;

  const STEP_TITLES = ['Pick a Plan', 'Business Details', 'Add Products'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step > 1 && (
                <TouchableOpacity onPress={() => setStep(s => (s - 1) as 1 | 2 | 3)} hitSlop={10} style={{ marginRight: 8 }}>
                  <Ionicons name="arrow-back" size={20} color="#9490C0" />
                </TouchableOpacity>
              )}
              <View style={styles.headerIcon}>
                <Ionicons name="megaphone-outline" size={20} color={Ping.purple} />
              </View>
              <Text style={styles.headerTitle}>{STEP_TITLES[step - 1]}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#9490C0" />
            </TouchableOpacity>
          </View>

          {/* Step dots */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map(s => (
              <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive]} />
            ))}
          </View>

          {/* ── Step 1: Plan ── */}
          {step === 1 && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {TIERS.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tierCard, tier === t.key && { borderColor: t.color, backgroundColor: `${t.color}12` }]}
                  onPress={() => setTier(t.key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.tierTop}>
                    <View>
                      <Text style={[styles.tierPrice, { color: tier === t.key ? t.color : '#F1F0FF' }]}>{t.price}</Text>
                      <Text style={styles.tierName}>{t.label}</Text>
                    </View>
                    {tier === t.key && (
                      <View style={[styles.tierCheck, { backgroundColor: t.color }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.tierPerks}>
                    {t.perks.map(p => (
                      <View key={p} style={styles.perkRow}>
                        <Ionicons name="checkmark-circle" size={14} color={tier === t.key ? t.color : '#5C5A80'} />
                        <Text style={[styles.perkText, { color: tier === t.key ? '#D4C7FF' : '#7A78A0' }]}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Step 2: Business Details ── */}
          {step === 2 && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {/* Cover image */}
              <View style={styles.section}>
                <SectionLabel text="Cover Photo" />
                <TouchableOpacity
                  style={styles.coverPicker}
                  onPress={pickCoverImage}
                  activeOpacity={0.8}
                  disabled={uploadingCover}
                >
                  {uploadingCover ? (
                    <ActivityIndicator size="large" color={Ping.purple} />
                  ) : coverImageUrl ? (
                    <>
                      <Image source={{ uri: coverImageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      <View style={styles.coverOverlay}>
                        <View style={styles.coverChangeBtn}>
                          <Ionicons name="camera-outline" size={16} color="#FFF" />
                          <Text style={styles.coverChangeTxt}>Change Cover</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.coverIconWrap, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                        <Ionicons name="image-outline" size={32} color={Ping.purpleLight} />
                      </View>
                      <Text style={styles.coverHint}>Tap to add a cover photo</Text>
                      <Text style={styles.coverSub}>Recommended: 16:9 · JPG or PNG</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Business name */}
              <View style={styles.section}>
                <SectionLabel text="Business Name *" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Chai Corner, Urban Cuts"
                  placeholderTextColor="#5C5A80"
                  value={businessName}
                  onChangeText={setBusinessName}
                  maxLength={40}
                />
              </View>

              {/* Category */}
              <View style={styles.section}>
                <SectionLabel text="Category" />
                <View style={styles.chipGrid}>
                  {CATEGORIES.map(cat => (
                    <Chip key={cat.key} active={category === cat.key} onPress={() => setCategory(cat.key)}>
                      <Ionicons name={cat.icon} size={13} color={category === cat.key ? '#FFF' : '#9490C0'} />
                      <Text style={[styles.chipText, category === cat.key && { color: '#FFF' }]}>{cat.label}</Text>
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Tagline */}
              <View style={styles.section}>
                <SectionLabel text="Tagline" />
                <TextInput
                  style={styles.input}
                  placeholder="A punchy one-liner about your business"
                  placeholderTextColor="#5C5A80"
                  value={tagline}
                  onChangeText={setTagline}
                  maxLength={60}
                />
              </View>

              {/* Address */}
              <View style={styles.section}>
                <SectionLabel text="Address (optional)" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 12 MG Road, Koramangala"
                  placeholderTextColor="#5C5A80"
                  value={address}
                  onChangeText={setAddress}
                  maxLength={100}
                />
              </View>

              {/* Website */}
              <View style={styles.section}>
                <SectionLabel text="Website (optional)" />
                <TextInput
                  style={styles.input}
                  placeholder="https://yourbusiness.com"
                  placeholderTextColor="#5C5A80"
                  value={website}
                  onChangeText={setWebsite}
                  keyboardType="url"
                  autoCapitalize="none"
                  maxLength={200}
                />
              </View>

              {/* Contact phone */}
              <View style={styles.section}>
                <SectionLabel text="Contact Phone (optional)" />
                <TextInput
                  style={styles.input}
                  placeholder="10-digit number"
                  placeholderTextColor="#5C5A80"
                  value={contactPhone}
                  onChangeText={v => setContactPhone(v.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {/* Amenity tags */}
              <View style={styles.section}>
                <SectionLabel text="Amenities" />
                <View style={styles.tagsGrid}>
                  {AMENITY_TAGS.map(tag => {
                    const active = selectedTags.has(tag.key);
                    return (
                      <TouchableOpacity
                        key={tag.key}
                        style={[styles.tagChip, active && styles.tagChipActive]}
                        onPress={() => {
                          setSelectedTags(prev => {
                            const n = new Set(prev);
                            active ? n.delete(tag.key) : n.add(tag.key);
                            return n;
                          });
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={tag.icon} size={13} color={active ? '#FFF' : '#9490C0'} />
                        <Text style={[styles.tagChipText, active && { color: '#FFF' }]}>{tag.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}

          {/* ── Step 3: Products ── */}
          {step === 3 && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {products.map((p, i) => (
                <View key={i} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productTitle}>Product {i + 1}</Text>
                    {products.length > 1 && (
                      <TouchableOpacity onPress={() => removeProduct(i)} hitSlop={8}>
                        <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Product name"
                    placeholderTextColor="#5C5A80"
                    value={p.name}
                    onChangeText={v => updateProduct(i, 'name', v)}
                    maxLength={40}
                  />
                  <TouchableOpacity
                    style={styles.imagePicker}
                    onPress={() => pickProductImage(i)}
                    activeOpacity={0.75}
                    disabled={uploadingIdx === i}
                  >
                    {uploadingIdx === i ? (
                      <ActivityIndicator size="small" color={Ping.purple} />
                    ) : p.imageUrl ? (
                      <>
                        <Image source={{ uri: p.imageUrl }} style={styles.imagePreview} />
                        <View style={styles.imagePickerOverlay}>
                          <Ionicons name="camera-outline" size={18} color="#FFF" />
                          <Text style={styles.imagePickerOverlayText}>Change</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={28} color="#5C5A80" />
                        <Text style={styles.imagePickerText}>Tap to upload product image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="Price in ₹ (optional)"
                    placeholderTextColor="#5C5A80"
                    value={p.priceMinor != null ? String(p.priceMinor / 100) : ''}
                    onChangeText={v => updateProduct(i, 'priceMinor', v)}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TextInput
                    style={[styles.input, styles.inputMulti, { marginTop: 8 }]}
                    placeholder="Short description (optional)"
                    placeholderTextColor="#5C5A80"
                    value={p.description ?? ''}
                    onChangeText={v => updateProduct(i, 'description', v)}
                    multiline
                    maxLength={120}
                  />
                </View>
              ))}
              {products.length < maxProducts && (
                <TouchableOpacity style={styles.addProductBtn} onPress={addProduct} activeOpacity={0.75}>
                  <Ionicons name="add-circle-outline" size={18} color={Ping.purpleLight} />
                  <Text style={styles.addProductText}>Add another product</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {step === 1 && (
              <TouchableOpacity style={styles.btn} onPress={goToStep2} activeOpacity={0.85}>
                <Text style={styles.btnText}>Next — Business Details</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
            {step === 2 && (
              <TouchableOpacity style={styles.btn} onPress={goToStep3} activeOpacity={0.85}>
                <Text style={styles.btnText}>Next — Add Products</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
            {step === 3 && (
              <TouchableOpacity
                style={[styles.btn, saving && styles.btnDisabled]}
                onPress={createAndLaunch}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={18} color="#FFF" />
                    <Text style={styles.btnText}>Launch Ad · {selectedTier.price}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#11112A',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#F1F0FF' },
  stepRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, justifyContent: 'center',
  },
  stepDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(167,139,250,0.15)' },
  stepDotActive: { backgroundColor: Ping.purple },
  body: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: 11, color: '#9490C0', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700',
  },

  // ── Tier cards ────────────────────────────────────────────────────────────────
  tierCard: {
    borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: Spacing.md, gap: Spacing.sm,
  },
  tierTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tierPrice: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tierName: { fontSize: 13, fontWeight: '600', color: '#9490C0', marginTop: 2 },
  tierCheck: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  tierPerks: { gap: 5 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: { fontSize: 13, fontWeight: '500' },

  // ── Cover photo ───────────────────────────────────────────────────────────────
  coverPicker: {
    height: 160,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  coverChangeTxt: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  coverIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  coverHint: { fontSize: 14, color: '#9490C0', fontWeight: '600' },
  coverSub: { fontSize: 12, color: '#5C5A80' },

  // ── Inputs ────────────────────────────────────────────────────────────────────
  input: {
    backgroundColor: '#1A1A38', borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)', height: 48,
    paddingHorizontal: Spacing.md, fontSize: 15, color: '#F1F0FF',
  },
  inputMulti: { height: 72, textAlignVertical: 'top', paddingTop: 12 },

  // ── Category chips ────────────────────────────────────────────────────────────
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5,
    backgroundColor: Ping.purple, borderColor: Ping.purple,
  },
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(167,139,250,0.2)',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#9490C0' },

  // ── Amenity tags ──────────────────────────────────────────────────────────────
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tagChipActive: {
    backgroundColor: Ping.purple,
    borderColor: Ping.purple,
  },
  tagChipText: { fontSize: 12, fontWeight: '600', color: '#9490C0' },

  // ── Products ──────────────────────────────────────────────────────────────────
  productCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)', padding: Spacing.md,
  },
  productHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  productTitle: { fontSize: 13, fontWeight: '700', color: '#9490C0' },
  imagePicker: {
    marginTop: 8, height: 120, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  imagePickerText: { fontSize: 12, color: '#5C5A80' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute' },
  imagePickerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  imagePickerOverlayText: { fontSize: 12, color: '#FFF', fontWeight: '600' },
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)', borderStyle: 'dashed',
  },
  addProductText: { fontSize: 14, color: Ping.purpleLight, fontWeight: '600' },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(167,139,250,0.1)',
  },
  btn: {
    backgroundColor: Ping.purple, borderRadius: Radius.md, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.55, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, color: '#FFF', fontWeight: '700' },
});
