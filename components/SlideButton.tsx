import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  Platform,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import logger from '@/lib/logger';

const BUTTON_HEIGHT = 60;
const BUTTON_PADDING = 4;
const SWIPE_THRESHOLD = 0.7;

interface SlideButtonProps {
  title: string;
  onComplete: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SlideButton({ title, onComplete, isLoading, disabled }: SlideButtonProps) {
  const { t } = useTranslation();
  const [completed, setCompleted] = useState(false);

  // Refs to hold mutable values — updated synchronously during render
  // (NOT in useEffect) so they are never stale when event handlers fire
  const widthRef = useRef(0);
  const completedRef = useRef(false);
  const loadingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // For web drag handling
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentDxRef = useRef(0);

  const translateX = useRef(new Animated.Value(0)).current;

  // Sync refs during render (synchronous — always up-to-date).
  // `disabled` shares the loading gate: both block every interaction path
  // (press-in, drag, release, completion).
  loadingRef.current = !!isLoading || !!disabled;
  completedRef.current = completed;
  onCompleteRef.current = onComplete;

  const getMaxDrag = () => widthRef.current - BUTTON_HEIGHT;

  const resetSlider = () => {
    setCompleted(false);
    completedRef.current = false;
    translateX.setValue(0);
  };

  const triggerCompletion = async (dx: number) => {
    if (completedRef.current || loadingRef.current) return;

    const maxDrag = getMaxDrag();
    logger.log('[SlideButton] triggerCompletion dx:', dx, 'maxDrag:', maxDrag, 'threshold:', maxDrag * SWIPE_THRESHOLD);

    if (dx > maxDrag * SWIPE_THRESHOLD) {
      logger.log('[SlideButton] Swipe threshold reached, triggering completion');
      setCompleted(true);
      completedRef.current = true;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      translateX.setValue(maxDrag);

      try {
        logger.log('[SlideButton] Calling onComplete handler...');
        await onCompleteRef.current();
        logger.log('[SlideButton] onComplete resolved successfully');
      } catch (error) {
        logger.log('[SlideButton] onComplete failed, resetting slider:', error);
        resetSlider();
      }
    } else {
      translateX.setValue(0);
    }
  };

  // Keep triggerCompletion accessible via ref so the web useEffect never has a stale closure
  const triggerCompletionRef = useRef(triggerCompletion);
  triggerCompletionRef.current = triggerCompletion;

  // Web mouse event handlers - attached to window
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || completedRef.current || loadingRef.current) return;

      const containerWidth = widthRef.current;
      if (containerWidth === 0) return;

      const maxDrag = containerWidth - BUTTON_HEIGHT;
      let dx = e.clientX - startXRef.current;

      if (dx < 0) dx = 0;
      if (dx > maxDrag) dx = maxDrag;

      currentDxRef.current = dx;
      translateX.setValue(dx);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      logger.log('[SlideButton] Mouse up, currentDx:', currentDxRef.current);
      isDraggingRef.current = false;
      triggerCompletionRef.current(currentDxRef.current);
      currentDxRef.current = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // translateX is useRef(...).current — stable for the component's lifetime,
    // so listing it changes nothing at runtime.
  }, [translateX]);

  // Web-specific: handle press start on the thumb
  const handlePressIn = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (completedRef.current || loadingRef.current) return;

    logger.log('[SlideButton] Press in detected');
    isDraggingRef.current = true;
    // Get clientX from the native event
    const clientX = e.nativeEvent?.pageX || e.nativeEvent?.clientX || 0;
    startXRef.current = clientX;
    currentDxRef.current = 0;
    translateX.setValue(0);
  };

  // Native PanResponder (for iOS/Android)
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

        const maxDrag = containerWidth - BUTTON_HEIGHT;
        let newDx = gestureState.dx;

        if (newDx < 0) newDx = 0;
        if (newDx > maxDrag) newDx = maxDrag;

        translateX.setValue(newDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (completedRef.current || loadingRef.current) return;
        triggerCompletion(gestureState.dx);
      },
    })
  ).current;

  const thumbStyle = [
    styles.thumb,
    { transform: [{ translateX }] },
  ];

  const isBlocked = completed || isLoading || disabled;

  return (
    <View
      style={[styles.container, disabled && styles.containerDisabled]}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        logger.log('[SlideButton] Layout width:', e.nativeEvent.layout.width);
      }}
    >
      <View style={styles.track}>
        <Text style={styles.title}>{isLoading ? t('common.loading') : title}</Text>
      </View>
      {Platform.OS === 'web' ? (
        <Pressable
          onPressIn={handlePressIn}
          disabled={isBlocked}
          style={{ position: 'absolute', left: BUTTON_PADDING, opacity: 1 }}
          android_disableSound
        >
          <Animated.View
            style={[
              styles.thumbInner,
              { transform: [{ translateX }] },
              { cursor: isBlocked ? 'not-allowed' : 'grab' },
            ] as any}
          >
            <ChevronRight color={Colors.primary} size={24} />
          </Animated.View>
        </Pressable>
      ) : (
        <Animated.View
          style={thumbStyle}
          {...panResponder.panHandlers}
        >
          <ChevronRight color={Colors.primary} size={24} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerDisabled: {
    opacity: 0.6,
  },
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
  thumbInner: {
    zIndex: 2,
    width: BUTTON_HEIGHT - BUTTON_PADDING * 2,
    height: BUTTON_HEIGHT - BUTTON_PADDING * 2,
    borderRadius: (BUTTON_HEIGHT - BUTTON_PADDING * 2) / 2,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
