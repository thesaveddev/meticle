import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { AnimationType } from '../../types';

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
  delay?: number;
  animation?: AnimationType;
  onAnimationEnd?: () => void;
}

const AnimatedView: React.FC<AnimatedViewProps> = ({
  children,
  style,
  duration = 300,
  delay = 0,
  animation = 'fadeIn',
  onAnimationEnd,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(animation === 'slideUp' ? 24 : 0)).current;

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      const compositeAnimations: Animated.CompositeAnimation[] = [];

      compositeAnimations.push(
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
        }),
      );

      if (animation === 'slideUp') {
        compositeAnimations.push(
          Animated.timing(translateY, {
            toValue: 0,
            duration,
            delay,
            useNativeDriver: true,
          }),
        );
      }

      Animated.parallel(compositeAnimations).start(({ finished }) => {
        if (finished && onAnimationEnd) {
          onAnimationEnd();
        }
      });
    },
    [opacity, translateY, duration, delay, animation, onAnimationEnd],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const compositeAnimations: Animated.CompositeAnimation[] = [];

      compositeAnimations.push(
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay: 0,
          useNativeDriver: true,
        }),
      );

      if (animation === 'slideUp') {
        compositeAnimations.push(
          Animated.timing(translateY, {
            toValue: 0,
            duration,
            delay: 0,
            useNativeDriver: true,
          }),
        );
      }

      Animated.parallel(compositeAnimations).start(({ finished }) => {
        if (finished && onAnimationEnd) {
          onAnimationEnd();
        }
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [opacity, translateY, duration, delay, animation, onAnimationEnd]);

  return (
    <Animated.View
      style={[styles.base, style, { opacity, transform: [{ translateY }] }]}
      onLayout={handleLayout}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default AnimatedView;
