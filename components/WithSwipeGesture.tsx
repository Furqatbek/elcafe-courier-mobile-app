import React, { useRef, useCallback } from 'react';
import { View, Animated, PanResponder, StyleSheet, GestureResponderEvent, PanResponderGestureState, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

// How far the screen may be dragged. The old code let the finger drag it the
// full width and then animated it the rest of the way off-screen before
// navigating — which is what produced the blank white page: nothing is rendered
// behind a tab screen, so once it slid away the window was empty, and it stayed
// empty for the whole 200ms animation plus however long the next route took to
// mount. Capping the travel keeps most of the screen on-screen at all times, so
// there is never a moment with nothing to look at.
const MAX_DRAG = SCREEN_WIDTH * 0.25;

// Ignore repeat swipes for this long after one is accepted. The previous guard
// was a state variable read from inside a PanResponder built once with
// useRef — so every callback closed over `isNavigating` from the first render,
// where it is always false. The guard never fired, and a fast double-swipe
// could navigate twice.
const NAVIGATION_COOLDOWN_MS = 400;

interface TabRoute {
  name: string;
  path: string;
}

/**
 * The tab order, which MUST match app/(tabs)/_layout.tsx: swiping left goes to
 * the next entry here, so a list in a different order sends the courier to the
 * wrong screen. Defined once and imported, rather than copied into each screen.
 */
export const TAB_ROUTES: TabRoute[] = [
  { name: 'orders', path: '/(tabs)/orders' },
  { name: 'finance', path: '/(tabs)/finance' },
  { name: 'settings', path: '/(tabs)/settings' },
];

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
  const translateX = useRef(new Animated.Value(0)).current;

  // The PanResponder is created once, so anything it reads must come from a ref
  // rather than from props or state captured in that first render.
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const currentIndexRef = useRef(0);
  currentIndexRef.current = routes.findIndex(r => r.name === currentRouteName);
  const navigatingUntilRef = useRef(0);
  const routerRef = useRef(router);
  routerRef.current = router;

  // Belt and braces: whatever happened during the last gesture — an animation
  // interrupted by a re-render, a navigation that unmounted us mid-flight — a
  // focused screen is always at rest in its normal position. Without this, a
  // single stranded value leaves the tab permanently blank with no way back.
  useFocusEffect(
    useCallback(() => {
      translateX.setValue(0);
    }, [translateX])
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (Date.now() < navigatingUntilRef.current) return false;
        const horizontalDistance = Math.abs(gestureState.dx);
        const verticalDistance = Math.abs(gestureState.dy);
        return horizontalDistance > 15 && horizontalDistance > verticalDistance * 2;
      },
      onMoveShouldSetPanResponderCapture: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (Date.now() < navigatingUntilRef.current) return false;
        const horizontalDistance = Math.abs(gestureState.dx);
        const verticalDistance = Math.abs(gestureState.dy);
        return horizontalDistance > 15 && horizontalDistance > verticalDistance * 2;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const currentIndex = currentIndexRef.current;
        const atStart = currentIndex === 0 && gestureState.dx > 0;
        const atEnd = currentIndex === routesRef.current.length - 1 && gestureState.dx < 0;

        // Rubber-band harder at the ends, where there is no tab to swipe to.
        const resistance = atStart || atEnd ? 0.2 : 1;
        const raw = gestureState.dx * resistance;

        // Clamp so the screen can never be dragged out of view.
        translateX.setValue(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, raw)));
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { dx, vx } = gestureState;
        const currentIndex = currentIndexRef.current;
        const tabs = routesRef.current;

        let targetRoute: string | null = null;
        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD) {
          if (dx > 0 && currentIndex > 0) {
            targetRoute = tabs[currentIndex - 1].path;
          } else if (dx < 0 && currentIndex < tabs.length - 1) {
            targetRoute = tabs[currentIndex + 1].path;
          }
        }

        // Always return to rest, whether or not we navigate. The spring is
        // started BEFORE navigating and its completion is not depended on for
        // anything, so an interrupted animation cannot strand the screen.
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start();

        if (targetRoute) {
          navigatingUntilRef.current = Date.now() + NAVIGATION_COOLDOWN_MS;
          // navigate, not push: these are sibling tabs, not a stack. push()
          // appended a new entry every swipe, so the hardware back button
          // walked backwards through the whole swipe history instead of
          // leaving the tabs.
          routerRef.current.navigate(targetRoute as any);
        }
      },
      // A gesture cancelled by the system (an incoming call, a parent taking
      // over) never reaches onPanResponderRelease, so reset here too.
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start();
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
    // Whatever shows through beside a dragged screen is the app background, not
    // the bare window (which renders white in light mode and is what made the
    // glitch look like a crash rather than an animation).
    backgroundColor: Colors.background,
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
