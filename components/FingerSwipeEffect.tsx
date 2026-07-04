import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import Colors from '@/constants/colors';

const MAX_PARTICLES = 25;
const PARTICLE_SIZE = 20;

export function FingerSwipeEffect({ children }: { children: React.ReactNode }) {
  const nextParticleIndex = useRef(0);
  
  // Create a pool of particles
  const particles = useMemo(() => {
    return Array.from({ length: MAX_PARTICLES }).map((_, i) => ({
      id: i,
      anim: new Animated.Value(0),
      position: new Animated.ValueXY({ x: -100, y: -100 }),
      scale: new Animated.Value(1),
    }));
  }, []);

  const handlePointerMove = (e: any) => {
    // Only work on native or web if supported
    // e.nativeEvent is available
    const { pageX, pageY } = e.nativeEvent;

    const index = nextParticleIndex.current;
    nextParticleIndex.current = (index + 1) % MAX_PARTICLES;

    const particle = particles[index];

    // Reset particle
    particle.anim.setValue(0);
    particle.scale.setValue(1);
    particle.position.setValue({ x: pageX, y: pageY });

    // Animate
    Animated.parallel([
      Animated.timing(particle.anim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web', // Native driver works for opacity/transform
      }),
      Animated.timing(particle.scale, {
        toValue: 0,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  return (
    <View style={styles.container} onPointerMove={handlePointerMove} pointerEvents="box-none">
      {children}
      <View style={styles.overlay} pointerEvents="none">
        {particles.map((p) => (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                opacity: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  { translateX: p.position.x },
                  { translateY: p.position.y },
                  { scale: p.scale },
                  { translateX: -PARTICLE_SIZE / 2 }, // Center the particle
                  { translateY: -PARTICLE_SIZE / 2 },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, // Ensure it's on top visually
    elevation: 9999,
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    borderRadius: PARTICLE_SIZE / 2,
    backgroundColor: Colors.primary, // Use primary color
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});
