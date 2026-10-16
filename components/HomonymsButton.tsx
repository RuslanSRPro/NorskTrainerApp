// components/HomonymsButton.tsx
// D10 16.10.2026 (plan v2, stage E, rule R5): homonym icon on a training card.
// Shows the other cards with the same lemma: other parts of speech (R1) and
// other cards of the same part of speech (R9, second homograph cards).
// The icon appears only when such cards exist. Tap -> list; tap a row -> its
// translation, example and verification (server stars). Article numbers are
// not shown. Read only.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/services/supabase';
import { VerificationBadge } from '@/components/VerificationBadge';

type Lang = 'ua' | 'en' | 'no';

type Neighbour = {
  id: string;
  lemma: string;
  pos: string | null;
  translation_ua: string | null;
  translation_en: string | null;
  example: string | null;
  verification_tier: string | null;
  verification_evidence: any;
  source_verified: string | null;
  dictionary_status?: string | null;
};

type Props = {
  lexemeId?: string | null;
  lemma?: string | null;
  lang?: string | null;
};

const UI = {
  ua: { title: 'Омоніми та інші значення', a11y: 'Омоніми та інші значення слова', close: 'Закрити', noTranslation: 'перекладу ще немає' },
  en: { title: 'Homonyms and other meanings', a11y: 'Homonyms and other meanings of the word', close: 'Close', noTranslation: 'no translation yet' },
  no: { title: 'Homonymer og andre betydninger', a11y: 'Homonymer og andre betydninger av ordet', close: 'Lukk', noTranslation: 'ingen oversettelse ennå' },
} as const;

const POS_NAMES: Record<string, Record<Lang, string>> = {
  noun: { ua: 'іменник', en: 'noun', no: 'substantiv' },
  verb: { ua: 'дієслово', en: 'verb', no: 'verb' },
  adjective: { ua: 'прикметник', en: 'adjective', no: 'adjektiv' },
  adverb: { ua: 'прислівник', en: 'adverb', no: 'adverb' },
  preposition: { ua: 'прийменник', en: 'preposition', no: 'preposisjon' },
  pronoun: { ua: 'займенник', en: 'pronoun', no: 'pronomen' },
  conjunction: { ua: 'сполучник', en: 'conjunction', no: 'konjunksjon' },
  determiner: { ua: 'детермінатив', en: 'determiner', no: 'determinativ' },
  numeral: { ua: 'числівник', en: 'numeral', no: 'tallord' },
  interjection: { ua: 'вигук', en: 'interjection', no: 'interjeksjon' },
};

const POS_ORDER = ['verb', 'noun', 'adjective', 'adverb'];

// Neighbours per lemma for the session (a training run shows many cards).
const cache = new Map<string, Neighbour[]>();

function normLang(lang?: string | null): Lang {
  return lang === 'en' || lang === 'no' || lang === 'ua' ? lang : 'ua';
}

function cleanLemma(value?: string | null): string {
  return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('nb-NO').replace(/^å\s+/, '');
}

function posLabel(pos: string | null, lang: Lang): string {
  const base = String(pos ?? '').toLowerCase().split('_')[0];
  return POS_NAMES[base]?.[lang] ?? (pos || '');
}

function translationOf(n: Neighbour, lang: Lang): string {
  const ua = String(n.translation_ua ?? '').trim();
  const en = String(n.translation_en ?? '').trim();
  return lang === 'ua' ? (ua || en) : (en || ua);
}

async function loadNeighbours(lemma: string): Promise<Neighbour[]> {
  if (cache.has(lemma)) return cache.get(lemma)!;
  const { data, error } = await supabase
    .from('lexemes')
    .select('id, lemma, pos, translation_ua, translation_en, example, verification_tier, verification_evidence, source_verified, dictionary_status')
    .eq('lemma', lemma)
    .limit(12);
  if (error) throw error;
  const rows = ((data ?? []) as Neighbour[])
    .filter((n) => n.pos !== 'expression' && n.dictionary_status !== 'excluded')
    .sort((a, b) => {
      const ia = POS_ORDER.indexOf(String(a.pos)); const ib = POS_ORDER.indexOf(String(b.pos));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  cache.set(lemma, rows);
  return rows;
}

export function HomonymsButton({ lexemeId, lemma, lang }: Props) {
  const safeLang = normLang(lang);
  const key = cleanLemma(lemma);
  const [rows, setRows] = useState<Neighbour[]>(() => (key && cache.get(key)) || []);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!key) { setRows([]); return; }
    loadNeighbours(key)
      .then((list) => { if (alive) setRows(list); })
      .catch(() => { if (alive) setRows([]); });   // no icon if unreadable
    return () => { alive = false; };
  }, [key]);

  const others = rows.filter((n) => n.id !== lexemeId);
  if (!lexemeId || others.length === 0) return null;
  const t = UI[safeLang];

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={t.a11y}
        activeOpacity={0.7}
        style={styles.icon}
      >
        <Text style={styles.iconText}>🟣</Text>
        <Text style={styles.count}>{others.length}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.popup} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.lemma}>«{key}»</Text>
            </View>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {others.map((n) => {
                const tr = translationOf(n, safeLang);
                const isOpen = expanded === n.id;
                return (
                  <View key={n.id} style={styles.row}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(isOpen ? null : n.id)}>
                      <Text style={styles.rowTitle}>
                        {`${n.lemma} — ${posLabel(n.pos, safeLang)}`}{tr ? ` · ${tr}` : ''}
                      </Text>
                    </TouchableOpacity>
                    {isOpen ? (
                      <View style={styles.details}>
                        <View style={styles.detailsTop}>
                          <Text style={styles.detailText}>{tr || t.noTranslation}</Text>
                          <VerificationBadge
                            tier={n.verification_tier}
                            sourceVerified={n.source_verified}
                            evidence={n.verification_evidence}
                            lemma={n.lemma}
                            size="sm"
                            lang={safeLang}
                            entityId={n.id}
                          />
                        </View>
                        {n.example ? <Text style={styles.example}>{n.example}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>{t.close}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 2 },
  iconText: { fontSize: 18 },
  count: { fontSize: 11, fontWeight: '700', color: '#5B21B6' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32 },
  popup: { width: '100%', maxWidth: 430, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', maxHeight: '80%', flexShrink: 1 },
  header: { padding: 18, paddingBottom: 12, backgroundColor: '#EDE9FE' },
  title: { fontSize: 16, fontWeight: '700', color: '#5B21B6' },
  lemma: { fontSize: 13, color: '#6D28D9', fontStyle: 'italic', marginTop: 2 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 14, paddingBottom: 20 },
  row: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#DDD6FE' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#4C1D95' },
  details: { marginTop: 6 },
  detailsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailText: { flex: 1, fontSize: 14, color: '#2C2C2A' },
  example: { fontSize: 13, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  closeBtn: { margin: 12, marginTop: 4, padding: 14, backgroundColor: '#F1EFE8', borderRadius: 10, alignItems: 'center' },
  closeText: { fontSize: 15, fontWeight: '600', color: '#444441' },
});
