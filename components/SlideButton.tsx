import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  Platform,
  GestureResponderEvent,
  PanResponderGestureState,
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
  const currentXRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadingRef.current = !!isLoading;
  }, [isLoading]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  // Calculate max drag distance
  const getMaxDrag = useCallback(() => {
    return widthRef.current - BUTTON_HEIGHT;
  }, []);

  // Handle completion logic
  const handleCompletion = useCallback((currentDx: number) => {
    if (completedRef.current || loadingRef.current) return;

    const maxDrag = getMaxDrag();

    if (currentDx > maxDrag * SWIPE_THRESHOLD) {
      // Success
      console.log('[SlideButton] Swipe threshold reached, triggering completion');
      setCompleted(true);
      completedRef.current = true;

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
    currentXRef.current = 0;
  }, [getMaxDrag, onComplete, translateX]);

  // Handle drag movement
  const handleDragMove = useCallback((dx: number) => {
    if (completedRef.current || loadingRef.current) return;

    const containerWidth = widthRef.current;
    if (containerWidth === 0) return;

    const maxDrag = getMaxDrag();

    let newDx = dx;
    // Clamp the value to ensure it stays within bounds
    if (newDx < 0) newDx = 0;
    if (newDx > maxDrag) newDx = maxDrag;

    currentXRef.current = newDx;
    translateX.setValue(newDx);
  }, [getMaxDrag, translateX]);

  // Web-specific mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (completedRef.current || loadingRef.current) return;
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    translateX.setValue(0);
  }, [translateX]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const dx = e.clientX - startXRef.current;
    handleDragMove(dx);
  }, [handleDragMove]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    isDraggingRef.current = false;
    handleCompletion(currentXRef.current);
  }, [handleCompletion]);

  // Add/remove global mouse event listeners for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
      const onMouseUp = (e: MouseEvent) => handleMouseUp(e);

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [handleMouseMove, handleMouseUp]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.setValue(0);
        currentXRef.current = 0;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (completedRef.current || loadingRef.current) return;

        const containerWidth = widthRef.current;
        if (containerWidth === 0) return;

        const maxDrag = containerWidth - BUTTON_HEIGHT;

        let newDx = gestureState.dx;
        // Clamp the value to ensure it stays within bounds
        if (newDx < 0) newDx = 0;
        if (newDx > maxDrag) newDx = maxDrag;

        currentXRef.current = newDx;
        translateX.setValue(newDx);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (completedRef.current || loadingRef.current) return;

        const containerWidth = widthRef.current;
        const maxDrag = containerWidth - BUTTON_HEIGHT;

        if (gestureState.dx > maxDrag * SWIPE_THRESHOLD) {
          // Success
          console.log('[SlideButton] Swipe threshold reached, triggering completion');
          setCompleted(true);
          completedRef.current = true;

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

  // Web-specific props for the thumb
  const webThumbProps = Platform.OS === 'web' ? {
    onMouseDown: handleMouseDown as any,
    style: [
      styles.thumb,
      {
        transform: [{ translateX }],
        cursor: completed || isLoading ? 'not-allowed' : 'grab',
      },
    ] as any,
  } : {};

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
      {Platform.OS === 'web' ? (
        <Animated.View
          {...webThumbProps}
        >
          <ChevronRight color={Colors.primary} size={24} />
        </Animated.View>
      ) : (
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
      )}
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
