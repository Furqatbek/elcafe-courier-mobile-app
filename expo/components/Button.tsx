import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps } from 'react-native';
import Colors from '@/constants/colors';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
}

export function Button({ title, variant = 'primary', isLoading, style, ...props }: ButtonProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return { bg: Colors.primary, text: Colors.surface, border: 'transparent' };
      case 'secondary':
        return { bg: Colors.secondary, text: Colors.surface, border: 'transparent' };
      case 'outline':
        return { bg: 'transparent', text: Colors.primary, border: Colors.primary };
      case 'danger':
        return { bg: Colors.danger, text: Colors.surface, border: 'transparent' };
      default:
        return { bg: Colors.primary, text: Colors.surface, border: 'transparent' };
    }
  };

  const variantStyle = getVariantStyle();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: variantStyle.bg, borderColor: variantStyle.border, borderWidth: variant === 'outline' ? 1 : 0 },
        props.disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variantStyle.text} />
      ) : (
        <Text style={[styles.text, { color: variantStyle.text }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
