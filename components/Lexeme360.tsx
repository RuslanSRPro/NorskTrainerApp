// components/Lexeme360.tsx
// Norsk Trainer App — Lexeme 360° view
// Full lexical network: forms + relations + grammar

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/services/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
type RelatedItem = {
  id: string;
  lemma: string;
  translation_ua?: string;
  translation_en?: string;
  pos?: string;
  expression_subtype?: string;
  relation_type: string;
  confidence: number;
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

  const vf = (data as any).verb_forms?.[0]      || {};
  const nf = (data as any).noun_forms?.[0]      || {};
  const af = (data as any).adjective_forms?.[0] || {};

  const grammar: GrammarForms = { ...vf, ...nf, ...af };

  // Relations
  const { data: rels } = await supabase
    .from('lexeme_relations')
    .select(`
      relation_type, confidence,
      target: target_lexeme_id (
        id, lemma, pos, translation_ua, translation_en,
        expression_data ( expression_subtype )
      )
    `)
    .eq('source_lexeme_id', lexemeId)
    .order('confidence', { ascending: false });

  const relations: RelatedItem[] = ((rels || []) as any[])
    .filter((r) => r.target)
    .map((r) => ({
      id:               r.target.id,
      lemma:            r.target.lemma,
      translation_ua:   r.target.translation_ua || '',
      translation_en:   r.target.translation_en || '',
      pos:              r.target.pos || '',
      expression_subtype: r.target.expression_data?.[0]?.expression_subtype || '',
      relation_type:    r.relation_type,
      confidence:       r.confidence,
    }));

  return {
    id:            data.id,
    lemma:         data.lemma,
    pos:           data.pos,
    translation_ua: (data as any).translation_ua || '',
    translation_en: (data as any).translation_en || '',
    example:       (data as any).example || '',
    grammar,
    relations,
  };
}

// ── Grammar forms helper ──────────────────────────────────────────────────────
function getGrammarRows(pos: string, g: GrammarForms, isUa: boolean): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (pos === 'verb') {
    if (g.presens)    rows.push({ label: isUa ? 'тепер.' : 'presens',     value: g.presens });
    if (g.preteritum) rows.push({ label: isUa ? 'минул.' : 'preteritum',  value: g.preteritum });
    if (g.perfektum)  rows.push({ label: isUa ? 'перф.' : 'perfektum',    value: `har ${g.perfektum}` });
    if (g.gruppe)     rows.push({ label: isUa ? 'група' : 'gruppe',       value: g.gruppe });
  } else if (pos === 'noun') {
    if (g.ubest_entall)   rows.push({ label: isUa ? 'неб. одн.' : 'ub. ent.',   value: g.ubest_entall });
    if (g.best_entall)    rows.push({ label: isUa ? 'б. одн.'   : 'best. ent.', value: g.best_entall });
    if (g.ubest_flertall) rows.push({ label: isUa ? 'неб. мн.'  : 'ub. flt.',  value: g.ubest_flertall });
    if (g.best_flertall)  rows.push({ label: isUa ? 'б. мн.'    : 'best. flt.', value: g.best_flertall });
  } else if (pos === 'adjective') {
    if (g.positiv)    rows.push({ label: isUa ? 'позит.'  : 'positiv',    value: g.positiv });
    if (g.intetkjonn) rows.push({ label: isUa ? 'серед.' : 'intetkjønn', value: g.intetkjonn });
    if (g.flertall)   rows.push({ label: isUa ? 'множ.'  : 'flertall',   value: g.flertall });
    if (g.komparativ) rows.push({ label: isUa ? 'порівн.' : 'komparativ', value: g.komparativ });
    if (g.superlativ) rows.push({ label: isUa ? 'найв.'  : 'superlativ', value: g.superlativ });
  }
  return rows;
}

// ── Section components ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null && <Text style={styles.sectionCount}>{count}</Text>}
    </View>
  );
}

function RelationPill({
  item, isUa, onPress,
}: { item: RelatedItem; isUa: boolean; onPress: () => void }) {
  const translation = isUa
    ? item.translation_ua || item.translation_en
    : item.translation_en || item.translation_ua;

  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.pillLemma}>{item.lemma}</Text>
      {translation ? (
        <Text style={styles.pillTranslation} numberOfLines={1}>{translation}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = {
  lexemeId: string;
  lemma: string;
  pos?: string;
  isUa?: boolean;
  onSelectWord?: (id: string, lemma: string) => void;
};

export function Lexeme360({ lexemeId, lemma, pos, isUa = true, onSelectWord }: Props) {
  const [visible, setVisible]   = useState(false);
  const [data, setData]         = useState<Lexeme360Data | null>(null);
  const [loading, setLoading]   = useState(false);

  async function open() {
    setVisible(true);
    if (data) return;
    setLoading(true);
    try {
      const result = await fetchLexeme360(lexemeId);
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  // Group relations
  const particleVariants = data?.relations.filter(r => r.relation_type === 'particle_variant') || [];
  const baseVerbs        = data?.relations.filter(r => r.relation_type === 'base_verb') || [];
  const expressions      = data?.relations.filter(r => r.relation_type === 'expression_family') || [];
  const idioms           = data?.relations.filter(r => r.relation_type === 'idiom_extension') || [];
  const synonyms         = data?.relations.filter(r => r.relation_type === 'synonym') || [];
  const collocations     = data?.relations.filter(r => r.relation_type === 'collocation') || [];

  const grammarRows = data ? getGrammarRows(data.pos, data.grammar, isUa) : [];
  const hasContent  = data && (
    particleVariants.length > 0 || baseVerbs.length > 0 ||
    expressions.length > 0 || idioms.length > 0 ||
    synonyms.length > 0 || collocations.length > 0 ||
    grammarRows.length > 0
  );

  const posLabel = data?.pos || pos || '';
  const coreTranslation = data
    ? (isUa ? data.translation_ua || data.translation_en : data.translation_en || data.translation_ua)
    : '';

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={open} activeOpacity={0.7}>
        <Text style={styles.triggerText}>🧠 360°</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerTop}>
                  <Text style={styles.headerLemma}>{lemma}</Text>
                  {posLabel ? (
                    <View style={styles.posBadge}>
                      <Text style={styles.posText}>{posLabel}</Text>
                    </View>
                  ) : null}
                </View>
                {coreTranslation ? (
                  <Text style={styles.headerTranslation} numberOfLines={1}>
                    {coreTranslation}
                  </Text>
                ) : (
                  <Text style={styles.headerSub}>Lexeme 360°</Text>
                )}
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* ── Divider ── */}
            <View style={styles.divider} />

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>
                  {isUa ? 'Завантаження...' : 'Loading...'}
                </Text>
              </View>
            ) : !hasContent ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>
                  {isUa ? 'Зв\'язки не знайдено' : 'No connections found'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {isUa
                    ? 'Лексична мережа для цього слова ще не побудована.'
                    : 'The lexical network for this word has not been built yet.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                bounces
              >
                {/* Grammar forms */}
                {grammarRows.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="📐" title={isUa ? 'Граматика' : 'Grammar'} />
                    <View style={styles.grammarGrid}>
                      {grammarRows.map(({ label, value }) => (
                        <View key={label} style={styles.grammarCell}>
                          <Text style={styles.grammarLabel}>{label}</Text>
                          <Text style={styles.grammarValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Base verb */}
                {baseVerbs.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="↑" title={isUa ? 'Базове дієслово' : 'Base verb'} count={baseVerbs.length} />
                    <View style={styles.pillRow}>
                      {baseVerbs.map(item => (
                        <RelationPill key={item.id} item={item} isUa={isUa} onPress={() => { setVisible(false); onSelectWord?.(item.id, item.lemma); }} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Particle variants */}
                {particleVariants.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="→" title={isUa ? 'Дієслова з часткою' : 'Particle verbs'} count={particleVariants.length} />
                    <View style={styles.pillRow}>
                      {particleVariants.map(item => (
                        <RelationPill key={item.id} item={item} isUa={isUa} onPress={() => { setVisible(false); onSelectWord?.(item.id, item.lemma); }} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Expressions */}
                {expressions.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="◉" title={isUa ? 'Вирази' : 'Expressions'} count={expressions.length} />
                    <View style={styles.pillRow}>
                      {expressions.map(item => (
                        <RelationPill key={item.id} item={item} isUa={isUa} onPress={() => { setVisible(false); onSelectWord?.(item.id, item.lemma); }} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Idioms */}
                {idioms.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="◈" title={isUa ? 'Ідіоми' : 'Idioms'} count={idioms.length} />
                    <View style={styles.pillRow}>
                      {idioms.map(item => (
                        <RelationPill key={item.id} item={item} isUa={isUa} onPress={() => { setVisible(false); onSelectWord?.(item.id, item.lemma); }} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Synonyms */}
                {synonyms.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="≈" title={isUa ? 'Синоніми' : 'Synonyms'} count={synonyms.length} />
                    <View style={styles.pillRow}>
                      {synonyms.map(item => (
                        <RelationPill key={item.id} item={item} isUa={isUa} onPress={() => { setVisible(false); onSelectWord?.(item.id, item.lemma); }} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Collocations */}
                {collocations.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader icon="·" title={isUa ? 'Колокації' : 'Collocations'} count={collocations.length} />
                    <View style={styles.pillRow}>
                      {collocations.map(item => (
                        <RelationPill key={item.id} item={item} isUa={isUa} onPress={() => { setVisible(false); onSelectWord?.(item.id, item.lemma); }} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Example */}
                {data?.example ? (
                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleText}>{data.example}</Text>
                  </View>
                ) : null}

              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  headerLeft: { flex: 1 },
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
  emptyIcon: { fontSize: 40 },
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
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
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
  pillRow: {
    gap: 8,
  },
  pill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  pillLemma: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  pillTranslation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
    maxWidth: '50%',
    textAlign: 'right',
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