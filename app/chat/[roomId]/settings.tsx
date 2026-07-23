import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Image, ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import {
  chatApi, friendsApi, uploadApi,
  type ChatRoom, type ChatParticipant, type Friendship,
} from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GroupChatSettings() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeTarget, setRemoveTarget] = useState<ChatParticipant | null>(null);
  const [uploading, setUploading] = useState(false);

  const isOwner = !!room?.isOwner;
  const members = room?.participantIds ?? [];

  const load = useCallback(async () => {
    try {
      const res = await chatApi.getRoom(roomId);
      setRoom(res.room);
      setName(res.room.name || '');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || !isOwner) return;
    setSaving(true);
    try {
      const res = await chatApi.updateRoom(roomId, { name: trimmed });
      setRoom(res.room);
      setEditingName(false);
      Toast.show({ type: 'success', text1: 'Group renamed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function changePhoto() {
    if (!isOwner) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'info', text1: 'Permission needed' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const url = await uploadApi.uploadImage(result.assets[0].uri, 'avatars');
      const res = await chatApi.updateRoom(roomId, { avatarUrl: url });
      setRoom(res.room);
      Toast.show({ type: 'success', text1: 'Photo updated' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: e.message });
    } finally {
      setUploading(false);
    }
  }

  async function openInvite() {
    try {
      const res = await friendsApi.list();
      const inRoom = new Set(members.map((m) => m._id));
      setFriends((res.friends ?? []).filter((f) => f.friend && !inRoom.has(f.friend._id)));
      setSelected(new Set());
      setInviteOpen(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    }
  }

  async function inviteSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    setSaving(true);
    try {
      const res = await chatApi.addMembers(roomId, ids);
      setRoom(res.room);
      setInviteOpen(false);
      Toast.show({ type: 'success', text1: `Added ${res.added} member${res.added === 1 ? '' : 's'}` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    try {
      const res = await chatApi.removeMember(roomId, target._id);
      if (res.left) {
        router.replace('/chat' as any);
        return;
      }
      setRoom(res.room);
      Toast.show({ type: 'success', text1: 'Removed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    }
  }

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a._id === room?.ownerId) return -1;
      if (b._id === room?.ownerId) return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [members, room?.ownerId]);

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: c.background, paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator color={Ping.purple} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Group info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={s.hero}>
          <TouchableOpacity onPress={changePhoto} disabled={!isOwner || uploading} activeOpacity={isOwner ? 0.75 : 1}>
            {room?.avatarUrl ? (
              <Image source={{ uri: room.avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback, { backgroundColor: `${Ping.purple}22` }]}>
                <Ionicons name="people" size={36} color={Ping.purple} />
              </View>
            )}
            {isOwner ? (
              <View style={[s.camBadge, { backgroundColor: Ping.purple }]}>
                {uploading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="camera" size={14} color="#FFF" />}
              </View>
            ) : null}
          </TouchableOpacity>

          {editingName && isOwner ? (
            <View style={s.nameEdit}>
              <TextInput
                style={[s.nameInput, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                value={name}
                onChangeText={setName}
                maxLength={60}
                autoFocus
                placeholder="Group name"
                placeholderTextColor={c.textSecondary}
              />
              <TouchableOpacity style={[s.saveNameBtn, { backgroundColor: Ping.purple }]} onPress={saveName} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.saveNameText}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setName(room?.name || ''); }}>
                <Text style={{ color: c.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => isOwner && setEditingName(true)}
              disabled={!isOwner}
              style={s.nameRow}
            >
              <Text style={[s.groupName, { color: c.text }]}>{room?.name || 'Group'}</Text>
              {isOwner ? <Ionicons name="pencil" size={16} color={c.textSecondary} /> : null}
            </TouchableOpacity>
          )}
          <Text style={[s.memberCount, { color: c.textSecondary }]}>
            {members.length} member{members.length === 1 ? '' : 's'}
            {isOwner ? ' · You’re the owner' : ''}
          </Text>
        </View>

        {/* Owner actions */}
        {isOwner ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TouchableOpacity style={s.actionRow} onPress={openInvite}>
              <Ionicons name="person-add-outline" size={20} color={Ping.purple} />
              <Text style={[s.actionText, { color: c.text }]}>Invite friends</Text>
              <Ionicons name="chevron-forward" size={16} color={c.icon} />
            </TouchableOpacity>
            <View style={[s.sep, { backgroundColor: c.border }]} />
            <TouchableOpacity style={s.actionRow} onPress={() => setEditingName(true)}>
              <Ionicons name="text-outline" size={20} color={c.textSecondary} />
              <Text style={[s.actionText, { color: c.text }]}>Change group name</Text>
              <Ionicons name="chevron-forward" size={16} color={c.icon} />
            </TouchableOpacity>
            <View style={[s.sep, { backgroundColor: c.border }]} />
            <TouchableOpacity style={s.actionRow} onPress={changePhoto} disabled={uploading}>
              <Ionicons name="image-outline" size={20} color={c.textSecondary} />
              <Text style={[s.actionText, { color: c.text }]}>Change group photo</Text>
              <Ionicons name="chevron-forward" size={16} color={c.icon} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Members */}
        <Text style={[s.sectionLabel, { color: c.textSecondary }]}>Members</Text>
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {sortedMembers.map((m, i) => {
            const isMe = m._id === user?._id;
            const isGroupOwner = m._id === room?.ownerId;
            return (
              <View key={m._id}>
                {i > 0 ? <View style={[s.sep, { backgroundColor: c.border }]} /> : null}
                <View style={s.memberRow}>
                  {m.avatarUrl ? (
                    <Image source={{ uri: m.avatarUrl }} style={s.memberAvatar} />
                  ) : (
                    <View style={[s.memberAvatar, { backgroundColor: `${Ping.purple}22`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: Ping.purple, fontWeight: '700' }}>
                        {(m.displayName || m.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memberName, { color: c.text }]}>
                      {m.displayName || m.username || 'User'}
                      {isMe ? ' (You)' : ''}
                    </Text>
                    {isGroupOwner ? (
                      <Text style={[s.ownerBadge, { color: Ping.purple }]}>Owner</Text>
                    ) : m.username ? (
                      <Text style={{ color: c.textSecondary, fontSize: 12 }}>@{m.username}</Text>
                    ) : null}
                  </View>
                  {isOwner && !isGroupOwner ? (
                    <TouchableOpacity
                      onPress={() => setRemoveTarget(m)}
                      hitSlop={8}
                      style={s.removeBtn}
                    >
                      <Ionicons name="remove-circle-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {!isOwner ? (
          <TouchableOpacity
            style={[s.leaveBtn, { borderColor: 'rgba(239,68,68,0.25)' }]}
            onPress={() => {
              if (!user?._id) return;
              Alert.alert('Leave group?', 'You will no longer see this chat.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await chatApi.removeMember(roomId, user._id);
                      router.replace('/chat' as any);
                    } catch (e: any) {
                      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
                    }
                  },
                },
              ]);
            }}
          >
            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Leave group</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Invite modal */}
      <Modal visible={inviteOpen} animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View style={[s.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setInviteOpen(false)} hitSlop={12} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: c.text }]}>Invite friends</Text>
            <TouchableOpacity onPress={inviteSelected} disabled={!selected.size || saving} hitSlop={8}>
              {saving
                ? <ActivityIndicator color={Ping.purple} />
                : <Text style={{ color: selected.size ? Ping.purple : c.textSecondary, fontWeight: '700' }}>Add</Text>}
            </TouchableOpacity>
          </View>
          <FlatList
            data={friends}
            keyExtractor={(f) => f.friend._id}
            contentContainerStyle={{ padding: Spacing.lg, gap: 4 }}
            ListEmptyComponent={
              <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>
                No friends left to invite
              </Text>
            }
            renderItem={({ item }) => {
              const on = selected.has(item.friend._id);
              return (
                <TouchableOpacity
                  style={[s.inviteRow, { backgroundColor: c.surface, borderColor: on ? Ping.purple : c.border }]}
                  onPress={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.friend._id)) next.delete(item.friend._id);
                      else next.add(item.friend._id);
                      return next;
                    });
                  }}
                >
                  {item.friend.avatarUrl ? (
                    <Image source={{ uri: item.friend.avatarUrl }} style={s.memberAvatar} />
                  ) : (
                    <View style={[s.memberAvatar, { backgroundColor: `${Ping.purple}22`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: Ping.purple, fontWeight: '700' }}>
                        {(item.friend.displayName || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={[s.memberName, { color: c.text, flex: 1 }]}>
                    {item.friend.displayName || item.friend.username || 'Friend'}
                  </Text>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? Ping.purple : c.textSecondary}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      <ConfirmSheet
        visible={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove member?"
        subtitle={removeTarget ? `Remove ${removeTarget.displayName || removeTarget.username || 'this person'} from the group?` : ''}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        icon="person-remove-outline"
        onConfirm={confirmRemove}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.bodyMed, fontSize: 17, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: Spacing.xl, gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  camBadge: {
    position: 'absolute', right: 2, bottom: 2,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { ...Typography.h3, fontSize: 22, fontWeight: '700' },
  memberCount: { ...Typography.caption },
  nameEdit: { width: '100%', paddingHorizontal: Spacing.lg, gap: 10, alignItems: 'center' },
  nameInput: {
    width: '100%', borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10, ...Typography.body,
  },
  saveNameBtn: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, minWidth: 90, alignItems: 'center',
  },
  saveNameText: { color: '#FFF', fontWeight: '700' },
  card: {
    marginHorizontal: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  actionText: { ...Typography.bodyMed, flex: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  sectionLabel: {
    ...Typography.caption, fontWeight: '600', marginTop: Spacing.lg,
    marginBottom: 8, marginHorizontal: Spacing.lg + 4,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberName: { ...Typography.bodyMed, fontWeight: '600' },
  ownerBadge: { ...Typography.caption, fontWeight: '700', fontSize: 11 },
  removeBtn: { padding: 4 },
  leaveBtn: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center',
  },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: Radius.md, borderWidth: 1, marginBottom: 8,
  },
});
