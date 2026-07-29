import { useState, useRef, useEffect, useMemo } from 'react';
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
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { authApi } from '@/lib/api';
import useAuthStore from '@/lib/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ping, Spacing, Gradients } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const OTP_LENGTH      = 6;
const RESEND_COOLDOWN = 30;
const PURPLE = Ping.purple;

export default function OtpScreen() {
  const { phone, debugCode } = useLocalSearchParams<{ phone: string; debugCode: string }>();
  const insets  = useSafeAreaInsets();
  const scheme  = useColorScheme() ?? 'light';
  const isDark  = scheme === 'dark';
  const s       = useMemo(() => makeStyles(isDark), [isDark]);

  const [digits, setDigits]         = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]       = useState(false);
  const [resendSecs, setResend]     = useState(RESEND_COOLDOWN);
  const [showSafety, setShowSafety] = useState(false);
  const pendingRoute = useRef<'/(admin)' | '/(auth)/setup' | '/(tabs)'>('/(tabs)');
  const inputs       = useRef<(TextInput | null)[]>([]);
  const router       = useRouter();
  const { login }    = useAuthStore();
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });

  const boxAnims    = useRef(Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1))).current;
  const safetyScale = useRef(new Animated.Value(0.88)).current;
  const safetyOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResend((sec) => sec - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

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
      const formattedPhone = phone?.startsWith('+') ? phone : `+91${(phone || '').replace(/\D/g, '')}`;
      const res = await authApi.verifyOtp(formattedPhone, code);
      if (!res || !res.accessToken || !res.user) {
        throw new Error('Invalid response from server. Please try again.');
      }
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
      Toast.show({ type: 'error', text1: 'Verification failed', text2: err.message || 'Please check the code and try again.' });
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

  const filled      = digits.filter(Boolean).length;
  const maskedPhone = phone ? `${phone.slice(0, 3)} *** *** ${phone.slice(-2)}` : '';
  const textColor   = isDark ? '#F1F0FF' : '#111111';
  const mutedColor  = isDark ? '#9490C0' : '#6F6866';

  return (
    <View style={[s.root, { backgroundColor: isDark ? '#0A0A0E' : '#F5F3FF' }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top spacer */}
          <View style={[s.topSpacer, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Text block */}
          <View style={s.textBlock}>
            <Text style={[
              s.appName,
              fontsLoaded ? { fontFamily: 'Pacifico_400Regular' } : { fontStyle: 'italic', fontWeight: '700' },
            ]}>
              Ping
            </Text>
            <Text style={s.headline}>
              Look at your phone{'\n'}for once.
            </Text>
            <Text style={s.subtitle}>
              A 6-digit code is waiting in your messages.{' '}
              <Text style={s.phoneHighlight}>{maskedPhone}</Text>
            </Text>
            {debugCode ? (
              <View style={s.debugBadge}>
                <Ionicons name="construct-outline" size={11} color={Ping.orange} />
                <Text style={s.debugText}>Dev code: {debugCode}</Text>
              </View>
            ) : null}
          </View>

          {/* Card */}
          <View style={[s.card, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}>
            <View style={s.pill} />

            <Text style={s.cardTitle}>Enter the 6-digit code</Text>

          {/* OTP boxes */}
          <View style={s.boxRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <View key={i} style={s.boxWrap}>
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: boxAnims[i] }] }]}>
                  <TextInput
                    ref={(el) => { inputs.current[i] = el; }}
                    style={[s.box, digits[i] ? s.boxFilled : null]}
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
              style={s.btn}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={s.btnText}>Verify code</Text>}
            </LinearGradient>
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity style={s.resendRow} onPress={resend} disabled={resendSecs > 0}>
            {resendSecs > 0 ? (
              <Text style={s.resendWait}>
                Resend in <Text style={{ color: PURPLE, fontWeight: '700' }}>{resendSecs}s</Text>
              </Text>
            ) : (
              <Text style={s.resendActive}>Resend code</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Safety / welcome modal */}
      <Modal visible={showSafety} transparent animationType="none" statusBarTranslucent>
        <View style={s.overlay}>
          <Animated.View style={[s.safetyCard, { opacity: safetyOp, transform: [{ scale: safetyScale }] }]}>
            <View style={s.checkCircle}>
              <Ionicons name="shield-checkmark" size={34} color="#FFF" />
            </View>

            <Text style={s.safetyTitle}>You made it.</Text>
            <Text style={s.safetySub}>We keep your stuff private. You're welcome.</Text>

            <View style={s.trustList}>
              {[
                { icon: 'lock-closed-outline' as const, text: 'Your number is encrypted and never shared' },
                { icon: 'eye-off-outline' as const,     text: 'Your profile is only visible to people you allow' },
                { icon: 'people-outline' as const,      text: 'Meet verified, real people only' },
              ].map((item, idx) => (
                <View key={idx} style={s.trustItem}>
                  <View style={s.trustIconWrap}>
                    <Ionicons name={item.icon} size={16} color={PURPLE} />
                  </View>
                  <Text style={s.trustItemText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.safetyBtn} onPress={dismissSafety} activeOpacity={0.88}>
              <Text style={s.safetyBtnText}>Let's go  →</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(isDark: boolean) {
  const bg      = isDark ? '#0A0A0E' : '#F5F3FF';
  const surface = isDark ? '#14141A' : '#FFFFFF';
  const text    = isDark ? '#F1F0FF' : '#111111';
  const muted   = isDark ? '#9490C0' : '#6F6866';
  const border  = isDark ? 'rgba(167,139,250,0.18)' : '#E6E1DA';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : Ping.soft;

  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: bg },
    scroll: { flexGrow: 1, justifyContent: 'space-between' },
    topSpacer: { flex: 1, paddingHorizontal: 28 },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center', justifyContent: 'center',
    },
    textBlock: { paddingHorizontal: 28, paddingBottom: 24, gap: 10 },
    appName: { fontSize: 52, color: Ping.purpleDim },
    headline: {
      fontSize: 30, fontWeight: '800', color: text,
      lineHeight: 38, letterSpacing: -0.5, marginTop: 4,
    },
    subtitle: { fontSize: 14, color: muted, lineHeight: 21, maxWidth: 300 },
    phoneHighlight: { color: PURPLE, fontWeight: '700' },
    debugBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(249,115,22,0.1)',
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 8, marginTop: 4,
    },
    debugText: { fontSize: 11, color: Ping.orange, fontWeight: '600' },
    card: {
      flex: 1,
      backgroundColor: surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 28,
      paddingTop: 18,
      gap: 16,
      borderTopWidth: 1,
      borderColor: isDark ? 'rgba(167,139,250,0.14)' : Ping.lavender,
      shadowColor: Ping.purpleDim,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 20,
      elevation: 12,
    },
    pill: {
      alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(167,139,250,0.35)' : Ping.lavender,
      marginBottom: 6,
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: text, letterSpacing: -0.3 },
    boxRow:  { flexDirection: 'row', gap: 8 },
    boxWrap: { flex: 1, height: 58 },
    box: {
      flex: 1, borderRadius: 14,
      backgroundColor: inputBg,
      borderWidth: 1.5, borderColor: border,
      fontSize: 24, fontWeight: '800', color: text,
    },
    boxFilled: {
      backgroundColor: 'rgba(187,146,255,0.16)',
      borderColor: PURPLE,
      color: Ping.purpleDim,
    },
    btn: { height: 54, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
    resendRow:    { alignItems: 'center' },
    resendWait:   { fontSize: 14, color: muted },
    resendActive: { fontSize: 14, color: PURPLE, fontWeight: '700' },

    // Safety modal
    overlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(28,16,64,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    safetyCard: {
      width: '100%',
      backgroundColor: surface,
      borderRadius: 32,
      padding: 32,
      alignItems: 'center',
      gap: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: 'rgba(167,139,250,0.14)',
      shadowColor: isDark ? PURPLE : '#1C1040',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.25 : 0.14,
      shadowRadius: 32,
      elevation: 20,
    },
    checkCircle: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: PURPLE,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: PURPLE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28, shadowRadius: 16, elevation: 8,
      marginBottom: 4,
    },
    safetyTitle: { fontSize: 26, fontWeight: '800', color: text, letterSpacing: -0.6 },
    safetySub:   { fontSize: 14, color: muted, textAlign: 'center', lineHeight: 20, marginTop: -4 },
    trustList:   { width: '100%', gap: 10, marginTop: 4 },
    trustItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: isDark ? 'rgba(124,58,237,0.1)' : '#F7F5FF',
      borderRadius: 14, padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.08)',
    },
    trustIconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(124,58,237,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },
    trustItemText: { flex: 1, fontSize: 13, color: text, lineHeight: 18, fontWeight: '500' },
    safetyBtn: {
      backgroundColor: PURPLE, borderRadius: 9999,
      height: 54, width: '100%',
      alignItems: 'center', justifyContent: 'center',
      marginTop: 4,
      shadowColor: PURPLE,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.26, shadowRadius: 14, elevation: 6,
    },
    safetyBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.4 },
  });
}
