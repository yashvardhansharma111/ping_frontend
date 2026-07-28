import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Linking, Share, TextInput, Platform, ActivityIndicator, Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import ConfirmSheet from '@/components/ConfirmSheet';
import ScreenHeader from '@/components/ScreenHeader';
import AppAvatar from '@/components/AppAvatar';
import { AppButton } from '@/components/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usersApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';

const CONTACTS_KEY = 'ping_trusted_contacts';

interface TrustedContact { id: string; name: string; phone: string; }

function ToolCard({ icon, label, color, onPress, loading, c }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string;
  onPress: () => void; loading?: boolean; c: (typeof Colors)['dark'];
}) {
  return (
    <TouchableOpacity style={[tc.wrap, { backgroundColor: c.card, borderColor: c.border }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[tc.iconWrap, { backgroundColor: `${color}18` }]}>
        {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={26} color={color} />}
      </View>
      <Text style={[tc.label, { color: c.textSecondary }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}
const tc = StyleSheet.create({
  wrap: { flex: 1, aspectRatio: 1.1, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.sm },
  iconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { ...Typography.caption, textAlign: 'center', lineHeight: 16, fontSize: 12 },
});

function ResourceCard({ icon, title, subtitle, color, c }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; color: string; c: (typeof Colors)['dark'];
}) {
  return (
    <View style={[rc.wrap, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[rc.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rc.title, { color: c.text }]}>{title}</Text>
        <Text style={[rc.sub, { color: c.textSecondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}
const rc = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyMed, fontSize: 14 },
  sub: { ...Typography.caption, marginTop: 2, lineHeight: 16 },
});

function AddContactSheet({ visible, onClose, onSaved, c }: {
  visible: boolean; onClose: () => void; onSaved: (contact: TrustedContact) => void; c: (typeof Colors)['dark'];
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  function save() {
    const n = name.trim();
    const p = phone.replace(/\s/g, '');
    if (!n) { Toast.show({ type: 'error', text1: 'Name required' }); return; }
    if (!/^\+?[\d]{7,15}$/.test(p)) { Toast.show({ type: 'error', text1: 'Enter a valid phone number' }); return; }
    onSaved({ id: Date.now().toString(), name: n, phone: p });
    setName(''); setPhone('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={acs.overlay}>
        <TouchableOpacity style={acs.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[acs.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={[acs.handle, { backgroundColor: c.border }]} />
          <Text style={[acs.title, { color: c.text }]}>Add trusted contact</Text>
          <Text style={[acs.sub, { color: c.textSecondary }]}>This person can receive your SOS alerts</Text>
          <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
            <TextInput style={[acs.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} placeholder="Full name" placeholderTextColor={c.textSecondary} value={name} onChangeText={setName} autoCapitalize="words" />
            <TextInput style={[acs.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} placeholder="Phone number (e.g. +91 98765 43210)" placeholderTextColor={c.textSecondary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <TouchableOpacity style={acs.saveBtn} onPress={save} activeOpacity={0.85}>
            <Text style={acs.saveBtnText}>Save contact</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const acs = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingTop: Spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  title: { ...Typography.h3, fontSize: 18 },
  sub: { ...Typography.bodySm, marginTop: 4 },
  input: { borderRadius: Radius.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 12, ...Typography.bodySm },
  saveBtn: { backgroundColor: Ping.purple, borderRadius: Radius.md, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  saveBtnText: { ...Typography.bodyMed, color: '#FFF', fontWeight: '600' },
});

export default function SafetyScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuthStore();

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);
  const [sharingTrip, setSharingTrip] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [removeContactId, setRemoveContactId] = useState<string | null>(null);
  const [showCall112Confirm, setShowCall112Confirm] = useState(false);
  const [showCall100Confirm, setShowCall100Confirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  useEffect(() => { loadContacts(); }, []);

  async function loadContacts() {
    try {
      const raw = await AsyncStorage.getItem(CONTACTS_KEY);
      setContacts(raw ? JSON.parse(raw) : []);
    } catch { setContacts([]); }
  }

  async function saveContacts(updated: TrustedContact[]) {
    setContacts(updated);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(updated)).catch(() => {});
  }

  async function removeContact(id: string) {
    setRemoveContactId(id);
  }

  async function callEmergency() {
    setShowCall112Confirm(true);
  }

  async function callPolice() {
    setShowCall100Confirm(true);
  }

  async function sendSOS() {
    setSendingSos(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location required', text2: 'Enable location to send your position in the SOS.' });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
      const baseMsg = `🚨 PING SAFETY ALERT\nI may need help. My current location:\n${mapsLink}`;

      if (contacts.length === 0) {
        await Share.share({ message: baseMsg });
        return;
      }

      if (contacts.length === 1) {
        // Single contact — try to open SMS directly (pre-filled)
        const ct = contacts[0];
        const encoded = encodeURIComponent(baseMsg);
        const smsUrl = Platform.OS === 'ios' ? `sms:${ct.phone}&body=${encoded}` : `sms:${ct.phone}?body=${encoded}`;
        const canOpen = await Linking.canOpenURL(smsUrl);
        if (canOpen) { await Linking.openURL(smsUrl); return; }
      }

      // Multiple contacts or SMS unavailable — include all contact numbers in the share message
      const contactLines = contacts.map((ct) => `• ${ct.name}: ${ct.phone}`).join('\n');
      const fullMsg = `${baseMsg}\n\nAlert these contacts:\n${contactLines}`;
      await Share.share({ message: fullMsg });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not send SOS.' });
    } finally {
      setSendingSos(false);
    }
  }

  async function shareLocation() {
    setSharingTrip(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Toast.show({ type: 'error', text1: 'Location required', text2: 'Enable location to share your position.' }); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const link = `https://maps.google.com/?q=${latitude},${longitude}`;
      await Share.share({ message: `My current location: ${link}`, url: link });
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Could not share location.' }); }
    finally { setSharingTrip(false); }
  }

  function confirmDeleteAccount() {
    setShowDeleteAccountConfirm(true);
  }

  async function doDeleteAccount() {
    setDeletingAccount(true);
    try { await usersApi.deleteMe(); await logout(); }
    catch (err: any) { setDeletingAccount(false); Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not delete account.' }); }
  }

  return (
    <>
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <ScreenHeader title="Safety & Account" onBack={() => router.back()} paddingTop={insets.top + 8} />

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Safety tools</Text>
          <View style={styles.toolsGrid}>
            <View style={styles.toolsRow}>
              <ToolCard icon="alert-circle-outline" label="Contact 100" color="#EF4444" onPress={callPolice} c={c} />
              <ToolCard icon="call-outline" label="Call safety support" color="#22C55E" onPress={callEmergency} c={c} />
            </View>
            <View style={styles.toolsRow}>
              <ToolCard icon="warning-outline" label="Send SOS alert" color="#F97316" onPress={sendSOS} loading={sendingSos} c={c} />
              <ToolCard icon="navigate-outline" label="Share trip status" color="#3B82F6" onPress={shareLocation} loading={sharingTrip} c={c} />
            </View>
          </View>

          <TouchableOpacity style={[styles.prefBanner, { backgroundColor: `${Ping.purple}18`, borderColor: `${Ping.purple}44` }]} onPress={() => setShowAddContact(true)} activeOpacity={0.8}>
            <View style={[styles.prefIcon, { backgroundColor: contacts.length > 0 ? `${Ping.purple}44` : `${Ping.purple}33` }]}>
              <Ionicons name={contacts.length > 0 ? 'shield-checkmark' : 'shield-half-outline'} size={22} color={Ping.purpleLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prefTitle, { color: c.text }]}>
                {contacts.length > 0
                  ? `${contacts.length} trusted contact${contacts.length > 1 ? 's' : ''} saved`
                  : 'Set up safety preferences'}
              </Text>
              <Text style={[styles.prefSub, { color: c.textSecondary }]}>
                {contacts.length > 0
                  ? 'Used for SOS alerts · Tap to add more'
                  : 'Add contacts who receive your SOS location'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          </TouchableOpacity>

          {contacts.length > 0 && (
            <View style={styles.contactsList}>
              {contacts.map((ct) => (
                <View key={ct.id} style={[styles.contactRow, { backgroundColor: c.card, borderColor: c.border }]}>
                  <AppAvatar name={ct.name} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactName, { color: c.text }]}>{ct.name}</Text>
                    <Text style={[styles.contactPhone, { color: c.textSecondary }]}>{ct.phone}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeContact(ct.id)} hitSlop={10}>
                    <Ionicons name="close-circle" size={20} color={c.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: c.text }]}>How you're protected</Text>
          <View style={{ gap: Spacing.sm }}>
            <ResourceCard icon="checkmark-circle-outline" title="Phone verification" subtitle="All users verify their phone number before joining" color="#22C55E" c={c} />
            <ResourceCard icon="shield-outline" title="Trust ratings" subtitle="Community-based trust score shown on every profile" color={Ping.purpleLight} c={c} />
            <ResourceCard icon="flag-outline" title="Report & block" subtitle="Report unsafe users or activities from any profile or ping" color="#F97316" c={c} />
            <ResourceCard icon="eye-off-outline" title="Leave quietly" subtitle="Exit any activity without alerting other participants" color="#3B82F6" c={c} />
            <ResourceCard icon="people-outline" title="Women-only pings" subtitle="Creators can restrict pings to verified female members only" color="#EC4899" c={c} />
          </View>

          <Text style={[styles.sectionTitle, { color: c.text, marginTop: Spacing.sm }]}>Account</Text>
          <AppButton
            label="Delete my account"
            variant="dangerOutline"
            icon="trash-outline"
            onPress={confirmDeleteAccount}
            loading={deletingAccount}
            style={{ borderRadius: Radius.md }}
          />
        </ScrollView>
      </View>

      <AddContactSheet
        visible={showAddContact}
        onClose={() => setShowAddContact(false)}
        onSaved={(contact) => saveContacts([...contacts, contact])}
        c={c}
      />

      <ConfirmSheet
        visible={removeContactId !== null}
        onClose={() => setRemoveContactId(null)}
        title="Remove contact?"
        subtitle="They will no longer receive SOS alerts."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          if (removeContactId) saveContacts(contacts.filter((c) => c.id !== removeContactId));
          setRemoveContactId(null);
        }}
      />

      <ConfirmSheet
        visible={showCall100Confirm}
        onClose={() => setShowCall100Confirm(false)}
        title="Call 100?"
        subtitle="This will call the police emergency number."
        confirmLabel="Call now"
        cancelLabel="Cancel"
        danger
        onConfirm={() => { setShowCall100Confirm(false); Linking.openURL('tel:100'); }}
        icon="call-outline"
      />

      <ConfirmSheet
        visible={showCall112Confirm}
        onClose={() => setShowCall112Confirm(false)}
        title="Call 112?"
        subtitle="This will call the national emergency number."
        confirmLabel="Call now"
        cancelLabel="Cancel"
        danger
        onConfirm={() => { setShowCall112Confirm(false); Linking.openURL('tel:112'); }}
        icon="call-outline"
      />

      <ConfirmSheet
        visible={showDeleteAccountConfirm}
        onClose={() => setShowDeleteAccountConfirm(false)}
        title="Delete account?"
        subtitle="This permanently deletes your account and data. Type delete to confirm. This cannot be undone."
        confirmLabel="Delete forever"
        cancelLabel="Cancel"
        danger
        requireType="delete"
        typeHint='Type "delete" to confirm'
        onConfirm={() => { setShowDeleteAccountConfirm(false); doDeleteAccount(); }}
        icon="trash-outline"
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { ...Typography.bodyMed, fontSize: 18, fontWeight: '700', marginTop: Spacing.xs },
  toolsGrid: { gap: Spacing.sm },
  toolsRow: { flexDirection: 'row', gap: Spacing.sm },
  prefBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5, marginTop: Spacing.xs },
  prefIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prefTitle: { ...Typography.bodyMed, fontSize: 15 },
  prefSub: { ...Typography.caption, marginTop: 2 },
  contactsList: { gap: Spacing.xs, marginTop: -Spacing.xs },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  contactName: { ...Typography.bodyMed, fontSize: 14 },
  contactPhone: { ...Typography.caption, marginTop: 1 },
});
