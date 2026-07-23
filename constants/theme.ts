/**
 * Ping design system — purple-first palette from brand UI kit.
 * Prefer Colors[scheme] in screens; Ping.* for accents/gradients.
 */

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

/** 8pt spacing scale */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  '3xl': 64,
  '4xl': 80,
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 32,
  full: 9999,
};

/** Plus Jakarta Sans metrics — pair with loaded fontFamily in app */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const Typography = {
  display: { fontSize: 34, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.34 },
  h1:      { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.28 },
  h2:      { fontSize: 22, fontWeight: '600' as const, lineHeight: 28, letterSpacing: -0.22 },
  h3:      { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, letterSpacing: -0.1 },
  h4:      { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  body:    { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMed: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySm:  { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label:   { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.4, textTransform: 'uppercase' as const },
  micro:   { fontSize: 10, fontWeight: '500' as const, lineHeight: 13 },
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
