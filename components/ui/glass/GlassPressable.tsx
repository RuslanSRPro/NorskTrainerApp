import { ReactNode, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function GlassPressable({
  children,
  style,
  contentStyle,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  ...props
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 28,
      bounciness: 7,
    }).start();
  }

  function handlePressIn(event: GestureResponderEvent) {
    animateTo(pressedScale);
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    animateTo(1);
    onPressOut?.(event);
  }

  return (
    <Pressable
      {...props}
      style={style}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[contentStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}