// components/HomonymsButton.tsx
// D10 16.10.2026 (plan v2, stage E, rule R5): homonym icon on a training card.
// Shows the other cards with the same lemma: other parts of speech (R1) and
// other cards of the same part of speech (R9, second homograph cards).
// The icon appears only when such cards exist. Icon (agreed 16.10): "A¹²" in
// a purple circle, the number = all cards of this word. Tap -> list (part of
// speech, word, translation in the interface language); tap a row -> the full
// card opens in Read, as from the search. Article numbers are not shown.

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';

import { router } from 'expo-router';



type Lang = 'ua' | 'en' | 'no';

type Neighbour = {
  id: string;
  lemma: string;
  pos: string | null;
  translation_ua: string | null;
  translation_en: string | null;
  dictionary_status?: string | null;
};

type Props = {
  cardCount?: number;
  cards?: Neighbour[];
  lexemeId?: string | null;
  lemma?: string | null;
  lang?: string | null;
};

const UI = {
  ua: { title: 'Омоніми та інші значення', a11y: 'Омоніми та інші значення слова', close: 'Закрити', open: 'Відкрити картку' },
  en: { title: 'Homonyms and other meanings', a11y: 'Homonyms and other meanings of the word', close: 'Close', open: 'Open card' },
  no: { title: 'Homonymer og andre betydninger', a11y: 'Homonymer og andre betydninger av ordet', close: 'Lukk', open: 'Åpne kortet' },
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

// Explicit linked cards are supplied by the batch read model. No requests on mount or open.


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

export function HomonymsButton({ lexemeId, lemma, lang, cardCount = 0, cards }: Props) {
  const { theme: T, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = themeName === 'dark';
  const safeLang = normLang(lang);
  const key = cleanLemma(lemma);
  const rows = [...(cards ?? [])].sort((a,b) => {
    const pa=POS_ORDER.indexOf(String(a.pos)),pb=POS_ORDER.indexOf(String(b.pos));
    return (pa<0?99:pa)-(pb<0?99:pb)||a.id.localeCompare(b.id);
  });
  const [open,setOpen]=useState(false);
  const failed = !cards;
  const others = rows.filter((n) => n.id !== lexemeId);
  if (!lexemeId || cardCount < 2) return null;
  const t = UI[safeLang];

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`${t.a11y}: ${cardCount}`}
        activeOpacity={0.7}
        style={styles.icon}
      >
        <View style={[styles.circle,{backgroundColor:'transparent',borderColor:T.border,overflow:'hidden'}]}>
          <GlassOverlay dark={dark} material="button" shape="card" radius={13} />
          <Text style={[styles.letter,{color:T.accent}]}>A</Text>
          <Text style={[styles.sup,{color:T.accent}]}>{'¹²'}</Text>
        </View>
        <Text style={[styles.count,{color:T.accent}]}>{cardCount}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* D10 16.10.2026: scrolling fix - the popup is a View, not a Pressable; a tap outside closes */}
        <View style={[styles.overlay,{paddingBottom:Math.max(insets.bottom,12),paddingTop:insets.top+12}]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.popup,{backgroundColor:'transparent',borderRadius:28}]}>
            <GlassOverlay dark={dark} material="overlay" shape="sheet" radius={28} />
            <View style={[styles.header,{backgroundColor:'transparent'}]}>
              <Text style={[styles.title,{color:T.textPrimary}]}>{t.title}</Text>
              <Text style={[styles.lemma,{color:T.textMuted}]}>«{key}»</Text>
            </View>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {failed ? <Text style={{color:T.textSecondary,padding:12}}>{safeLang==='ua'?'Не вдалося завантажити. Онови список навчання.':safeLang==='no'?'Kunne ikke laste. Last inn treningen på nytt.':'Could not load. Reload the training list.'}</Text> : null}
              {others.map((n) => {
                const tr = translationOf(n, safeLang);
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.row,{borderBottomWidth:0,borderRadius:18,overflow:'hidden',marginBottom:8,paddingHorizontal:14,minHeight:48}]}
                    activeOpacity={0.7}
                    accessibilityLabel={`${t.open}: ${n.lemma} ${posLabel(n.pos, safeLang)}`}
                    onPress={() => {
                      setOpen(false);
                      // Same card view as the search in Read (reading.tsx: openLexemeId).
                      router.push({ pathname: '/reading', params: { openLexemeId: n.id, t: String(Date.now()) } });
                    }}
                  >
                    <GlassOverlay dark={dark} material="card" shape="card" radius={18} />
                    <Text style={[styles.rowTitle,{color:T.textPrimary}]}>
                      {`${n.lemma} — ${posLabel(n.pos, safeLang)}`}{tr ? ` · ${tr}` : ''}
                    </Text>
                    <Text style={[styles.rowOpen,{color:T.accent}]}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[styles.closeBtn,{backgroundColor:'transparent',overflow:'hidden',borderRadius:18,minHeight:48}]} onPress={() => setOpen(false)}>
              <GlassOverlay dark={dark} material="button" shape="card" radius={18} />
              <Text style={[styles.closeText,{color:T.textPrimary}]}>{t.close}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 2 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#7C3AED26', borderWidth: 1, borderColor: '#7C3AED55',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 13, fontWeight: '800', color: '#6D28D9' },
  sup: { fontSize: 8, fontWeight: '800', color: '#6D28D9', marginTop: -7, marginLeft: 1 },
  count: { fontSize: 11, fontWeight: '700', color: '#5B21B6' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32 },
  popup: { width: '100%', maxWidth: 430, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', maxHeight: '80%', flexShrink: 1 },
  header: { padding: 18, paddingBottom: 12, backgroundColor: '#EDE9FE' },
  title: { fontSize: 16, fontWeight: '700', color: '#5B21B6' },
  lemma: { fontSize: 13, color: '#6D28D9', fontStyle: 'italic', marginTop: 2 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 14, paddingBottom: 20 },
  row: { paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#DDD6FE', flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#4C1D95' },
  rowOpen: { fontSize: 20, color: '#7C3AED' },
  closeBtn: { margin: 12, marginTop: 4, padding: 14, backgroundColor: '#F1EFE8', borderRadius: 10, alignItems: 'center' },
  closeText: { fontSize: 15, fontWeight: '600', color: '#444441' },
});
