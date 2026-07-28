import { useState, useRef, useMemo } from 'react';
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
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { LinearGradient } from 'expo-linear-gradient';
import { authApi } from '@/lib/api';
import { Ping, Gradients } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const INDIA_PHONE_RE = /^[6-9]\d{9}$/;

export default function PhoneScreen() {
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef<TextInput>(null);
  const router                = useRouter();
  const insets                = useSafeAreaInsets();
  const scheme                = useColorScheme() ?? 'light';
  const isDark                = scheme === 'dark';
  const s                     = useMemo(() => makeStyles(isDark), [isDark]);

  const [fontsLoaded] = useFonts({ Pacifico_400Regular });

  const isValid = INDIA_PHONE_RE.test(phone.trim());

  async function handleSend() {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const fullPhone = `+91${phone.trim()}`;
      const res       = await authApi.requestOtp(fullPhone) as any;
      router.push({ pathname: '/(auth)/otp', params: { phone: fullPhone, debugCode: res.code ?? '' } });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not send code', text2: err.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ flex: 1, minHeight: insets.top + 24 }} />

        <View style={s.textBlock}>
          <Text style={[
            s.appName,
            fontsLoaded ? { fontFamily: 'Pacifico_400Regular' } : { fontStyle: 'italic', fontWeight: '700' },
          ]}>
            Ping
          </Text>
          <Text style={s.headline}>
            Drop a ping,{'\n'}find your people.
          </Text>
          <Text style={s.subtitle}>
            Real plans, real humans — not just profiles you'll never swipe right on.
          </Text>
        </View>

        <View style={[s.card, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.pill} />

          <Text style={s.cardTitle}>Enter your mobile number</Text>
          <Text style={s.cardSub}>We'll send you a code. One code. Try not to lose it.</Text>

          <TouchableOpacity
            style={[s.inputWrap, isValid && s.inputWrapFocus]}
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={s.flag}>🇮🇳</Text>
            <Text style={s.prefix}>+91</Text>
            <View style={s.divider} />
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="98765 43210"
              placeholderTextColor={isDark ? '#555570' : '#A6A6B0'}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              autoFocus
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!isValid || loading}
            activeOpacity={0.88}
            style={{ borderRadius: 9999, overflow: 'hidden', opacity: (!isValid || loading) ? 0.55 : 1 }}
          >
            <LinearGradient
              colors={[...Gradients.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.btn}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={s.btnText}>Send OTP</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.legal}>
            By continuing, you agree to our{' '}
            <Text style={s.legalLink}>Terms & Conditions</Text>
            {' '}and{' '}
            <Text style={s.legalLink}>Privacy Policy</Text>
            .
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(isDark: boolean) {
  const bg      = isDark ? '#0F0F12' : '#FFFFFF';
  const surface = isDark ? '#1A1A24' : '#FFFFFF';
  const text    = isDark ? '#F1F0FF' : '#111111';
  const muted   = isDark ? '#9490C0' : '#6F6866';
  const border  = isDark ? 'rgba(167,139,250,0.18)' : '#E6E1DA';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : Ping.soft;

  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: bg },
    scroll: { flexGrow: 1 },
    textBlock: { paddingHorizontal: 28, paddingBottom: 24, gap: 10 },
    appName: { fontSize: 52, color: Ping.purpleDim },
    headline: {
      fontSize: 30, fontWeight: '800', color: text,
      lineHeight: 38, letterSpacing: -0.5, marginTop: 4,
    },
    subtitle: { fontSize: 14, color: muted, lineHeight: 21, maxWidth: 300 },
    card: {
      backgroundColor: surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 28,
      paddingTop: 16,
      gap: 14,
      borderTopWidth: 1,
      borderColor: isDark ? 'rgba(167,139,250,0.14)' : Ping.lavender,
      shadowColor: Ping.purpleDim,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 20,
      elevation: 12,
    },
    pill: {
      alignSelf: 'center', width: 36, height: 4,
      borderRadius: 2, backgroundColor: isDark ? 'rgba(167,139,250,0.35)' : Ping.lavender,
      marginBottom: 6,
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: text, letterSpacing: -0.3 },
    cardSub:   { fontSize: 13, color: muted, lineHeight: 19, marginTop: -4 },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: inputBg,
      borderRadius: 16, borderWidth: 1.5, borderColor: border,
      height: 54, paddingHorizontal: 14, gap: 8,
    },
    inputWrapFocus: {
      borderColor: Ping.purpleLight,
      backgroundColor: isDark ? 'rgba(167,139,250,0.08)' : '#FFF',
    },
    flag:   { fontSize: 18 },
    prefix: { fontSize: 15, fontWeight: '600', color: text },
    divider: { width: 1, height: 22, backgroundColor: border },
    input: {
      flex: 1, height: '100%', paddingHorizontal: 10,
      fontSize: 16, color: text, letterSpacing: 1.5,
    },
    btn: { height: 54, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
    legal: { fontSize: 11, color: muted, textAlign: 'center', lineHeight: 17 },
    legalLink: { color: Ping.purpleDim, fontWeight: '600', textDecorationLine: 'underline' },
  });
}
