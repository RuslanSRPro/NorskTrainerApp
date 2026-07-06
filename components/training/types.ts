import { ReactNode } from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { TrainingMode } from '@/services/settings';

export type TrainingTask = {
  id: string;
  mode: TrainingMode;
  word: any;
  prompt?: string;
  expected?: string;
  options?: string[];
  formLabel?: string;
};

export type TrainingFormItem = {
  label: string;
  value: string;
};

export type TrainingTone = 'hard' | 'ok' | 'easy';

export type TrainingTextColors = {
  textColor: string;
  mutedColor: string;
  accent: string;
};

export type TrainingGlassBaseProps = {
  isDark: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export type TrainingButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};