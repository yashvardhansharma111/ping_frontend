import React from 'react';
import { StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import {
  Urbanist_300Light,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
  Urbanist_900Black,
  Urbanist_400Regular_Italic,
  Urbanist_600SemiBold_Italic,
  Urbanist_700Bold_Italic,
} from '@expo-google-fonts/urbanist';

// App-wide typeface. Loaded once in the root layout via useFonts(APP_FONTS).
export const APP_FONTS = {
  Urbanist_300Light,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
  Urbanist_900Black,
  Urbanist_400Regular_Italic,
  Urbanist_600SemiBold_Italic,
  Urbanist_700Bold_Italic,
};

const REGULAR: Record<string, string> = {
  '100': 'Urbanist_300Light',
  '200': 'Urbanist_300Light',
  '300': 'Urbanist_300Light',
  '400': 'Urbanist_400Regular',
  normal: 'Urbanist_400Regular',
  '500': 'Urbanist_500Medium',
  '600': 'Urbanist_600SemiBold',
  '700': 'Urbanist_700Bold',
  bold: 'Urbanist_700Bold',
  '800': 'Urbanist_800ExtraBold',
  '900': 'Urbanist_900Black',
};

const ITALIC: Record<string, string> = {
  '100': 'Urbanist_400Regular_Italic',
  '200': 'Urbanist_400Regular_Italic',
  '300': 'Urbanist_400Regular_Italic',
  '400': 'Urbanist_400Regular_Italic',
  normal: 'Urbanist_400Regular_Italic',
  '500': 'Urbanist_600SemiBold_Italic',
  '600': 'Urbanist_600SemiBold_Italic',
  '700': 'Urbanist_700Bold_Italic',
  bold: 'Urbanist_700Bold_Italic',
  '800': 'Urbanist_700Bold_Italic',
  '900': 'Urbanist_700Bold_Italic',
};

export function fontFor(weight: TextStyle['fontWeight'] = '400', italic = false) {
  const key = String(weight);
  return (italic ? ITALIC : REGULAR)[key] ?? REGULAR['400'];
}

let fontsReady = false;
export function setFontsReady(ready: boolean) { fontsReady = ready; }

// Resolves fontWeight/fontStyle to the matching Urbanist face. Explicit
// fontFamily (e.g. the Pacifico wordmark) is left untouched. Weight and
// style are cleared because each face is registered as its own family.
export function resolveFontStyle(style: StyleProp<TextStyle>): TextStyle | undefined {
  if (!fontsReady) return undefined;
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return undefined;
  return {
    fontFamily: fontFor(flat.fontWeight, flat.fontStyle === 'italic'),
    fontWeight: undefined,
    fontStyle: undefined,
  };
}

let patched = false;

// Makes Urbanist the default for every <Text> and <TextInput> without
// touching call sites: RN exposes both through configurable getters on
// the package export, so we swap in thin wrappers that append the resolved
// font family. Must run before the first render (top of the root layout).
export function applyGlobalFont() {
  if (patched) return;
  patched = true;

  const RN = require('react-native');
  for (const name of ['Text', 'TextInput'] as const) {
    const Orig = RN[name];
    const Wrapped = (props: any) =>
      React.createElement(Orig, { ...props, style: [props.style, resolveFontStyle(props.style)] });
    Wrapped.displayName = name;
    for (const key of Object.keys(Orig)) (Wrapped as any)[key] = (Orig as any)[key];
    Object.defineProperty(RN, name, { configurable: true, enumerable: true, get: () => Wrapped });
  }
}
