import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
  Modal, Switch, KeyboardAvoidingView, Platform, FlatList, Image,
  Keyboard, Dimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { adminApi, uploadApi, type PingEvent } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(s: string): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function displayDate(s: string) {
  if (!s) return 'Select date';
  return parseYMD(s).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function FormField({
  label,
  labelStyle,
  onActivate,
  children,
}: {
  label: string;
  labelStyle: object;
  onActivate: (wrap: View | null) => void;
  children: (bind: { onFocus: () => void }) => React.ReactNode;
}) {
  const wrapRef = useRef<View>(null);
  return (
    <View ref={wrapRef} collapsable={false}>
      <Text style={labelStyle}>{label}</Text>
      {children({ onFocus: () => onActivate(wrapRef.current) })}
    </View>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY_META: Record<string, { label: string; color: string; icon: IoniconName }> = {
  event: { label: 'Event', color: '#0F766E', icon: 'calendar-outline' },
  offer: { label: 'Café Offer', color: '#EA580C', icon: 'pricetag-outline' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function isExpired(e: PingEvent) {
  return new Date(e.endDate) < new Date();
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onToggle,
  onDelete,
  onEdit,
}: {
  event: PingEvent;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.event;
  const expired = isExpired(event);

  return (
    <View style={[c.card, expired && c.cardExpired]}>
      <View style={c.hero}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={c.heroImg} resizeMode="cover" />
        ) : (
          <View style={[c.heroPlaceholder, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={28} color="#FFF" />
          </View>
        )}
        <View style={[c.badge, { backgroundColor: `${meta.color}EE` }]}>
          <Ionicons name={meta.icon} size={11} color="#FFF" />
          <Text style={c.badgeText}>{meta.label}</Text>
        </View>
        {expired && (
          <View style={c.expiredBadge}>
            <Text style={c.expiredText}>Expired</Text>
          </View>
        )}
      </View>

      <View style={c.body}>
        <View style={c.cardTop}>
          <Text style={c.title} numberOfLines={2}>{event.title}</Text>
          <Switch
            value={event.isActive}
            onValueChange={onToggle}
            trackColor={{ false: '#E5E7EB', true: `${Ping.purple}80` }}
            thumbColor={event.isActive ? Ping.purple : '#9CA3AF'}
            style={{ transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] }}
          />
        </View>

        {event.description ? (
          <Text style={c.desc} numberOfLines={2}>{event.description}</Text>
        ) : null}

        {(event.venueName || event.venueAddress) ? (
          <View style={c.venueRow}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={c.venueText} numberOfLines={1}>
              {event.venueName ?? event.venueAddress}
            </Text>
          </View>
        ) : null}

        <View style={c.datesRow}>
          <Ionicons name="time-outline" size={12} color="#9CA3AF" />
          <Text style={c.dateText}>{fmt(event.startDate)} — {fmt(event.endDate)}</Text>
        </View>

        {event.tags.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={c.tagsScroll}>
            {event.tags.map((tag) => (
              <View key={tag} style={c.tag}>
                <Text style={c.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={c.actions}>
          <TouchableOpacity style={c.editBtn} onPress={onEdit} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={14} color="#111827" />
            <Text style={c.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={c.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={c.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED',
    overflow: 'hidden',
  },
  cardExpired: { opacity: 0.55 },
  hero: { height: 120, position: 'relative', backgroundColor: '#F3F4F6' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full,
  },
  badgeText: { ...Typography.micro, color: '#FFF', fontWeight: '700' },
  expiredBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(220,38,38,0.9)',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  expiredText: { ...Typography.micro, color: '#FFF', fontWeight: '700' },
  body: { padding: Spacing.md, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { ...Typography.h4, color: '#111827', flex: 1 },
  desc: { ...Typography.bodySm, color: '#6B7280' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  venueText: { ...Typography.caption, color: '#6B7280', flex: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { ...Typography.caption, color: '#9CA3AF' },
  tagsScroll: { marginTop: 2 },
  tag: {
    backgroundColor: '#F3F4F6',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    marginRight: 6,
  },
  tagText: { ...Typography.micro, color: '#6B7280' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: Radius.md,
  },
  editBtnText: { ...Typography.bodySm, color: '#111827', fontWeight: '600' },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10,
    backgroundColor: 'rgba(220,38,38,0.06)',
    borderRadius: Radius.md,
  },
  deleteBtnText: { ...Typography.bodySm, color: '#DC2626', fontWeight: '600' },
});

// ── Create / Edit modal ───────────────────────────────────────────────────────

interface EventForm {
  title: string;
  description: string;
  category: 'offer' | 'event';
  venueName: string;
  venueAddress: string;
  startDate: string;
  endDate: string;
  tags: string;
  isActive: boolean;
  imageUrl: string | null;
}

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  category: 'event',
  venueName: '',
  venueAddress: '',
  startDate: '',
  endDate: '',
  tags: '',
  isActive: true,
  imageUrl: null,
};

function eventToForm(e: PingEvent): EventForm {
  return {
    title: e.title,
    description: e.description ?? '',
    category: e.category,
    venueName: e.venueName ?? '',
    venueAddress: e.venueAddress ?? '',
    startDate: e.startDate.split('T')[0],
    endDate: e.endDate.split('T')[0],
    tags: e.tags.join(', '),
    isActive: e.isActive,
    imageUrl: e.imageUrl ?? null,
  };
}

function FormModal({
  visible,
  editEvent,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editEvent: PingEvent | null;
  onClose: () => void;
  onSaved: (e: PingEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHRef = useRef(0);
  const focusWrapRef = useRef<View | null>(null);

  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);
  const [dateField, setDateField] = useState<'startDate' | 'endDate' | null>(null);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  const wasVisible = useRef(false);
  if (visible && !wasVisible.current) {
    wasVisible.current = true;
    const next = editEvent ? eventToForm(editEvent) : EMPTY_FORM;
    if (JSON.stringify(next) !== JSON.stringify(form)) {
      setForm(next);
    }
  }
  if (!visible && wasVisible.current) {
    wasVisible.current = false;
    setDateField(null);
    setIosPickerOpen(false);
    setKeyboardH(0);
    keyboardHRef.current = 0;
  }

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      const h = e.endCoordinates.height;
      keyboardHRef.current = h;
      setKeyboardH(h);
      // Re-scroll focused field once keyboard height is known
      setTimeout(() => scrollFocusedIntoView(), 50);
      setTimeout(() => scrollFocusedIntoView(), 200);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      keyboardHRef.current = 0;
      setKeyboardH(0);
      focusWrapRef.current = null;
    });
    return () => { show.remove(); hide.remove(); };
  }, [visible]);

  function scrollFocusedIntoView() {
    const wrap = focusWrapRef.current;
    if (!wrap || !scrollRef.current) return;
    wrap.measureInWindow((_x, y, _w, h) => {
      const winH = Dimensions.get('window').height;
      const kb = keyboardHRef.current > 40 ? keyboardHRef.current : 0;
      if (kb <= 0) return;
      // Leave a little breathing room above the keyboard
      const keyboardTop = winH - kb;
      const fieldBottom = y + h + 16;
      if (fieldBottom > keyboardTop) {
        const delta = fieldBottom - keyboardTop;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + delta),
          animated: true,
        });
      }
    });
  }

  function onFieldFocus(wrap: View | null) {
    focusWrapRef.current = wrap;
    // Immediate attempt + delayed (keyboard animation / height settle)
    requestAnimationFrame(scrollFocusedIntoView);
    setTimeout(scrollFocusedIntoView, 100);
    setTimeout(scrollFocusedIntoView, 280);
    setTimeout(scrollFocusedIntoView, 450);
  }

  function set(k: keyof EventForm, v: string | boolean | null) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openDatePicker(field: 'startDate' | 'endDate') {
    Keyboard.dismiss();
    setDateField(field);
    if (Platform.OS === 'ios') setIosPickerOpen(true);
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setDateField(null);
      if (event.type !== 'set' || !selected || !dateField) return;
      set(dateField, toYMD(selected));
      return;
    }
    if (selected && dateField) set(dateField, toYMD(selected));
  }

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'info', text1: 'Permission needed', text2: 'Allow photo access to upload a cover.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'misc');
      set('imageUrl', url);
      Toast.show({ type: 'success', text1: 'Cover uploaded' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: e.message || 'Try again.' });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.title.trim()) { Toast.show({ type: 'error', text1: 'Title required' }); return; }
    if (!form.startDate) { Toast.show({ type: 'error', text1: 'Start date required' }); return; }
    if (!form.endDate) { Toast.show({ type: 'error', text1: 'End date required' }); return; }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      venueName: form.venueName.trim() || null,
      venueAddress: form.venueAddress.trim() || null,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate + 'T23:59:59').toISOString(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      isActive: form.isActive,
      imageUrl: form.imageUrl,
    };

    setSaving(true);
    try {
      let saved: PingEvent;
      if (editEvent) {
        saved = await adminApi.updateEvent(editEvent._id, payload);
      } else {
        saved = await adminApi.createEvent(payload);
      }
      onSaved(saved);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setSaving(false);
    }
  }

  const pickerValue = parseYMD(dateField ? form[dateField] : '');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[fm.root, { paddingTop: insets.top }]}>
        <View style={fm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={[fm.headerSide, { alignItems: 'flex-start' }]}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={fm.headerTitle}>{editEvent ? 'Edit Event' : 'New Event'}</Text>
          <TouchableOpacity onPress={save} disabled={saving || uploading} hitSlop={8} style={[fm.headerSide, { alignItems: 'flex-end' }]}>
            {saving
              ? <ActivityIndicator color={Ping.purple} size="small" />
              : <Text style={fm.saveBtn}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        {/* padding works inside Modal on Android; activity "pan" does not */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              fm.body,
              { paddingBottom: 32 + Math.max(keyboardH, insets.bottom) + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <Text style={fm.label}>Poster / Cover</Text>
            <TouchableOpacity style={fm.coverBtn} onPress={pickCover} activeOpacity={0.85} disabled={uploading}>
              {form.imageUrl ? (
                <Image source={{ uri: form.imageUrl }} style={fm.coverImg} resizeMode="cover" />
              ) : (
                <View style={fm.coverEmpty}>
                  {uploading ? (
                    <ActivityIndicator color={Ping.purple} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                      <Text style={fm.coverHint}>Upload poster image</Text>
                      <Text style={fm.coverSub}>Looks best in portrait 3:4</Text>
                    </>
                  )}
                </View>
              )}
              {form.imageUrl ? (
                <View style={fm.coverOverlay}>
                  <Text style={fm.coverChange}>{uploading ? 'Uploading…' : 'Change cover'}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            {form.imageUrl ? (
              <TouchableOpacity onPress={() => set('imageUrl', null)} style={fm.removeCover}>
                <Text style={fm.removeCoverText}>Remove cover</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={fm.label}>Category</Text>
            <View style={fm.chips}>
              {(['event', 'offer'] as const).map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = form.category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[fm.chip, active && { backgroundColor: `${meta.color}20`, borderColor: meta.color }]}
                    onPress={() => set('category', cat)}
                  >
                    <Ionicons name={meta.icon} size={14} color={active ? meta.color : '#9CA3AF'} />
                    <Text style={[fm.chipText, active && { color: meta.color }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FormField label="Title *" labelStyle={fm.label} onActivate={onFieldFocus}>
              {({ onFocus }) => (
                <TextInput
                  style={fm.input}
                  value={form.title}
                  onChangeText={(v) => set('title', v)}
                  placeholder="e.g. Cocktail Night / 50% off lattes"
                  placeholderTextColor="#9CA3AF"
                  maxLength={80}
                  onFocus={onFocus}
                />
              )}
            </FormField>

            <FormField label="Tagline / Description" labelStyle={fm.label} onActivate={onFieldFocus}>
              {({ onFocus }) => (
                <TextInput
                  style={[fm.input, fm.textarea]}
                  value={form.description}
                  onChangeText={(v) => set('description', v)}
                  placeholder="One line that sells it — shown under the poster"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  onFocus={onFocus}
                />
              )}
            </FormField>

            <FormField label="Venue Name" labelStyle={fm.label} onActivate={onFieldFocus}>
              {({ onFocus }) => (
                <TextInput
                  style={fm.input}
                  value={form.venueName}
                  onChangeText={(v) => set('venueName', v)}
                  placeholder="Café name or venue"
                  placeholderTextColor="#9CA3AF"
                  maxLength={100}
                  onFocus={onFocus}
                />
              )}
            </FormField>

            <FormField label="Venue Address" labelStyle={fm.label} onActivate={onFieldFocus}>
              {({ onFocus }) => (
                <TextInput
                  style={fm.input}
                  value={form.venueAddress}
                  onChangeText={(v) => set('venueAddress', v)}
                  placeholder="Full address or area"
                  placeholderTextColor="#9CA3AF"
                  maxLength={200}
                  onFocus={onFocus}
                />
              )}
            </FormField>

            <Text style={fm.label}>Start Date *</Text>
            <TouchableOpacity style={fm.dateBtn} onPress={() => openDatePicker('startDate')} activeOpacity={0.75}>
              <Ionicons name="calendar-outline" size={18} color="#111827" />
              <Text style={[fm.dateText, !form.startDate && fm.datePlaceholder]}>
                {displayDate(form.startDate)}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <Text style={fm.label}>End Date *</Text>
            <TouchableOpacity style={fm.dateBtn} onPress={() => openDatePicker('endDate')} activeOpacity={0.75}>
              <Ionicons name="calendar-outline" size={18} color="#111827" />
              <Text style={[fm.dateText, !form.endDate && fm.datePlaceholder]}>
                {displayDate(form.endDate)}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <FormField label="Tags (comma-separated)" labelStyle={fm.label} onActivate={onFieldFocus}>
              {({ onFocus }) => (
                <TextInput
                  style={fm.input}
                  value={form.tags}
                  onChangeText={(v) => set('tags', v)}
                  placeholder="coffee, discount, weekend"
                  placeholderTextColor="#9CA3AF"
                  onFocus={onFocus}
                />
              )}
            </FormField>

            <View style={fm.switchRow}>
              <View>
                <Text style={[fm.label, { marginBottom: 0 }]}>Active</Text>
                <Text style={fm.switchSub}>Shows on the Events carousel</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={(v) => set('isActive', v)}
                trackColor={{ false: '#E5E7EB', true: `${Ping.purple}80` }}
                thumbColor={form.isActive ? Ping.purple : '#9CA3AF'}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {Platform.OS === 'android' && dateField ? (
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="calendar"
            onChange={onDateChange}
          />
        ) : null}

        {Platform.OS === 'ios' && iosPickerOpen && dateField ? (
          <View style={[fm.iosPickerWrap, { paddingBottom: insets.bottom + 8 }]}>
            <View style={fm.iosPickerBar}>
              <TouchableOpacity onPress={() => { setIosPickerOpen(false); setDateField(null); }}>
                <Text style={fm.iosPickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={fm.iosPickerTitle}>{dateField === 'startDate' ? 'Start date' : 'End date'}</Text>
              <TouchableOpacity onPress={() => { setIosPickerOpen(false); setDateField(null); }}>
                <Text style={fm.iosPickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="inline"
              onChange={onDateChange}
              style={{ alignSelf: 'center' }}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8ED',
  },
  headerSide: { minWidth: 56, alignItems: 'center' },
  headerTitle: { ...Typography.h4, color: '#111827', fontWeight: '700', flex: 1, textAlign: 'center' },
  saveBtn: { ...Typography.bodyMed, color: '#111827', fontWeight: '700' },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  label: { ...Typography.caption, color: '#6B7280', fontWeight: '600', marginBottom: -2 },
  coverBtn: {
    height: 180,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED',
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  coverHint: { color: '#111827', fontWeight: '600', fontSize: 14 },
  coverSub: { color: '#9CA3AF', fontSize: 12 },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  coverChange: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  removeCover: { alignSelf: 'flex-start', marginBottom: 4 },
  removeCoverText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    ...Typography.body,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateText: { ...Typography.body, color: '#111827', flex: 1 },
  datePlaceholder: { color: '#9CA3AF' },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED',
  },
  chipText: { ...Typography.bodySm, color: '#6B7280', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8ED', padding: Spacing.md,
    marginTop: 4,
  },
  switchSub: { ...Typography.caption, color: '#9CA3AF', marginTop: 2 },
  iosPickerWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E8E8ED',
    paddingTop: 8,
  },
  iosPickerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
  },
  iosPickerCancel: { ...Typography.bodyMed, color: '#6B7280' },
  iosPickerTitle: { ...Typography.bodyMed, color: '#111827', fontWeight: '700' },
  iosPickerDone: { ...Typography.bodyMed, color: Ping.purple, fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AdminEvents() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<PingEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editEvent, setEditEvent] = useState<PingEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PingEvent | null>(null);

  async function load(p = 1, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else if (p === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await adminApi.events(p);
      if (p === 1) {
        setEvents(res.events);
      } else {
        setEvents((prev) => [...prev, ...res.events]);
      }
      setTotal(res.total);
      setPage(p);
    } catch (err: any) {
      if (err.message !== 'Not authenticated') Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  useFocusEffect(useCallback(() => { load(1); }, []));

  async function handleToggle(event: PingEvent) {
    try {
      const updated = await adminApi.updateEvent(event._id, { isActive: !event.isActive });
      setEvents((prev) => prev.map((e) => e._id === updated._id ? updated : e));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  }

  async function confirmDelete(event: PingEvent) {
    try {
      await adminApi.deleteEvent(event._id);
      setEvents((prev) => prev.filter((e) => e._id !== event._id));
      setTotal((t) => t - 1);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  }

  function handleEdit(event: PingEvent) {
    setEditEvent(event);
    setModalVisible(true);
  }

  function handleNew() {
    setEditEvent(null);
    setModalVisible(true);
  }

  function handleSaved(saved: PingEvent) {
    setModalVisible(false);
    if (editEvent) {
      setEvents((prev) => prev.map((e) => e._id === saved._id ? saved : e));
    } else {
      setEvents((prev) => [saved, ...prev]);
      setTotal((t) => t + 1);
    }
  }

  const hasMore = events.length < total;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Events</Text>
          <Text style={s.headerSub}>{total} total</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={handleNew} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={s.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Ping.purple} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e._id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor={Ping.purple} />
          }
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onToggle={() => handleToggle(item)}
              onDelete={() => setDeleteTarget(item)}
              onEdit={() => handleEdit(item)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
              <Ionicons name="film-outline" size={36} color="#9CA3AF" />
              </View>
              <Text style={s.emptyTitle}>No events yet</Text>
              <Text style={s.emptySub}>Create a poster-style event — it’ll appear in the app carousel.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={s.loadMore} onPress={() => load(page + 1)}>
                {loadingMore
                  ? <ActivityIndicator color={Ping.purple} />
                  : <Text style={s.loadMoreText}>Load more</Text>
                }
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <FormModal
        visible={modalVisible}
        editEvent={editEvent}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />

      <ConfirmSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete event?"
        subtitle={deleteTarget ? `"${deleteTarget.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        icon="trash-outline"
        onConfirm={() => {
          if (deleteTarget) confirmDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8ED',
  },
  headerTitle: { ...Typography.h3, color: '#111827', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { ...Typography.caption, color: '#6B7280', marginTop: 2, fontWeight: '600' },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#111827', borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  newBtnText: { ...Typography.bodySm, color: '#FFF', fontWeight: '600' },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { ...Typography.h3, color: '#111827', fontSize: 18 },
  emptySub: { ...Typography.bodySm, color: '#9CA3AF', textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  loadMore: { alignItems: 'center', paddingVertical: Spacing.lg },
  loadMoreText: { color: '#6B7280', fontWeight: '600' },
});
