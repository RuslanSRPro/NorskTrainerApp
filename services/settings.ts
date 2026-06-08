import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type AppLanguage = 'ua' | 'en';
export type TranslationMode = 'ua' | 'en' | 'ua_en';
export type CategoryFilter = 'all' | 'verbs' | 'nouns' | 'adjectives' | 'adverbs' | 'expressions';
export type StudySet = 'all' | 'new' | 'weak' | 'due';
export type DailyLimit = 20 | 50 | 100 | 200;
export type TrainingMode = 'flashcards' | 'choice' | 'typing' | 'cloze' | 'forms';
export type TrainingFlow = 'reinforcement' | 'one_per_word';
export type TrainingLayout = 'standard' | 'sentence_first';

export type UserSettings = {
  preferred_user:         string;
  app_language:           AppLanguage;
  translation_mode:       TranslationMode;
  category_filter:        CategoryFilter;
  study_set:              StudySet;
  daily_limit:            DailyLimit;
  training_modes:         TrainingMode[];
  mix_modes:              boolean;
  training_flow:          TrainingFlow;
  training_layout:        TrainingLayout;
  auto_pronounce:         boolean;
  pronounce_forms:        boolean;
  pronounce_after_answer: boolean;
  speech_rate:            number;
};

export type ProfileRecord = {
  id:           string;
  profile_key:  string;
  display_name: string;
  email:        string | null;
  sync_code:    string | null;
};

export type UserRecord = {
  user_id:      string;
  display_name: string;
  email:        string | null;
  sync_code:    string | null;
  created_at?:  string;
};

export const DEFAULT_SETTINGS: UserSettings = {
  preferred_user:         'user1',
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

const STORAGE_USER_ID_KEY  = 'norsk_trainer_user_id';
const STORAGE_DISPLAY_NAME = 'norsk_trainer_display_name';

// ============================================================
// ID generation
// ============================================================

function generateUserId(): string {
  return 'u_' + Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
}

function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ============================================================
// User management
// ============================================================

export async function getOrCreateUser(displayName?: string): Promise<UserRecord> {
  const storedId = await AsyncStorage.getItem(STORAGE_USER_ID_KEY);

  if (storedId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', storedId)
      .maybeSingle();

    if (data) {
      await AsyncStorage.setItem(STORAGE_DISPLAY_NAME, data.display_name);
      return data as UserRecord;
    }
  }

  const userId   = generateUserId();
  const syncCode = generateSyncCode();
  const name     = displayName || 'User';

  const { data: created, error } = await supabase
    .from('users')
    .insert({
      user_id:      userId,
      display_name: name,
      email:        null,
      sync_code:    syncCode,
    })
    .select('*')
    .single();

  if (error || !created) {
    const fallback: UserRecord = {
      user_id:      userId,
      display_name: name,
      email:        null,
      sync_code:    syncCode,
    };
    await AsyncStorage.setItem(STORAGE_USER_ID_KEY,  userId);
    await AsyncStorage.setItem(STORAGE_DISPLAY_NAME, name);
    return fallback;
  }

  await AsyncStorage.setItem(STORAGE_USER_ID_KEY,  userId);
  await AsyncStorage.setItem(STORAGE_DISPLAY_NAME, name);
  return created as UserRecord;
}

export async function getCurrentUserId(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_USER_ID_KEY);
  return stored || 'user1';
}

export async function getCurrentDisplayName(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_DISPLAY_NAME);
  return stored || 'User';
}

export async function updateUserProfile(params: {
  userId:       string;
  displayName?: string;
  email?:       string;
}): Promise<{ ok: boolean }> {
  const updates: any = { updated_at: new Date().toISOString() };

  if (params.displayName) {
    updates.display_name = String(params.displayName).trim();
    await AsyncStorage.setItem(STORAGE_DISPLAY_NAME, updates.display_name);
  }

  if (params.email) {
    updates.email = String(params.email).trim().toLowerCase();
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('user_id', params.userId);

  if (error) console.error('updateUserProfile error:', error.message);
  return { ok: true };
}

export async function regenerateSyncCode(userId: string): Promise<string> {
  const newCode = generateSyncCode();

  const { error } = await supabase
    .from('users')
    .update({ sync_code: newCode, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return newCode;
}

export async function restoreUserByEmail(params: {
  email:    string;
  syncCode: string;
}): Promise<UserRecord> {
  const email    = String(params.email    || '').trim().toLowerCase();
  const syncCode = String(params.syncCode || '').trim().toUpperCase();

  if (!email)    throw new Error('Email is empty');
  if (!syncCode) throw new Error('Sync code is empty');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('sync_code', syncCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('User not found. Check email and sync code.');

  await AsyncStorage.setItem(STORAGE_USER_ID_KEY,  data.user_id);
  await AsyncStorage.setItem(STORAGE_DISPLAY_NAME, data.display_name);

  return data as UserRecord;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

// ============================================================
// Profiles — обратная совместимость
// ============================================================

export async function getProfiles(): Promise<ProfileRecord[]> {
  const userId      = await getCurrentUserId();
  const displayName = await getCurrentDisplayName();

  return [
    {
      id:           userId,
      profile_key:  userId,
      display_name: displayName,
      email:        null,
      sync_code:    null,
    },
  ];
}

export async function updateProfileName(
  profileKey: string,
  displayName: string,
): Promise<{ ok: boolean }> {
  return updateUserProfile({ userId: profileKey, displayName });
}

export async function updateProfileIdentity(params: {
  profileKey:  string;
  displayName: string;
  email?:      string;
  syncCode?:   string;
}): Promise<{ ok: boolean }> {
  return updateUserProfile({
    userId:      params.profileKey,
    displayName: params.displayName,
    email:       params.email,
  });
}

export async function connectProfileByEmail(params: {
  email:    string;
  syncCode: string;
}): Promise<ProfileRecord> {
  const user = await restoreUserByEmail(params);
  return {
    id:           user.user_id,
    profile_key:  user.user_id,
    display_name: user.display_name,
    email:        user.email,
    sync_code:    user.sync_code,
  };
}

// ============================================================
// Settings
// ============================================================

function normalizeTrainingFlow(value: unknown): TrainingFlow {
  if (value === 'one_per_word') return 'one_per_word';
  return 'reinforcement';
}

function normalizeTrainingLayout(value: unknown): TrainingLayout {
  if (value === 'sentence_first') return 'sentence_first';
  return 'standard';
}

function normalizeSettings(
  data: Partial<UserSettings> | null | undefined,
  preferredUser: string,
): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    preferred_user:   data?.preferred_user   || preferredUser,
    app_language:     data?.app_language     || DEFAULT_SETTINGS.app_language,
    translation_mode: data?.translation_mode || DEFAULT_SETTINGS.translation_mode,
    category_filter:  data?.category_filter  || DEFAULT_SETTINGS.category_filter,
    study_set:        data?.study_set        || DEFAULT_SETTINGS.study_set,
    daily_limit:      data?.daily_limit      || DEFAULT_SETTINGS.daily_limit,
    training_modes:
      data?.training_modes && data.training_modes.length > 0
        ? data.training_modes
        : DEFAULT_SETTINGS.training_modes,
    mix_modes:
      typeof data?.mix_modes === 'boolean'
        ? data.mix_modes
        : DEFAULT_SETTINGS.mix_modes,
    training_flow:          normalizeTrainingFlow(data?.training_flow),
    training_layout:        normalizeTrainingLayout(data?.training_layout),
    auto_pronounce:
      typeof data?.auto_pronounce === 'boolean'
        ? data.auto_pronounce
        : DEFAULT_SETTINGS.auto_pronounce,
    pronounce_forms:
      typeof data?.pronounce_forms === 'boolean'
        ? data.pronounce_forms
        : DEFAULT_SETTINGS.pronounce_forms,
    pronounce_after_answer:
      typeof data?.pronounce_after_answer === 'boolean'
        ? data.pronounce_after_answer
        : DEFAULT_SETTINGS.pronounce_after_answer,
    speech_rate:
      typeof data?.speech_rate === 'number'
        ? data.speech_rate
        : DEFAULT_SETTINGS.speech_rate,
  };
}

export async function getUserSettings(selectedUser?: string): Promise<UserSettings> {
  const userId = selectedUser || await getCurrentUserId();

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return normalizeSettings(null, userId);
    return normalizeSettings(data, userId);
  } catch {
    return normalizeSettings(null, userId);
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<{ ok: boolean }> {
  const userId = settings.preferred_user || await getCurrentUserId();

  const payload = {
    user_id:                userId,
    preferred_user:         userId,
    app_language:           settings.app_language,
    translation_mode:       settings.translation_mode,
    category_filter:        settings.category_filter,
    study_set:              settings.study_set,
    daily_limit:            settings.daily_limit,
    training_modes:         settings.training_modes,
    mix_modes:              settings.mix_modes,
    training_flow:          settings.training_flow,
    training_layout:        settings.training_layout,
    auto_pronounce:         settings.auto_pronounce,
    pronounce_forms:        settings.pronounce_forms,
    pronounce_after_answer: settings.pronounce_after_answer,
    speech_rate:            settings.speech_rate,
    updated_at:             new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) console.error('Save settings error:', error);
  } catch (e) {
    console.error('Save settings exception:', e);
  }

  return { ok: true };
}