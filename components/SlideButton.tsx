import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const BUTTON_HEIGHT = 60;
const BUTTON_PADDING = 4;
const SWIPE_THRESHOLD = 0.7;

interface SlideButtonProps {
  title: string;
  onComplete: () => void;
  isLoading?: boolean;
}

export function SlideButton({ title, onComplete, isLoading }: SlideButtonProps) {
  const { t } = useTranslation();
  const [completed, setCompleted] = useState(false);
  
  // Refs to hold mutable values for PanResponder closure
  const widthRef = useRef(0);
  const completedRef = useRef(false);
  const loadingRef = useRef(false);
  
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadingRef.current = !!isLoading;
  }, [isLoading]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (completedRef.current || loadingRef.current) return;
        
        const containerWidth = widthRef.current;
        if (containerWidth === 0) return;

        // The maximum distance the button can travel
        // Total width - thumb width - start padding - end padding
        // Thumb width = BUTTON_HEIGHT - 2 * BUTTON_PADDING
        // So max travel = containerWidth - (BUTTON_HEIGHT - 2 * BUTTON_PADDING) - 2 * BUTTON_PADDING
        // = containerWidth - BUTTON_HEIGHT
        const maxDrag = containerWidth - BUTTON_HEIGHT;
        
        let newDx = gestureState.dx;
        // Clamp the value to ensure it stays within bounds
        if (newDx < 0) newDx = 0;
        if (newDx > maxDrag) newDx = maxDrag;
        
        translateX.setValue(newDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (completedRef.current || loadingRef.current) return;
        
        const containerWidth = widthRef.current;
        const maxDrag = containerWidth - BUTTON_HEIGHT;
        
        if (gestureState.dx > maxDrag * SWIPE_THRESHOLD) {
          // Success
          console.log('[SlideButton] Swipe threshold reached, triggering completion');
          setCompleted(true);

          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          Animated.spring(translateX, {
            toValue: maxDrag,
            useNativeDriver: Platform.OS !== 'web',
            bounciness: 8,
          }).start(() => {
            console.log('[SlideButton] Animation complete, calling onComplete callback');
            onComplete();
          });
        } else {
          // Reset
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
            bounciness: 8,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View 
      style={styles.container}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
    >
      <View style={styles.track}>
        <Text style={styles.title}>{isLoading ? t('common.loading') : title}</Text>
      </View>
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <ChevronRight color={Colors.primary} size={24} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BUTTON_HEIGHT,
    backgroundColor: Colors.secondary,
    borderRadius: BUTTON_HEIGHT / 2,
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
    paddingLeft: 40,
    zIndex: 1,
  },
  thumb: {
    zIndex: 2,
    width: BUTTON_HEIGHT - BUTTON_PADDING * 2,
    height: BUTTON_HEIGHT - BUTTON_PADDING * 2,
    borderRadius: (BUTTON_HEIGHT - BUTTON_PADDING * 2) / 2,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: BUTTON_PADDING,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
