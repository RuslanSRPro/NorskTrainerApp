export type GlassControlSize = 'compact' | 'regular' | 'large' | 'icon';

export const glassControls = {
  compact: { visualHeight: 40, minTouchHeight: 44, radius: 18, horizontalPadding: 14, fontSize: 14 },
  regular: { visualHeight: 48, minTouchHeight: 48, radius: 22, horizontalPadding: 18, fontSize: 15 },
  large: { visualHeight: 54, minTouchHeight: 54, radius: 25, horizontalPadding: 20, fontSize: 17 },
  icon: { visualHeight: 44, minTouchHeight: 44, radius: 22, horizontalPadding: 0, fontSize: 16 },
} as const;
