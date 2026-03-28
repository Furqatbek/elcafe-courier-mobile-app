import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, PanResponder, Dimensions, StyleSheet, GestureResponderEvent, PanResponderGestureState } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface SwipeableTabsProps {
  children: React.ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

export const SwipeableTabs: React.FC<SwipeableTabsProps> = ({
  children,
  activeIndex,
  onIndexChange,
}) => {
  const scrollX = useRef(new Animated.Value(-activeIndex * SCREEN_WIDTH)).current;
  const [scrollValue, setScrollValue] = useState(-activeIndex * SCREEN_WIDTH);
  const offsetX = useRef(0);

  useEffect(() => {
    Animated.spring(scrollX, {
      toValue: -activeIndex * SCREEN_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start(() => {
      offsetX.current = -activeIndex * SCREEN_WIDTH;
    });
  }, [activeIndex, scrollX]);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      setScrollValue(value);
    });
    return () => {
      scrollX.removeListener(id);
    };
  }, [scrollX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: () => {
        offsetX.current = scrollValue;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const newValue = offsetX.current + gestureState.dx;
        const maxScroll = 0;
        const minScroll = -(children.length - 1) * SCREEN_WIDTH;
        
        let clampedValue = newValue;
        if (newValue > maxScroll) {
          clampedValue = maxScroll + (newValue - maxScroll) * 0.2;
        } else if (newValue < minScroll) {
          clampedValue = minScroll + (newValue - minScroll) * 0.2;
        }
        
        scrollX.setValue(clampedValue);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        let newIndex = activeIndex;

        if (gestureState.dx < -SWIPE_THRESHOLD && activeIndex < children.length - 1) {
          newIndex = activeIndex + 1;
        } else if (gestureState.dx > SWIPE_THRESHOLD && activeIndex > 0) {
          newIndex = activeIndex - 1;
        } else {
          newIndex = Math.round(-scrollValue / SCREEN_WIDTH);
          newIndex = Math.max(0, Math.min(children.length - 1, newIndex));
        }

        if (newIndex !== activeIndex) {
          onIndexChange(newIndex);
        } else {
          Animated.spring(scrollX, {
            toValue: -activeIndex * SCREEN_WIDTH,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }).start(() => {
            offsetX.current = -activeIndex * SCREEN_WIDTH;
          });
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.pagesContainer,
          {
            transform: [{ translateX: scrollX }],
          },
        ]}
      >
        {children.map((child, index) => (
          <View key={index} style={styles.page}>
            {child}
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  pagesContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});
