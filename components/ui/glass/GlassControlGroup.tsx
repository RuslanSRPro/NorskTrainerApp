import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type Props = { children: ReactNode; spacing?: number; style?: StyleProp<ViewStyle> };

/**
 * Interaction-safe control group. We intentionally keep Pressables as direct
 * React Native layout children instead of putting them inside GlassContainer:
 * native glass is rendered inside each GlassControl while this wrapper owns
 * only row geometry. This keeps hit-testing deterministic.
 */
export function GlassControlGroup({ children, style }: Props) {
  return <View style={style}>{children}</View>;
}
