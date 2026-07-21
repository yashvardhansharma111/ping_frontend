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
    text: '#1C1040',
    textSecondary: '#7B6DAA',
    background: '#FFFFFF',
    surface: '#F9F8FF',
    card: '#FFFFFF',
    border: 'rgba(124, 58, 237, 0.1)',
    tint: Ping.purple,
    icon: '#7B6DAA',
    tabIconDefault: '#A89CC8',
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
  display: { fontSize: 36, fontWeight: '800' as const, lineHeight: 44, letterSpacing: -0.5 },
  h1:      { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.3 },
  h2:      { fontSize: 22, fontWeight: '700' as const, lineHeight: 30, letterSpacing: -0.2 },
  h3:      { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  h4:      { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  body:    { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMed: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySm:  { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label:   { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  micro:   { fontSize: 10, fontWeight: '500' as const, lineHeight: 13 },
};

export const Shadow = {
  sm: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const Glass = {
  dark: {
    backgroundColor: 'rgba(17,17,42,0.72)',
    borderColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1 as const,
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1 as const,
  },
};
