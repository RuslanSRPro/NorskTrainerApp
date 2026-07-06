import { createContext, ReactNode, useContext } from 'react';

import { AppLanguage } from '@/services/i18n';

import { TrainingTask } from './types';

type TrainingContextValue = {
  currentTask: TrainingTask;
  current: any;
  isDark: boolean;
  s: any;

  appLanguage: AppLanguage;
  taskTitle: string;
  textColor: string;
  mutedColor: string;
  fonts: any;

  answerVisible: boolean;
  typedAnswer: string;
  feedback: string;
  savingReview: boolean;
  reviewSaved: boolean;

  ui: (key: any) => string;

  getCategoryLabel: (cat: string) => string;
  getMainWord: (w: any) => string;
  getImageUrl: (w: any) => string;
  getTranslation: (w: any) => string;
  getAllForms: (w: any) => { label: string; value: string }[];
  getClozeHint: (w: any) => string;

  hasVerification: (w: any) => boolean;
  hasRelations: (w: any) => boolean;

  speakCurrentTask: () => void;
  selectChoice: (option: string) => void;
  setTypedAnswer: (value: string) => void;
  checkTyped: () => void;
  onToggleFlashcard: () => void;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

type ProviderProps = TrainingContextValue & {
  children: ReactNode;
};

export function TrainingProvider({ children, ...value }: ProviderProps) {
  return (
    <TrainingContext.Provider value={value}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);

  if (!context) {
    throw new Error('useTraining must be used inside TrainingProvider');
  }

  return context;
}

export type { TrainingContextValue };