import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import {
  GlassMaterialVariant,
  GlassShapeVariant,
  GlassSurfaceVariant,
} from '@/design-system/glass';

import { GlassSurface } from './glass/GlassSurface';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  dark?: boolean;
  intensity?: number;

  variant?: GlassSurfaceVariant;
  material?: GlassMaterialVariant;
  shape?: GlassShapeVariant;
};

export function GlassCard({
  children,
  style,
  innerStyle,
  dark = false,
  intensity,
  variant = 'card',
  material,
  shape,
}: Props) {
  return (
    <GlassSurface
      variant={variant}
      material={material}
      shape={shape}
      dark={dark}
      intensity={intensity}
      style={style}
      contentStyle={innerStyle}
    >
      {children}
    </GlassSurface>
  );
}