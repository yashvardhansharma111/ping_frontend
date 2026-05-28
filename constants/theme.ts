export const Ping = {
  purple: '#7C3AED',
  purpleLight: '#A78BFA',
  purpleDim: '#5B21B6',
  orange: '#F97316',
  green: '#22C55E',
  red: '#EF4444',
  yellow: '#F59E0B',
};

export const Colors = {
  light: {
    primary: Ping.purple,
    accent: Ping.orange,
    text: '#1A1730',
    textSecondary: '#6B7280',
    background: '#F5F3FF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: 'rgba(124, 58, 237, 0.12)',
    tint: Ping.purple,
    icon: '#6B7280',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Ping.purple,
    online: Ping.green,
    danger: Ping.red,
  },
  dark: {
    primary: Ping.purpleLight,
    accent: Ping.orange,
    text: '#F1F0FF',
    textSecondary: '#9490C0',
    background: '#080815',
    surface: '#11112A',
    card: '#1A1A38',
    border: 'rgba(167, 139, 250, 0.2)',
    tint: Ping.purpleLight,
    icon: '#9490C0',
    tabIconDefault: '#5C5A80',
    tabIconSelected: Ping.purpleLight,
    online: Ping.green,
    danger: Ping.red,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMed: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};
