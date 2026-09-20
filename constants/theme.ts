/**
 * Ping design system — purple-first palette from brand UI kit.
 * Prefer Colors[scheme] in screens; Ping.* for accents/gradients.
 */
import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 390; // Pixel 7 / iPhone 14 design baseline
const { width: SCREEN_W } = Dimensions.get('window');
const _ratio = SCREEN_W / BASE_WIDTH;

/**
 * Responsive font/size scale.
 * Scales down linearly on narrow screens, caps upscale at +8%
 * so large phones don't get oversized text.
 */
export function sp(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * Math.min(_ratio, 1.08)));
}

export const Ping = {
  // Brand purples (design board)
  purple: '#8F63F4',       // deep primary
  purpleLight: '#BB92FF',  // bright primary
  purpleDim: '#6545D9',    // dark purple
  lavender: '#EBD8FF',
  soft: '#F3ECFF',
  // Gradients
  gradStart: '#C8A8FF',
  gradEnd: '#7B5CFF',
  // Semantic (kept for toasts / rare status — prefer purple tints in UI)
  orange: '#F97316',
  green: '#22C55E',
  red: '#EF4444',
  yellow: '#F59E0B',
};

export const Gradients = {
  primary: [Ping.gradStart, Ping.gradEnd] as const,
  primaryAngle: '135deg',
  ambient: ['rgba(187,146,255,0.35)', 'rgba(101,69,217,0.08)', 'transparent'] as const,
  darkSurface: ['#15151A', '#101014'] as const,
};

export const Colors = {
  light: {
    primary: Ping.purple,
    accent: Ping.purpleLight,
    text: '#111111',
    textSecondary: '#6F6866',
    background: '#F6F3EF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    soft: Ping.soft,
    lavender: Ping.lavender,
    border: '#E6E1DA',
    tint: Ping.purple,
    icon: '#6F6866',
    tabIconDefault: '#A6A6B0',
    tabIconSelected: Ping.purple,
    online: Ping.purpleLight,
    danger: Ping.red,
    input: '#FFFFFF',
    inputBorder: '#E6E1DA',
    chip: Ping.soft,
    glow: 'rgba(143,99,244,0.22)',
  },
  dark: {
    primary: Ping.purpleLight,
    accent: Ping.purple,
    text: '#F5F5F7',
    textSecondary: '#A6A6B0',
    background: '#0F0F12',
    surface: '#1E1E25',
    card: '#1E1E25',
    soft: 'rgba(187,146,255,0.12)',
    lavender: Ping.lavender,
    border: 'rgba(235,216,255,0.14)',
    tint: Ping.purpleLight,
    icon: '#A6A6B0',
    tabIconDefault: '#6B6B78',
    tabIconSelected: Ping.purpleLight,
    online: Ping.purpleLight,
    danger: Ping.red,
    input: '#16161C',
    inputBorder: 'rgba(235,216,255,0.16)',
    chip: 'rgba(187,146,255,0.14)',
    glow: 'rgba(187,146,255,0.28)',
  },
};

/** 8pt spacing scale — scaled to screen width */
export const Spacing = {
  xs:  sp(4),
  sm:  sp(8),
  md:  sp(16),
  lg:  sp(22),
  xl:  sp(30),
  xxl: sp(44),
  '3xl': sp(58),
  '4xl': sp(72),
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 32,
  full: 9999,
};

/** System font — Rookey on Motorola, Roboto on stock Android, SF Pro on iOS */
export const Fonts = {
  regular:  undefined,
  medium:   undefined,
  semiBold: undefined,
  bold:     undefined,
};

export const Typography = {
  display: { fontSize: sp(32), fontWeight: '700' as const, lineHeight: sp(38), letterSpacing: -0.3 },
  h1:      { fontSize: sp(26), fontWeight: '700' as const, lineHeight: sp(32), letterSpacing: -0.25 },
  h2:      { fontSize: sp(20), fontWeight: '600' as const, lineHeight: sp(26), letterSpacing: -0.2 },
  h3:      { fontSize: sp(17), fontWeight: '600' as const, lineHeight: sp(22), letterSpacing: -0.1 },
  h4:      { fontSize: sp(14), fontWeight: '600' as const, lineHeight: sp(20) },
  body:    { fontSize: sp(14), fontWeight: '400' as const, lineHeight: sp(21) },
  bodyMed: { fontSize: sp(14), fontWeight: '500' as const, lineHeight: sp(21) },
  bodySm:  { fontSize: sp(13), fontWeight: '400' as const, lineHeight: sp(18) },
  caption: { fontSize: sp(11), fontWeight: '400' as const, lineHeight: sp(15) },
  label:   { fontSize: sp(10), fontWeight: '600' as const, lineHeight: sp(13), letterSpacing: 0.4, textTransform: 'uppercase' as const },
  micro:   { fontSize: sp(9),  fontWeight: '500' as const, lineHeight: sp(12) },
};

export const Shadow = {
  sm: {
    shadowColor: '#6545D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#6545D9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowColor: '#6545D9',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 16,
  },
};

export const Glass = {
  dark: {
    backgroundColor: 'rgba(30,30,37,0.72)',
    borderColor: 'rgba(235,216,255,0.16)',
    borderWidth: 1 as const,
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: 'rgba(230,225,218,0.9)',
    borderWidth: 1 as const,
  },
};
