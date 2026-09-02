import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

/**
 * The ZBR brand mark.
 *
 * Renders the approved mark (white Z on the emerald rounded square) from a
 * single raster source, which is the same artwork the app icon, adaptive icon,
 * splash and web favicon are generated from — so every surface stays in sync.
 * Source of truth: assets/ZBR Mark Concepts-selection.png.
 *
 * Previously this drew a different mark (an amber lightning bolt) in inline
 * SVG, which meant the logo users saw in the app did not match the icon on
 * their home screen.
 */

// 1024x1024 so it stays crisp at every size this component is used at
// (currently 80-120px) on 3x displays.
const MARK = require('@/assets/images/logo-mark.png');

interface LogoProps {
  size?: number;
  showText?: boolean;
  showSubtitle?: boolean;
}

export function Logo({ size = 100, showText = false, showSubtitle = false }: LogoProps) {
  return (
    <View style={styles.container}>
      <Image
        source={MARK}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="ZBR"
      />
      {showText && (
        <Text style={[styles.wordmark, { fontSize: size * 0.18, marginTop: size * 0.08 }]}>
          ZBR
        </Text>
      )}
      {showText && showSubtitle && (
        <Text style={[styles.subtitle, { fontSize: size * 0.09 }]}>COURIER</Text>
      )}
    </View>
  );
}

/** Icon-only alias kept for callers that want an explicit small mark. */
export function LogoIcon({ size = 48 }: { size?: number }) {
  return <Logo size={size} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
});

export default Logo;
