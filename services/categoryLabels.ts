// D10 07.11.2026 (agreed, D10_expression_category_label_v1): the label of the
// card's word class shown in the card (search, preview) and in training.
// An expression shows its category (expression_subtype) instead of just
// "expression"; a noun shows its gender. Unknown values fall back to the
// generic label. Pure function, three languages.

export type CategoryLang = 'ua' | 'en' | 'no';

const POS: Record<string, Record<CategoryLang, string>> = {
  verb: { ua: 'Дієслово', en: 'Verb', no: 'Verb' },
  noun: { ua: 'Іменник', en: 'Noun', no: 'Substantiv' },
  noun_masculine: { ua: 'Іменник · ч.р.', en: 'Noun · masc.', no: 'Subst. · hankjønn' },
  noun_feminine: { ua: 'Іменник · ж.р.', en: 'Noun · fem.', no: 'Subst. · hunkjønn' },
  noun_neuter: { ua: 'Іменник · с.р.', en: 'Noun · neuter', no: 'Subst. · intetkjønn' },
  adjective: { ua: 'Прикметник', en: 'Adjective', no: 'Adjektiv' },
  adverb: { ua: 'Прислівник', en: 'Adverb', no: 'Adverb' },
  preposition: { ua: 'Прийменник', en: 'Preposition', no: 'Preposisjon' },
  pronoun: { ua: 'Займенник', en: 'Pronoun', no: 'Pronomen' },
  conjunction: { ua: 'Сполучник', en: 'Conjunction', no: 'Konjunksjon' },
  subjunction: { ua: 'Підрядний сполучник', en: 'Subjunction', no: 'Subjunksjon' },
  determiner: { ua: 'Детермінатив', en: 'Determiner', no: 'Determinativ' },
  numeral: { ua: 'Числівник', en: 'Numeral', no: 'Tallord' },
  interjection: { ua: 'Вигук', en: 'Interjection', no: 'Interjeksjon' },
  expression: { ua: 'Сталий вираз', en: 'Expression', no: 'Fast uttrykk' },
};

// expression_subtype -> label ('ordbokene_sub_article' is a source, not a category: generic label)
const EXPRESSION: Record<string, Record<CategoryLang, string>> = {
  idiom: { ua: 'Ідіома', en: 'Idiom', no: 'Idiom' },
  particle_verb: { ua: 'Дієслово з часткою', en: 'Particle verb', no: 'Partikkelverb' },
  prepositional_verb: { ua: 'Дієслово з прийменником', en: 'Prepositional verb', no: 'Preposisjonsverb' },
  lexical_reflexive: { ua: 'Зворотне дієслово', en: 'Reflexive verb', no: 'Refleksivt verb' },
  reflexive_particle_verb: { ua: 'Зворотне дієслово з часткою', en: 'Reflexive particle verb', no: 'Refleksivt partikkelverb' },
  reflexive_construction: { ua: 'Зворотна конструкція', en: 'Reflexive construction', no: 'Refleksiv konstruksjon' },
  verb_expression: { ua: 'Дієслівний вираз', en: 'Verb expression', no: 'Verbuttrykk' },
  fixed_expression: { ua: 'Сталий вираз', en: 'Fixed expression', no: 'Fast uttrykk' },
  collocation: { ua: 'Словосполучення', en: 'Collocation', no: 'Kollokasjon' },
  conversation_phrase: { ua: 'Розмовна фраза', en: 'Conversational phrase', no: 'Samtalefrase' },
  discourse_marker: { ua: "Зв'язкове слово", en: 'Discourse marker', no: 'Diskursmarkør' },
  time_expression: { ua: 'Вираз часу', en: 'Time expression', no: 'Tidsuttrykk' },
};

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

// category: the card's category/type (noun_masculine, verb, expression ...);
// word: the card (pos, expression_subtype) when available.
export function categoryLabel(category: unknown, word: any, lang: CategoryLang): string {
  const cat = norm(category) || norm(word?.category) || norm(word?.type) || norm(word?.pos);
  const pos = norm(word?.pos) || cat;
  if (pos === 'expression' || cat === 'expression') {
    // D10 10.11.2026: the checked category (expression_catalog.category) first,
    // then the older expression_subtype
    const sub = norm(word?.expression_category) || norm(word?.expression_subtype ?? word?.expressionSubtype);
    const label = EXPRESSION[sub]?.[lang];
    if (label) return label;
    return POS.expression[lang];
  }
  return POS[cat]?.[lang] ?? POS[cat.split('_')[0]]?.[lang] ?? POS[pos]?.[lang] ?? String(category ?? '');
}
