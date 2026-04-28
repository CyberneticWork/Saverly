import React from 'react';
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

const BRAND = {
  primary: '#1C9A76',
  secondary: '#FFA11A',
  text: '#2F3136',
  subtext: '#4C5057',
  background: '#F8FBFA',
};

function BrandMark() {
  return (
    <G>
      <Path
        d="M20 18H36C41 18 45 21 47 25L64 88C65 92 69 95 74 95H150C155 95 160 92 162 87L173 54"
        stroke={BRAND.primary}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M73 95H148" stroke={BRAND.primary} strokeWidth="9" strokeLinecap="round" />
      <Rect x="67" y="44" width="12" height="36" rx="3" fill={BRAND.secondary} />
      <Rect x="87" y="34" width="12" height="46" rx="3" fill={BRAND.secondary} />
      <Rect x="107" y="24" width="12" height="56" rx="3" fill={BRAND.secondary} />
      <Rect x="127" y="12" width="12" height="68" rx="3" fill={BRAND.secondary} />
      <Circle cx="80" cy="118" r="10" fill={BRAND.primary} />
      <Circle cx="80" cy="118" r="4" fill={BRAND.background} />
      <Circle cx="132" cy="118" r="10" fill={BRAND.primary} />
      <Circle cx="132" cy="118" r="4" fill={BRAND.background} />
    </G>
  );
}

export default function BrandLogo({ width = 220, variant = 'full', withTagline = true }) {
  if (variant === 'mark') {
    const height = width * 0.78;
    return (
      <Svg width={width} height={height} viewBox="0 0 190 140">
        <BrandMark />
      </Svg>
    );
  }

  const height = withTagline ? width * 0.72 : width * 0.58;

  return (
    <Svg width={width} height={height} viewBox="0 0 360 260">
      <BrandMark />
      <SvgText
        x="180"
        y="190"
        fill={BRAND.text}
        fontSize="58"
        fontWeight="800"
        textAnchor="middle"
        letterSpacing="-1.5"
      >
        Saverly
      </SvgText>
      {withTagline ? (
        <SvgText
          x="180"
          y="226"
          fill={BRAND.subtext}
          fontSize="18"
          fontWeight="500"
          textAnchor="middle"
        >
          See Where You Save.
        </SvgText>
      ) : null}
    </Svg>
  );
}
