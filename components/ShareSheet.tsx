import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Linking,
  Animated,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  // invite / default
  const lines: string[] = [];
  if (content.emoji) lines.push(`${content.emoji} ${content.title}`);
  else lines.push(content.title);
  if (content.subtitle) lines.push(content.subtitle);
  lines.push('', content.body, '', `Ping → ${STORE_URL}`);
  return lines.join('\n');
}

async function openApp(scheme: string, text: string) {
  const url = `${scheme}${encodeURIComponent(text)}`;
  const canOpen = await Linking.canOpenURL(url).catch(() => false);
  if (canOpen) {
    await Linking.openURL(url).catch(() => {});
  } else {
    Share.share({ message: text }).catch(() => {});
  }
}

interface ShareOption {
  key: string;
  label: string;
  icon: MCIName;
  color: string;
  bg: string;
  onPress: (text: string) => void;
}

const OPTIONS: ShareOption[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.12)',
    onPress: (text) => openApp('whatsapp://send?text=', text),
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: 'send-circle',
    color: '#2AABEE',
    bg: 'rgba(42,171,238,0.12)',
    onPress: (text) => openApp('tg://msg?text=', text),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'instagram',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.12)',
    onPress: (text) => Share.share({ message: text }).catch(() => {}),
  },
  {
    key: 'more',
    label: 'More',
    icon: 'dots-horizontal-circle',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    onPress: (text) => Share.share({ message: text }).catch(() => {}),
  },
];

export default function ShareSheet({ visible, onClose, content }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await opt.onPress(shareText);
  }

  async function handleCopy() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      // Try expo-clipboard if available, otherwise Share
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Share.share({ message: shareText }).catch(() => {});
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
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        {/* Content preview */}
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

        {/* Platform share buttons */}
        <View style={styles.optionRow}>
          {OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.optionBtn}
              onPress={() => handleOption(opt)}
              activeOpacity={0.75}
            >
              <View style={[styles.optionIcon, { backgroundColor: opt.bg }]}>
                <MaterialCommunityIcons name={opt.icon} size={26} color={opt.color} />
              </View>
              <Text style={[styles.optionLabel, { color: c.textSecondary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Copy + Native share row */}
        <View style={[styles.actionRow, { borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={handleCopy}
            activeOpacity={0.8}
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
            style={[styles.actionBtn, { backgroundColor: Ping.purple }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Share.share({ message: shareText }).catch(() => {});
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={18} color="#FFF" />
            <Text style={[styles.actionBtnText, { color: '#FFF', fontWeight: '700' }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  optionBtn: { alignItems: 'center', gap: 6 },
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
