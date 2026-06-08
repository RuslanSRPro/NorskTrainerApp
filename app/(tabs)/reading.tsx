import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  addLexemeToLearningFromSupabase,
  addPreviewWordViaAppsScript,
  addExpressionCandidateToSupabase,
  analyzeTextViaAppsScript,
  boostReadingLexemeHitsInSupabase,
  getReadingLexemesFromSupabase,
  inspectWordViaAppsScript,
  translateSentenceWithAI,
} from '@/services/api';
import { speakNorwegian, stopSpeech } from '@/services/speech';
import { useSettingsStore } from '@/store/settingsStore';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Lexeme360 } from '@/components/Lexeme360';

type WordStatus = 'learned' | 'in_base' | 'unknown';

type AnalysisSource = 'pwa' | 'ai';

type AnalysisItem = {
  text: string;
  normalized: string;
  status: WordStatus;
  translation?: string;
  lexeme?: any;
};

type SentenceAIResult = {
  translation?: string;
  grammarNotes?: string[];
  expressions?: string[];
  literalMeaning?: string;
  difficulty?: string;
};

type AnalyzerCandidate = {
  id: string;
  selected: boolean;
  source: AnalysisSource;
  kind: 'missing' | 'expression';
  status: WordStatus;
  text?: string;
  lemma?: string;
  type?: string;
  meaning_ua?: string;
  meaning_en?: string;
  example?: string;
  confidence?: string;
  cefr?: string;
  frequency_level?: string;
  expression_subtype?: string;
  raw: any;
  lexeme?: any;
  added?: boolean;
  error?: string;
};

// ── helpers for word forms ────────────────────────────────────────────────────
function getFormLabels(word: any): { label: string; value: string }[] {
  const forms: { label: string; value: string }[] = [];
  const pos = (word?.pos || word?.type || word?.category || '').toLowerCase();

  // Noun forms from noun_forms join or f1-f5 fields
  if (word?.noun_forms) {
    const nf = word.noun_forms;
    if (nf.ubest_entall)   forms.push({ label: 'ub. ent.',  value: nf.ubest_entall });
    if (nf.best_entall)    forms.push({ label: 'best. ent.', value: nf.best_entall });
    if (nf.ubest_flertall) forms.push({ label: 'ub. flt.',  value: nf.ubest_flertall });
    if (nf.best_flertall)  forms.push({ label: 'best. flt.', value: nf.best_flertall });
    return forms;
  }

  // Verb forms from verb_forms join
  if (word?.verb_forms) {
    const vf = word.verb_forms;
    if (vf.infinitiv)   forms.push({ label: 'infinitiv',  value: vf.infinitiv });
    if (vf.presens)     forms.push({ label: 'presens',    value: vf.presens });
    if (vf.preteritum)  forms.push({ label: 'preteritum', value: vf.preteritum });
    if (vf.perfektum)   forms.push({ label: 'perfektum',  value: vf.perfektum });
    return forms;
  }

  // Adjective forms
  if (word?.adjective_forms) {
    const af = word.adjective_forms;
    if (af.positiv)     forms.push({ label: 'positiv',  value: af.positiv });
    if (af.intetkjonn)  forms.push({ label: 'intetkjønn', value: af.intetkjonn });
    if (af.flertall)    forms.push({ label: 'flertall', value: af.flertall });
    return forms;
  }

  // Fallback: flat f1-f5 fields
  const isVerb = pos.includes('verb');
  const isNoun = pos.includes('noun') || pos.includes('subst');
  const isAdj  = pos.includes('adj');

  if (isVerb) {
    if (word?.f1) forms.push({ label: 'infinitiv',  value: word.f1 });
    if (word?.f2) forms.push({ label: 'presens',    value: word.f2 });
    if (word?.f3) forms.push({ label: 'preteritum', value: word.f3 });
    if (word?.f4) forms.push({ label: 'perfektum',  value: word.f4 });
  } else if (isNoun) {
    if (word?.f1) forms.push({ label: 'ub. ent.',   value: word.f1 });
    if (word?.f2) forms.push({ label: 'best. ent.', value: word.f2 });
    if (word?.f3) forms.push({ label: 'ub. flt.',   value: word.f3 });
    if (word?.f4) forms.push({ label: 'best. flt.', value: word.f4 });
  } else if (isAdj) {
    if (word?.f1) forms.push({ label: 'positiv',    value: word.f1 });
    if (word?.f2) forms.push({ label: 'intetkjønn', value: word.f2 });
    if (word?.f3) forms.push({ label: 'flertall',   value: word.f3 });
  } else {
    // Unknown pos — show raw
    if (word?.f1) forms.push({ label: 'f1', value: word.f1 });
    if (word?.f2) forms.push({ label: 'f2', value: word.f2 });
    if (word?.f3) forms.push({ label: 'f3', value: word.f3 });
    if (word?.f4) forms.push({ label: 'f4', value: word.f4 });
    if (word?.f5) forms.push({ label: 'f5', value: word.f5 });
  }
  return forms;
}
// ─────────────────────────────────────────────────────────────────────────────

function normalizeToken(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»]/g, '')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

function splitWords(text: string) {
  return String(text || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSentences(text: string) {
  return (
    String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .match(/[^.!?]+[.!?]?/g)
      ?.map((item) => item.trim())
      .filter(Boolean) || []
  );
}

function makeCandidateId(source: string, kind: string, item: any, index: number) {
  return `${source}-${kind}-${item?.lemma || item?.text || 'item'}-${index}`;
}

function displayCandidateText(item: AnalyzerCandidate) {
  return item.lemma || item.text || '';
}

async function boostReadingHits(
  analysisItems: AnalysisItem[],
  preferredUser: string
) {
  try {
    const ids = Array.from(
      new Set(
        analysisItems
          .map((item) => item.lexeme?.id)
          .filter(Boolean)
      )
    );
    if (ids.length === 0) return;
    await boostReadingLexemeHitsInSupabase({
      preferred_user: preferredUser,
      lexemeIds: ids,
    });
  } catch (err) {
    console.error('Reading boost error:', err);
  }
}

export default function ReadingScreen() {
  const { preferred_user, app_language } = useSettingsStore();
  const isUa = app_language === 'ua';

  const [text, setText] = useState('');
  const [wordQuery, setWordQuery] = useState('');
  const [wordSearchMessage, setWordSearchMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [pwaLoading, setPwaLoading] = useState(false);
  const [aiTextLoading, setAiTextLoading] = useState(false);
  const [batchAdding, setBatchAdding] = useState(false);

  const [analysis, setAnalysis] = useState<AnalysisItem[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);
  const [error, setError] = useState('');

  const [activeSource, setActiveSource] = useState<AnalysisSource | null>(null);
  const [analyzerResult, setAnalyzerResult] = useState<any>(null);
  const [analyzerCandidates, setAnalyzerCandidates] = useState<AnalyzerCandidate[]>([]);
  const [analyzerMessage, setAnalyzerMessage] = useState('');

  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [sentenceAI, setSentenceAI] = useState<SentenceAIResult | null>(null);
  const [sentenceUsage, setSentenceUsage] = useState<any>(null);
  const [sentenceLoading, setSentenceLoading] = useState(false);
  const [sentenceError, setSentenceError] = useState('');

  const [addingWord, setAddingWord] = useState(false);
  const [addingGlobalWord, setAddingGlobalWord] = useState(false);
  const [previewWord, setPreviewWord] = useState<any>(null);

  const stats = useMemo(() => {
    const total = analysis.length;
    const learned = analysis.filter((item) => item.status === 'learned').length;
    const inBase = analysis.filter((item) => item.status === 'in_base').length;
    const unknown = analysis.filter((item) => item.status === 'unknown').length;
    const coverage =
      total > 0 ? Math.round(((learned + inBase) / total) * 100) : 0;
    return { total, learned, inBase, unknown, coverage };
  }, [analysis]);

  const selectedCandidates = analyzerCandidates.filter(
    (item) => item.selected && !item.added && item.status === 'unknown'
  );

  function clearText() {
    setText('');
    setAnalysis([]);
    setSentences([]);
    setError('');
    setSelectedWord(null);
    setSelectedSentence(null);
    setSentenceAI(null);
    setSentenceUsage(null);
    setSentenceError('');
    setAddingWord(false);
    setActiveSource(null);
    setAnalyzerResult(null);
    setAnalyzerCandidates([]);
    setAnalyzerMessage('');
  }

  function clearWordSearch() {
    setWordQuery('');
    setWordSearchMessage('');
    setPreviewWord(null);
  }

  function openSentence(sentence: string) {
    setSelectedSentence(sentence);
    setSentenceAI(null);
    setSentenceUsage(null);
    setSentenceError('');
  }

  async function buildLocalDictionary() {
    const lexemes = await getReadingLexemesFromSupabase(preferred_user);
    const dictionary = new Map<string, any>();

    function addKey(raw: any, word: any) {
      const key = normalizeToken(String(raw || ''));
      if (!key) return;
      const existing = dictionary.get(key);
      if (!existing || word.learned) {
        dictionary.set(key, word);
      }
    }

    function addKeyVariants(raw: any, word: any) {
      const value = String(raw || '').trim();
      if (!value) return;
      addKey(value, word);
      addKey(value.replace(/^å\s+/i, ''), word);
      addKey(value.replace(/^(en|ei|et)\s+/i, ''), word);
    }

    lexemes.forEach((word: any) => {
      const keys = [
        word.lemma,
        word.word,
        word.display_form,
        word.canonical,
        word.f1,
        word.f2,
        word.f3,
        word.f4,
        word.f5,
      ];
      keys.forEach((key) => addKeyVariants(key, word));
    });

    return dictionary;
  }

  async function analyzeTextLocal() {
    const dictionary = await buildLocalDictionary();

    const result = splitWords(text).map((raw) => {
      const normalized = normalizeToken(raw);
      const found = dictionary.get(normalized);

      let status: WordStatus = 'unknown';
      if (found?.learned) status = 'learned';
      else if (found) status = 'in_base';

      return {
        text: raw,
        normalized,
        status,
        lexeme: found || null,
        translation: found
          ? isUa ? found.ua || found.en : found.en || found.ua
          : '',
      };
    });

    setAnalysis(result);
    setSentences(splitSentences(text));
    boostReadingHits(result, preferred_user);

    return { dictionary, localAnalysis: result };
  }

  function rebuildAnalysisFromEdgeResult(result: any, learnedIds: Set<string>) {
    const knownTextMap = new Map<string, any>();

    for (const item of (result.known || [])) {
      if (!item.found) continue;
      const tokens = (item.text || '').split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        const key = normalizeToken(token);
        if (!key) continue;
        const lexeme = { ...item.found, learned: learnedIds.has(item.found.id) };
        if (!knownTextMap.has(key) || lexeme.learned) {
          knownTextMap.set(key, lexeme);
        }
      }
    }

    for (const item of (result.expressions || [])) {
      if (!item.in_base || !item.found) continue;
      const tokens = (item.text || '').split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        const key = normalizeToken(token);
        if (!key) continue;
        const lexeme = {
          ...item.found,
          ua: item.found.ua || item.meaning_ua || '',
          en: item.found.en || item.meaning_en || '',
          learned: learnedIds.has(item.found.id),
        };
        if (!knownTextMap.has(key) || lexeme.learned) {
          knownTextMap.set(key, lexeme);
        }
      }
    }

    const newAnalysis = splitWords(text).map((raw) => {
      const key = normalizeToken(raw);
      const found = knownTextMap.get(key);

      let status: WordStatus = 'unknown';
      if (found?.learned) status = 'learned';
      else if (found) status = 'in_base';

      return {
        text: raw,
        normalized: key,
        status,
        lexeme: found || null,
        translation: found
          ? isUa ? (found.ua || found.en) : (found.en || found.ua)
          : '',
      };
    });

    setAnalysis(newAnalysis);
    setSentences(splitSentences(text));
    boostReadingHits(newAnalysis, preferred_user);
  }

  function getCandidateLocalStatus(item: any, dictionary: Map<string, any>) {
    if (item?.in_base === true) {
      const lexeme = item?.found || null;
      if (lexeme?.learned) return { status: 'learned' as WordStatus, lexeme };
      return { status: 'in_base' as WordStatus, lexeme };
    }
    if (item?.in_base === false) {
      return { status: 'unknown' as WordStatus, lexeme: null };
    }

    const possibleRawKeys = [
      item?.lemma, item?.text, item?.word, item?.canonical, item?.display_form,
      item?.found?.lemma, item?.found?.word, item?.found?.display_form, item?.found?.canonical,
    ];

    const possibleKeys = new Set<string>();
    possibleRawKeys.forEach((raw) => {
      const value = String(raw || '').trim();
      if (!value) return;
      [value, value.replace(/^å\s+/i, ''), value.replace(/^(en|ei|et)\s+/i, '')]
        .map(normalizeToken)
        .filter(Boolean)
        .forEach((key) => possibleKeys.add(key));
    });

    for (const key of possibleKeys) {
      const found = dictionary.get(key);
      if (found?.learned) return { status: 'learned' as WordStatus, lexeme: found };
      if (found) return { status: 'in_base' as WordStatus, lexeme: found };
    }

    if (item?.found) {
      return { status: 'in_base' as WordStatus, lexeme: item.found };
    }

    return { status: 'unknown' as WordStatus, lexeme: null };
  }

  function buildAnalyzerCandidates(result: any, source: AnalysisSource, dictionary: Map<string, any>) {
    const missing = result?.missing || [];
    const expressions = result?.expressions || [];

    const missingCandidates: AnalyzerCandidate[] = missing.map((item: any, index: number) => {
      const local = getCandidateLocalStatus(item, dictionary);
      return {
        id: makeCandidateId(source, 'missing', item, index),
        selected: false, source, kind: 'missing',
        status: local.status, lexeme: local.lexeme,
        text: item.text || item.lemma || '',
        lemma: item.lemma || item.text || '',
        type: item.type || '',
        meaning_ua: item.meaning_ua || item.translation_ua || item.ua || '',
        meaning_en: item.meaning_en || item.translation_en || item.en || '',
        example: item.example || '', confidence: item.confidence || '',
        cefr: item.cefr || '', frequency_level: item.frequency_level || '',
        expression_subtype: item.expression_subtype || '', raw: item,
      };
    });

    const expressionCandidates: AnalyzerCandidate[] = expressions.map((item: any, index: number) => {
      const local = getCandidateLocalStatus(item, dictionary);
      return {
        id: makeCandidateId(source, 'expression', item, index),
        selected: false, source, kind: 'expression',
        status: local.status, lexeme: local.lexeme,
        text: item.text || item.lemma || '',
        lemma: item.lemma || item.text || '',
        type: item.type || 'expression',
        meaning_ua: item.meaning_ua || item.translation_ua || item.ua || '',
        meaning_en: item.meaning_en || item.translation_en || item.en || '',
        example: item.example || '', confidence: item.confidence || '',
        cefr: item.cefr || '', frequency_level: item.frequency_level || '',
        expression_subtype: item.expression_subtype || '', raw: item,
      };
    });

    return [...missingCandidates, ...expressionCandidates];
  }

  function toggleCandidate(id: string) {
    setAnalyzerCandidates((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.status !== 'unknown' || item.added) return item;
        return { ...item, selected: !item.selected };
      })
    );
  }

  function selectAllUnknownCandidates() {
    setAnalyzerCandidates((prev) =>
      prev.map((item) => ({ ...item, selected: item.status === 'unknown' && !item.added }))
    );
  }

  function unselectAllCandidates() {
    setAnalyzerCandidates((prev) => prev.map((item) => ({ ...item, selected: false })));
  }

  async function checkWord() {
    try {
      const normalizedQuery = normalizeToken(wordQuery);
      if (!normalizedQuery) {
        setWordSearchMessage(isUa ? 'Введи слово для перевірки.' : 'Enter a word to check.');
        return;
      }
      setWordLoading(true);
      setWordSearchMessage('');
      setSelectedWord(null);
      setPreviewWord(null);

      const result = await inspectWordViaAppsScript(normalizedQuery);

      if (result?.found && result?.item) {
        setSelectedWord({
          ...result.item,
          learned: false,
          ua: result.item.ua || result.item.translation_ua || '',
          en: result.item.en || result.item.translation_en || '',
          category: result.item.type || result.item.category || '',
        });
        setWordSearchMessage(isUa ? 'Слово знайдено.' : 'Word found.');
        return;
      }

      if (result?.preview) {
        setPreviewWord(result.preview);
        setWordSearchMessage(
          isUa ? 'Нове слово. Перевір preview перед додаванням.' : 'New word. Review preview before adding.'
        );
        return;
      }

      setWordSearchMessage((result as any)?.message || (isUa ? 'Не вдалося обробити слово.' : 'Could not process word.'));
    } catch (err: any) {
      setWordSearchMessage(String(err?.message || err));
    } finally {
      setWordLoading(false);
    }
  }

  async function inspectUnknownWord(value: string) {
    const query = normalizeToken(value);
    if (!query) return;

    setWordQuery(query);
    setPreviewWord(null);
    setSelectedWord(null);
    setWordSearchMessage('');

    try {
      setWordLoading(true);
      const result = await inspectWordViaAppsScript(query);

      if (result?.found && result?.item) {
        setSelectedWord({
          ...result.item,
          learned: false,
          ua: result.item.ua || result.item.translation_ua || '',
          en: result.item.en || result.item.translation_en || '',
          category: result.item.type || result.item.category || '',
        });
        setWordSearchMessage(isUa ? 'Слово знайдено.' : 'Word found.');
        return;
      }

      if (result?.preview) {
        setPreviewWord(result.preview);
        setWordSearchMessage(isUa ? 'Preview готовий. Можна додати в базу.' : 'Preview ready. You can add it to database.');
        return;
      }

      setWordSearchMessage((result as any)?.message || (isUa ? 'Не вдалося обробити слово.' : 'Could not process word.'));
    } catch (err: any) {
      setWordSearchMessage(String(err?.message || err));
    } finally {
      setWordLoading(false);
    }
  }

  async function addWordToGlobalBase() {
    try {
      if (!previewWord) return;
      setAddingGlobalWord(true);
      const result = await addPreviewWordViaAppsScript(previewWord);
      if (!result?.ok) throw new Error((result as any)?.message || 'Add preview failed');
      setWordSearchMessage(isUa ? 'Слово додано до глобальної бази.' : 'Word added to global database.');
      setPreviewWord(null);
      await checkWord();
    } catch (err: any) {
      setWordSearchMessage(String(err?.message || err));
    } finally {
      setAddingGlobalWord(false);
    }
  }

  async function loadSentenceAI() {
    try {
      if (!selectedSentence) return;
      setSentenceLoading(true);
      setSentenceError('');
      const data = await translateSentenceWithAI({
        sentence: selectedSentence,
        profileKey: preferred_user,
        targetLanguage: isUa ? 'ua' : 'en',
      });
      setSentenceAI(data.result || null);
      setSentenceUsage(data.usage || null);
    } catch (err: any) {
      setSentenceError(String(err?.message || err));
    } finally {
      setSentenceLoading(false);
    }
  }

  async function addCurrentWordToLearning() {
    try {
      if (!selectedWord?.id) return;
      setAddingWord(true);
      await addLexemeToLearningFromSupabase({ preferred_user, lexemeId: selectedWord.id });
      setAnalysis((prev) =>
        prev.map((item) => {
          if (item.lexeme?.id === selectedWord.id) {
            return { ...item, status: 'learned', lexeme: { ...item.lexeme, learned: true } };
          }
          return item;
        })
      );
      setSelectedWord({ ...selectedWord, learned: true });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setAddingWord(false);
    }
  }

  async function runPwaTextAnalysis() {
    try {
      if (!text.trim()) return;
      setPwaLoading(true); setLoading(true); setError('');
      setAnalyzerMessage(''); setAnalyzerResult(null);
      setAnalyzerCandidates([]); setActiveSource('pwa');

      const { dictionary } = await analyzeTextLocal();
      const learnedIds = new Set<string>(
        Array.from(dictionary.values()).filter((w: any) => w.learned && w.id).map((w: any) => w.id)
      );

      const result = await analyzeTextViaAppsScript(text.trim());
      if (!result?.ok) throw new Error(result?.message || 'PWA text analyzer failed');

      rebuildAnalysisFromEdgeResult(result, learnedIds);
      const candidates = buildAnalyzerCandidates(result, 'pwa', dictionary);
      setAnalyzerResult(result);
      setAnalyzerCandidates(candidates);

      const unknownCandidates = candidates.filter((item) => item.status === 'unknown').length;
      const inBaseCandidates = candidates.filter((item) => item.status === 'in_base' || item.status === 'learned').length;

      setAnalyzerMessage(
        isUa
          ? `PWA аналіз готовий. У базі: ${inBaseCandidates}, кандидатів на додавання: ${unknownCandidates}. Галочки зняті — вибери потрібні.`
          : `PWA analysis ready. In base: ${inBaseCandidates}, candidates to add: ${unknownCandidates}. Nothing is preselected.`
      );
    } catch (err: any) {
      setAnalyzerMessage(String(err?.message || err));
    } finally {
      setPwaLoading(false); setLoading(false);
    }
  }

  async function runAiTextAnalysis() {
    try {
      if (!text.trim()) return;
      setAiTextLoading(true); setLoading(true); setError('');
      setAnalyzerMessage(''); setAnalyzerResult(null);
      setAnalyzerCandidates([]); setActiveSource('ai');

      const { dictionary } = await analyzeTextLocal();
      const learnedIds = new Set<string>(
        Array.from(dictionary.values()).filter((w: any) => w.learned && w.id).map((w: any) => w.id)
      );

      const result = await analyzeTextViaAppsScript(text.trim());
      if (!result?.ok) throw new Error(result?.message || 'AI text analyzer failed');

      rebuildAnalysisFromEdgeResult(result, learnedIds);
      const candidates = buildAnalyzerCandidates(result, 'ai', dictionary);
      setAnalyzerResult(result);
      setAnalyzerCandidates(candidates);

      const unknownCandidates = candidates.filter((item) => item.status === 'unknown').length;
      const inBaseCandidates = candidates.filter((item) => item.status === 'in_base' || item.status === 'learned').length;

      setAnalyzerMessage(
        isUa
          ? `AI аналіз готовий. У базі: ${inBaseCandidates}, кандидатів на додавання: ${unknownCandidates}. Галочки зняті — вибери потрібні.`
          : `AI analysis ready. In base: ${inBaseCandidates}, candidates to add: ${unknownCandidates}. Nothing is preselected.`
      );
    } catch (err: any) {
      setAnalyzerMessage(String(err?.message || err));
    } finally {
      setAiTextLoading(false); setLoading(false);
    }
  }

  async function addSelectedAnalyzerItems() {
    try {
      if (!selectedCandidates.length) {
        setAnalyzerMessage(isUa ? 'Вибери слова для додавання.' : 'Select words to add.');
        return;
      }

      setBatchAdding(true);
      setAnalyzerMessage(
        isUa ? `Додаю вибрані елементи: ${selectedCandidates.length}...` : `Adding selected items: ${selectedCandidates.length}...`
      );

      let okCount = 0, duplicateCount = 0, failCount = 0;
      const processed: Record<string, { ok: boolean; duplicate?: boolean; message?: string; foundItem?: any }> = {};

      for (const candidate of selectedCandidates) {
        const query = displayCandidateText(candidate).trim();
        if (!query) { failCount++; processed[candidate.id] = { ok: false, message: 'Empty candidate' }; continue; }

        try {
          if (candidate.kind === 'expression') {
            const addResult = await addExpressionCandidateToSupabase({ candidate: candidate.raw, preferred_user });
            if (!addResult?.ok) { failCount++; processed[candidate.id] = { ok: false, message: addResult?.message || 'Add expression failed' }; continue; }
            okCount += addResult.alreadyExists ? 0 : 1;
            duplicateCount += addResult.alreadyExists ? 1 : 0;
            processed[candidate.id] = { ok: true, duplicate: addResult.alreadyExists, message: addResult.alreadyExists ? (isUa ? 'Вже є в базі' : 'Already in database') : (isUa ? 'Додано в базу' : 'Added to database'), foundItem: addResult.item || null };
            continue;
          }

          const inspectResult = await inspectWordViaAppsScript(query);
          if (inspectResult?.found && inspectResult?.item) {
            duplicateCount++;
            processed[candidate.id] = { ok: true, duplicate: true, message: isUa ? 'Вже є в базі' : 'Already in database', foundItem: inspectResult.item };
            continue;
          }

          if (!inspectResult?.preview) { failCount++; processed[candidate.id] = { ok: false, message: (inspectResult as any)?.message || (isUa ? 'Preview не створено' : 'Preview was not created') }; continue; }

          const addResult = await addPreviewWordViaAppsScript(inspectResult.preview);
          if (!addResult?.ok) { failCount++; processed[candidate.id] = { ok: false, message: (addResult as any)?.message || 'Add preview failed' }; continue; }

          const recheckResult = await inspectWordViaAppsScript(inspectResult.preview.word || query);
          okCount++;
          processed[candidate.id] = { ok: true, message: (addResult as any)?.message || (isUa ? 'Додано в базу' : 'Added to database'), foundItem: recheckResult?.item || null };
        } catch (err: any) {
          failCount++;
          processed[candidate.id] = { ok: false, message: String(err?.message || err) };
        }
      }

      setAnalyzerCandidates((prev) =>
        prev.map((candidate) => {
          const result = processed[candidate.id];
          if (!result) return candidate;
          if (!result.ok) return { ...candidate, selected: false, error: result.message || 'Add failed' };
          return { ...candidate, selected: false, added: true, status: 'in_base', lexeme: result.foundItem || candidate.lexeme, error: '' };
        })
      );

      const { dictionary } = await analyzeTextLocal();
      setAnalyzerCandidates((prev) =>
        prev.map((candidate) => {
          const local = getCandidateLocalStatus(candidate.raw, dictionary);
          return { ...candidate, status: local.status, lexeme: local.lexeme || candidate.lexeme, selected: false, added: candidate.added || local.status === 'in_base' || local.status === 'learned' };
        })
      );

      setAnalyzerMessage(
        isUa ? `Готово. Додано: ${okCount}, вже було: ${duplicateCount}, помилок: ${failCount}.` : `Done. Added: ${okCount}, already existed: ${duplicateCount}, errors: ${failCount}.`
      );
    } catch (err: any) {
      setAnalyzerMessage(String(err?.message || err));
    } finally {
      setBatchAdding(false);
    }
  }

  async function inspectCandidate(candidate: AnalyzerCandidate) {
    if (candidate.lexeme) { setSelectedWord(candidate.lexeme); return; }
    await inspectUnknownWord(displayCandidateText(candidate));
  }

  const unknownWords = analysis.filter((item) => item.status === 'unknown' && item.normalized);
  const inBaseWords = analysis.filter((item) => item.status === 'in_base' && item.normalized);
  const uniqueUnknownWords = Array.from(new Set(unknownWords.map((item) => item.normalized)));
  const uniqueInBaseWords = Array.from(new Map(inBaseWords.map((item) => [item.normalized, item])).values());
  const unknownCandidatesCount = analyzerCandidates.filter((item) => item.status === 'unknown').length;
  const inBaseCandidatesCount = analyzerCandidates.filter((item) => item.status === 'in_base' || item.status === 'learned').length;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{isUa ? '📖 Аналіз тексту' : '📖 Reading Mode'}</Text>
        <Text style={styles.subtitle}>
          {isUa
            ? 'PWA аналіз і AI аналіз працюють окремо, але обидва використовують локальну базу для підсвітки.'
            : 'PWA analysis and AI analysis work independently, but both use the local base for highlighting.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isUa ? '🔎 Аналіз слова' : '🔎 Word Analysis'}</Text>
          <TextInput
            style={styles.wordInput}
            value={wordQuery}
            onChangeText={setWordQuery}
            placeholder={isUa ? 'Введи слово будь-якою мовою...' : 'Enter word in any language...'}
            autoCapitalize="none"
          />
          <View style={styles.actionsRow}>
            <Pressable style={[styles.button, styles.analyzeButton, wordLoading && styles.disabledButton]} disabled={wordLoading || !wordQuery.trim()} onPress={checkWord}>
              <Text style={styles.buttonText}>{wordLoading ? (isUa ? 'Пошук...' : 'Searching...') : isUa ? 'Перевірити' : 'Check'}</Text>
            </Pressable>
            <Pressable style={styles.clearButton} onPress={clearWordSearch}>
              <Text style={styles.clearButtonText}>{isUa ? 'Очистити' : 'Clear'}</Text>
            </Pressable>
          </View>

          {previewWord ? (
            <View style={styles.previewBox}>
              <Text style={styles.sectionTitle}>{isUa ? '🆕 Preview слова' : '🆕 Word Preview'}</Text>
              <Text style={styles.modalWord}>{previewWord.word}</Text>
              <Text style={styles.modalTranslation}>
                {isUa ? previewWord.translation_ua || previewWord.translation_en : previewWord.translation_en || previewWord.translation_ua}
              </Text>
              <Text style={styles.modalCategory}>
                {previewWord.type || previewWord.category || ''}{previewWord.gender ? ` · ${previewWord.gender}` : ''}
              </Text>
              <View style={styles.formsBox}>
                {getFormLabels(previewWord).map(({ label, value }) => (
                  <View key={label} style={styles.formRow}>
                    <Text style={styles.formLabel}>{label}</Text>
                    <Text style={styles.formText}>{value}</Text>
                  </View>
                ))}
              </View>
              {previewWord.example ? <View style={styles.exampleBox}><Text style={styles.exampleText}>{previewWord.example}</Text></View> : null}
              {previewWord.notes_ua ? <View style={styles.placeholderBox}><Text style={styles.placeholderText}>{previewWord.notes_ua}</Text></View> : null}
              <Pressable style={[styles.addButton, addingGlobalWord && styles.disabledButton]} disabled={addingGlobalWord} onPress={addWordToGlobalBase}>
                <Text style={styles.addButtonText}>{addingGlobalWord ? (isUa ? 'Додавання...' : 'Adding...') : isUa ? '➕ Додати preview у базу' : '➕ Add preview to database'}</Text>
              </Pressable>
            </View>
          ) : null}

          {wordSearchMessage ? <View style={styles.notFoundBox}><Text style={styles.notFoundText}>{wordSearchMessage}</Text></View> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isUa ? '🧾 Аналіз тексту' : '🧾 Text Analysis'}</Text>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            placeholder="Jeg har hatt det travelt i det siste..."
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actionsColumn}>
            <Pressable style={[styles.pwaButton, pwaLoading && styles.disabledButton]} disabled={pwaLoading || aiTextLoading || !text.trim()} onPress={runPwaTextAnalysis}>
              <Text style={styles.pwaButtonText}>{pwaLoading ? (isUa ? 'PWA аналіз...' : 'PWA analyzing...') : isUa ? '🧾 Аналіз як у PWA' : '🧾 PWA-style analysis'}</Text>
            </Pressable>
            <Pressable style={[styles.aiTextButton, aiTextLoading && styles.disabledButton]} disabled={pwaLoading || aiTextLoading || !text.trim()} onPress={runAiTextAnalysis}>
              <Text style={styles.aiTextButtonText}>{aiTextLoading ? (isUa ? 'AI аналіз...' : 'AI analyzing...') : isUa ? '✨ AI аналіз' : '✨ AI analysis'}</Text>
            </Pressable>
            <Pressable style={styles.clearWideButton} onPress={clearText}>
              <Text style={styles.clearButtonText}>{isUa ? 'Очистити' : 'Clear'}</Text>
            </Pressable>
          </View>
        </View>

        {loading || pwaLoading || aiTextLoading ? <ActivityIndicator size="large" color="#0EA5E9" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {analyzerMessage ? <View style={styles.analyzerMessageBox}><Text style={styles.analyzerMessageText}>{analyzerMessage}</Text></View> : null}

        {analysis.length > 0 ? (
          <>
            <View style={styles.statsGrid}>
              <Stat label={isUa ? 'Усього' : 'Total'} value={stats.total} />
              <Stat label={isUa ? 'Вивчені' : 'Learned'} value={stats.learned} />
              <Stat label={isUa ? 'Є в базі' : 'In base'} value={stats.inBase} />
              <Stat label={isUa ? 'Немає в базі' : 'Not in base'} value={stats.unknown} />
              <Stat label="Coverage" value={`${stats.coverage}%`} />
            </View>
            <View style={styles.legendCard}>
              <Text style={styles.legendText}>🟢 {isUa ? 'Вивчено' : 'Learned'}</Text>
              <Text style={styles.legendText}>🟡 {isUa ? 'Є в базі' : 'In database'}</Text>
              <Text style={styles.legendText}>🔴 {isUa ? 'Немає в базі / кандидат' : 'Not in database / candidate'}</Text>
            </View>
          </>
        ) : null}

        {analyzerCandidates.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {activeSource === 'ai' ? (isUa ? '✨ AI кандидати' : '✨ AI candidates') : (isUa ? '🧾 PWA кандидати' : '🧾 PWA candidates')}
            </Text>
            <Text style={styles.methodText}>
              {isUa
                ? `У базі: ${inBaseCandidatesCount} · Кандидати на додавання: ${unknownCandidatesCount} · Вибрано: ${selectedCandidates.length}`
                : `In base: ${inBaseCandidatesCount} · Add candidates: ${unknownCandidatesCount} · Selected: ${selectedCandidates.length}`}
            </Text>
            <View style={styles.actionsRow}>
              <Pressable style={styles.smallControlButton} onPress={selectAllUnknownCandidates}>
                <Text style={styles.smallControlButtonText}>{isUa ? 'Вибрати нові' : 'Select new'}</Text>
              </Pressable>
              <Pressable style={styles.smallControlButton} onPress={unselectAllCandidates}>
                <Text style={styles.smallControlButtonText}>{isUa ? 'Зняти всі' : 'Clear all'}</Text>
              </Pressable>
            </View>

            {analyzerCandidates.map((candidate) => (
              <View key={candidate.id} style={[styles.candidateCard, candidate.status === 'learned' && styles.candidateLearned, candidate.status === 'in_base' && styles.candidateInBase, candidate.status === 'unknown' && styles.candidateUnknown]}>
                <Pressable style={styles.candidateHeader} onPress={() => toggleCandidate(candidate.id)}>
                  <Text style={styles.checkboxText}>{candidate.added ? '✅' : candidate.status !== 'unknown' ? '🟡' : candidate.selected ? '☑️' : '⬜️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.candidateTitle}>{displayCandidateText(candidate)}</Text>
                    <Text style={styles.candidateMeta}>
                      {candidate.status === 'learned' ? (isUa ? 'вже в навчанні' : 'already in learning') : candidate.status === 'in_base' ? (isUa ? 'є в базі' : 'in database') : (isUa ? 'немає в базі' : 'not in database')}
                      {' · '}{candidate.kind === 'expression' ? (isUa ? 'вираз' : 'expression') : candidate.type || 'word'}
                      {candidate.expression_subtype ? ` · ${candidate.expression_subtype}` : ''}
                      {candidate.cefr ? ` · ${candidate.cefr}` : ''}
                      {candidate.frequency_level ? ` · ${candidate.frequency_level}` : ''}
                      {candidate.confidence ? ` · ${candidate.confidence}` : ''}
                    </Text>
                  </View>
                </Pressable>
                {candidate.meaning_ua || candidate.meaning_en ? (
                  <Text style={styles.candidateMeaning}>{isUa ? candidate.meaning_ua || candidate.meaning_en : candidate.meaning_en || candidate.meaning_ua}</Text>
                ) : null}
                {candidate.example ? <Text style={styles.candidateExample}>{candidate.example}</Text> : null}
                {candidate.error ? <Text style={styles.candidateError}>❌ {candidate.error}</Text> : null}
                <Pressable style={styles.previewCandidateButton} onPress={() => inspectCandidate(candidate)}>
                  <Text style={styles.previewCandidateButtonText}>{candidate.status === 'unknown' ? '🔎 Preview' : (isUa ? '📖 Відкрити картку' : '📖 Open card')}</Text>
                </Pressable>
              </View>
            ))}

            <Pressable style={[styles.addButton, batchAdding && styles.disabledButton, selectedCandidates.length === 0 && styles.disabledButton]} disabled={batchAdding || selectedCandidates.length === 0} onPress={addSelectedAnalyzerItems}>
              <Text style={styles.addButtonText}>{batchAdding ? (isUa ? 'Додаю...' : 'Adding...') : isUa ? `➕ Додати вибрані (${selectedCandidates.length})` : `➕ Add selected (${selectedCandidates.length})`}</Text>
            </Pressable>
          </View>
        ) : null}

        {analyzerResult ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{isUa ? '✅ Уже є в базі за аналізом' : '✅ Already in base by analyzer'}</Text>
            {(analyzerResult.known || []).length === 0 ? (
              <Text style={styles.emptyText}>{isUa ? 'Нічого не знайдено.' : 'Nothing found.'}</Text>
            ) : (
              (analyzerResult.known || []).slice(0, 80).map((item: any, index: number) => (
                <View key={`known-${index}`} style={styles.knownAnalyzerItem}>
                  <Text style={styles.knownAnalyzerTitle}>{item.lemma || item.text}</Text>
                  {item.found?.ua || item.found?.en ? (
                    <Text style={styles.knownAnalyzerTranslation}>{isUa ? item.found.ua || item.found.en : item.found.en || item.found.ua}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        {analysis.length > 0 ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{isUa ? '📊 Методологія тексту' : '📊 Text Methodology'}</Text>
              <Text style={styles.methodText}>{isUa ? `Унікальних слів не в базі: ${uniqueUnknownWords.length}` : `Unique words not in base: ${uniqueUnknownWords.length}`}</Text>
              <Text style={styles.methodText}>{isUa ? `Слів є в базі, але не вивчено: ${uniqueInBaseWords.length}` : `Words in base, not learned: ${uniqueInBaseWords.length}`}</Text>
              <Text style={styles.methodText}>{isUa ? `Покриття базою: ${stats.coverage}%` : `Database coverage: ${stats.coverage}%`}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{isUa ? '🧾 Речення' : '🧾 Sentences'}</Text>
              {sentences.map((sentence, index) => (
                <Pressable key={`${sentence}-${index}`} style={styles.sentenceCard} onPress={() => openSentence(sentence)}>
                  <Text style={styles.sentenceText}>{sentence}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{isUa ? '🧩 Розмітка слів' : '🧩 Word map'}</Text>
              <View style={styles.wordWrap}>
                {analysis.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.text}-${index}`}
                    activeOpacity={0.7}
                    onPress={() => { if (item.lexeme) { setSelectedWord(item.lexeme); return; } inspectUnknownWord(item.normalized); }}
                    style={[styles.wordChip, item.status === 'learned' && styles.learnedChip, item.status === 'in_base' && styles.inBaseChip, item.status === 'unknown' && styles.unknownChip]}
                  >
                    <Text style={[styles.wordChipText, item.status === 'learned' && styles.learnedText, item.status === 'in_base' && styles.inBaseText, item.status === 'unknown' && styles.unknownText]}>
                      {item.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{isUa ? '🔴 Не в базі' : '🔴 Not in database'}</Text>
              {uniqueUnknownWords.length === 0 ? (
                <Text style={styles.emptyText}>{isUa ? 'Нових слів не знайдено.' : 'No new words found.'}</Text>
              ) : (
                uniqueUnknownWords.slice(0, 80).map((item, index) => (
                  <Pressable key={`${item}-new-${index}`} onPress={() => inspectUnknownWord(item)}>
                    <Text style={styles.unknownListItem}>{item}</Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* ── Modal: previewWord ───────────────────────────────────────────── */}
      <Modal visible={!!previewWord} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>{isUa ? 'Preview слова' : 'Word preview'}</Text>
              <Text style={styles.modalWord}>{previewWord?.word || previewWord?.lemma || wordQuery}</Text>
              <Text style={styles.modalTranslation}>
                {isUa ? previewWord?.translation_ua || previewWord?.ua || previewWord?.translation_en || previewWord?.en : previewWord?.translation_en || previewWord?.en || previewWord?.translation_ua || previewWord?.ua}
              </Text>
              <Text style={styles.modalCategory}>
                {previewWord?.type || previewWord?.category || ''}{previewWord?.gender ? ` · ${previewWord.gender}` : ''}
              </Text>
              <View style={styles.formsBox}>
                {getFormLabels(previewWord || {}).map(({ label, value }) => (
                  <View key={label} style={styles.formRow}>
                    <Text style={styles.formLabel}>{label}</Text>
                    <Text style={styles.formText}>{value}</Text>
                  </View>
                ))}
              </View>
              {previewWord?.example ? <View style={styles.exampleBox}><Text style={styles.exampleText}>{previewWord.example}</Text></View> : null}
              {previewWord?.notes_ua || previewWord?.notes ? <View style={styles.placeholderBox}><Text style={styles.placeholderText}>{previewWord.notes_ua || previewWord.notes}</Text></View> : null}
              <Pressable style={[styles.addButton, addingGlobalWord && styles.disabledButton]} disabled={addingGlobalWord} onPress={addWordToGlobalBase}>
                <Text style={styles.addButtonText}>{addingGlobalWord ? (isUa ? 'Додавання...' : 'Adding...') : isUa ? '➕ Додати preview у базу' : '➕ Add preview to database'}</Text>
              </Pressable>
              <Pressable style={styles.stopButton} onPress={stopSpeech}><Text style={styles.stopButtonText}>⏹ {isUa ? 'Зупинити звук' : 'Stop audio'}</Text></Pressable>
              <Pressable style={styles.closeButton} onPress={() => { stopSpeech(); setPreviewWord(null); }}><Text style={styles.closeButtonText}>{isUa ? 'Закрити' : 'Close'}</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal: selectedWord ──────────────────────────────────────────── */}
      <Modal visible={!!selectedWord} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>

              {/* Word header */}
              <Text style={styles.modalWord}>{selectedWord?.lemma || selectedWord?.word}</Text>
              <Text style={styles.modalTranslation}>
                {isUa ? selectedWord?.ua || selectedWord?.en : selectedWord?.en || selectedWord?.ua}
              </Text>

              {/* Category + VerificationBadge row */}
              <View style={styles.modalMetaRow}>
                <Text style={styles.modalCategory}>{selectedWord?.category || selectedWord?.type || ''}</Text>
                {selectedWord?.verification_tier ? (
                  <VerificationBadge
                    tier={selectedWord.verification_tier}
                    sourceVerified={selectedWord.source_verified}
                    evidence={selectedWord.verification_evidence}
                    lemma={selectedWord.lemma || selectedWord.word}
                    size="md"
                  />
                ) : null}
              </View>

              {/* Lexeme 360 */}
              {selectedWord?.id && (
                <View style={{ marginTop: 12 }}>
                  <Lexeme360
                    lexemeId={selectedWord.id}
                    lemma={selectedWord.lemma || selectedWord.word}
                    isUa={isUa}
                    onSelectWord={(id, lemma) => {
                      setSelectedWord({ id, word: lemma, lemma });
                    }}
                  />
                </View>
              )}

              {/* Example */}
              {selectedWord?.example ? <View style={styles.exampleBox}><Text style={styles.exampleText}>{selectedWord.example}</Text></View> : null}

              {/* Word forms with labels */}
              {getFormLabels(selectedWord || {}).length > 0 ? (
                <View style={styles.formsBox}>
                  <Text style={styles.formsTitle}>{isUa ? 'Форми' : 'Forms'}</Text>
                  {getFormLabels(selectedWord || {}).map(({ label, value }) => (
                    <View key={label} style={styles.formRow}>
                      <Text style={styles.formLabel}>{label}</Text>
                      <Text style={styles.formText}>{value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Actions */}
              <Pressable style={styles.speakButton} onPress={() => speakNorwegian(selectedWord?.lemma || selectedWord?.word || '')}>
                <Text style={styles.speakButtonText}>🔊 {isUa ? 'Озвучити' : 'Pronounce'}</Text>
              </Pressable>
              {!selectedWord?.learned ? (
                <Pressable style={[styles.addButton, addingWord && styles.disabledButton]} disabled={addingWord} onPress={addCurrentWordToLearning}>
                  <Text style={styles.addButtonText}>{addingWord ? (isUa ? 'Додавання...' : 'Adding...') : isUa ? '➕ Додати до навчання' : '➕ Add to learning'}</Text>
                </Pressable>
              ) : (
                <View style={styles.learnedBadge}><Text style={styles.learnedBadgeText}>✅ {isUa ? 'У навчанні' : 'In learning'}</Text></View>
              )}
              <Pressable style={styles.stopButton} onPress={stopSpeech}><Text style={styles.stopButtonText}>⏹ {isUa ? 'Зупинити звук' : 'Stop audio'}</Text></Pressable>
              <Pressable style={styles.closeButton} onPress={() => { stopSpeech(); setSelectedWord(null); }}><Text style={styles.closeButtonText}>{isUa ? 'Закрити' : 'Close'}</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal: selectedSentence ──────────────────────────────────────── */}
      <Modal visible={!!selectedSentence} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>{isUa ? 'Речення' : 'Sentence'}</Text>
              <Text style={styles.sentenceModalText}>{selectedSentence}</Text>
              <Pressable style={[styles.aiButton, sentenceLoading && styles.disabledButton]} disabled={sentenceLoading} onPress={loadSentenceAI}>
                <Text style={styles.aiButtonText}>{sentenceLoading ? (isUa ? 'AI аналіз...' : 'AI analyzing...') : isUa ? '✨ Перекласти й пояснити' : '✨ Translate & explain'}</Text>
              </Pressable>
              {sentenceError ? <Text style={styles.error}>{sentenceError}</Text> : null}
              {sentenceAI ? (
                <>
                  <View style={styles.placeholderBox}>
                    <Text style={styles.placeholderTitle}>{isUa ? 'Переклад' : 'Translation'}</Text>
                    <Text style={styles.placeholderText}>{sentenceAI.translation || '-'}</Text>
                  </View>
                  {sentenceAI.literalMeaning ? (
                    <View style={styles.placeholderBox}>
                      <Text style={styles.placeholderTitle}>{isUa ? 'Дослівно' : 'Literal meaning'}</Text>
                      <Text style={styles.placeholderText}>{sentenceAI.literalMeaning}</Text>
                    </View>
                  ) : null}
                  <View style={styles.placeholderBox}>
                    <Text style={styles.placeholderTitle}>{isUa ? 'Граматика' : 'Grammar'}</Text>
                    {(sentenceAI.grammarNotes || []).length > 0 ? sentenceAI.grammarNotes?.map((note, index) => <Text key={`grammar-${index}`} style={styles.bulletText}>• {note}</Text>) : <Text style={styles.placeholderText}>-</Text>}
                  </View>
                  <View style={styles.placeholderBox}>
                    <Text style={styles.placeholderTitle}>{isUa ? 'Вирази' : 'Expressions'}</Text>
                    {(sentenceAI.expressions || []).length > 0 ? sentenceAI.expressions?.map((item, index) => <Text key={`expression-${index}`} style={styles.bulletText}>• {item}</Text>) : <Text style={styles.placeholderText}>-</Text>}
                  </View>
                  {sentenceUsage ? <Text style={styles.usageText}>AI: {sentenceUsage.used}/{sentenceUsage.limit}</Text> : null}
                </>
              ) : (
                <View style={styles.placeholderBox}>
                  <Text style={styles.placeholderTitle}>{isUa ? 'AI пояснення' : 'AI explanation'}</Text>
                  <Text style={styles.placeholderText}>{isUa ? 'Натисни кнопку AI, щоб отримати переклад і пояснення.' : 'Press AI button to get translation and explanation.'}</Text>
                </View>
              )}
              <Pressable style={styles.speakButton} onPress={() => speakNorwegian(selectedSentence || '')}><Text style={styles.speakButtonText}>🔊 {isUa ? 'Озвучити речення' : 'Pronounce sentence'}</Text></Pressable>
              <Pressable style={styles.stopButton} onPress={stopSpeech}><Text style={styles.stopButtonText}>⏹ {isUa ? 'Зупинити звук' : 'Stop audio'}</Text></Pressable>
              <Pressable style={styles.closeButton} onPress={() => { stopSpeech(); setSelectedSentence(null); setSentenceAI(null); setSentenceUsage(null); setSentenceError(''); }}><Text style={styles.closeButtonText}>{isUa ? 'Закрити' : 'Close'}</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4ED' },
  content: { paddingTop: 70, paddingHorizontal: 20, paddingBottom: 120 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 10, color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', lineHeight: 24, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, marginBottom: 18 },
  legendCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 18, gap: 6 },
  legendText: { fontSize: 15, fontWeight: '800', color: '#374151' },
  textArea: { minHeight: 170, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 14, fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 14 },
  wordInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 14, fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionsColumn: { gap: 10 },
  button: { backgroundColor: '#0EA5E9', borderRadius: 16, paddingVertical: 16 },
  analyzeButton: { flex: 1 },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontSize: 17, fontWeight: '900' },
  clearButton: { backgroundColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 18, justifyContent: 'center' },
  clearWideButton: { backgroundColor: '#E5E7EB', borderRadius: 16, paddingVertical: 16 },
  clearButtonText: { color: '#111827', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  pwaButton: { backgroundColor: '#E0F2FE', borderRadius: 16, paddingVertical: 16 },
  pwaButtonText: { color: '#0284C7', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  aiTextButton: { backgroundColor: '#F5E8FF', borderRadius: 16, paddingVertical: 16 },
  aiTextButtonText: { color: '#7E22CE', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  previewBox: { marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16 },
  notFoundBox: { marginTop: 14, backgroundColor: '#FEF3C7', borderRadius: 16, padding: 14 },
  notFoundText: { fontSize: 15, fontWeight: '800', color: '#92400E', lineHeight: 22 },
  analyzerMessageBox: { backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, marginBottom: 18 },
  analyzerMessageText: { fontSize: 15, fontWeight: '800', color: '#3730A3', lineHeight: 22 },
  smallControlButton: { flex: 1, backgroundColor: '#E5E7EB', borderRadius: 14, paddingVertical: 12, marginBottom: 12 },
  smallControlButtonText: { color: '#111827', textAlign: 'center', fontSize: 15, fontWeight: '900' },
  candidateCard: { backgroundColor: '#F8FAFC', borderRadius: 18, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  candidateLearned: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  candidateInBase: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  candidateUnknown: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  candidateHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkboxText: { fontSize: 22, lineHeight: 28 },
  candidateTitle: { fontSize: 19, fontWeight: '900', color: '#111827' },
  candidateMeta: { marginTop: 3, fontSize: 13, fontWeight: '800', color: '#6B7280' },
  candidateMeaning: { marginTop: 10, fontSize: 16, fontWeight: '800', color: '#0EA5E9', lineHeight: 23 },
  candidateExample: { marginTop: 10, fontSize: 15, fontWeight: '700', color: '#374151', lineHeight: 22 },
  candidateError: { marginTop: 10, fontSize: 14, fontWeight: '800', color: '#991B1B' },
  previewCandidateButton: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12 },
  previewCandidateButtonText: { color: '#0284C7', textAlign: 'center', fontSize: 15, fontWeight: '900' },
  knownAnalyzerItem: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 10 },
  knownAnalyzerTitle: { fontSize: 17, fontWeight: '900', color: '#166534' },
  knownAnalyzerTranslation: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#374151' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  statCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#0EA5E9' },
  statLabel: { marginTop: 4, fontSize: 13, fontWeight: '800', color: '#6B7280' },
  sectionTitle: { fontSize: 21, fontWeight: '900', color: '#111827', marginBottom: 14 },
  methodText: { fontSize: 16, fontWeight: '800', color: '#374151', lineHeight: 25 },
  sentenceCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 10 },
  sentenceText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#374151' },
  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
  learnedChip: { backgroundColor: '#DCFCE7' },
  inBaseChip: { backgroundColor: '#FEF3C7' },
  unknownChip: { backgroundColor: '#FEE2E2' },
  wordChipText: { fontSize: 15, fontWeight: '800' },
  learnedText: { color: '#166534' },
  inBaseText: { color: '#92400E' },
  unknownText: { color: '#991B1B' },
  unknownListItem: { fontSize: 18, fontWeight: '800', color: '#991B1B', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  emptyText: { fontSize: 16, color: '#6B7280', lineHeight: 24 },
  error: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 14, borderRadius: 12, marginBottom: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxHeight: '88%', backgroundColor: '#FFFFFF', borderRadius: 28, overflow: 'hidden' },
  modalScroll: { width: '100%' },
  modalScrollContent: { padding: 24, paddingBottom: 28 },
  modalLabel: { fontSize: 14, fontWeight: '900', color: '#6B7280', marginBottom: 8 },
  modalWord: { fontSize: 32, fontWeight: '900', color: '#111827' },
  modalTranslation: { marginTop: 10, fontSize: 20, fontWeight: '800', color: '#0EA5E9', lineHeight: 28 },
  modalMetaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  modalCategory: { fontSize: 14, fontWeight: '800', color: '#6B7280' },
  sentenceModalText: { fontSize: 22, lineHeight: 31, fontWeight: '900', color: '#111827' },
  placeholderBox: { marginTop: 18, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14 },
  placeholderTitle: { fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 6 },
  placeholderText: { fontSize: 15, fontWeight: '700', color: '#6B7280', lineHeight: 22 },
  bulletText: { fontSize: 15, fontWeight: '700', color: '#374151', lineHeight: 22, marginBottom: 4 },
  usageText: { marginTop: 12, fontSize: 13, fontWeight: '800', color: '#6B7280', textAlign: 'center' },
  aiButton: { marginTop: 18, backgroundColor: '#F5E8FF', borderRadius: 16, paddingVertical: 16 },
  aiButtonText: { color: '#7E22CE', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  exampleBox: { marginTop: 18, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14 },
  exampleText: { fontSize: 16, fontWeight: '700', color: '#374151', lineHeight: 24 },
  formsBox: { marginTop: 18, gap: 6 },
  formsTitle: { fontSize: 13, fontWeight: '900', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', width: 80 },
  formText: { fontSize: 16, fontWeight: '800', color: '#374151' },
  speakButton: { marginTop: 22, backgroundColor: '#E0F2FE', borderRadius: 16, paddingVertical: 16 },
  speakButtonText: { color: '#0284C7', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  addButton: { marginTop: 14, backgroundColor: '#DCFCE7', borderRadius: 16, paddingVertical: 16 },
  addButtonText: { color: '#166534', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  learnedBadge: { marginTop: 14, backgroundColor: '#DCFCE7', borderRadius: 16, paddingVertical: 14 },
  learnedBadgeText: { color: '#166534', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  stopButton: { marginTop: 14, backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 16 },
  stopButtonText: { color: '#374151', textAlign: 'center', fontSize: 16, fontWeight: '900' },
  closeButton: { marginTop: 14, backgroundColor: '#0EA5E9', borderRadius: 16, paddingVertical: 16 },
  closeButtonText: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '900' },
});