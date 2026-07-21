import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from './ConfirmSheet';
import { Ionicons } from '@expo/vector-icons';
import { highlightsApi, type Highlight } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';
import CreateHighlightModal from './CreateHighlightModal';
import HighlightViewerModal from './HighlightViewerModal';

interface SuggestedActivity {
  _id: string;
  title: string;
  type: string;
  placeName?: string;
  expiresAt: string;
  vibe?: string;
}

const CIRCLE_SIZE = 72;
const CIRCLE_BORDER = 3;

const CATEGORY_COLORS: Record<string, string> = {
  food: '#F97316', fitness: '#22C55E', networking: '#3B82F6',
  chill: '#10B981', fun: '#7C3AED', sport: '#EF4444',
  music: '#8B5CF6', outdoor: '#10B981', study: '#3B82F6',
  gaming: '#EC4899', meetup: Ping.purple,
};

interface Props {
  userId: string;
  isOwnProfile: boolean;
  scheme?: 'light' | 'dark';
}

export default function HighlightsSection({ userId, isOwnProfile, scheme = 'light' }: Props) {
  const hs = makeHsStyles(scheme === 'dark');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<SuggestedActivity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [prefillActivity, setPrefillActivity] = useState<SuggestedActivity | null>(null);
  const [viewerHighlight, setViewerHighlight] = useState<Highlight | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Highlight | null>(null);

  useEffect(() => {
    loadHighlights();
    if (isOwnProfile) loadSuggestion();
  }, [userId]);

  async function loadHighlights() {
    try {
      const hs = await highlightsApi.list(userId);
      setHighlights(hs);
    } catch {
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuggestion() {
    try {
      const s = await highlightsApi.suggest();
      setSuggestion(s);
    } catch {}
  }

  function openCreate(activity?: SuggestedActivity | null) {
    setPrefillActivity(activity ?? null);
    setEditingHighlight(null);
    setShowCreate(true);
  }

  function openEdit(h: Highlight) {
    setEditingHighlight(h);
    setPrefillActivity(null);
    setShowCreate(true);
  }

  function handleCreated(h: Highlight) {
    setHighlights((prev) => [h, ...prev]);
    if (prefillActivity) setSuggestion(null);
  }

  function handleUpdated(updated: Highlight) {
    setHighlights((prev) => prev.map((h) => h._id === updated._id ? updated : h));
  }

  function handleLongPress(h: Highlight) {
    if (!isOwnProfile) return;
    setDeleteTarget(h);
  }

  async function doDeleteHighlight(h: Highlight) {
    try {
      await highlightsApi.remove(h._id);
      setHighlights((prev) => prev.filter((x) => x._id !== h._id));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not delete highlight.' });
    }
  }

  if (loading && highlights.length === 0) {
    return (
      <View style={hs.loadingRow}>
        <ActivityIndicator color={Ping.purpleLight} size="small" />
      </View>
    );
  }

  if (!isOwnProfile && highlights.length === 0) return null;

  return (
    <View style={hs.root}>
      <Text style={hs.sectionLabel}>Highlights</Text>

      {/* Auto-suggest banner */}
      {isOwnProfile && suggestion && (
        <TouchableOpacity
          style={hs.suggestBanner}
          onPress={() => openCreate(suggestion)}
          activeOpacity={0.8}
        >
          <View style={hs.suggestIconWrap}>
            <Ionicons name="flash" size={16} color={scheme === 'dark' ? Ping.purpleLight : Ping.purple} />
          </View>
          <Text style={hs.suggestText} numberOfLines={1}>
            Add highlight from "{suggestion.title}"?
          </Text>
          <Ionicons name="add-circle-outline" size={18} color={scheme === 'dark' ? Ping.purpleLight : Ping.purple} />
        </TouchableOpacity>
      )}

      {/* Circle row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={hs.row}
      >
        {/* Add button (own profile only) */}
        {isOwnProfile && (
          <TouchableOpacity
            style={hs.circleWrap}
            onPress={() => openCreate(null)}
            activeOpacity={0.75}
          >
            <View style={[hs.circleOuter, { borderColor: scheme === 'dark' ? 'rgba(167,139,250,0.4)' : 'rgba(124,58,237,0.25)' }]}>
              <View style={[hs.circleInner, { backgroundColor: 'rgba(124,58,237,0.08)' }]}>
                <Ionicons name="add" size={28} color={scheme === 'dark' ? Ping.purpleLight : Ping.purple} />
              </View>
            </View>
            <Text style={hs.circleLabel} numberOfLines={1}>Add</Text>
          </TouchableOpacity>
        )}

        {/* Highlight circles */}
        {highlights.map((h) => {
          const catColor = CATEGORY_COLORS[h.category ?? ''] ?? Ping.purple;
          return (
            <TouchableOpacity
              key={h._id}
              style={hs.circleWrap}
              onPress={() => setViewerHighlight(h)}
              onLongPress={() => handleLongPress(h)}
              activeOpacity={0.8}
              delayLongPress={400}
            >
              <View style={[hs.circleOuter, { borderColor: catColor }]}>
                {h.images[0] ? (
                  <Image source={{ uri: h.images[0] }} style={hs.circleImage} />
                ) : (
                  <View style={[hs.circleInner, { backgroundColor: `${catColor}25` }]}>
                    {/^[a-z0-9-]+$/.test(h.emoji ?? '')
                      ? <Ionicons name={h.emoji as any} size={28} color={catColor} />
                      : <Text style={{ fontSize: 28 }}>{h.emoji}</Text>}
                  </View>
                )}
              </View>
              <Text style={hs.circleLabel} numberOfLines={1}>{h.title}</Text>
              {/* Edit badge — tap to edit, own profile only */}
              {isOwnProfile && (
                <TouchableOpacity style={hs.editBadge} onPress={() => openEdit(h)} hitSlop={6}>
                  <Ionicons name="ellipsis-horizontal" size={9} color="#FFF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {isOwnProfile && highlights.length === 0 && !suggestion && (
          <View style={hs.emptyRow}>
            <Text style={hs.emptyText}>No highlights yet. Tap + to create one!</Text>
          </View>
        )}
      </ScrollView>

      {isOwnProfile && highlights.length > 0 && (
        <Text style={hs.holdHint}>Hold a highlight to edit or delete</Text>
      )}

      <CreateHighlightModal
        visible={showCreate}
        onClose={() => { setShowCreate(false); setEditingHighlight(null); }}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
        prefillActivity={prefillActivity}
        editHighlight={editingHighlight}
      />

      <HighlightViewerModal
        highlight={viewerHighlight}
        visible={!!viewerHighlight}
        onClose={() => setViewerHighlight(null)}
      />

      <ConfirmSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete highlight?"
        subtitle={deleteTarget ? `"${deleteTarget.title}" will be permanently removed.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          if (deleteTarget) doDeleteHighlight(deleteTarget);
          setDeleteTarget(null);
        }}
        icon="trash-outline"
      />
    </View>
  );
}

function makeHsStyles(isDark: boolean) {
  const muted = isDark ? '#9490C0' : '#7B6DAA';
  const dim   = isDark ? '#5C5A80' : '#A89CC8';
  const tint  = isDark ? Ping.purpleLight : Ping.purple;
  return StyleSheet.create({
    root: { gap: Spacing.sm },
    sectionLabel: { ...Typography.caption, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: Spacing.lg },
    loadingRow: { height: 100, justifyContent: 'center', alignItems: 'center' },
    suggestBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      padding: 10,
      backgroundColor: 'rgba(124,58,237,0.08)',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: 'rgba(124,58,237,0.18)',
    },
    suggestIconWrap: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(124,58,237,0.14)',
      alignItems: 'center', justifyContent: 'center',
    },
    suggestText: { ...Typography.caption, color: tint, flex: 1 },
    row: { paddingHorizontal: Spacing.lg, gap: 14, paddingVertical: 4 },
    circleWrap: { alignItems: 'center', gap: 6, width: CIRCLE_SIZE + 8 },
    circleOuter: {
      width: CIRCLE_SIZE + CIRCLE_BORDER * 2,
      height: CIRCLE_SIZE + CIRCLE_BORDER * 2,
      borderRadius: (CIRCLE_SIZE + CIRCLE_BORDER * 2) / 2,
      borderWidth: CIRCLE_BORDER,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    circleInner: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    circleImage: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
    },
    circleLabel: { ...Typography.caption, color: muted, fontSize: 11, maxWidth: CIRCLE_SIZE + 8, textAlign: 'center' },
    editBadge: {
      position: 'absolute',
      top: 52,
      right: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(100,100,140,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8 },
    emptyText: { ...Typography.caption, color: dim, textAlign: 'center', maxWidth: 200 },
    holdHint: { ...Typography.caption, color: dim, fontSize: 10, textAlign: 'center', paddingHorizontal: Spacing.lg },
  });
}
