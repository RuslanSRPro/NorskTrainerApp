export type GlassTone = 'neutral' | 'accent' | 'danger' | 'warning' | 'success';

export const glassSemantic = {
  neutral: {
    lightTint: 'rgba(255,255,255,0.08)',
    darkTint: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.30)',
    text: '#FFFFFF',
  },
  accent: {
    lightTint: 'rgba(10,132,255,0.24)',
    darkTint: 'rgba(10,132,255,0.22)',
    border: 'rgba(90,170,255,0.54)',
    text: '#FFFFFF',
  },
  danger: {
    lightTint: 'rgba(255,92,92,0.18)',
    darkTint: 'rgba(255,92,92,0.16)',
    border: 'rgba(255,150,150,0.48)',
    text: '#FFFFFF',
  },
  warning: {
    lightTint: 'rgba(255,214,74,0.17)',
    darkTint: 'rgba(255,214,74,0.15)',
    border: 'rgba(255,232,140,0.48)',
    text: '#FFFFFF',
  },
  success: {
    lightTint: 'rgba(52,199,89,0.17)',
    darkTint: 'rgba(52,199,89,0.15)',
    border: 'rgba(145,245,180,0.48)',
    text: '#FFFFFF',
  },
} as const;
