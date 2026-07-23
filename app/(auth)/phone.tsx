import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
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

const INDIA_PHONE_RE = /^[6-9]\d{9}$/;

const BG     = Ping.soft;       // #F3ECFF
const WHITE  = '#FFFFFF';
const TEXT   = '#111111';
const MUTED  = '#6F6866';
const DIM    = '#A6A6B0';
const BORDER = '#E6E1DA';

export default function PhoneScreen() {
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef<TextInput>(null);
  const router                = useRouter();
  const insets                = useSafeAreaInsets();

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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, minHeight: insets.top + 24 }} />

      <View style={styles.textBlock}>
        <Text style={[
          styles.appName,
          fontsLoaded ? { fontFamily: 'Pacifico_400Regular' } : { fontStyle: 'italic', fontWeight: '700' },
        ]}>
          Ping
        </Text>
        <Text style={styles.headline}>
          Drop a ping,{'\n'}find your people.
        </Text>
        <Text style={styles.subtitle}>
          Real plans, real humans — not just profiles you'll never swipe right on.
        </Text>
      </View>

      <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.pill} />

        <Text style={styles.cardTitle}>Enter your mobile number</Text>
        <Text style={styles.cardSub}>We'll send you a code. One code. Try not to lose it.</Text>

        <TouchableOpacity
          style={[styles.inputWrap, isValid && styles.inputWrapFocus]}
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <Text style={styles.flag}>🇮🇳</Text>
          <Text style={styles.prefix}>+91</Text>
          <View style={styles.divider} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="98765 43210"
            placeholderTextColor={DIM}
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
            style={styles.btn}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnText}>Send OTP</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalLink}>Terms & Conditions</Text>
          {' '}and{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>
          .
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  textBlock: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    gap: 10,
  },
  appName: {
    fontSize: 52,
    color: Ping.purpleDim,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 21,
    maxWidth: 300,
  },
  card: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 14,
    borderTopWidth: 1,
    borderColor: Ping.lavender,
    shadowColor: Ping.purpleDim,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  pill: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Ping.lavender,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
    marginTop: -4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Ping.soft,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    height: 54,
    paddingHorizontal: 14,
    gap: 8,
  },
  inputWrapFocus: {
    borderColor: Ping.purpleLight,
    backgroundColor: '#FFF',
  },
  flag: { fontSize: 18 },
  prefix: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: BORDER,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 16,
    color: TEXT,
    letterSpacing: 1.5,
  },
  btn: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.2,
  },
  legal: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: {
    color: Ping.purpleDim,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
