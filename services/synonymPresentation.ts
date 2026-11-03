// Pure presentation policy. A view item is a PAIR of senses, never a whole lemma.
export type SynonymClass = 'strict' | 'contextual' | 'one_way';
export const SYNONYM_COLORS: Record<SynonymClass, string> = {
  strict: '#22C55E', contextual: '#0EA5E9', one_way: '#F59E0B',
};

export function sourceMeaningsTitle(lemma: string, lang: string) {
  return lang === 'ua' ? `Значення слова «${lemma}»`
    : lang === 'no' ? `Betydninger av «${lemma}»` : `Meanings of «${lemma}»`;
}

export function synonymClass(row: {
  decision?: string; can_replace_opened?: boolean | null; can_replace_target?: boolean | null;
  same_construction?: boolean | null;
}): SynonymClass {
  const f = row.can_replace_opened;
  const r = row.can_replace_target;
  if ((f === true && r === false) || (f === false && r === true)) return 'one_way';
  // Missing historical evidence stays unknown; never invent a direction.
  return row.decision === 'verified_synonym' && f === true && r === true
    && row.same_construction === true ? 'strict' : 'contextual';
}

export function filterSynonyms<T extends { senseKey?: string | null; displayClass?: SynonymClass }>(
  items: T[], sense: string | null, classes: SynonymClass[],
): T[] {
  return items.filter(item => (!sense || item.senseKey === sense)
    && (!classes.length || (item.displayClass != null && classes.includes(item.displayClass))));
}

export const SYNONYM_TEXT = {
  ua: { strict: 'Синоніми', contextual: 'У контексті', one_way: 'Одностороння заміна',
    source: 'Значення вихідного слова', target: 'Переклад синоніма в цьому значенні',
    canonical: 'Переклад картки', all: 'Усі значення', empty: 'За цими фільтрами зв’язків немає.',
    unknown: 'Напрям заміни не збережений у попередній перевірці.',
    strictHint: 'Взаємозаміна в цьому значенні; враховуй контекст.',
    contextHint: 'Заміна залежить від контексту або конструкції.',
    pending: 'Переклад значення ще не готовий.',
    checked: 'Перевірка за словниковими значеннями', dictionary: 'Взаємні посилання словника',
  },
  en: { strict: 'Synonyms', contextual: 'In context', one_way: 'One-way replacement',
    source: 'Meaning of the source word', target: 'Synonym translation in this sense',
    canonical: 'Card translation', all: 'All meanings', empty: 'No relations match these filters.',
    unknown: 'The earlier check did not save substitution direction.',
    strictHint: 'Interchangeable in this sense; consider the context.',
    contextHint: 'Replacement depends on context or construction.', pending: 'Sense translation is not ready.',
    checked: 'Checked against dictionary meanings', dictionary: 'Mutual dictionary references',
  },
  no: { strict: 'Synonymer', contextual: 'I kontekst', one_way: 'Enveis erstatning',
    source: 'Betydningen til utgangsordet', target: 'Synonymets oversettelse i denne betydningen',
    canonical: 'Kortets oversettelse', all: 'Alle betydninger', empty: 'Ingen forbindelser passer filtrene.',
    unknown: 'Den tidligere kontrollen lagret ikke bytteretningen.',
    strictHint: 'Kan byttes i denne betydningen; ta hensyn til konteksten.',
    contextHint: 'Byttet avhenger av kontekst eller konstruksjon.', pending: 'Betydningsoversettelsen er ikke klar.',
    checked: 'Kontrollert mot ordbokbetydninger', dictionary: 'Gjensidige ordbokhenvisninger',
  },
} as const;
