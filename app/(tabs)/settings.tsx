import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsAISection } from '@/components/settings/SettingsAISection';
import { SettingsAboutSection } from '@/components/settings/SettingsAboutSection';
import { SettingsAppearanceSection } from '@/components/settings/SettingsAppearanceSection';
import { SettingsLanguageSection } from '@/components/settings/SettingsLanguageSection';
import { SettingsLearningSection } from '@/components/settings/SettingsLearningSection';
import { SettingsNotificationsSection } from '@/components/settings/SettingsNotificationsSection';
import { SettingsProfileSection } from '@/components/settings/SettingsProfileSection';
import { SettingsPronunciationSection } from '@/components/settings/SettingsPronunciationSection';
import { SettingsTrainingSection } from '@/components/settings/SettingsTrainingSection';
import { SettingsWallpaperSection } from '@/components/settings/SettingsWallpaperSection';

import { WallpaperLayer } from '@/design-system/wallpaper';
import { AppLanguage, t } from '@/services/i18n';
import { useAppTheme } from '@/services/theme';
import { useSettingsStore } from '@/store/settingsStore';

export default function SettingsScreen() {
  const { loading, app_language, theme, loadSettings } = useSettingsStore();
  const { colors } = useAppTheme();

  const lang = (app_language as AppLanguage) || 'ua';
  const T = (key: Parameters<typeof t>[0]) => t(key, lang);
  const isDark = theme === 'dark';

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <WallpaperLayer dark={isDark}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </SafeAreaView>
      </WallpaperLayer>
    );
  }

  return (
    <WallpaperLayer dark={isDark}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <ScreenHeader icon="⚙️" title={T('settings')} />

          <SettingsProfileSection lang={lang} />
          <SettingsLanguageSection lang={lang} />
          <SettingsAppearanceSection lang={lang} />
          <SettingsWallpaperSection lang={lang} />
          <SettingsLearningSection lang={lang} />
          <SettingsTrainingSection lang={lang} />
          <SettingsPronunciationSection lang={lang} />
          <SettingsNotificationsSection lang={lang} />
          <SettingsAISection lang={lang} />
          <SettingsAboutSection lang={lang} />
        </ScrollView>
      </SafeAreaView>
    </WallpaperLayer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    padding: 20,
    paddingBottom: 130,
  },
});