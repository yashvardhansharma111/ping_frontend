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
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { adsApi, uploadApi, type AdTier, type AdCategory, type AdProduct, WEB_BASE } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── static config ─────────────────────────────────────────────────────────────

const TIERS: { key: AdTier; label: string; price: string; radius: string; duration: string; maxProducts: number; color: string }[] = [
  {
    key: 'basic_49', label: 'Basic', price: '₹49', radius: '200m', duration: '24 hrs',
    maxProducts: 1, color: '#3B82F6',
  },
  {
    key: 'pro_99', label: 'Pro', price: '₹99', radius: '1km', duration: '24 hrs',
    maxProducts: 6, color: '#8B5CF6',
  },
];

const CATEGORIES: { key: AdCategory; label: string; icon: IoniconName }[] = [
  { key: 'food_drink',       label: 'Food & Drink',      icon: 'restaurant-outline' },
  { key: 'fashion',          label: 'Fashion',           icon: 'shirt-outline' },
  { key: 'beauty_wellness',  label: 'Beauty',            icon: 'sparkles-outline' },
  { key: 'home_services',    label: 'Home Services',     icon: 'home-outline' },
  { key: 'education',        label: 'Education',         icon: 'school-outline' },
  { key: 'entertainment',    label: 'Entertainment',     icon: 'musical-notes-outline' },
  { key: 'other',            label: 'Other',             icon: 'grid-outline' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Chip({
  active, color = Ping.purple, onPress, children,
}: {
  active: boolean; color?: string; onPress: () => void; children: React.ReactNode;
}) {
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

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  lat: number;
  lng: number;
}

export default function CreateAdModal({ visible, onClose, onCreated, lat, lng }: Props) {
  const insets = useSafeAreaInsets();

  // step 1 — business info
  const [tier, setTier] = useState<AdTier>('basic_49');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<AdCategory>('food_drink');
  const [tagline, setTagline] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // step 2 — product(s)
  const [products, setProducts] = useState<AdProduct[]>([{ imageUrl: '', name: '', priceMinor: null, description: '' }]);

  // nav
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [createdAdId, setCreatedAdId] = useState<string | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const maxProducts = TIERS.find(t => t.key === tier)!.maxProducts;

  function reset() {
    setTier('basic_49');
    setBusinessName('');
    setCategory('food_drink');
    setTagline('');
    setContactPhone('');
    setProducts([{ imageUrl: '', name: '', priceMinor: null, description: '' }]);
    setStep(1);
    setSaving(false);
    setWaitingPayment(false);
    setCreatedAdId(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── step 1 → 2 ──────────────────────────────────────────────────────────────

  function goToStep2() {
    if (!businessName.trim()) {
      Alert.alert('Required', 'Enter your business name.');
      return;
    }
    setStep(2);
  }

  // ── step 2 — product management ─────────────────────────────────────────────

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
      Alert.alert('Permission needed', 'Allow photo access to upload product images.');
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
      Alert.alert('Upload failed', err.message || 'Could not upload image.');
    } finally {
      setUploadingIdx(null);
    }
  }

  // ── step 2 → 3 (create draft + open payment) ────────────────────────────────

  async function createAndPay() {
    const validProducts = products.filter(p => p.name.trim() && p.imageUrl.trim());
    if (validProducts.length === 0) {
      Alert.alert('Required', 'Add at least one product with a name and image.');
      return;
    }

    setSaving(true);
    try {
      // 1. create draft
      const draftRes = await adsApi.create({
        tier,
        businessName: businessName.trim(),
        category,
        tagline: tagline.trim() || undefined,
        lat,
        lng,
        contactPhone: contactPhone.trim() || undefined,
        products: validProducts,
      });
      const adId = draftRes.ad._id;
      setCreatedAdId(adId);

      // 2. create Razorpay order
      const orderRes = await adsApi.createOrder(adId);
      const { id: orderId, amount, keyId } = orderRes.order;

      setSaving(false);
      setStep(3);
      setWaitingPayment(true);

      // 3. open hosted checkout page in browser
      const url = `${WEB_BASE}/pay?orderId=${orderId}&amount=${amount}&keyId=${keyId}&adId=${adId}&name=${encodeURIComponent(businessName.trim())}`;
      await WebBrowser.openBrowserAsync(url, { toolbarColor: '#11112A' });

      // 4. browser closed — poll ad status
      await pollAdLive(adId);
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Error', err.message || 'Could not create ad.');
    }
  }

  async function pollAdLive(adId: string) {
    const MAX_POLLS = 15;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(2000);
      try {
        const res = await adsApi.get(adId);
        if (res.ad.status === 'live') {
          setWaitingPayment(false);
          onCreated();
          handleClose();
          return;
        }
      } catch {}
    }
    // Timed out — still show success but let user know
    setWaitingPayment(false);
    Alert.alert(
      'Ad submitted',
      'Your payment is being processed. Your ad will go live shortly.',
      [{ text: 'OK', onPress: handleClose }],
    );
  }

  // ── render ───────────────────────────────────────────────────────────────────

  const selectedTier = TIERS.find(t => t.key === tier)!;

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
              {step > 1 && !waitingPayment && (
                <TouchableOpacity onPress={() => setStep(s => (s - 1) as 1 | 2 | 3)} hitSlop={10} style={{ marginRight: 8 }}>
                  <Ionicons name="arrow-back" size={20} color="#9490C0" />
                </TouchableOpacity>
              )}
              <View style={styles.headerIcon}>
                <Ionicons name="megaphone-outline" size={20} color={Ping.purple} />
              </View>
              <Text style={styles.headerTitle}>
                {step === 1 ? 'New Micro Ad' : step === 2 ? 'Product Details' : 'Confirm & Pay'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#9490C0" />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map(s => (
              <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive]} />
            ))}
          </View>

          {/* ── Step 1: Business Info ── */}
          {step === 1 && (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              {/* Tier selection */}
              <View style={styles.section}>
                <SectionLabel text="Ad Plan" />
                <View style={styles.tierRow}>
                  {TIERS.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.tierCard,
                        tier === t.key && { borderColor: t.color, backgroundColor: `${t.color}18` },
                      ]}
                      onPress={() => setTier(t.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tierPrice, { color: tier === t.key ? t.color : '#F1F0FF' }]}>
                        {t.price}
                      </Text>
                      <Text style={styles.tierLabel}>{t.label}</Text>
                      <Text style={styles.tierMeta}>{t.radius} radius · {t.duration}</Text>
                      <Text style={styles.tierMeta}>{t.maxProducts} product{t.maxProducts > 1 ? 's' : ''}</Text>
                      {tier === t.key && (
                        <View style={[styles.tierCheck, { backgroundColor: t.color }]}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Business name */}
              <View style={styles.section}>
                <SectionLabel text="Business Name" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Chai Corner"
                  placeholderTextColor="#5C5A80"
                  value={businessName}
                  onChangeText={setBusinessName}
                  maxLength={40}
                  autoFocus
                />
              </View>

              {/* Category */}
              <View style={styles.section}>
                <SectionLabel text="Category" />
                <View style={styles.chipGrid}>
                  {CATEGORIES.map(cat => (
                    <Chip
                      key={cat.key}
                      active={category === cat.key}
                      onPress={() => setCategory(cat.key)}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={13}
                        color={category === cat.key ? '#FFF' : '#9490C0'}
                      />
                      <Text style={[styles.chipText, category === cat.key && { color: '#FFF' }]}>
                        {cat.label}
                      </Text>
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Tagline */}
              <View style={styles.section}>
                <SectionLabel text="Tagline (optional)" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Best chai in Bhopal"
                  placeholderTextColor="#5C5A80"
                  value={tagline}
                  onChangeText={setTagline}
                  maxLength={60}
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
            </ScrollView>
          )}

          {/* ── Step 2: Products ── */}
          {step === 2 && (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
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

          {/* ── Step 3: Confirm + Pay ── */}
          {step === 3 && (
            <View style={[styles.body, { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }]}>
              {waitingPayment ? (
                <>
                  <ActivityIndicator size="large" color={Ping.purple} />
                  <Text style={styles.waitText}>Waiting for payment confirmation...</Text>
                  <Text style={styles.waitSub}>Complete the payment in your browser, then return here.</Text>
                </>
              ) : (
                <>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryTitle}>{businessName}</Text>
                    <Text style={styles.summaryMeta}>
                      {selectedTier.label} plan · {selectedTier.price} · {selectedTier.radius} radius
                    </Text>
                    <Text style={styles.summaryMeta}>
                      {products.filter(p => p.name.trim()).length} product(s) · {selectedTier.duration}
                    </Text>
                  </View>
                  <Text style={styles.locNote}>
                    <Ionicons name="location-outline" size={13} color="#5C5A80" /> Ad pinned at your current location
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Footer button */}
          <View style={styles.footer}>
            {step === 1 && (
              <TouchableOpacity style={styles.btn} onPress={goToStep2} activeOpacity={0.85}>
                <Text style={styles.btnText}>Next — Add Products</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
            {step === 2 && (
              <TouchableOpacity
                style={[styles.btn, saving && styles.btnDisabled]}
                onPress={createAndPay}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color="#FFF" />
                    <Text style={styles.btnText}>Pay {selectedTier.price} & Go Live</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {step === 3 && !waitingPayment && (
              <TouchableOpacity style={styles.btn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── styles ────────────────────────────────────────────────────────────────────

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
  headerTitle: { ...Typography.h3, color: '#F1F0FF' },
  stepRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, justifyContent: 'center',
  },
  stepDot: {
    width: 28, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  stepDotActive: { backgroundColor: Ping.purple },
  body: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.caption,
    color: '#9490C0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tierRow: { flexDirection: 'row', gap: Spacing.sm },
  tierCard: {
    flex: 1, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: Spacing.md, gap: 3,
  },
  tierPrice: { ...Typography.h3, fontSize: 22 },
  tierLabel: { ...Typography.bodyMed, color: '#F1F0FF', fontWeight: '700' },
  tierMeta: { ...Typography.caption, color: '#9490C0' },
  tierCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1.5,
    backgroundColor: Ping.purple, borderColor: Ping.purple,
  },
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(167,139,250,0.2)',
  },
  chipText: { ...Typography.bodySm, fontWeight: '600', color: '#9490C0' },
  input: {
    backgroundColor: '#1A1A38', borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)', height: 48,
    paddingHorizontal: Spacing.md, ...Typography.bodyMed, color: '#F1F0FF',
  },
  inputMulti: { height: 72, textAlignVertical: 'top', paddingTop: 12 },
  productCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)', padding: Spacing.md, gap: 0,
  },
  productHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  productTitle: { ...Typography.bodyMed, color: '#9490C0', fontWeight: '700' },
  imagePicker: {
    marginTop: 8, height: 120, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  imagePickerText: { ...Typography.caption, color: '#5C5A80' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute' },
  imagePickerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  imagePickerOverlayText: { ...Typography.caption, color: '#FFF', fontWeight: '600' },
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)', borderStyle: 'dashed',
  },
  addProductText: { ...Typography.bodyMed, color: Ping.purpleLight },
  summaryBox: {
    backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
    padding: Spacing.lg, gap: 6, width: '100%', alignItems: 'center',
  },
  summaryTitle: { ...Typography.h3, color: '#F1F0FF' },
  summaryMeta: { ...Typography.bodySm, color: '#9490C0' },
  locNote: { ...Typography.caption, color: '#5C5A80', textAlign: 'center' },
  waitText: { ...Typography.bodyMed, color: '#F1F0FF', textAlign: 'center' },
  waitSub: { ...Typography.bodySm, color: '#9490C0', textAlign: 'center' },
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
  btnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '700' },
});
