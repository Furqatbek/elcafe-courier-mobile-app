import React, { useRef, useState, useEffect } from 'react';
import { View, Animated, PanResponder, StyleSheet, GestureResponderEvent, PanResponderGestureState, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

interface TabRoute {
  name: string;
  path: string;
}

interface WithSwipeGestureProps {
  routes: TabRoute[];
  currentRouteName: string;
  children: React.ReactNode;
}

export const WithSwipeGesture: React.FC<WithSwipeGestureProps> = ({
  routes,
  currentRouteName,
  children,
}) => {
  const router = useRouter();
  const currentIndex = routes.findIndex(r => r.name === currentRouteName);
  const translateX = useRef(new Animated.Value(0)).current;
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    translateX.setValue(0);
  }, [currentRouteName, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (isNavigating) return false;
        const horizontalDistance = Math.abs(gestureState.dx);
        const verticalDistance = Math.abs(gestureState.dy);
        return horizontalDistance > 15 && horizontalDistance > verticalDistance * 2;
      },
      onMoveShouldSetPanResponderCapture: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (isNavigating) return false;
        const horizontalDistance = Math.abs(gestureState.dx);
        const verticalDistance = Math.abs(gestureState.dy);
        return horizontalDistance > 15 && horizontalDistance > verticalDistance * 2;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        let newValue = gestureState.dx;
        
        if (currentIndex === 0 && gestureState.dx > 0) {
          newValue = gestureState.dx * 0.2;
        } else if (currentIndex === routes.length - 1 && gestureState.dx < 0) {
          newValue = gestureState.dx * 0.2;
        }
        
        translateX.setValue(newValue);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { dx, vx } = gestureState;
        let shouldNavigate = false;
        let targetRoute: string | null = null;
        
        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD) {
          if (dx > 0 && currentIndex > 0) {
            shouldNavigate = true;
            targetRoute = routes[currentIndex - 1].path;
          } else if (dx < 0 && currentIndex < routes.length - 1) {
            shouldNavigate = true;
            targetRoute = routes[currentIndex + 1].path;
          }
        }
        
        if (shouldNavigate && targetRoute) {
          setIsNavigating(true);
          const targetValue = dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
          
          Animated.timing(translateX, {
            toValue: targetValue,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            router.push(targetRoute as any);
            translateX.setValue(0);
            setIsNavigating(false);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  animatedContainer: {
    flex: 1,
  },
});
