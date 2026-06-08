import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  AppLanguage,
  CategoryFilter,
  DailyLimit,
  getUserSettings,
  saveUserSettings,
  StudySet,
  TrainingFlow,
  TrainingLayout,
  TranslationMode,
  UserSettings,
} from '@/services/settings';

import { getCurrentUserId } from '@/store/authStore';

const TRAINING_LAYOUT_KEY = 'norsk_trainer_training_layout';

type SettingsState = UserSettings & {
  loading: boolean;
  saving:  boolean;

  loadSettings:  () => Promise<void>;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  saveSettings:  () => Promise<void>;
};

const DEFAULT_SETTINGS: UserSettings = {
  preferred_user:         '',
  app_language:           'ua',
  translation_mode:       'ua',
  category_filter:        'all',
  study_set:              'all',
  daily_limit:            50,
  training_modes:         ['flashcards'],
  mix_modes:              true,
  training_flow:          'reinforcement',
  training_layout:        'standard',
  auto_pronounce:         false,
  pronounce_forms:        false,
  pronounce_after_answer: false,
  speech_rate:            0.85,
};

function normalizeSettings(
  settings?: Partial<UserSettings> | null,
  userId?: string,
): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    preferred_user: userId || DEFAULT_SETTINGS.preferred_user,
    training_modes:
      settings?.training_modes && settings.training_modes.length > 0
        ? settings.training_modes
        : DEFAULT_SETTINGS.training_modes,
    mix_modes:
      typeof settings?.mix_modes === 'boolean'
        ? settings.mix_modes
        : DEFAULT_SETTINGS.mix_modes,
    training_flow:
      settings?.training_flow === 'one_per_word' ? 'one_per_word' : 'reinforcement',
    training_layout:
      settings?.training_layout === 'sentence_first' ? 'sentence_first' : 'standard',
    auto_pronounce:
      typeof settings?.auto_pronounce === 'boolean'
        ? settings.auto_pronounce
        : DEFAULT_SETTINGS.auto_pronounce,
    pronounce_forms:
      typeof settings?.pronounce_forms === 'boolean'
        ? settings.pronounce_forms
        : DEFAULT_SETTINGS.pronounce_forms,
    pronounce_after_answer:
      typeof settings?.pronounce_after_answer === 'boolean'
        ? settings.pronounce_after_answer
        : DEFAULT_SETTINGS.pronounce_after_answer,
    speech_rate:
      typeof settings?.speech_rate === 'number'
        ? settings.speech_rate
        : DEFAULT_SETTINGS.speech_rate,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loading: false,
  saving:  false,

  async loadSettings() {
    try {
      set({ loading: true });

      // Використовуємо Auth UUID — не старий u_xxx
      const userId = getCurrentUserId();
      if (!userId || userId === 'anonymous') {
        set({ ...DEFAULT_SETTINGS, loading: false });
        return;
      }

      // Завантажуємо налаштування для цього UUID
      let settings: Partial<UserSettings> | null = null;
      try {
        settings = await getUserSettings(userId);
      } catch {
        // Нема збережених налаштувань — використаємо дефолтні
      }

      const normalizedSettings = normalizeSettings(settings, userId);
      const storedLayout = await AsyncStorage.getItem(TRAINING_LAYOUT_KEY);
      const trainingLayout: TrainingLayout =
        storedLayout === 'sentence_first' ? 'sentence_first' : normalizedSettings.training_layout;

      set({
        ...normalizedSettings,
        preferred_user:  userId,
        training_layout: trainingLayout,
        loading:         false,
      });

      await AsyncStorage.setItem(TRAINING_LAYOUT_KEY, trainingLayout);
    } catch (error) {
      console.log('Settings store load error:', error);
      set({ ...DEFAULT_SETTINGS, loading: false });
    }
  },

  updateSetting(key, value) {
    set({ [key]: value } as Pick<SettingsState, typeof key>);
  },

  async saveSettings() {
    try {
      set({ saving: true });
      const state = get();

      await saveUserSettings({
        preferred_user:         state.preferred_user,
        app_language:           state.app_language           as AppLanguage,
        translation_mode:       state.translation_mode       as TranslationMode,
        category_filter:        state.category_filter        as CategoryFilter,
        study_set:              state.study_set              as StudySet,
        daily_limit:            state.daily_limit            as DailyLimit,
        training_modes:         state.training_modes,
        mix_modes:              state.mix_modes,
        training_flow:          state.training_flow          as TrainingFlow,
        training_layout:        state.training_layout        as TrainingLayout,
        auto_pronounce:         state.auto_pronounce,
        pronounce_forms:        state.pronounce_forms,
        pronounce_after_answer: state.pronounce_after_answer,
        speech_rate:            state.speech_rate,
      });

      await AsyncStorage.setItem(TRAINING_LAYOUT_KEY, state.training_layout);
      set({ saving: false });
    } catch (error) {
      console.log('Settings store save error:', error);
      set({ saving: false });
      throw error;
    }
  },
}));