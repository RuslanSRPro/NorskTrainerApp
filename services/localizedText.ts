import type { AppLanguage } from '@/services/i18n';

export function normalizeAppLanguage(lang?: AppLanguage | string | null): AppLanguage {
  if (lang === 'ua' || lang === 'en' || lang === 'no') return lang;
  return 'ua';
}

export function getLocalizedText(item: any, lang?: AppLanguage | string | null): string {
  const safeLang = normalizeAppLanguage(lang);

  if (!item) return '';

  if (safeLang === 'ua') {
    return (
      item.translation_ua ||
      item.meaning_ua ||
      item.ua ||
      item.translation_en ||
      item.meaning_en ||
      item.en ||
      item.translation_no ||
      item.no ||
      ''
    );
  }

  if (safeLang === 'no') {
    return (
      item.translation_no ||
      item.meaning_no ||
      item.no ||
      item.translation_en ||
      item.meaning_en ||
      item.en ||
      item.translation_ua ||
      item.meaning_ua ||
      item.ua ||
      ''
    );
  }

  return (
    item.translation_en ||
    item.meaning_en ||
    item.en ||
    item.translation_ua ||
    item.meaning_ua ||
    item.ua ||
    item.translation_no ||
    item.meaning_no ||
    item.no ||
    ''
  );
}

export function getLocalizedNotes(item: any, lang?: AppLanguage | string | null): string {
  const safeLang = normalizeAppLanguage(lang);

  if (!item) return '';

  if (safeLang === 'ua') {
    return item.notes_ua || item.note_ua || item.notes || '';
  }

  if (safeLang === 'no') {
    return item.notes_no || item.note_no || item.notes_en || item.notes_ua || item.notes || '';
  }

  return item.notes_en || item.note_en || item.notes_ua || item.notes || '';
}

export function getLocalizedTargetLanguage(lang?: AppLanguage | string | null): 'ua' | 'en' | 'no' {
  return normalizeAppLanguage(lang);
}