import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { highlightsApi, uploadApi, type Highlight } from '@/lib/api';
import { Ping, Spacing, Radius, Typography, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// Icon presets — stored as the icon name string in the `emoji` API field
const ICON_PRESETS: { icon: IoniconsName; label: string; color: string }[] = [
  { icon: 'sparkles',                label: 'Moments',     color: '#F59E0B' },
  { icon: 'cafe-outline',            label: 'Café',        color: '#D97706' },
  { icon: 'musical-notes-outline',   label: 'Music',       color: '#8B5CF6' },
  { icon: 'bicycle-outline',         label: 'Cycling',     color: '#22C55E' },
  { icon: 'leaf-outline',            label: 'Nature',      color: '#10B981' },
  { icon: 'restaurant-outline',      label: 'Food',        color: '#F97316' },
  { icon: 'game-controller-outline', label: 'Gaming',      color: '#EC4899' },
  { icon: 'book-outline',            label: 'Study',       color: '#3B82F6' },
  { icon: 'people-outline',          label: 'Social',      color: '#7C3AED' },
  { icon: 'gift-outline',            label: 'Celebrate',   color: '#F59E0B' },
  { icon: 'rocket-outline',          label: 'Goals',       color: '#6366F1' },
  { icon: 'sunny-outline',           label: 'Outdoors',    color: '#FBBF24' },
  { icon: 'walk',                    label: 'Active',      color: '#22C55E' },
  { icon: 'earth-outline',           label: 'Travel',      color: '#0EA5E9' },
  { icon: 'flame-outline',           label: 'Hot',         color: '#EF4444' },
  { icon: 'camera-outline',          label: 'Photos',      color: '#A78BFA' },
  { icon: 'heart-outline',           label: 'Memories',    color: '#EC4899' },
  { icon: 'film-outline',            label: 'Movies',      color: '#8B5CF6' },
  { icon: 'barbell-outline',         label: 'Gym',         color: '#EF4444' },
  { icon: 'compass-outline',         label: 'Adventure',   color: '#F59E0B' },
  { icon: 'tennisball-outline',      label: 'Sports',      color: '#22C55E' },
  { icon: 'color-palette-outline',   label: 'Creative',    color: '#EC4899' },
  { icon: 'star-outline',            label: 'Special',     color: '#FBBF24' },
  { icon: 'pizza-outline',           label: 'Pizza',       color: '#F97316' },
];

const DEFAULT_ICON: IoniconsName = 'sparkles';

const PRIVACY_OPTIONS = [
  { key: 'public',      label: 'Public',   icon: 'earth-outline' as IoniconsName       },
  { key: 'connections', label: 'Friends',  icon: 'people-outline' as IoniconsName      },
  { key: 'private',     label: 'Only me',  icon: 'lock-closed-outline' as IoniconsName },
] as const;

interface PrefillActivity {
  _id: string;
  title: string;
  type: string;
  placeName?: string;
  expiresAt: string;
  vibe?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (highlight: Highlight) => void;
  onUpdated?: (highlight: Highlight) => void;
  prefillActivity?: PrefillActivity | null;
  editHighlight?: Highlight | null;
}

function resolveIcon(stored: string | undefined): IoniconsName {
  if (!stored) return DEFAULT_ICON;
  return ICON_PRESETS.some((p) => p.icon === stored)
    ? (stored as IoniconsName)
    : DEFAULT_ICON;
}

export default function CreateHighlightModal({
  visible, onClose, onCreated, onUpdated, prefillActivity, editHighlight,
}: Props) {
  const insets        = useSafeAreaInsets();
  const scheme        = useColorScheme() ?? 'dark';
  const c             = Colors[scheme];
  const isEditing     = !!editHighlight;

  const [selectedIcon, setSelectedIcon] = useState<IoniconsName>(DEFAULT_ICON);
  const [title, setTitle]               = useState('');
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newUris, setNewUris]           = useState<string[]>([]);
  const [privacy, setPrivacy]           = useState<'public' | 'connections' | 'private'>('public');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [showAllIcons, setShowAllIcons] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowAllIcons(false);
    if (editHighlight) {
      setSelectedIcon(resolveIcon(editHighlight.emoji));
      setTitle(editHighlight.title);
      setExistingUrls(editHighlight.images ?? []);
      setNewUris([]);
      setPrivacy(editHighlight.privacy ?? 'public');
    } else {
      setSelectedIcon(DEFAULT_ICON);
      setTitle('');
      setExistingUrls([]);
      setNewUris([]);
      setPrivacy('public');
    }
  }, [visible, editHighlight]);

  function handleClose() {
    setSelectedIcon(DEFAULT_ICON);
    setTitle('');
    setExistingUrls([]);
    setNewUris([]);
    setPrivacy('public');
    onClose();
  }

  const totalImages = existingUrls.length + newUris.length;

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow photo access to add images to your highlight.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - totalImages,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri);
    setNewUris((prev) => [...prev, ...uris].slice(0, 10 - existingUrls.length));
  }

  function removeExisting(idx: number) {
    setExistingUrls((prev) => prev.filter((_, i) => i !== idx));
  }
  function removeNew(idx: number) {
    setNewUris((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    const t = title.trim();
    if (!t) { Toast.show({ type: 'error', text1: 'Title required', text2: 'Give your highlight a name.' }); return; }

    setSaving(true);
    let uploadedNewUrls: string[] = [];
    try {
      if (newUris.length > 0) {
        setUploading(true);
        uploadedNewUrls = await Promise.all(
          newUris.map((uri) => uploadApi.uploadImage(uri, 'misc'))
        );
        setUploading(false);
      }

      const allImages = [...existingUrls, ...uploadedNewUrls];

      if (isEditing && editHighlight) {
        const updated = await highlightsApi.update(editHighlight._id, {
          title: t, emoji: selectedIcon, images: allImages, privacy,
        });
        onUpdated?.(updated);
      } else {
        const highlight = await highlightsApi.create({
          title: t, emoji: selectedIcon, images: allImages, privacy,
          ...(prefillActivity ? {
            activityId: prefillActivity._id,
            location:   prefillActivity.placeName,
            vibe:       prefillActivity.vibe,
            pingDate:   prefillActivity.expiresAt,
            category:   prefillActivity.type as any,
          } : {}),
        });
        onCreated(highlight);
      }
      handleClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not save highlight.' });
      setSaving(false);
    }
  }

  const activePreset  = ICON_PRESETS.find((p) => p.icon === selectedIcon) ?? ICON_PRESETS[0];
  const borderColor   = scheme === 'dark' ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.1)';
  const subBorder     = scheme === 'dark' ? 'rgba(167,139,250,0.1)'  : 'rgba(124,58,237,0.07)';
  const chipBorder    = scheme === 'dark' ? 'rgba(167,139,250,0.2)'  : 'rgba(124,58,237,0.15)';
  const chipBg        = scheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const handleColor   = scheme === 'dark' ? 'rgba(167,139,250,0.3)'  : 'rgba(124,58,237,0.2)';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={cm.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={cm.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={[cm.sheet, {
          backgroundColor: c.surface,
          borderColor,
        }, { paddingBottom: insets.bottom + Spacing.md }]}>

          {/* Handle */}
          <View style={[cm.handle, { backgroundColor: handleColor }]} />

          {/* Header */}
          <View style={[cm.header, { borderBottomColor: subBorder }]}>
            <View style={[cm.headerIconWrap, { backgroundColor: `${activePreset.color}18` }]}>
              <Ionicons name={selectedIcon} size={18} color={activePreset.color} />
            </View>
            <Text style={[cm.headerTitle, { color: c.text }]}>
              {isEditing ? 'Edit Highlight' : 'New Highlight'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={c.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={cm.body}
          >
            {/* Icon picker */}
            <View style={cm.section}>
              <Text style={[cm.label, { color: c.textSecondary }]}>Icon</Text>
              <View style={cm.iconGrid}>
                {(showAllIcons ? ICON_PRESETS : ICON_PRESETS.slice(0, 5)).map((preset) => {
                  const active = selectedIcon === preset.icon;
                  return (
                    <TouchableOpacity
                      key={preset.icon}
                      style={[
                        cm.iconBtn,
                        { borderColor: active ? preset.color : chipBorder, backgroundColor: active ? `${preset.color}18` : chipBg },
                      ]}
                      onPress={() => setSelectedIcon(preset.icon)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={preset.icon}
                        size={20}
                        color={active ? preset.color : c.icon}
                      />
                      <Text style={[cm.iconBtnLabel, { color: active ? preset.color : c.icon }]} numberOfLines={1}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[cm.iconBtn, { borderColor: chipBorder, backgroundColor: chipBg }]}
                  onPress={() => setShowAllIcons((v) => !v)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={showAllIcons ? 'chevron-up' : 'ellipsis-horizontal'}
                    size={20}
                    color={c.icon}
                  />
                  <Text style={[cm.iconBtnLabel, { color: c.icon }]} numberOfLines={1}>
                    {showAllIcons ? 'Less' : 'More'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Title */}
            <View style={cm.section}>
              <Text style={[cm.label, { color: c.textSecondary }]}>Title</Text>
              <TextInput
                style={[cm.titleInput, { backgroundColor: c.card, borderColor: chipBorder, color: c.text }]}
                placeholder="e.g. Cafe Meetup or Sunday Badminton"
                placeholderTextColor={c.icon}
                value={title}
                onChangeText={setTitle}
                maxLength={60}
                returnKeyType="done"
              />
            </View>

            {/* Images */}
            <View style={cm.section}>
              <Text style={[cm.label, { color: c.textSecondary }]}>
                Photos{'  '}
                <Text style={[cm.labelSub, { color: c.icon }]}>{totalImages}/10</Text>
              </Text>
              <View style={cm.imageGrid}>
                {existingUrls.map((url, i) => (
                  <View key={`ex-${i}`} style={cm.imageCell}>
                    <Image source={{ uri: url }} style={cm.imageThumb} resizeMode="cover" />
                    <TouchableOpacity style={cm.imageRemove} onPress={() => removeExisting(i)}>
                      <Ionicons name="close-circle" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {newUris.map((uri, i) => (
                  <View key={`new-${i}`} style={cm.imageCell}>
                    <Image source={{ uri }} style={cm.imageThumb} resizeMode="cover" />
                    <TouchableOpacity style={cm.imageRemove} onPress={() => removeNew(i)}>
                      <Ionicons name="close-circle" size={18} color="#FFF" />
                    </TouchableOpacity>
                    <View style={cm.newBadge}>
                      <Ionicons name="add" size={10} color="#FFF" />
                    </View>
                  </View>
                ))}
                {totalImages < 10 && (
                  <TouchableOpacity
                    style={[cm.addImageBtn, { backgroundColor: chipBg, borderColor: chipBorder }]}
                    onPress={pickImages}
                    activeOpacity={0.75}
                  >
                    {uploading
                      ? <ActivityIndicator color={Ping.purpleLight} />
                      : <Ionicons name="add" size={28} color={c.icon} />}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Linked ping banner */}
            {!isEditing && prefillActivity && (
              <View style={[cm.linkedPing, { backgroundColor: `${Ping.purple}12`, borderColor: `${Ping.purple}25` }]}>
                <Ionicons name="flash" size={14} color={Ping.purpleLight} />
                <Text style={[cm.linkedPingText, { color: Ping.purpleLight }]} numberOfLines={1}>
                  From: {prefillActivity.title}
                  {prefillActivity.placeName ? ` · ${prefillActivity.placeName}` : ''}
                </Text>
              </View>
            )}

            {/* Privacy */}
            <View style={cm.section}>
              <Text style={[cm.label, { color: c.textSecondary }]}>Who can see it?</Text>
              <View style={cm.privacyRow}>
                {PRIVACY_OPTIONS.map((opt) => {
                  const active = privacy === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        cm.privacyChip,
                        { borderColor: active ? Ping.purple : chipBorder, backgroundColor: active ? Ping.purple : chipBg },
                      ]}
                      onPress={() => setPrivacy(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={opt.icon} size={13} color={active ? '#FFF' : c.icon} />
                      <Text style={[cm.privacyLabel, { color: active ? '#FFF' : c.textSecondary }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Save button */}
          <View style={[cm.footer, { borderTopColor: subBorder }]}>
            <TouchableOpacity
              style={[cm.saveBtn, saving && cm.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name={selectedIcon} size={18} color="#FFF" />
                  <Text style={cm.saveBtnText}>
                    {isEditing ? 'Update Highlight' : 'Save Highlight'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CELL_SIZE = 80;

const cm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerIconWrap: {
    width: 34, height: 34, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3, flex: 1 },
  body:    { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  label:   { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.6 },
  labelSub:{ textTransform: 'none', letterSpacing: 0, fontWeight: '400' },

  // Icon picker grid
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: {
    width: 58, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1.5, gap: 4,
  },
  iconBtnLabel: { fontSize: 9, fontWeight: '600', textAlign: 'center' },

  // Title
  titleInput: {
    borderRadius: Radius.md, borderWidth: 1.5,
    height: 52, paddingHorizontal: Spacing.md,
    ...Typography.bodyMed,
  },

  // Images
  imageGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageCell:  { width: CELL_SIZE, height: CELL_SIZE, borderRadius: Radius.md, overflow: 'hidden' },
  imageThumb: { width: CELL_SIZE, height: CELL_SIZE },
  imageRemove:{
    position: 'absolute', top: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
  },
  newBadge: {
    position: 'absolute', bottom: 4, left: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Ping.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  addImageBtn: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: Radius.md,
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // Linked ping
  linkedPing: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: Radius.md, borderWidth: 1,
  },
  linkedPingText: { ...Typography.caption, flex: 1 },

  // Privacy
  privacyRow: { flexDirection: 'row', gap: Spacing.sm },
  privacyChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1.5,
  },
  privacyLabel: { ...Typography.caption, fontWeight: '600' },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  saveBtn: {
    backgroundColor: Ping.purple, borderRadius: Radius.md,
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '700' },
});
