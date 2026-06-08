export const CATEGORY_LABELS_UA: Record<string, string> = {
  verb: 'Дієслово',

  noun_masculine: 'Іменник · чоловічий рід',
  noun_feminine: 'Іменник · жіночий рід',
  noun_neuter: 'Іменник · середній рід',

  adjective: 'Прикметник',
  adverb: 'Прислівник',

  expression: 'Сталий вираз',
};

export const CATEGORY_LABELS_EN: Record<string, string> = {
  verb: 'Verb',

  noun_masculine: 'Noun · masculine',
  noun_feminine: 'Noun · feminine',
  noun_neuter: 'Noun · neuter',

  adjective: 'Adjective',
  adverb: 'Adverb',

  expression: 'Expression',
};

export function getCategoryLabel(
  category: string,
  language: 'ua' | 'en' = 'ua'
) {
  if (language === 'en') {
    return (
      CATEGORY_LABELS_EN[category] ||
      category
    );
  }

  return (
    CATEGORY_LABELS_UA[category] ||
    category
  );
}