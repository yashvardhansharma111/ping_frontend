import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ping } from '@/constants/theme';

let NativeMapLibre: any = null;
let isNativeSupported = false;

try {
  const { TurboModuleRegistry } = require('react-native');
  const hasCameraModule = TurboModuleRegistry ? TurboModuleRegistry.get('MLRNCameraModule') != null : false;
  if (hasCameraModule) {
    NativeMapLibre = require('@maplibre/maplibre-react-native');
    isNativeSupported = true;
  }
} catch {
  isNativeSupported = false;
}

// ── Fallback Camera Component for Expo Go ────────────────────────────────────
const FallbackCamera = forwardRef((props: any, ref: any) => {
  useImperativeHandle(ref, () => ({
    setCamera: () => {},
    moveTo: () => {},
    flyTo: () => {},
    zoomTo: () => {},
  }));
  return null;
});

// ── Fallback Marker Component for Expo Go ────────────────────────────────────
const FallbackMarker = ({ id, coordinate, children }: any) => {
  const { width: W, height: H } = Dimensions.get('window');
  const lng = Array.isArray(coordinate) ? coordinate[0] : 77.64;
  const lat = Array.isArray(coordinate) ? coordinate[1] : 12.97;
  
  // Deterministic mapping to canvas coordinates around city center
  const posX = Math.abs(Math.sin(lng * 1000 + lat * 500)) * (W - 90) + 45;
  const posY = Math.abs(Math.cos(lat * 1000 + lng * 500)) * (H - 280) + 130;

  return (
    <View
      key={id}
      style={[
        fbStyle.markerWrapper,
        { left: posX - 24, top: posY - 24 },
      ]}
    >
      {children}
    </View>
  );
};

// ── Fallback Map Canvas with Dark City Grid & Vector Road Accents ────────────
const FallbackMap = forwardRef(({ style, children, onPress }: any, ref: any) => {
  useImperativeHandle(ref, () => ({
    getCenter: async () => [77.6412, 12.9719],
    getZoom: async () => 14,
    getBounds: async () => [[77.6, 12.9], [77.7, 13.0]],
  }));

  const { width: W, height: H } = Dimensions.get('window');

  return (
    <View style={[style, fbStyle.container]} onTouchEnd={onPress}>
      {/* Ambient Water Feature */}
      <View style={fbStyle.waterBody} />
      
      {/* City Grid Road Arterials */}
      <View style={fbStyle.roadH} />
      <View style={[fbStyle.roadH, { top: H * 0.42 }]} />
      <View style={[fbStyle.roadH, { top: H * 0.68 }]} />
      <View style={fbStyle.roadV} />
      <View style={[fbStyle.roadV, { left: W * 0.65 }]} />
      <View style={fbStyle.diagonalRoad} />

      {/* District Neighborhood Labels */}
      <Text style={[fbStyle.districtLabel, { top: H * 0.22, left: W * 0.15 }]}>Indiranagar</Text>
      <Text style={[fbStyle.districtLabel, { top: H * 0.48, left: W * 0.58 }]}>Koramangala</Text>
      <Text style={[fbStyle.districtLabel, { top: H * 0.72, left: W * 0.22 }]}>HSR Layout</Text>

      {/* User Location Pulse Point */}
      <View style={[fbStyle.userPulseWrap, { left: W * 0.46, top: H * 0.48 }]}>
        <View style={fbStyle.userPulseRing} />
        <View style={fbStyle.userPulseDot} />
      </View>

      {/* Render map pin markers */}
      {children}

      {/* Top Floating Map Badge */}
      <View style={fbStyle.banner}>
        <View style={fbStyle.bannerDot} />
        <Text style={fbStyle.bannerText}>Interactive Map · Expo Go Preview</Text>
      </View>
    </View>
  );
});

export const Map = isNativeSupported && NativeMapLibre?.Map ? NativeMapLibre.Map : FallbackMap;
export const Camera = isNativeSupported && NativeMapLibre?.Camera ? NativeMapLibre.Camera : FallbackCamera;
export const Marker = isNativeSupported && NativeMapLibre?.Marker ? NativeMapLibre.Marker : FallbackMarker;
export const setAccessToken = NativeMapLibre?.setAccessToken ?? (() => {});

export type MapRef = any;
export type CameraRef = any;

const fbStyle = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A10',
    overflow: 'hidden',
  },
  roadH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '25%',
    height: 3,
    backgroundColor: 'rgba(187, 146, 255, 0.12)',
  },
  roadV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '32%',
    width: 3,
    backgroundColor: 'rgba(187, 146, 255, 0.12)',
  },
  diagonalRoad: {
    position: 'absolute',
    top: 100,
    left: -50,
    width: 600,
    height: 2,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    transform: [{ rotate: '35deg' }],
  },
  waterBody: {
    position: 'absolute',
    top: '15%',
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  districtLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.22)',
    textTransform: 'uppercase',
  },
  userPulseWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    zIndex: 5,
  },
  userPulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(187, 146, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(187, 146, 255, 0.45)',
  },
  userPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Ping.purpleLight,
  },
  markerWrapper: {
    position: 'absolute',
    zIndex: 10,
  },
  banner: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18, 18, 26, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(187, 146, 255, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
  },
});
