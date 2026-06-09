// services/i18n.ts
// Norsk Trainer App — internationalization
// Supported: ua (Ukrainian), en (English), no (Norwegian)

export type AppLanguage = 'ua' | 'en' | 'no';

type TranslationKey =
  // General
  | 'close' | 'cancel' | 'save' | 'add' | 'remove' | 'search' | 'clear'
  | 'loading' | 'error' | 'done' | 'yes' | 'no_word'
  // Verification
  | 'verification' | 'verified_by' | 'registered_in' | 'confirmed_by'
  | 'dictionary_entry' | 'dictionary_match' | 'normative_reference'
  | 'usage_evidence' | 'component_match' | 'ai_candidate'
  | 'registered_entry' | 'learner_dictionary' | 'community_dictionary'
  | 'no_authoritative_sources'
  // Verification descriptions
  | 'dict_entry_desc' | 'dict_match_desc' | 'normative_ref_desc'
  | 'usage_evidence_desc' | 'component_match_desc' | 'ai_candidate_desc'
  // 360°
  | 'lexeme_360' | 'grammar' | 'base_verb' | 'particle_verbs'
  | 'expressions' | 'idioms' | 'synonyms' | 'collocations'
  | 'no_connections' | 'no_network_yet' | 'connections_found'
  // Reading
  | 'reading_mode' | 'text_analysis' | 'word_analysis'
  | 'analyze_pwa' | 'analyze_ai' | 'word_found' | 'word_not_found'
  | 'add_to_learning' | 'already_learning' | 'pronounce' | 'stop_audio'
  | 'total' | 'learned' | 'in_base' | 'not_in_base' | 'coverage'
  | 'sentences' | 'word_map' | 'new_word' | 'preview'
  | 'add_to_database' | 'added_to_database' | 'already_in_database'
  // Forms
  | 'forms' | 'present' | 'past' | 'perfect' | 'group'
  | 'indef_sg' | 'def_sg' | 'indef_pl' | 'def_pl' | 'gender'
  | 'positive' | 'neuter' | 'plural' | 'comparative' | 'superlative'
  // Settings
  | 'settings' | 'app_language' | 'interface_language'
  | 'language_ua' | 'language_en' | 'language_no';

type Translations = Record<TranslationKey, string>;

const UA: Translations = {
  close: 'Закрити', cancel: 'Скасувати', save: 'Зберегти',
  add: 'Додати', remove: 'Видалити', search: 'Пошук', clear: 'Очистити',
  loading: 'Завантаження...', error: 'Помилка', done: 'Готово',
  yes: 'Так', no_word: 'Ні',
  verification: 'Верифікація', verified_by: 'Верифіковано',
  registered_in: 'Зареєстровано в', confirmed_by: 'Підтверджено',
  dictionary_entry: 'Словниковий запис', dictionary_match: 'Знайдено в словнику',
  normative_reference: 'Нормативний запис', usage_evidence: 'Підтверджено вживанням',
  component_match: 'Компоненти верифіковані', ai_candidate: 'Кандидат AI',
  registered_entry: 'Зареєстрований запис', learner_dictionary: 'Навчальний словник',
  community_dictionary: 'Спільнотний словник', no_authoritative_sources: 'Авторитетних джерел не знайдено',
  dict_entry_desc: 'Зареєстровано як окремий запис в авторитетному словнику.',
  dict_match_desc: 'Знайдено як цілий вираз в авторитетних джерелах, але окремого запису немає.',
  normative_ref_desc: 'Підтверджено Språkrådet як визнану норвезьку мовну конструкцію.',
  usage_evidence_desc: 'Підтверджено прикладами вживання в авторитетних джерелах.',
  component_match_desc: 'Окремі слова зареєстровані, але вираз як одиниця — ні.',
  ai_candidate_desc: 'Авторитетного підтвердження не знайдено. Лише AI-аналіз.',
  lexeme_360: '360°', grammar: 'Граматика', base_verb: 'Базове дієслово',
  particle_verbs: 'Дієслова з часткою', expressions: 'Вирази',
  idioms: 'Ідіоми', synonyms: 'Синоніми', collocations: 'Колокації',
  no_connections: 'Зв\'язки не знайдено', no_network_yet: 'Лексична мережа ще не побудована.',
  connections_found: 'зв\'язків знайдено',
  reading_mode: 'Аналіз тексту', text_analysis: 'Аналіз тексту',
  word_analysis: 'Аналіз слова', analyze_pwa: 'Аналіз як у PWA',
  analyze_ai: 'AI аналіз', word_found: 'Слово знайдено.',
  word_not_found: 'Не вдалося обробити слово.',
  add_to_learning: 'Додати до навчання', already_learning: 'У навчанні',
  pronounce: 'Озвучити', stop_audio: 'Зупинити звук',
  total: 'Усього', learned: 'Вивчені', in_base: 'Є в базі',
  not_in_base: 'Немає в базі', coverage: 'Покриття',
  sentences: 'Речення', word_map: 'Розмітка слів', new_word: 'Нове слово',
  preview: 'Preview', add_to_database: 'Додати в базу',
  added_to_database: 'Додано в базу', already_in_database: 'Вже є в базі',
  forms: 'Форми', present: 'тепер.', past: 'минул.', perfect: 'перф.',
  group: 'група', indef_sg: 'неб. одн.', def_sg: 'б. одн.',
  indef_pl: 'неб. мн.', def_pl: 'б. мн.', gender: 'рід',
  positive: 'позит.', neuter: 'серед.', plural: 'множ.',
  comparative: 'порівн.', superlative: 'найв.',
  settings: 'Налаштування', app_language: 'Мова додатку',
  interface_language: 'Мова інтерфейсу',
  language_ua: 'Українська', language_en: 'English', language_no: 'Norsk',
};

const EN: Translations = {
  close: 'Close', cancel: 'Cancel', save: 'Save',
  add: 'Add', remove: 'Remove', search: 'Search', clear: 'Clear',
  loading: 'Loading...', error: 'Error', done: 'Done',
  yes: 'Yes', no_word: 'No',
  verification: 'Verification', verified_by: 'Verified by',
  registered_in: 'Registered in', confirmed_by: 'Confirmed by',
  dictionary_entry: 'Dictionary entry', dictionary_match: 'Dictionary match',
  normative_reference: 'Normative reference', usage_evidence: 'Usage evidence',
  component_match: 'Components verified', ai_candidate: 'AI candidate',
  registered_entry: 'Registered entry', learner_dictionary: 'Learner dictionary',
  community_dictionary: 'Community dictionary', no_authoritative_sources: 'No authoritative sources found',
  dict_entry_desc: 'Registered as a separate entry in an authoritative dictionary.',
  dict_match_desc: 'Found as a whole unit in authoritative sources, but no separate entry.',
  normative_ref_desc: 'Confirmed by Språkrådet as a recognised Norwegian language construction.',
  usage_evidence_desc: 'Confirmed through usage examples in authoritative sources.',
  component_match_desc: 'Individual words are registered, but the full expression is not.',
  ai_candidate_desc: 'No authoritative confirmation found. Based on AI analysis only.',
  lexeme_360: '360°', grammar: 'Grammar', base_verb: 'Base verb',
  particle_verbs: 'Particle verbs', expressions: 'Expressions',
  idioms: 'Idioms', synonyms: 'Synonyms', collocations: 'Collocations',
  no_connections: 'No connections found', no_network_yet: 'The lexical network has not been built yet.',
  connections_found: 'connections found',
  reading_mode: 'Reading Mode', text_analysis: 'Text Analysis',
  word_analysis: 'Word Analysis', analyze_pwa: 'PWA-style analysis',
  analyze_ai: 'AI analysis', word_found: 'Word found.',
  word_not_found: 'Could not process word.',
  add_to_learning: 'Add to learning', already_learning: 'In learning',
  pronounce: 'Pronounce', stop_audio: 'Stop audio',
  total: 'Total', learned: 'Learned', in_base: 'In base',
  not_in_base: 'Not in base', coverage: 'Coverage',
  sentences: 'Sentences', word_map: 'Word map', new_word: 'New word',
  preview: 'Preview', add_to_database: 'Add to database',
  added_to_database: 'Added to database', already_in_database: 'Already in database',
  forms: 'Forms', present: 'present', past: 'past', perfect: 'perfect',
  group: 'group', indef_sg: 'indef. sg', def_sg: 'def. sg',
  indef_pl: 'indef. pl', def_pl: 'def. pl', gender: 'gender',
  positive: 'positive', neuter: 'neuter', plural: 'plural',
  comparative: 'comparative', superlative: 'superlative',
  settings: 'Settings', app_language: 'App language',
  interface_language: 'Interface language',
  language_ua: 'Ukrainian', language_en: 'English', language_no: 'Norwegian',
};

const NO: Translations = {
  close: 'Lukk', cancel: 'Avbryt', save: 'Lagre',
  add: 'Legg til', remove: 'Fjern', search: 'Søk', clear: 'Tøm',
  loading: 'Laster...', error: 'Feil', done: 'Ferdig',
  yes: 'Ja', no_word: 'Nei',
  verification: 'Verifisering', verified_by: 'Verifisert av',
  registered_in: 'Registrert i', confirmed_by: 'Bekreftet av',
  dictionary_entry: 'Ordbokartikel', dictionary_match: 'Funnet i ordbok',
  normative_reference: 'Normativ referanse', usage_evidence: 'Brukseksempel',
  component_match: 'Komponenter verifisert', ai_candidate: 'AI-kandidat',
  registered_entry: 'Registrert oppslag', learner_dictionary: 'Innlæringsordbok',
  community_dictionary: 'Fellesskapsordbok', no_authoritative_sources: 'Ingen autoritative kilder funnet',
  dict_entry_desc: 'Registrert som eget oppslag i en autoritativ ordbok.',
  dict_match_desc: 'Funnet som helhet i autoritative kilder, men uten eget oppslag.',
  normative_ref_desc: 'Bekreftet av Språkrådet som en anerkjent norsk språkkonstruksjon.',
  usage_evidence_desc: 'Bekreftet gjennom brukseksempler i autoritative kilder.',
  component_match_desc: 'Enkeltord er registrert, men hele uttrykket er ikke det.',
  ai_candidate_desc: 'Ingen autoritativ bekreftelse funnet. Kun AI-analyse.',
  lexeme_360: '360°', grammar: 'Grammatikk', base_verb: 'Grunnverb',
  particle_verbs: 'Partikelverb', expressions: 'Uttrykk',
  idioms: 'Idiomer', synonyms: 'Synonymer', collocations: 'Kollokasjoner',
  no_connections: 'Ingen forbindelser funnet', no_network_yet: 'Det leksikalske nettverket er ikke bygget ennå.',
  connections_found: 'forbindelser funnet',
  reading_mode: 'Lesetekst', text_analysis: 'Tekstanalyse',
  word_analysis: 'Ordanalyse', analyze_pwa: 'PWA-analyse',
  analyze_ai: 'AI-analyse', word_found: 'Ord funnet.',
  word_not_found: 'Kunne ikke behandle ordet.',
  add_to_learning: 'Legg til læring', already_learning: 'I læring',
  pronounce: 'Uttale', stop_audio: 'Stopp lyd',
  total: 'Totalt', learned: 'Lært', in_base: 'I basen',
  not_in_base: 'Ikke i basen', coverage: 'Dekning',
  sentences: 'Setninger', word_map: 'Ordkart', new_word: 'Nytt ord',
  preview: 'Forhåndsvis', add_to_database: 'Legg til i database',
  added_to_database: 'Lagt til i database', already_in_database: 'Allerede i database',
  forms: 'Former', present: 'presens', past: 'preteritum', perfect: 'perfektum',
  group: 'gruppe', indef_sg: 'ub. ent.', def_sg: 'best. ent.',
  indef_pl: 'ub. flt.', def_pl: 'best. flt.', gender: 'kjønn',
  positive: 'positiv', neuter: 'intetkjønn', plural: 'flertall',
  comparative: 'komparativ', superlative: 'superlativ',
  settings: 'Innstillinger', app_language: 'Appspråk',
  interface_language: 'Grensesnittspråk',
  language_ua: 'Ukrainsk', language_en: 'Engelsk', language_no: 'Norsk',
};

const TRANSLATIONS: Record<AppLanguage, Translations> = { ua: UA, en: EN, no: NO };

export function t(key: TranslationKey, lang: AppLanguage): string {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function useT(lang: AppLanguage) {
  return (key: TranslationKey) => t(key, lang);
}