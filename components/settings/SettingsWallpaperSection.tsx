import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { useWallpaper } from '@/design-system/wallpaper';
import { wallpapers, WallpaperKey } from '@/design-system/wallpaper/wallpapers';
import { AppLanguage } from '@/services/i18n';
import { useAppTheme } from '@/services/theme';

import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

type WallpaperItem = {
  id: string;
  title: string;
  group: string;
  image?: any;
  palette?: readonly [string, string, string];
};

export function SettingsWallpaperSection({ lang }: Props) {
  const {
    wallpaper,
    effectiveWallpaper,
    wallpaperMode,
    customUri,
    setWallpaper,
    setFollowTheme,
    pickCustomWallpaper,
    clearCustomWallpaper,
  } = useWallpaper();

  const { colors, scale } = useAppTheme();
  const [visible, setVisible] = useState(false);

  const sectionTitle = lang === 'ua' ? 'Шпалери' : lang === 'no' ? 'Bakgrunn' : 'Wallpaper';
  const wallpaperTitle = lang === 'ua' ? 'Фон застосунку' : lang === 'no' ? 'Appbakgrunn' : 'App wallpaper';
  const followThemeTitle = lang === 'ua' ? 'За темою' : lang === 'no' ? 'Følg tema' : 'Follow theme';
  const themeTitle = lang === 'ua' ? 'Теми' : lang === 'no' ? 'Temaer' : 'Themes';
  const natureTitle = lang === 'ua' ? 'Норвегія' : lang === 'no' ? 'Norge' : 'Norway';
  const classicTitle = lang === 'ua' ? 'Класичні' : lang === 'no' ? 'Klassiske' : 'Classic';
  const customTitle = lang === 'ua' ? 'Власне фото' : lang === 'no' ? 'Eget bilde' : 'Custom photo';
  const choosePhotoTitle = lang === 'ua' ? 'Обрати фото' : lang === 'no' ? 'Velg bilde' : 'Choose photo';
  const removePhotoTitle = lang === 'ua' ? 'Прибрати фото' : lang === 'no' ? 'Fjern bilde' : 'Remove photo';

  const items = useMemo<WallpaperItem[]>(() => {
    return Object.values(wallpapers).map((item) => {
      const group = item.key.startsWith('theme_')
        ? themeTitle
        : item.key.startsWith('gradient_')
          ? classicTitle
          : natureTitle;

      return {
        id: item.key,
        title: item.name,
        group,
        image: item.image,
        palette: item.palette,
      };
    });
  }, [classicTitle, natureTitle, themeTitle]);

  function label() {
    if (wallpaperMode === 'follow_theme') return followThemeTitle;
    if (wallpaperMode === 'custom' && customUri) return customTitle;
    return wallpapers[wallpaper]?.name || wallpaper;
  }

  async function chooseBuiltIn(id: string) {
    await setWallpaper(id as WallpaperKey);
    setVisible(false);
  }

  async function chooseCustom() {
    await pickCustomWallpaper();
    setVisible(false);
  }

  async function removeCustom() {
    await clearCustomWallpaper();
    setVisible(false);
  }

  async function followTheme() {
    await setFollowTheme();
    setVisible(false);
  }

  function renderPreview(item: WallpaperItem) {
    const active =
      wallpaperMode === 'follow_theme'
        ? item.id === effectiveWallpaper
        : wallpaperMode === 'built_in'
          ? item.id === wallpaper
          : false;

    return (
      <Pressable key={item.id} style={styles.previewItem} onPress={() => chooseBuiltIn(item.id)}>
        <View style={[styles.previewFrame, active && { borderColor: colors.accent }]}>
          {item.image ? (
            <ImageBackground source={item.image} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={item.palette as any} style={styles.previewImage} />
          )}
        </View>

        <Text numberOfLines={1} style={[styles.previewTitle, { color: colors.textPrimary, fontSize: scale(12) }]}>
          {item.title}
        </Text>
      </Pressable>
    );
  }

  const grouped = [themeTitle, natureTitle, classicTitle].map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));

  return (
    <>
      <GlassSettingsSection title={sectionTitle}>
        <GlassSettingsRow
          icon="🖼️"
          title={wallpaperTitle}
          value={label()}
          isLast
          onPress={() => setVisible(true)}
        />
      </GlassSettingsSection>

      <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable>
            <GlassSurface variant="sheet" style={styles.sheetWrap} contentStyle={styles.sheetContent}>
              <SafeAreaView edges={['bottom']}>
                <View style={styles.handle} />

                <Text style={[styles.title, { color: colors.textPrimary, fontSize: scale(18) }]}>
                  {wallpaperTitle}
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                  <Pressable style={styles.followRow} onPress={followTheme}>
                    <Text style={[styles.followText, { color: colors.textPrimary, fontSize: scale(15) }]}>
                      {followThemeTitle}
                    </Text>
                    <Text style={[styles.check, { color: wallpaperMode === 'follow_theme' ? colors.accent : 'transparent' }]}>
                      ✓
                    </Text>
                  </Pressable>

                  {grouped.map((section) => (
                    <View key={section.group} style={styles.group}>
                      <Text style={[styles.groupTitle, { color: colors.textSecondary, fontSize: scale(12) }]}>
                        {section.group}
                      </Text>

                      <View style={styles.grid}>
                        {section.items.map(renderPreview)}
                      </View>
                    </View>
                  ))}

                  <View style={styles.group}>
                    <Text style={[styles.groupTitle, { color: colors.textSecondary, fontSize: scale(12) }]}>
                      {customTitle}
                    </Text>

                    <View style={styles.customActions}>
                      <Pressable style={[styles.actionButton, { backgroundColor: colors.accent }]} onPress={chooseCustom}>
                        <Text style={styles.actionText}>{choosePhotoTitle}</Text>
                      </Pressable>

                      {customUri ? (
                        <Pressable style={styles.secondaryButton} onPress={removeCustom}>
                          <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>
                            {removePhotoTitle}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </ScrollView>
              </SafeAreaView>
            </GlassSurface>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  sheetWrap: {
    width: '100%',
  },
  sheetContent: {
    maxHeight: '86%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    fontWeight: '900',
    marginBottom: 14,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  followRow: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followText: {
    fontWeight: '900',
  },
  check: {
    fontSize: 22,
    fontWeight: '900',
  },
  group: {
    marginBottom: 18,
  },
  groupTitle: {
    marginBottom: 10,
    marginLeft: 4,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewItem: {
    width: '31%',
  },
  previewFrame: {
    height: 112,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  previewImage: {
    flex: 1,
  },
  previewTitle: {
    marginTop: 6,
    fontWeight: '800',
    textAlign: 'center',
  },
  customActions: {
    gap: 10,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: {
    fontWeight: '900',
  },
});