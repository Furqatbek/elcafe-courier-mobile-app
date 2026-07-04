import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, Text, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Colors from '@/constants/colors';

interface LogoProps {
  size?: number;
  showText?: boolean;
  showSubtitle?: boolean;
}

export function Logo({ size = 100, showText = false, showSubtitle = false }: LogoProps) {
  return (
    <View style={[styles.container, { width: size, height: showText ? size * 1.3 : size }]}>
      <Svg width={size} height={showText ? size * 1.3 : size} viewBox={showText ? "0 0 100 130" : "0 0 100 100"}>
        <Defs>
          <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={Colors.primary} />
            <Stop offset="100%" stopColor={Colors.primaryDark} />
          </LinearGradient>
          <LinearGradient id="flashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FBBF24" />
            <Stop offset="100%" stopColor={Colors.accent} />
          </LinearGradient>
        </Defs>

        {/* Main circle background */}
        <Circle cx="50" cy="50" r="46" fill="url(#bgGrad)" />

        {/* Lightning bolt */}
        <Path
          d="M 42 18 L 62 42 L 52 42 L 58 82 L 38 52 L 48 52 Z"
          fill="url(#flashGrad)"
          stroke="white"
          strokeWidth="1.5"
        />

        {/* Speed lines */}
        <Rect x="12" y="42" width="16" height="3" rx="1.5" fill="white" opacity="0.6" />
        <Rect x="16" y="48" width="12" height="3" rx="1.5" fill="white" opacity="0.4" />
        <Rect x="14" y="54" width="14" height="3" rx="1.5" fill="white" opacity="0.5" />

        {/* ZBR text */}
        {showText && (
          <G>
            <Text
              x="50"
              y="115"
              fontFamily="Arial"
              fontSize="18"
              fontWeight="900"
              fill={Colors.text}
              textAnchor="middle"
            >
              ZBR
            </Text>
            {showSubtitle && (
              <Text
                x="50"
                y="128"
                fontFamily="Arial"
                fontSize="8"
                fontWeight="600"
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                COURIER
              </Text>
            )}
          </G>
        )}
      </Svg>
    </View>
  );
}

// Icon-only version for smaller displays
export function LogoIcon({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={Colors.primary} />
          <Stop offset="100%" stopColor={Colors.primaryDark} />
        </LinearGradient>
        <LinearGradient id="flashGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FBBF24" />
          <Stop offset="100%" stopColor={Colors.accent} />
        </LinearGradient>
      </Defs>

      {/* Main circle background */}
      <Circle cx="50" cy="50" r="46" fill="url(#bgGradIcon)" />

      {/* Lightning bolt */}
      <Path
        d="M 42 18 L 62 42 L 52 42 L 58 82 L 38 52 L 48 52 Z"
        fill="url(#flashGradIcon)"
        stroke="white"
        strokeWidth="1.5"
      />

      {/* Speed lines */}
      <Rect x="12" y="42" width="16" height="3" rx="1.5" fill="white" opacity="0.6" />
      <Rect x="16" y="48" width="12" height="3" rx="1.5" fill="white" opacity="0.4" />
      <Rect x="14" y="54" width="14" height="3" rx="1.5" fill="white" opacity="0.5" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Logo;
