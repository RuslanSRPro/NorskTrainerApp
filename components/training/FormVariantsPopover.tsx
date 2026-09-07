import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { AppLanguage } from '@/services/i18n';
import {
  collectFormVariantGroups,
  type FormVariantGroup,
} from '@/services/formPresentation';

type Props = {
  word: any;
  isDark: boolean;
  lang: AppLanguage;
};

const UI = {
  ua: {
    trigger: 'Інші офіційні форми',
    title: 'Офіційні варіанти',
    primary: 'Основні',
    alternative: 'Альтернативні',
    source: 'Джерело: Ordbøkene (UiB + Språkrådet)',
    close: 'Закрити',
  },
  en: {
    trigger: 'Other official forms',
    title: 'Official variants',
    primary: 'Primary',
    alternative: 'Alternatives',
    source: 'Source: Ordbøkene (UiB + Språkrådet)',
    close: 'Close',
  },
  no: {
    trigger: 'Andre offisielle former',
    title: 'Offisielle varianter',
    primary: 'Hovedformer',
    alternative: 'Alternative former',
    source: 'Kilde: Ordbøkene (UiB + Språkrådet)',
    close: 'Lukk',
  },
} as const;

const FORM_LABELS: Record<string, Record<AppLanguage, string>> = {
  infinitiv: { ua: 'Інфінітив', en: 'Infinitive', no: 'Infinitiv' },
  presens: { ua: 'Теперішній час', en: 'Present', no: 'Presens' },
  preteritum: { ua: 'Минулий час', en: 'Preterite', no: 'Preteritum' },
  perfektum: { ua: 'Перфект', en: 'Perfect', no: 'Perfektum' },
  ubest_entall: { ua: 'Неозначена однина', en: 'Indefinite singular', no: 'Ubestemt entall' },
  best_entall: { ua: 'Означена однина', en: 'Definite singular', no: 'Bestemt entall' },
  ubest_flertall: { ua: 'Неозначена множина', en: 'Indefinite plural', no: 'Ubestemt flertall' },
  best_flertall: { ua: 'Означена множина', en: 'Definite plural', no: 'Bestemt flertall' },
  positiv: { ua: 'Позитив', en: 'Positive', no: 'Positiv' },
  intetkjonn: { ua: 'Середній рід', en: 'Neuter', no: 'Intetkjønn' },
  flertall: { ua: 'Множина', en: 'Plural', no: 'Flertall' },
  komparativ: { ua: 'Компаратив', en: 'Comparative', no: 'Komparativ' },
  superlativ: { ua: 'Суперлатив', en: 'Superlative', no: 'Superlativ' },
  best_superlativ: { ua: 'Означений суперлатив', en: 'Definite superlative', no: 'Bestemt superlativ' },
};

export function FormVariantsPopover({ word, isDark, lang }: Props) {
  const [visible, setVisible] = useState(false);
  const groups = useMemo(() => collectFormVariantGroups(word), [word]);
  if (groups.length === 0) return null;

  const ui = UI[lang] ?? UI.en;
  const textColor = isDark ? '#FFFFFF' : '#101828';
  const mutedColor = isDark ? 'rgba(255,255,255,0.68)' : '#667085';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ui.trigger}
        accessibilityHint={ui.title}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <GlassSurface
          variant="badge"
          shape="circle"
          dark={isDark}
          contentStyle={styles.triggerInner}
        >
          <Ionicons
            name="git-branch-outline"
            size={19}
            color={isDark ? '#D0D5DD' : '#475467'}
          />
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{variantCount(groups)}</Text>
          </View>
        </GlassSurface>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable
            accessibilityRole="summary"
            onPress={(event) => event.stopPropagation()}
            style={styles.popoverPosition}
          >
            <GlassSurface
              variant="card"
              dark={isDark}
              style={styles.popover}
              contentStyle={styles.popoverInner}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: textColor }]}>{ui.title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={ui.close}
                  onPress={() => setVisible(false)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color={mutedColor} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.groups}
                showsVerticalScrollIndicator={false}
              >
                {groups.map((group) => (
                  <View key={group.formKey} style={styles.group}>
                    <Text style={[styles.formLabel, { color: mutedColor }]}>
                      {formLabel(group.formKey, lang)}
                    </Text>
                    {group.primaryValues.length > 0 ? (
                      <VariantLine
                        label={ui.primary}
                        values={group.primaryValues}
                        textColor={textColor}
                        mutedColor={mutedColor}
                      />
                    ) : null}
                    {group.alternativeValues.length > 0 ? (
                      <VariantLine
                        label={ui.alternative}
                        values={group.alternativeValues}
                        textColor={textColor}
                        mutedColor={mutedColor}
                      />
                    ) : null}
                  </View>
                ))}
              </ScrollView>

              <Text style={[styles.source, { color: mutedColor }]}>{ui.source}</Text>
            </GlassSurface>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function VariantLine({
  label,
  values,
  textColor,
  mutedColor,
}: {
  label: string;
  values: string[];
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.variantLine}>
      <Text style={[styles.variantLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.variantValue, { color: textColor }]}>
        {values.join(' / ')}
      </Text>
    </View>
  );
}

function variantCount(groups: FormVariantGroup[]): number {
  return groups.reduce(
    (count, group) =>
      count + Math.max(0, group.primaryValues.length - 1) +
      group.alternativeValues.length,
    0,
  );
}

function formLabel(formKey: string, lang: AppLanguage): string {
  return FORM_LABELS[formKey]?.[lang] ?? formKey.replaceAll('_', ' ');
}

const styles = StyleSheet.create({
  trigger: {
    width: 34,
    height: 34,
  },
  triggerInner: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  popoverPosition: {
    width: '100%',
    maxWidth: 360,
  },
  popover: {
    width: '100%',
  },
  popoverInner: {
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    maxHeight: 300,
  },
  groups: {
    gap: 10,
  },
  group: {
    gap: 5,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.38)',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  variantLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  variantLabel: {
    width: 108,
    fontSize: 13,
    fontWeight: '600',
  },
  variantValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  source: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
