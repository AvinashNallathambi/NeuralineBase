/**
 * CustomSpinner — animated dual-ring spinner with Neuraline teal gradient.
 *
 * Replaces the default ActivityIndicator with a branded spinner that
 * matches the app's visual identity. Uses Reanimated for smooth rotation.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const PRIMARY = '#0D7C8A';
const PRIMARY_LIGHT = '#5EC4D0';

export const CustomSpinner: React.FC<{ size?: number; color?: string }> = ({
  size = 40,
  color = PRIMARY,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${-rotation.value * 1.5}deg` }],
  }));

  const outerSize = size;
  const innerSize = size * 0.6;
  const borderW = size * 0.08;

  return (
    <View style={[styles.container, { width: outerSize, height: outerSize }]}>
      {/* Outer ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: outerSize,
            height: outerSize,
            borderWidth: borderW,
            borderRadius: outerSize / 2,
            borderLeftColor: color,
            borderTopColor: color,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
          },
          outerRingStyle,
        ]}
      />
      {/* Inner ring (counter-rotating) */}
      <Animated.View
        style={[
          styles.innerRing,
          {
            width: innerSize,
            height: innerSize,
            borderWidth: borderW * 0.8,
            borderRadius: innerSize / 2,
            borderLeftColor: 'transparent',
            borderTopColor: PRIMARY_LIGHT,
            borderRightColor: PRIMARY_LIGHT,
            borderBottomColor: 'transparent',
          },
          innerRingStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
  },
  innerRing: {
    position: 'absolute',
  },
});
