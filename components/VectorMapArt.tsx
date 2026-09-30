import { StyleSheet } from 'react-native';
import Svg, { Rect, Path, Circle, Ellipse, G } from 'react-native-svg';

// Decorative "vector map" backdrop: blocks, roads, a park and a pond.
// Purely illustrative — used where a live map would be overkill or unreliable.
export default function VectorMapArt({ isDark = false }: { isDark?: boolean }) {
  const bg     = isDark ? '#15161C' : '#F3EFE7';
  const block  = isDark ? '#1E2029' : '#E7E1D6';
  const blockB = isDark ? '#242732' : '#DED7CA';
  const road   = isDark ? '#2C3040' : '#FFFFFF';
  const roadMd = isDark ? '#353A4C' : '#FBF8F2';
  const roadHi = isDark ? '#4A4F66' : '#F5D9A6';
  const park   = isDark ? '#1F3328' : '#CFE7C6';
  const parkB  = isDark ? '#264031' : '#BFDDB4';
  const water  = isDark ? '#1C2E44' : '#BFD9F0';
  const label  = isDark ? '#3B4052' : '#D2CBBE';

  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice">
      <Rect x="0" y="0" width="320" height="160" fill={bg} />

      {/* city blocks */}
      <G fill={block}>
        <Rect x="14" y="12" width="52" height="34" rx="4" />
        <Rect x="80" y="10" width="70" height="26" rx="4" />
        <Rect x="14" y="60" width="40" height="46" rx="4" />
        <Rect x="170" y="14" width="46" height="40" rx="4" />
        <Rect x="230" y="12" width="76" height="30" rx="4" />
        <Rect x="236" y="60" width="70" height="38" rx="4" />
        <Rect x="80" y="118" width="60" height="30" rx="4" />
        <Rect x="160" y="112" width="54" height="36" rx="4" />
        <Rect x="14" y="122" width="48" height="26" rx="4" />
      </G>
      <G fill={blockB}>
        <Rect x="90" y="52" width="40" height="30" rx="4" />
        <Rect x="180" y="66" width="34" height="30" rx="4" />
        <Rect x="250" y="112" width="56" height="36" rx="4" />
      </G>

      {/* park + pond */}
      <Path d="M132 88 C 150 70, 182 74, 190 96 C 196 114, 172 124, 152 118 C 136 113, 124 102, 132 88 Z" fill={park} />
      <Ellipse cx="160" cy="98" rx="14" ry="9" fill={parkB} />
      <Path d="M262 78 C 284 66, 312 74, 318 92 C 322 108, 300 118, 282 112 C 266 106, 250 90, 262 78 Z" fill={water} />

      {/* minor streets */}
      <G stroke={road} strokeWidth="4" strokeLinecap="round" fill="none">
        <Path d="M0 52 H320" />
        <Path d="M0 108 H128" />
        <Path d="M214 106 H320" />
        <Path d="M72 0 V160" />
        <Path d="M158 0 V70" />
        <Path d="M224 0 V160" />
        <Path d="M0 30 H14" />
        <Path d="M150 130 H228" />
      </G>
      {/* dashed lanes */}
      <G stroke={roadMd} strokeWidth="1.2" strokeDasharray="5 5" fill="none">
        <Path d="M0 52 H320" />
        <Path d="M72 0 V160" />
        <Path d="M224 0 V160" />
      </G>

      {/* main road, slightly diagonal, warm highlight */}
      <Path d="M-10 132 C 60 118, 120 140, 200 122 C 250 110, 290 116, 330 100" stroke={roadHi} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Path d="M-10 132 C 60 118, 120 140, 200 122 C 250 110, 290 116, 330 100" stroke={road} strokeWidth="2" strokeDasharray="8 8" strokeLinecap="round" fill="none" />

      {/* tiny "landmark" dots */}
      <G fill={label}>
        <Circle cx="40" cy="30" r="2.2" />
        <Circle cx="193" cy="34" r="2.2" />
        <Circle cx="270" cy="27" r="2.2" />
        <Circle cx="110" cy="133" r="2.2" />
      </G>
    </Svg>
  );
}
