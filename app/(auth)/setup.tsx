import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

export default function SetupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuthStore();

  function onNameChange(v: string) {
    setDisplayName(v);
    if (!username || username === slugify(displayName)) {
      setUsername(slugify(v));
    }
  }

  async function handleSubmit() {
    const name = displayName.trim();
    const uname = username.trim().toLowerCase();
    if (!name) return Alert.alert('', 'Please enter your name.');
    if (uname && !/^[a-z0-9_]{3,24}$/.test(uname)) {
      return Alert.alert('', 'Username must be 3–24 characters: letters, numbers, underscores only.');
    }
    setLoading(true);
    try {
      const res = await usersApi.updateMe({
        displayName: name,
        ...(uname ? { username: uname } : {}),
      });
      setUser(res.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = displayName.trim().length >= 2;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.avatarPlaceholder}>
        <Ionicons name="person-outline" size={36} color={Ping.purpleLight} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Let's set up{'\n'}your profile</Text>
        <Text style={styles.sub}>You can change this anytime from settings</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Display name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rahul Sharma"
            placeholderTextColor="#5C5A80"
            value={displayName}
            onChangeText={onNameChange}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.input, styles.usernameInput]}
              placeholder="rahul_sharma"
              placeholderTextColor="#5C5A80"
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24))}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>Start Pinging</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080815',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A38',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  header: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  title: {
    ...Typography.h2,
    color: '#F1F0FF',
    textAlign: 'center',
  },
  sub: {
    ...Typography.bodySm,
    color: '#9490C0',
    textAlign: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.caption,
    color: '#9490C0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#1A1A38',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    height: 52,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: '#F1F0FF',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A38',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    height: 52,
    paddingLeft: Spacing.md,
  },
  at: {
    ...Typography.bodyMed,
    color: Ping.purpleLight,
  },
  usernameInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 4,
    height: 50,
  },
  btn: {
    backgroundColor: Ping.purple,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: {
    backgroundColor: '#2A2A4A',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    ...Typography.bodyMed,
    color: '#FFF',
    fontWeight: '600',
  },
});
