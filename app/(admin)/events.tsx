import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
  Modal, Switch, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, type PingEvent } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY_META: Record<string, { label: string; color: string; icon: IoniconName }> = {
  event: { label: 'Event', color: Ping.purple, icon: 'calendar-outline' },
  offer: { label: 'Café Offer', color: '#F97316', icon: 'pricetag-outline' },
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
      <View style={c.cardTop}>
        <View style={[c.badge, { backgroundColor: `${meta.color}20`, borderColor: `${meta.color}40` }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[c.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {expired && (
          <View style={c.expiredBadge}>
            <Text style={c.expiredText}>Expired</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Switch
          value={event.isActive}
          onValueChange={onToggle}
          trackColor={{ false: '#2A2A50', true: `${Ping.purple}80` }}
          thumbColor={event.isActive ? Ping.purple : '#5C5A80'}
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        />
      </View>

      <Text style={c.title} numberOfLines={2}>{event.title}</Text>
      {event.description ? (
        <Text style={c.desc} numberOfLines={2}>{event.description}</Text>
      ) : null}

      {(event.venueName || event.venueAddress) ? (
        <View style={c.venueRow}>
          <Ionicons name="location-outline" size={12} color="#9490C0" />
          <Text style={c.venueText} numberOfLines={1}>
            {event.venueName ?? event.venueAddress}
          </Text>
        </View>
      ) : null}

      <View style={c.datesRow}>
        <Ionicons name="time-outline" size={12} color="#5C5A80" />
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
        <TouchableOpacity style={c.editBtn} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={14} color={Ping.purpleLight} />
          <Text style={c.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={c.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
          <Text style={c.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: '#11112A',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    padding: Spacing.md,
    gap: 8,
  },
  cardExpired: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1,
  },
  badgeText: { ...Typography.micro, fontWeight: '700' },
  expiredBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  expiredText: { ...Typography.micro, color: '#EF4444', fontWeight: '700' },
  title: { ...Typography.h4, color: '#F1F0FF' },
  desc: { ...Typography.bodySm, color: '#9490C0' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  venueText: { ...Typography.caption, color: '#9490C0', flex: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { ...Typography.caption, color: '#5C5A80' },
  tagsScroll: { marginTop: 2 },
  tag: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    marginRight: 6,
  },
  tagText: { ...Typography.micro, color: Ping.purpleLight },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: Radius.sm, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  editBtnText: { ...Typography.bodySm, color: Ping.purpleLight, fontWeight: '600' },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: Radius.sm, borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  deleteBtnText: { ...Typography.bodySm, color: '#EF4444', fontWeight: '600' },
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
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
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
  }

  function set(k: keyof EventForm, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.title.trim()) { Toast.show({ type: 'error', text1: 'Title required' }); return; }
    if (!form.startDate) { Toast.show({ type: 'error', text1: 'Start date required', text2: 'Format: YYYY-MM-DD' }); return; }
    if (!form.endDate) { Toast.show({ type: 'error', text1: 'End date required', text2: 'Format: YYYY-MM-DD' }); return; }

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

  const inputStyle = [fm.input];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.root}>
          {/* Header */}
          <View style={fm.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#9490C0" />
            </TouchableOpacity>
            <Text style={fm.headerTitle}>{editEvent ? 'Edit Event' : 'New Event / Offer'}</Text>
            <TouchableOpacity onPress={save} disabled={saving} hitSlop={8}>
              {saving
                ? <ActivityIndicator color={Ping.purple} size="small" />
                : <Text style={fm.saveBtn}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            {/* Category chips */}
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
                    <Ionicons name={meta.icon} size={14} color={active ? meta.color : '#5C5A80'} />
                    <Text style={[fm.chipText, active && { color: meta.color }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={fm.label}>Title *</Text>
            <TextInput
              style={inputStyle}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder="e.g. 50% off lattes every Monday"
              placeholderTextColor="#5C5A80"
              maxLength={80}
            />

            <Text style={fm.label}>Description</Text>
            <TextInput
              style={[inputStyle, fm.textarea]}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              placeholder="What's happening? Keep it short."
              placeholderTextColor="#5C5A80"
              multiline
              maxLength={500}
            />

            <Text style={fm.label}>Venue Name</Text>
            <TextInput
              style={inputStyle}
              value={form.venueName}
              onChangeText={(v) => set('venueName', v)}
              placeholder="Café name or venue"
              placeholderTextColor="#5C5A80"
              maxLength={100}
            />

            <Text style={fm.label}>Venue Address</Text>
            <TextInput
              style={inputStyle}
              value={form.venueAddress}
              onChangeText={(v) => set('venueAddress', v)}
              placeholder="Full address or area"
              placeholderTextColor="#5C5A80"
              maxLength={200}
            />

            <Text style={fm.label}>Start Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={inputStyle}
              value={form.startDate}
              onChangeText={(v) => set('startDate', v)}
              placeholder="2026-07-01"
              placeholderTextColor="#5C5A80"
              keyboardType="numeric"
              maxLength={10}
            />

            <Text style={fm.label}>End Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={inputStyle}
              value={form.endDate}
              onChangeText={(v) => set('endDate', v)}
              placeholder="2026-07-31"
              placeholderTextColor="#5C5A80"
              keyboardType="numeric"
              maxLength={10}
            />

            <Text style={fm.label}>Tags (comma-separated)</Text>
            <TextInput
              style={inputStyle}
              value={form.tags}
              onChangeText={(v) => set('tags', v)}
              placeholder="coffee, discount, weekend"
              placeholderTextColor="#5C5A80"
            />

            <View style={fm.switchRow}>
              <View>
                <Text style={fm.label}>Active</Text>
                <Text style={fm.switchSub}>Shows on map and events tab</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={(v) => set('isActive', v)}
                trackColor={{ false: '#2A2A50', true: `${Ping.purple}80` }}
                thumbColor={form.isActive ? Ping.purple : '#5C5A80'}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fm = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080815' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  headerTitle: { ...Typography.h4, color: '#F1F0FF' },
  saveBtn: { ...Typography.bodyMed, color: Ping.purpleLight, fontWeight: '700' },
  body: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 60 },
  label: { ...Typography.caption, color: '#9490C0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: -2 },
  input: {
    backgroundColor: '#11112A',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F0FF',
    ...Typography.body,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    backgroundColor: '#11112A',
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  chipText: { ...Typography.bodySm, color: '#5C5A80', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#11112A', borderRadius: Radius.md, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)', padding: Spacing.md,
    marginTop: 4,
  },
  switchSub: { ...Typography.caption, color: '#5C5A80', marginTop: 2 },
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
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Events & Offers</Text>
          <Text style={s.headerSub}>{total} total</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={handleNew}>
          <Ionicons name="add" size={18} color="#F1F0FF" />
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
            <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor={Ping.purpleLight} />
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
              <Ionicons name="calendar-outline" size={48} color="#2A2A50" />
              <Text style={s.emptyTitle}>No events yet</Text>
              <Text style={s.emptySub}>Tap "New" to create your first event or café offer.</Text>
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
  root: { flex: 1, backgroundColor: '#080815' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  headerTitle: { ...Typography.h3, color: '#F1F0FF' },
  headerSub: { ...Typography.caption, color: '#9490C0', marginTop: 2 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Ping.purple, borderRadius: Radius.sm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  newBtnText: { ...Typography.bodySm, color: '#F1F0FF', fontWeight: '700' },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { ...Typography.h3, color: '#5C5A80' },
  emptySub: { ...Typography.bodySm, color: '#2A2A50', textAlign: 'center', maxWidth: 260 },
  loadMore: { alignItems: 'center', paddingVertical: Spacing.lg },
  loadMoreText: { ...Typography.bodyMed, color: Ping.purpleLight },
});
