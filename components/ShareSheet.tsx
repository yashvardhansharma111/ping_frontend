import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface ShareContent {
  type: 'ping' | 'profile' | 'invite';
  title: string;
  subtitle?: string;
  body: string;
  emoji?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  content: ShareContent;
}

const STORE_URL = 'https://pingnow.in';

const TYPE_HOOKS: Record<string, string> = {
  food:    "We're eating. Come hungry or don't come at all.",
  sport:   "Moving our bodies like functioning humans. Join.",
  music:   "The aux is open. Bring your actual taste.",
  study:   "Group delusion that we'll be productive. You in?",
  outdoor: "Outside. On purpose. It'll be worth it.",
  gaming:  "We play, we argue, we do it again. Classic.",
  meetup:  "Real people. IRL. In this economy. Wild.",
};

function buildShareText(content: ShareContent): string {
  if (content.type === 'ping') {
    const hook = content.subtitle ? TYPE_HOOKS[content.subtitle] : null;
    const lines = [
      `${content.emoji ?? '📍'} ${content.title}`,
      '',
      hook ?? content.body,
      ...(hook && content.body ? ['', content.body] : []),
      '',
      `Get on Ping and join → ${STORE_URL}`,
    ];
    return lines.join('\n');
  }

  if (content.type === 'profile') {
    return [
      `Meet ${content.title} on Ping${content.subtitle ? ` (${content.subtitle})` : ''} 👀`,
      '',
      content.body,
      '',
      `Find them on Ping → ${STORE_URL}`,
    ].join('\n');
  }

  const lines: string[] = [];
  if (content.emoji) lines.push(`${content.emoji} ${content.title}`);
  else lines.push(content.title);
  if (content.subtitle) lines.push(content.subtitle);
  lines.push('', content.body, '', `Ping → ${STORE_URL}`);
  return lines.join('\n');
}

/** Try URLs in order — do NOT gate on canOpenURL (Android often returns false). */
async function tryOpenUrls(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

async function shareWhatsApp(text: string) {
  const q = encodeURIComponent(text);
  const opened = await tryOpenUrls([
    `whatsapp://send?text=${q}`,
    `https://wa.me/?text=${q}`,
  ]);
  if (!opened) await Share.share({ message: text });
}

async function shareTelegram(text: string) {
  const q = encodeURIComponent(text);
  const opened = await tryOpenUrls([
    `tg://msg?text=${q}`,
    `https://t.me/share/url?url=${encodeURIComponent(STORE_URL)}&text=${q}`,
  ]);
  if (!opened) await Share.share({ message: text });
}

async function shareInstagram(text: string) {
  // Instagram has no text-share URL — copy first, then open the app
  await Clipboard.setStringAsync(text);
  const opened = await tryOpenUrls([
    'instagram://app',
    'https://www.instagram.com/',
  ]);
  Toast.show({
    type: 'info',
    text1: 'Copied to clipboard',
    text2: opened ? 'Paste it in Instagram' : 'Open Instagram and paste',
  });
}

async function shareSms(text: string) {
  const q = encodeURIComponent(text);
  const opened = await tryOpenUrls([
    Platform.OS === 'ios' ? `sms:&body=${q}` : `sms:?body=${q}`,
  ]);
  if (!opened) await Share.share({ message: text });
}

interface ShareOption {
  key: string;
  label: string;
  icon: MCIName;
  color: string;
  bg: string;
  run: (text: string) => Promise<void>;
}

const OPTIONS: ShareOption[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.12)',
    run: shareWhatsApp,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: 'send',
    color: '#2AABEE',
    bg: 'rgba(42,171,238,0.12)',
    run: shareTelegram,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'instagram',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.12)',
    run: shareInstagram,
  },
  {
    key: 'sms',
    label: 'Messages',
    icon: 'message-text',
    color: '#34C759',
    bg: 'rgba(52,199,89,0.12)',
    run: shareSms,
  },
];

export default function ShareSheet({ visible, onClose, content }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCopied(false);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 260, mass: 0.9, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const shareText = buildShareText(content);

  async function handleOption(opt: ShareOption) {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await opt.run(shareText);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (busy) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await Clipboard.setStringAsync(shareText);
      setCopied(true);
      Toast.show({ type: 'success', text1: 'Copied', text2: 'Share text is on your clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not copy' });
    }
  }

  async function handleNativeShare() {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({ message: shareText });
      onClose();
    } catch {
      // user dismissed
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          <View style={[styles.preview, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.previewEmoji}>{content.emoji ?? '📤'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewTitle, { color: c.text }]} numberOfLines={1}>
                {content.title}
              </Text>
              {content.subtitle ? (
                <Text style={[styles.previewSub, { color: c.textSecondary }]} numberOfLines={1}>
                  {content.subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.optionRow}>
            {OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.optionBtn}
                onPress={() => handleOption(opt)}
                activeOpacity={0.75}
                disabled={busy}
              >
                <View style={[styles.optionIcon, { backgroundColor: opt.bg }]}>
                  <MaterialCommunityIcons name={opt.icon} size={26} color={opt.color} />
                </View>
                <Text style={[styles.optionLabel, { color: c.textSecondary }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.actionRow, { borderTopColor: c.border }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={handleCopy}
              activeOpacity={0.8}
              disabled={busy}
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={copied ? Ping.green : c.icon}
              />
              <Text style={[styles.actionBtnText, { color: copied ? Ping.green : c.text }]}>
                {copied ? 'Copied!' : 'Copy text'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Ping.purple, borderColor: Ping.purple }]}
              onPress={handleNativeShare}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={[styles.actionBtnText, { color: '#FFF', fontWeight: '700' }]}>More</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  previewEmoji: { fontSize: 28 },
  previewTitle: { ...Typography.bodyMed, fontWeight: '700' },
  previewSub: { ...Typography.caption, marginTop: 2 },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  optionBtn: { alignItems: 'center', gap: 6, minWidth: 68 },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { ...Typography.caption, fontSize: 11, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  actionBtnText: { ...Typography.bodySm, fontWeight: '600' },
});
