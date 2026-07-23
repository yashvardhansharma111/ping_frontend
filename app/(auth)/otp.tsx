import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  Keyboard,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ping, Spacing, Gradients } from '@/constants/theme';

const OTP_LENGTH      = 6;
const RESEND_COOLDOWN = 30;

// Light premium palette — Ping design system
const BG     = '#FFFFFF';
const TEXT   = '#111111';
const MUTED  = '#6F6866';
const DIM    = '#A6A6B0';
const BORDER = 'rgba(143,99,244,0.18)';
const PURPLE = Ping.purple;

export default function OtpScreen() {
  const { phone, debugCode } = useLocalSearchParams<{ phone: string; debugCode: string }>();
  const insets = useSafeAreaInsets();
  const [digits, setDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]   = useState(false);
  const [resendSecs, setResend] = useState(RESEND_COOLDOWN);
  const [showSafety, setShowSafety] = useState(false);
  const pendingRoute = useRef<'/(admin)' | '/(auth)/setup' | '/(tabs)'>('/(tabs)');
  const inputs       = useRef<(TextInput | null)[]>([]);
  const router       = useRouter();
  const { login }    = useAuthStore();

  // Per-box spring anims
  const boxAnims = useRef(Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1))).current;

  // Screen entrance
  const slideAnim = useRef(new Animated.Value(28)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Safety modal anims
  const safetyScale = useRef(new Animated.Value(0.88)).current;
  const safetyOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []);

  // Countdown
  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResend((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  // Auto-fill debug code and dismiss keyboard so verify button is visible
  useEffect(() => {
    if (debugCode && debugCode.length === OTP_LENGTH) {
      setDigits(debugCode.split(''));
      setTimeout(() => Keyboard.dismiss(), 100);
    }
  }, [debugCode]);

  function openSafety() {
    setShowSafety(true);
    Animated.parallel([
      Animated.spring(safetyScale, { toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true }),
      Animated.timing(safetyOp, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function dismissSafety() {
    Animated.parallel([
      Animated.timing(safetyScale, { toValue: 0.88, duration: 180, useNativeDriver: true }),
      Animated.timing(safetyOp, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => { setShowSafety(false); router.replace(pendingRoute.current); });
  }

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit) {
      Animated.sequence([
        Animated.spring(boxAnims[index], { toValue: 1.07, damping: 12, stiffness: 400, useNativeDriver: true }),
        Animated.spring(boxAnims[index], { toValue: 1,    damping: 14, stiffness: 300, useNativeDriver: true }),
      ]).start();
      if (index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    }
    if (digit && next.every(Boolean) && index === OTP_LENGTH - 1) verifyOtp(next.join(''));
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
        pendingRoute.current = '/(admin)';
      } else if (res.isNewUser || !res.user?.displayName) {
        pendingRoute.current = '/(auth)/setup';
      } else {
        pendingRoute.current = '/(tabs)';
      }
      openSafety();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Wrong code', text2: err.message || 'Please check the code and try again.' });
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
      setResend(RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not resend code. Try again.' });
    }
  }

  const filled = digits.filter(Boolean).length;
  const maskedPhone = phone ? `${phone.slice(0, 3)} *** *** ${phone.slice(-2)}` : '';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>

        {/* Brand icon */}
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.brandIcon}
          resizeMode="contain"
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Look at your phone{'\n'}for once.</Text>
          <Text style={styles.subtitle}>
            A 6-digit code is sitting in your messages.{'\n'}
            Waiting for you.{' '}
            <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
          </Text>
          {debugCode ? (
            <View style={styles.debugBadge}>
              <Ionicons name="construct-outline" size={11} color={Ping.orange} />
              <Text style={styles.debugText}>Dev code: {debugCode}</Text>
            </View>
          ) : null}
        </View>

        {/* OTP boxes */}
        <View style={styles.boxRow}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            // Outer View owns the flex layout — scale never displaces siblings
            <View key={i} style={styles.boxWrap}>
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: boxAnims[i] }] }]}>
                <TextInput
                  ref={(el) => { inputs.current[i] = el; }}
                  style={[styles.box, digits[i] ? styles.boxFilled : null]}
                  value={digits[i]}
                  onChangeText={(v) => handleDigit(i, v)}
                  onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace') handleBackspace(i); }}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={i === 0}
                  selectionColor={PURPLE}
                />
              </Animated.View>
            </View>
          ))}
        </View>

        {/* Verify button */}
        <TouchableOpacity
          onPress={() => { Keyboard.dismiss(); verifyOtp(); }}
          disabled={filled < OTP_LENGTH || loading}
          activeOpacity={0.88}
          style={{ borderRadius: 9999, overflow: 'hidden', opacity: filled < OTP_LENGTH ? 0.45 : 1 }}
        >
          <LinearGradient
            colors={[...Gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btn}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnText}>Yep, that's it</Text>}
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity style={styles.resendRow} onPress={resend} disabled={resendSecs > 0}>
          {resendSecs > 0 ? (
            <Text style={styles.resendWait}>
              Still nothing? Resend in <Text style={{ color: PURPLE, fontWeight: '700' }}>{resendSecs}s</Text>
            </Text>
          ) : (
            <Text style={styles.resendActive}>Try again (it's free)</Text>
          )}
        </TouchableOpacity>

      </Animated.View>
      </ScrollView>

      {/* ── Safety / welcome modal ── */}
      <Modal visible={showSafety} transparent animationType="none" statusBarTranslucent>
        <View style={styles.overlay}>
          <Animated.View style={[styles.safetyCard, { opacity: safetyOp, transform: [{ scale: safetyScale }] }]}>

            {/* Check circle */}
            <View style={styles.checkCircle}>
              <Ionicons name="shield-checkmark" size={34} color="#FFF" />
            </View>

            <Text style={styles.safetyTitle}>You made it.</Text>
            <Text style={styles.safetySub}>We keep your stuff private. You're welcome.</Text>

            <View style={styles.trustList}>
              {[
                { icon: 'lock-closed-outline' as const, text: 'Your number is encrypted and never shared' },
                { icon: 'eye-off-outline' as const,     text: 'Your profile is only visible to people you allow' },
                { icon: 'people-outline' as const,      text: 'Meet verified, real people only' },
              ].map((item, i) => (
                <View key={i} style={styles.trustItem}>
                  <View style={styles.trustIconWrap}>
                    <Ionicons name={item.icon} size={16} color={PURPLE} />
                  </View>
                  <Text style={styles.trustItemText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.safetyBtn} onPress={dismissSafety} activeOpacity={0.88}>
              <Text style={styles.safetyBtnText}>Let's go  →</Text>
            </TouchableOpacity>

          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 28,
  },

  // Back button
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Ping.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandIcon: {
    width: 72,
    height: 72,
  },

  // Header
  header: { gap: 8 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 21,
  },
  phoneHighlight: {
    color: PURPLE,
    fontWeight: '700',
  },
  debugBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  debugText: {
    fontSize: 11,
    color: Ping.orange,
    fontWeight: '600',
  },

  // OTP boxes
  boxRow: {
    flexDirection: 'row',
    gap: 8,
  },
  boxWrap: { flex: 1, height: 58 },
  box: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Ping.soft,
    borderWidth: 1.5,
    borderColor: BORDER,
    fontSize: 24,
    fontWeight: '800',
    color: TEXT,
  },
  boxFilled: {
    backgroundColor: 'rgba(187,146,255,0.16)',
    borderColor: PURPLE,
    color: Ping.purpleDim,
  },

  // Button
  btn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },

  // Resend
  resendRow: { alignItems: 'center' },
  resendWait: { fontSize: 14, color: MUTED },
  resendActive: { fontSize: 14, color: PURPLE, fontWeight: '700' },

  // ── Safety modal ──────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,16,64,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  safetyCard: {
    width: '100%',
    backgroundColor: BG,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#1C1040',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 20,
  },
  checkCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 4,
  },
  safetyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.6,
  },
  safetySub: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -4,
  },
  trustList: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7F5FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.08)',
  },
  trustIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustItemText: {
    flex: 1,
    fontSize: 13,
    color: TEXT,
    lineHeight: 18,
    fontWeight: '500',
  },
  safetyBtn: {
    backgroundColor: PURPLE,
    borderRadius: 9999,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 6,
  },
  safetyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.4,
  },
});
