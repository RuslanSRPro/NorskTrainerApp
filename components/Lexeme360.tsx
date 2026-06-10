// components/Lexeme360.tsx
// Norsk Trainer App — Lexeme 360° view
// Semantic network shell: forms + meaning carousel + examples

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';

import { supabase } from '@/services/supabase';
import { t, AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { addLexemeToLearningFromSupabase } from '@/services/api';
import {
  Lexeme360Carousel,
  type Lexeme360CarouselItem,
} from '@/components/Lexeme360Carousel';

// ── Types ─────────────────────────────────────────────────────────────────────

type RelatedItem = Lexeme360CarouselItem & {
  expression_subtype?: string;
};

type GrammarForms = {
  // verb
  infinitiv?: string;
  presens?: string;
  preteritum?: string;
  perfektum?: string;
  gruppe?: string;

  // noun
  ubest_entall?: string;
  best_entall?: string;
  ubest_flertall?: string;
  best_flertall?: string;
  official_gender?: string;

  // adjective
  positiv?: string;
  intetkjonn?: string;
  flertall?: string;
  komparativ?: string;
  superlativ?: string;
};

type Lexeme360Data = {
  id: string;
  lemma: string;
  pos: string;
  translation_ua?: string;
  translation_en?: string;
  translation_no?: string;
  example?: string;
  grammar: GrammarForms;
  relations: RelatedItem[];
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchLexeme360(lexemeId: string): Promise<Lexeme360Data | null> {
  const { data, error } = await supabase
    .from('lexemes')
    .select(`
      id, lemma, pos, translation_ua, translation_en, example,
      verb_forms ( infinitiv, presens, preteritum, perfektum, gruppe ),
      noun_forms ( ubest_entall, best_entall, ubest_flertall, best_flertall, official_gender ),
      adjective_forms ( positiv, intetkjonn, flertall, komparativ, superlativ )
    `)
    .eq('id', lexemeId)
    .single();

  if (error || !data) return null;

  const vf = (data as any).verb_forms?.[0] || {};
  const nf = (data as any).noun_forms?.[0] || {};
  const af = (data as any).adjective_forms?.[0] || {};

  const grammar: GrammarForms = {
    ...vf,
    ...nf,
    ...af,
  };

  const { data: rels } = await supabase
    .from('lexeme_relations')
    .select(`
      relation_type,
      confidence,
      importance_level,
      importance_score,
      frequency_score,
      semantic_shift_score,
      learner_value_score,
      target: target_lexeme_id (
        id, lemma, pos, translation_ua, translation_en, example,
        expression_data ( expression_subtype )
      )
    `)
    .eq('source_lexeme_id', lexemeId)
    .order('confidence', { ascending: false });

  const relations: RelatedItem[] = ((rels || []) as any[])
    .filter((r) => r.target)
    .map((r) => ({
      id: r.target.id,
      lemma: r.target.lemma,
      translation_ua: r.target.translation_ua || '',
      translation_en: r.target.translation_en || '',
      pos: r.target.pos || '',
      example: r.target.example || '',
      expression_subtype:
        r.target.expression_data?.[0]?.expression_subtype || '',
      relation_type: r.relation_type,
      confidence: Number(r.confidence ?? 0),
      importance_level: r.importance_level || 'important',
      importance_score: Number(r.importance_score ?? 0),
      frequency_score: Number(r.frequency_score ?? 0),
      semantic_shift_score: Number(r.semantic_shift_score ?? 0),
      learner_value_score: Number(r.learner_value_score ?? 0),
    }));

  return {
    id: data.id,
    lemma: data.lemma,
    pos: data.pos,
    translation_ua: (data as any).translation_ua || '',
    translation_en: (data as any).translation_en || '',
    translation_no: (data as any).translation_no || '',
    example: (data as any).example || '',
    grammar,
    relations,
  };
}

// ── Language helpers ──────────────────────────────────────────────────────────

function resolveLang(
  lang?: AppLanguage | string | null,
  isUaLegacy?: boolean
): AppLanguage {
  if (lang === 'ua' || lang === 'en' || lang === 'no') return lang;
  return isUaLegacy ? 'ua' : 'en';
}

function safeT(key: string, lang: AppLanguage, fallback: string) {
  try {
    const value = t(key as any, lang as any);
    if (value && value !== key) return value;
  } catch {
    // fallback
  }

  return fallback;
}

function pickLexemeTranslation(
  item: {
    translation_ua?: string;
    translation_en?: string;
    translation_no?: string;
  },
  lang: AppLanguage
) {
  const ua = item?.translation_ua || '';
  const en = item?.translation_en || '';
  const no = item?.translation_no || '';

  if (lang === 'ua') return ua || en || no;
  if (lang === 'no') return no || en || ua;
  return en || ua || no;
}

function displayLemmaWithInfinitiveMarker(lemma: string, pos?: string) {
  const value = String(lemma || '').trim();
  const safePos = String(pos || '').toLowerCase();

  if (!value) return value;
  if (value.toLowerCase().startsWith('å ')) return value;

  if (safePos === 'verb' || safePos.includes('verb') || safePos === 'expression') {
    return `å ${value}`;
  }

  return value;
}

// ── Grammar forms helper ──────────────────────────────────────────────────────

function getGrammarRows(
  pos: string,
  g: GrammarForms,
  lang: AppLanguage
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const safePos = String(pos || '').toLowerCase();

  if (safePos === 'verb' || safePos.includes('verb')) {
    if (g.infinitiv) {
      rows.push({
        label: safeT('infinitive', lang, 'Infinitiv'),
        value: g.infinitiv,
      });
    }

    if (g.presens) {
      rows.push({
        label: safeT('present', lang, 'Presens'),
        value: g.presens,
      });
    }

    if (g.preteritum) {
      rows.push({
        label: safeT('past', lang, 'Preteritum'),
        value: g.preteritum,
      });
    }

    if (g.perfektum) {
      rows.push({
        label: safeT('perfect', lang, 'Perfektum'),
        value: `har ${g.perfektum}`,
      });
    }

    if (g.gruppe) {
      rows.push({
        label: safeT('group', lang, 'Gruppe'),
        value: g.gruppe,
      });
    }
  } else if (
    safePos === 'noun' ||
    safePos.includes('noun') ||
    safePos.includes('subst')
  ) {
    if (g.ubest_entall) {
      rows.push({
        label: safeT('indef_sg', lang, 'Ubestemt entall'),
        value: g.ubest_entall,
      });
    }

    if (g.best_entall) {
      rows.push({
        label: safeT('def_sg', lang, 'Bestemt entall'),
        value: g.best_entall,
      });
    }

    if (g.ubest_flertall) {
      rows.push({
        label: safeT('indef_pl', lang, 'Ubestemt flertall'),
        value: g.ubest_flertall,
      });
    }

    if (g.best_flertall) {
      rows.push({
        label: safeT('def_pl', lang, 'Bestemt flertall'),
        value: g.best_flertall,
      });
    }

    if (g.official_gender) {
      rows.push({
        label: safeT('gender', lang, 'Kjønn'),
        value: g.official_gender,
      });
    }
  } else if (safePos === 'adjective' || safePos.includes('adj')) {
    if (g.positiv) {
      rows.push({
        label: safeT('positive', lang, 'Positiv'),
        value: g.positiv,
      });
    }

    if (g.intetkjonn) {
      rows.push({
        label: safeT('neuter', lang, 'Intetkjønn'),
        value: g.intetkjonn,
      });
    }

    if (g.flertall) {
      rows.push({
        label: safeT('plural', lang, 'Flertall'),
        value: g.flertall,
      });
    }

    if (g.komparativ) {
      rows.push({
        label: safeT('comparative', lang, 'Komparativ'),
        value: g.komparativ,
      });
    }

    if (g.superlativ) {
      rows.push({
        label: safeT('superlative', lang, 'Superlativ'),
        value: g.superlativ,
      });
    }
  }

  return rows;
}

// ── Semantic filtering ────────────────────────────────────────────────────────

function getSemanticRelations(
  data: Lexeme360Data | null,
  learnedRelationIds: Set<string>
) {
  const relations = data?.relations || [];

  return relations
    .filter((relation) =>
      [
        'particle_variant',
        'expression_family',
        'idiom_extension',
        'grammar_pattern',
        'synonym',
        'collocation',
      ].includes(relation.relation_type)
    )
    .map((relation) => ({
      ...relation,
      lemma: displayLemmaWithInfinitiveMarker(relation.lemma, relation.pos),
      learned: relation.learned || learnedRelationIds.has(relation.id),
    }));
}

// ── Section components ────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>

      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {count != null ? (
        <Text style={styles.sectionCount}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}

function Lexeme360Content({
  data,
  lemma,
  pos,
  lang,
  loading,
  addingId,
  learnedRelationIds,
  onClose,
  onSelectWord,
  onAddToLearning,
}: {
  data: Lexeme360Data | null;
  lemma: string;
  pos?: string;
  lang: AppLanguage;
  loading: boolean;
  addingId?: string | null;
  learnedRelationIds: Set<string>;
  onClose?: () => void;
  onSelectWord?: (id: string, lemma: string) => void;
  onAddToLearning?: (id: string) => void;
}) {
  const grammarRows = data ? getGrammarRows(data.pos, data.grammar, lang) : [];
  const semanticRelations = getSemanticRelations(data, learnedRelationIds);

  const hasContent = Boolean(
    data &&
      (
        grammarRows.length > 0 ||
        semanticRelations.length > 0 ||
        data.example
      )
  );

  const posLabel = data?.pos || pos || '';
  const displayLemma = displayLemmaWithInfinitiveMarker(lemma, posLabel);
  const coreTranslation = data ? pickLexemeTranslation(data, lang) : '';

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTop}>
            <Text style={styles.headerLemma}>
              {displayLemma}
            </Text>

            {posLabel ? (
              <View style={styles.posBadge}>
                <Text style={styles.posText}>
                  {posLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {coreTranslation ? (
            <Text
              style={styles.headerTranslation}
              numberOfLines={1}
            >
              {coreTranslation}
            </Text>
          ) : (
            <Text style={styles.headerSub}>
              Lexeme 360°
            </Text>
          )}
        </View>

        {onClose ? (
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
          >
            <Text style={styles.closeBtnText}>
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>

      {data?.example ? (
        <View style={styles.coreExampleBox}>
          <Text style={styles.coreExampleText} numberOfLines={2}>
            {data.example}
          </Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
            color="#0EA5E9"
          />

          <Text style={styles.loadingText}>
            {safeT('loading', lang, 'Loading...')}
          </Text>
        </View>
      ) : !hasContent ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>
            🔍
          </Text>

          <Text style={styles.emptyText}>
            {safeT('no_connections', lang, 'No connections')}
          </Text>

          <Text style={styles.emptySubtext}>
            {safeT(
              'no_network_yet',
              lang,
              'The lexical network for this word has not been built yet.'
            )}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator
          bounces
          nestedScrollEnabled
          scrollEnabled
        >
          {semanticRelations.length > 0 ? (
            <>
              {addingId ? (
                <View style={styles.addingBox}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
                  <Text style={styles.addingText}>
                    {lang === 'ua'
                      ? 'Додаю до навчання...'
                      : lang === 'no'
                        ? 'Legger til i læring...'
                        : 'Adding to learning...'}
                  </Text>
                </View>
              ) : null}

              <Lexeme360Carousel
                items={semanticRelations}
                lang={lang}
                onSelect={(id, nextLemma) => {
                  onClose?.();
                  onSelectWord?.(id, nextLemma);
                }}
                onAdd={onAddToLearning}
              />
            </>
          ) : null}

          {grammarRows.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                icon="📐"
                title={safeT('grammar', lang, 'Grammar')}
              />

              <View style={styles.grammarGrid}>
                {grammarRows.map(({ label, value }) => (
                  <View
                    key={`${label}-${value}`}
                    style={styles.grammarCell}
                  >
                    <Text style={styles.grammarLabel}>
                      {label}
                    </Text>

                    <Text style={styles.grammarValue}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  lexemeId: string;
  lemma: string;
  pos?: string;
  lang?: AppLanguage | string | null;

  /**
   * Backward compatibility for older calls.
   * Prefer passing lang={app_language}.
   */
  isUa?: boolean;

  onSelectWord?: (id: string, lemma: string) => void;

  // External control, used to avoid nested Modal iOS scroll bugs.
  externalVisible?: boolean;
  onOpenRequest?: () => void;
  onCloseRequest?: () => void;
};

export function Lexeme360({
  lexemeId,
  lemma,
  pos,
  lang = 'en',
  isUa: isUaLegacy,
  onSelectWord,
  externalVisible,
  onOpenRequest,
  onCloseRequest,
}: Props) {
  const { preferred_user } = useSettingsStore();
  const uiLang = resolveLang(lang, isUaLegacy);

  const [internalVisible, setInternalVisible] =
    useState(false);

  const [data, setData] =
    useState<Lexeme360Data | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [addingId, setAddingId] =
    useState<string | null>(null);

  const [learnedRelationIds, setLearnedRelationIds] =
    useState<Set<string>>(new Set());

  const visible =
    externalVisible !== undefined
      ? externalVisible
      : internalVisible;

  const setVisible = (value: boolean) => {
    if (externalVisible !== undefined) {
      value
        ? onOpenRequest?.()
        : onCloseRequest?.();
    } else {
      setInternalVisible(value);
    }
  };

  async function open() {
    setVisible(true);

    if (data || loading) return;

    setLoading(true);

    try {
      const result = await fetchLexeme360(lexemeId);
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  async function addRelationToLearning(id: string) {
    try {
      if (!id || addingId || learnedRelationIds.has(id)) return;

      setAddingId(id);

      await addLexemeToLearningFromSupabase({
        preferred_user,
        lexemeId: id,
      });

      setLearnedRelationIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (err) {
      console.error('Lexeme360 add relation error:', err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={open}
        activeOpacity={0.7}
      >
        <Text style={styles.triggerText}>
          🧠 360°
        </Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setVisible(false)}
        >
          <Pressable
            style={styles.modalSheetWrapper}
            onPress={(event) => event.stopPropagation()}
          >
            <Lexeme360Content
              data={data}
              lemma={lemma}
              pos={pos}
              lang={uiLang}
              loading={loading}
              addingId={addingId}
              learnedRelationIds={learnedRelationIds}
              onClose={() => setVisible(false)}
              onSelectWord={onSelectWord}
              onAddToLearning={addRelationToLearning}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Lexeme360Sheet — renders sheet content without Modal wrapper ──────────────
// Use this when parent already manages the Modal.

export function Lexeme360Sheet({
  lexemeId,
  lemma,
  pos,
  lang = 'en',
  isUa: isUaLegacy,
  onSelectWord,
  onClose,
}: {
  lexemeId: string;
  lemma: string;
  pos?: string;
  lang?: AppLanguage | string | null;

  /**
   * Backward compatibility for older calls.
   * Prefer passing lang={app_language}.
   */
  isUa?: boolean;

  onSelectWord?: (id: string, lemma: string) => void;
  onClose?: () => void;
}) {
  const { preferred_user } = useSettingsStore();
  const uiLang = resolveLang(lang, isUaLegacy);

  const [data, setData] =
    useState<Lexeme360Data | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [addingId, setAddingId] =
    useState<string | null>(null);

  const [learnedRelationIds, setLearnedRelationIds] =
    useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!lexemeId) return;

    let mounted = true;

    setLoading(true);

    fetchLexeme360(lexemeId)
      .then((result) => {
        if (mounted) setData(result);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [lexemeId]);

  async function addRelationToLearning(id: string) {
    try {
      if (!id || addingId || learnedRelationIds.has(id)) return;

      setAddingId(id);

      await addLexemeToLearningFromSupabase({
        preferred_user,
        lexemeId: id,
      });

      setLearnedRelationIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (err) {
      console.error('Lexeme360Sheet add relation error:', err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Lexeme360Content
      data={data}
      lemma={lemma}
      pos={pos}
      lang={uiLang}
      loading={loading}
      addingId={addingId}
      learnedRelationIds={learnedRelationIds}
      onClose={onClose}
      onSelectWord={onSelectWord}
      onAddToLearning={addRelationToLearning}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheetWrapper: {
    height: '93%',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerLemma: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
  },
  posBadge: {
    backgroundColor: '#F1EFE8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  posText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888780',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTranslation: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0EA5E9',
    marginTop: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '700',
  },
  coreExampleBox: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  coreExampleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#374151',
    fontStyle: 'italic',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E5E7EB',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 40,
  },




  addingBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionIcon: {
    fontSize: 15,
    width: 22,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  grammarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grammarCell: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '45%',
    flex: 1,
  },
  grammarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  grammarValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  exampleBox: {
    marginTop: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  exampleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 22,
    fontStyle: 'italic',
  },
});