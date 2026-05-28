import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/lib/api';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const INDIA_PHONE_RE = /^[6-9]\d{9}$/;

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const router = useRouter();

  const isValid = INDIA_PHONE_RE.test(phone.trim());

  async function handleSend() {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const fullPhone = `+91${phone.trim()}`;
      const res = await authApi.requestOtp(fullPhone) as any;
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone: fullPhone,
          // Pass debug code so testers don't need SMS
          debugCode: res.code ?? '',
        },
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>P</Text>
        </View>
        <Text style={styles.appName}>Ping</Text>
        <Text style={styles.tagline}>Discover what's happening around you</Text>
      </View>

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.label}>Mobile number</Text>
        <TouchableOpacity
          style={[styles.inputRow, isValid && styles.inputRowActive]}
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={styles.prefix}>
            <Ionicons name="globe-outline" size={16} color={Ping.purpleLight} />
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <View style={styles.divider} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="10-digit mobile number"
            placeholderTextColor="#5C5A80"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            autoFocus
          />
          {isValid && (
            <Ionicons name="checkmark-circle" size={20} color={Ping.green} style={styles.checkIcon} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, !isValid && styles.btnDisabled]}
          onPress={handleSend}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.btnText}>Send OTP</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.fine}>
        By continuing you agree to our Terms & Privacy Policy
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080815',
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  logoWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Ping.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -1,
  },
  appName: {
    ...Typography.h1,
    color: '#F1F0FF',
    letterSpacing: -0.5,
  },
  tagline: {
    ...Typography.bodySm,
    color: '#9490C0',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#11112A',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.15)',
  },
  label: {
    ...Typography.caption,
    color: '#9490C0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A38',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.15)',
    overflow: 'hidden',
  },
  inputRowActive: {
    borderColor: Ping.purple,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  prefixText: {
    ...Typography.bodyMed,
    color: '#F1F0FF',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: Spacing.md,
    ...Typography.bodyMed,
    color: '#F1F0FF',
  },
  checkIcon: {
    marginRight: Spacing.md,
  },
  btn: {
    backgroundColor: Ping.purple,
    borderRadius: Radius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
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
  fine: {
    ...Typography.caption,
    color: '#5C5A80',
    textAlign: 'center',
  },
});
