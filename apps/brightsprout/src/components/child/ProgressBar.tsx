import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, BorderRadius } from '../../theme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  showLabel?: boolean;
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
  animated?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  color = Colors.child.progressFill,
  trackColor = Colors.child.progressTrack,
  showLabel = false,
  labelPosition = 'right',
  animated = true,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const animatedWidth = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: clampedProgress,
        duration: 400,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress, animated, animatedWidth]);

  const animatedFillStyle = {
    width: animatedWidth.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
      extrapolate: 'clamp',
    }),
  };

  const staticFillStyle = {
    width: `${clampedProgress}%` as const,
  };

  const labelText = <Text style={styles.label}>{clampedProgress}%</Text>;

  const hasTopLabel = showLabel && labelPosition === 'top';
  const hasBottomLabel = showLabel && labelPosition === 'bottom';
  const hasLeftLabel = showLabel && labelPosition === 'left';
  const hasRightLabel = showLabel && labelPosition === 'right';

  const bar = (
    <View style={styles.barContainer}>
      <View
        style={[
          styles.track,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: trackColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: color,
            },
            animated ? animatedFillStyle : staticFillStyle,
          ]}
        />
      </View>
      {hasRightLabel ? labelText : null}
    </View>
  );

  if (hasTopLabel) {
    return (
      <View>
        <View style={styles.labelTopRow}>{labelText}</View>
        {bar}
      </View>
    );
  }

  if (hasBottomLabel) {
    return (
      <View>
        {bar}
        <View style={styles.labelBottomRow}>{labelText}</View>
      </View>
    );
  }

  if (hasLeftLabel) {
    return (
      <View style={styles.barContainer}>
        {labelText}
        <View style={styles.barFlex}>
          <View
            style={[
              styles.track,
              {
                height,
                borderRadius: height / 2,
                backgroundColor: trackColor,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.fill,
                {
                  height,
                  borderRadius: height / 2,
                  backgroundColor: color,
                },
                animated ? animatedFillStyle : staticFillStyle,
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  return bar;
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  barFlex: {
    flex: 1,
    marginLeft: 8,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  label: {
    ...Typography.caption,
    fontWeight: '700',
    marginLeft: 8,
    color: Colors.child.textLight,
    minWidth: 36,
    textAlign: 'right',
  },
  labelTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  labelBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
});

export default ProgressBar;
