import { useRef } from 'react';
import { Animated, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  disabled?: boolean;
  hitSlop?: number;
}

export default function PressableScale({
  children,
  onPress,
  style,
  scaleValue = 0.95,
  disabled,
  hitSlop,
}: Props) {
  const anim = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(anim, {
      toValue: scaleValue,
      damping: 22,
      stiffness: 500,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  }

  function onPressOut() {
    Animated.spring(anim, {
      toValue: 1,
      damping: 16,
      stiffness: 300,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      disabled={disabled}
      hitSlop={hitSlop ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop } : undefined}
    >
      <Animated.View style={[style, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
