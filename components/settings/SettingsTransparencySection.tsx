import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSlider } from '@/components/ui/glass/GlassSlider';
import {
  GlassStyleName,
  useGlassPreferences,
} from '@/design-system/glassPreferences';
import { AppLanguage } from '@/services/i18n';
import { useAppTheme } from '@/services/theme';

type Props = {
  lang: AppLanguage;
};

export function SettingsTransparencySection({ lang }: Props) {
  const {
    style,
    opacity,
    blur,
    glow,
    refraction,
    load,
    setGlassStyle,
    setOpacity,
    setBlur,
    setGlow,
    setRefraction,
  } = useGlassPreferences();

  const { colors, scale } = useAppTheme();

  const [draftOpacity, setDraftOpacity] = useState(opacity);
  const [draftBlur, setDraftBlur] = useState(blur);
  const [draftGlow, setDraftGlow] = useState(glow);
  const [draftRefraction, setDraftRefraction] = useState(refraction);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setDraftOpacity(opacity);
    setDraftBlur(blur);
    setDraftGlow(glow);
    setDraftRefraction(refraction);
  }, [opacity, blur, glow, refraction]);

  const styleTitle =
    lang === 'ua' ? 'Стиль скла' : lang === 'no' ? 'Glass-stil' : 'Glass style';

  const opacityTitle =
    lang === 'ua' ? 'Прозорість' : lang === 'no' ? 'Transparens' : 'Opacity';

  const blurTitle =
    lang === 'ua' ? 'Розмиття' : lang === 'no' ? 'Uskarphet' : 'Blur';

  const glowTitle =
    lang === 'ua' ? 'Світіння' : lang === 'no' ? 'Glød' : 'Glow';

  const refractionTitle =
    lang === 'ua' ? 'Заломлення' : lang === 'no' ? 'Brytning' : 'Refraction';

  const styleOptions: { id: GlassStyleName; title: string }[] = [
    { id: 'ultraThin', title: lang === 'ua' ? 'Дуже тонке' : lang === 'no' ? 'Ultratynt' : 'Ultra Thin' },
    { id: 'thin', title: lang === 'ua' ? 'Тонке' : lang === 'no' ? 'Tynt' : 'Thin' },
    { id: 'regular', title: lang === 'ua' ? 'Звичайне' : lang === 'no' ? 'Vanlig' : 'Regular' },
    { id: 'thick', title: lang === 'ua' ? 'Щільне' : lang === 'no' ? 'Tykt' : 'Thick' },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.panel}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      bounces={false}
    >
      <Text style={[styles.groupTitle, { color: colors.textSecondary, fontSize: scale(12) }]}>
        {styleTitle}
      </Text>

      <View style={styles.presetGrid}>
        {styleOptions.map((item) => {
          const active = item.id === style;

          return (
            <Pressable
              key={item.id}
              style={[
                styles.preset,
                {
                  borderColor: active ? colors.accent : 'rgba(255,255,255,0.18)',
                  backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)',
                },
              ]}
              onPress={() => void setGlassStyle(item.id)}
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color: active ? colors.accent : colors.textPrimary,
                    fontSize: scale(12),
                  },
                ]}
              >
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <GlassSlider
        title={opacityTitle}
        value={draftOpacity}
        min={0.12}
        max={1.3}
        step={0.01}
        onChange={setDraftOpacity}
        onComplete={(v) => void setOpacity(v)}
      />

      <GlassSlider
        title={blurTitle}
        value={draftBlur}
        min={0.25}
        max={1.35}
        step={0.01}
        onChange={setDraftBlur}
        onComplete={(v) => void setBlur(v)}
      />

      <GlassSlider
        title={glowTitle}
        value={draftGlow}
        min={0.05}
        max={1.5}
        step={0.01}
        onChange={setDraftGlow}
        onComplete={(v) => void setGlow(v)}
      />

      <GlassSlider
        title={refractionTitle}
        value={draftRefraction}
        min={0.05}
        max={1.5}
        step={0.01}
        onChange={setDraftRefraction}
        onComplete={(v) => void setRefraction(v)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 430,
  },
  panel: {
    paddingBottom: 80,
  },
  groupTitle: {
    marginBottom: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    width: '48%',
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontWeight: '900',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginVertical: 14,
  },
});