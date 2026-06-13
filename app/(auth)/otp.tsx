import { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { Ping, Spacing, Radius, Typography } from '@/constants/theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function OtpScreen() {
  const { phone, debugCode } = useLocalSearchParams<{ phone: string; debugCode: string }>();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendSecs, setResendSecs] = useState(RESEND_COOLDOWN);
  const inputs = useRef<(TextInput | null)[]>([]);
  const router = useRouter();
  const { login } = useAuthStore();

  // Per-box spring animations
  const boxAnims = useRef(Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1))).current;

  // Screen entrance
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResendSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  // Auto-fill debug code (dev only)
  useEffect(() => {
    if (debugCode && debugCode.length === OTP_LENGTH) {
      const arr = debugCode.split('');
      setDigits(arr);
    }
  }, [debugCode]);

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit) {
      // Spring pop on fill
      Animated.sequence([
        Animated.spring(boxAnims[index], { toValue: 1.18, damping: 6, stiffness: 300, useNativeDriver: true }),
        Animated.spring(boxAnims[index], { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }),
      ]).start();
      if (index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    }
    // Auto-submit when complete
    if (digit && next.every(Boolean) && index === OTP_LENGTH - 1) {
      verifyOtp(next.join(''));
    }
  }

  function handleBackspace(index: number) {
    if (!digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputs.current[index - 1]?.focus();
    }
  }

  async function verifyOtp(code = digits.join('')) {
    if (code.length < OTP_LENGTH || loading) return;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code);
      await login(res.accessToken, res.refreshToken, res.user, res.isNewUser, (res as any).isAdmin, (res as any).adminToken);
      if ((res as any).isAdmin) {
        router.replace('/(admin)');
      } else if (res.isNewUser) {
        router.replace('/(auth)/setup');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Invalid OTP', err.message || 'Please check the code and try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resendSecs > 0) return;
    try {
      await authApi.requestOtp(phone);
      setResendSecs(RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } catch {
      Alert.alert('Error', 'Could not resend OTP. Try again.');
    }
  }

  const filled = digits.filter(Boolean).length;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#A78BFA" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            Sent to{' '}
            <Text style={styles.phoneHighlight}>{phone}</Text>
          </Text>
          {debugCode ? (
            <View style={styles.debugBadge}>
              <Ionicons name="construct-outline" size={12} color={Ping.orange} />
              <Text style={styles.debugText}>Dev: {debugCode}</Text>
            </View>
          ) : null}
        </View>

        {/* OTP boxes */}
        <View style={styles.boxRow}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <Animated.View key={i} style={{ flex: 1, transform: [{ scale: boxAnims[i] }] }}>
              <TextInput
                ref={(el) => { inputs.current[i] = el; }}
                style={[
                  styles.box,
                  digits[i] ? styles.boxFilled : null,
                ]}
                value={digits[i]}
                onChangeText={(v) => handleDigit(i, v)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace') handleBackspace(i);
                }}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={i === 0}
                selectionColor={Ping.purple}
              />
            </Animated.View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, filled < OTP_LENGTH && styles.btnDisabled]}
          onPress={() => verifyOtp()}
          disabled={filled < OTP_LENGTH || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendRow} onPress={resend} disabled={resendSecs > 0}>
          {resendSecs > 0 ? (
            <Text style={styles.resendWait}>
              Resend in <Text style={{ color: Ping.purpleLight }}>{resendSecs}s</Text>
            </Text>
          ) : (
            <Text style={styles.resendActive}>Resend OTP</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080815',
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    gap: Spacing.xl,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.xs,
  },
  title: {
    ...Typography.h2,
    color: '#F1F0FF',
  },
  subtitle: {
    ...Typography.body,
    color: '#9490C0',
  },
  phoneHighlight: {
    color: Ping.purpleLight,
    fontWeight: '600',
  },
  debugBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  debugText: {
    ...Typography.caption,
    color: Ping.orange,
  },
  boxRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  box: {
    width: '100%',
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: '#1A1A38',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    fontSize: 24,
    fontWeight: '700',
    color: '#F1F0FF',
  },
  boxFilled: {
    borderColor: Ping.purple,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
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
  resendRow: {
    alignItems: 'center',
  },
  resendWait: {
    ...Typography.bodySm,
    color: '#5C5A80',
  },
  resendActive: {
    ...Typography.bodySm,
    color: Ping.purpleLight,
    fontWeight: '600',
  },
});
