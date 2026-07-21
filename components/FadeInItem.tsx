import { useRef, useEffect } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  delay?: number;
  from?: 'bottom' | 'top' | 'left' | 'right';
  distance?: number;
  style?: ViewStyle;
}

export default function FadeInItem({
  children,
  delay = 0,
  from = 'bottom',
  distance = 16,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(
    from === 'bottom' ? distance : from === 'top' ? -distance : 0,
  )).current;
  const translateX = useRef(new Animated.Value(
    from === 'left' ? -distance : from === 'right' ? distance : 0,
  )).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        delay,
        damping: 20,
        stiffness: 200,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        delay,
        damping: 20,
        stiffness: 200,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isHorizontal = from === 'left' || from === 'right';

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: isHorizontal
            ? [{ translateX }]
            : [{ translateY: translate }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
