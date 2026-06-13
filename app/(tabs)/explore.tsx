import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLearningWordsFromSupabase,
  saveReviewToSupabase,
} from '@/services/api';
import { TrainingMode } from '@/services/settings';
import {
  speakNorwegian,
  speakNorwegianForms,
  stopSpeech,
} from '@/services/speech';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Lexeme360 } from '@/components/Lexeme360';
import { AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';

type TrainingTask = {
  id: string;
  mode: TrainingMode;
  word: any;
  prompt?: string;
  expected?: string;
  options?: string[];
  formLabel?: string;
};

type UiKey =
  | 'title'
  | 'empty_tasks'
  | 'save_error'
  | 'correct'
  | 'correct_answer'
  | 'context'
  | 'translation'
  | 'forms'
  | 'all_forms'
  | 'tap_to_reveal'
  | 'type_word'
  | 'type_form'
  | 'fill_gap'
  | 'check'
  | 'hint'
  | 'next_task'
  | 'saving'
  | 'hard'
  | 'ok'
  | 'easy'
  | 'open_360'
  | 'verification';

const UI_TEXT: Record<AppLanguage, Record<UiKey, string>> = {
  ua: {
    title: '🎯 Тренування',
    empty_tasks: 'Завдань немає.',
    save_error: 'Не вдалося зберегти відповідь.',
    correct: '✅ Правильно',
    correct_answer: '❌ Правильно:',
    context: 'Контекст',
    translation: 'Переклад',
    forms: 'Форми',
    all_forms: 'Усі форми',
    tap_to_reveal: 'Натисни на картку, щоб показати відповідь',
    type_word: 'Введи слово',
    type_form: 'Введи форму',
    fill_gap: 'Встав слово',
    check: 'Перевірити',
    hint: 'Підказка',
    next_task: 'Наступне завдання',
    saving: 'Збереження...',
    hard: 'Складно',
    ok: 'OK',
    easy: 'Легко',
    open_360: '360°',
    verification: 'Джерела',
  },
  en: {
    title: '🎯 Training',
    empty_tasks: 'No tasks available.',
    save_error: 'Failed to save review.',
    correct: '✅ Correct',
    correct_answer: '❌ Correct:',
    context: 'Context',
    translation: 'Translation',
    forms: 'Forms',
    all_forms: 'All forms',
    tap_to_reveal: 'Tap card to reveal answer',
    type_word: 'Type the word',
    type_form: 'Type the form',
    fill_gap: 'Fill the gap',
    check: 'Check',
    hint: 'Hint',
    next_task: 'Next task',
    saving: 'Saving...',
    hard: 'Hard',
    ok: 'OK',
    easy: 'Easy',
    open_360: '360°',
    verification: 'Sources',
  },
  no: {
    title: '🎯 Trening',
    empty_tasks: 'Ingen oppgaver tilgjengelig.',
    save_error: 'Kunne ikke lagre svaret.',
    correct: '✅ Riktig',
    correct_answer: '❌ Riktig svar:',
    context: 'Kontekst',
    translation: 'Oversettelse',
    forms: 'Former',
    all_forms: 'Alle former',
    tap_to_reveal: 'Trykk på kortet for å vise svaret',
    type_word: 'Skriv ordet',
    type_form: 'Skriv formen',
    fill_gap: 'Fyll inn ordet',
    check: 'Sjekk',
    hint: 'Hint',
    next_task: 'Neste oppgave',
    saving: 'Lagrer...',
    hard: 'Vanskelig',
    ok: 'OK',
    easy: 'Lett',
    open_360: '360°',
    verification: 'Kilder',
  },
};

function makeUi(lang: AppLanguage) {
  return (key: UiKey) => UI_TEXT[lang]?.[key] ?? UI_TEXT.en[key] ?? key;
}


function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeAnswer(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»]/g, '')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .replace(/^(den|det|de)\s+/i, '')
    .replace(/^den\/det\/de\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFormAnswer(value: string) {
  return normalizeAnswer(value)
    .replace(/^(den|det|de)\s+/i, '')
    .replace(/^den\/det\/de\s+/i, '')
    .trim();
}

function splitAcceptedAnswers(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const parts = raw
    .split(/[,;\/|]/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set([raw, ...parts]));
}

function isAcceptedAnswer(input: string, expected: string, mode?: TrainingMode) {
  const normalize = mode === 'forms' ? normalizeFormAnswer : normalizeAnswer;
  const typed = normalize(input);

  if (!typed) return false;

  const accepted = splitAcceptedAnswers(expected).map(normalize).filter(Boolean);

  return accepted.some((answer) => answer === typed);
}

function normalizeChoiceValue(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getCategoryFamily(word: any) {
  const category = String(word?.category || word?.type || '').toLowerCase();

  if (category.includes('verb')) return 'verb';
  if (category.includes('noun')) return 'noun';
  if (category.includes('adjective')) return 'adjective';
  if (category.includes('adverb')) return 'adverb';
  if (category.includes('expression')) return 'expression';

  return category || 'unknown';
}

function isVerbLike(word: any) {
  const category = String(word?.category || word?.type || word?.pos || '').toLowerCase();
  return category.includes('verb');
}

function displayNorwegianLemma(value: string, word?: any) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if (/^å\s+/i.test(raw)) return raw;

  if (isVerbLike(word)) {
    return `å ${raw}`;
  }

  return raw;
}

function getRelationsCount(word: any) {
  const direct = Number(
    word?.relations_count ??
      word?.relation_count ??
      word?.relationsCount ??
      word?.semantic_relations_count
  );

  if (Number.isFinite(direct) && direct > 0) return direct;

  if (Array.isArray(word?.relations)) return word.relations.length;

  return 0;
}

function hasRelations(word: any) {
  return Boolean(
    getRelationsCount(word) > 0 ||
      word?.has_relations ||
      word?.hasRelations
  );
}

function hasVerification(word: any) {
  return Boolean(
    word?.verification_tier ||
      word?.verification_evidence ||
      word?.source_verified
  );
}

function getNestedFirst(value: any) {
  if (Array.isArray(value)) return value[0] || {};
  return value || {};
}

function getFormValue(word: any, keys: string[]) {
  for (const key of keys) {
    const value = word?.[key];
    if (value) return value;
  }

  const verb = getNestedFirst(word?.verb_forms);
  const noun = getNestedFirst(word?.noun_forms);
  const adjective = getNestedFirst(word?.adjective_forms);

  for (const key of keys) {
    const value = verb?.[key] || noun?.[key] || adjective?.[key];
    if (value) return value;
  }

  return '';
}

function getFrequencyValue(word: any) {
  const direct = Number(word?.frequency);
  const nested = Number(word?.srs?.frequency);

  const value = Number.isFinite(direct) ? direct : nested;

  if (!Number.isFinite(value) || value <= 0) {
    return 999999;
  }

  return value;
}

function getPriorityValue(word: any) {
  const direct = Number(word?.priorityScore ?? word?.priority_score);
  const nested = Number(word?.srs?.priority_score);

  const value = Number.isFinite(direct) ? direct : nested;

  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function getWeakValue(word: any) {
  const direct = Number(word?.weakScore ?? word?.weak_score);
  const nested = Number(word?.srs?.weak_score);

  const value = Number.isFinite(direct) ? direct : nested;
  return Number.isFinite(value) ? value : 0;
}

function getPersonalHitsValue(word: any) {
  const direct = Number(word?.personalHits ?? word?.personal_hits);
  const nested = Number(word?.srs?.personal_hits);

  const value = Number.isFinite(direct) ? direct : nested;
  return Number.isFinite(value) ? value : 0;
}

function getMemoryStatusValue(word: any) {
  return String(word?.memoryStatus ?? word?.memory_status ?? word?.srs?.memory_status ?? 'active');
}

function getQueueValue(word: any) {
  const direct = Number(word?.queueScore ?? word?.queue_score);
  const nested = Number(word?.srs?.queue_score);

  const value = Number.isFinite(direct) ? direct : nested;
  return Number.isFinite(value) ? value : 0;
}

function getTrainingBucket(word: any) {
  const status = getMemoryStatusValue(word);
  const weak = getWeakValue(word);
  const hits = getPersonalHitsValue(word);
  const priority = getPriorityValue(word);
  const queue = getQueueValue(word);

  if (status === 'passive_known') return 'passive';
  if (status === 'weak' || weak >= 45 || queue >= 70) return 'weak';
  if (hits > 0 || priority >= 55) return 'reading';
  if (status === 'reinforcement') return 'reinforcement';
  return 'new';
}

function getWordLearningScore(word: any) {
  const frequency = getFrequencyValue(word);
  const frequencyBoost = frequency > 0 ? Math.max(0, 60 - Math.log10(frequency + 1) * 12) : 0;
  const status = getMemoryStatusValue(word);

  let statusBoost = 0;
  if (status === 'weak') statusBoost = 70;
  if (status === 'active') statusBoost = 25;
  if (status === 'reinforcement') statusBoost = 10;
  if (status === 'passive_known') statusBoost = -120;

  return (
    getPriorityValue(word) +
    getWeakValue(word) * 1.6 +
    getQueueValue(word) * 0.7 +
    Math.min(getPersonalHitsValue(word), 30) * 5 +
    frequencyBoost +
    statusBoost
  );
}

function sortWordsForSession(words: any[]) {
  return [...words].sort((a, b) => getWordLearningScore(b) - getWordLearningScore(a));
}

export default function TrainScreen() {
  const [loading, setLoading] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [words, setWords] = useState<any[]>([]);
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [error, setError] = useState('');
  const [answerVisible, setAnswerVisible] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback] = useState('');

  const {
    app_language,
    translation_mode,
    category_filter,
    study_set,
    daily_limit,
    preferred_user,
    training_modes,
    mix_modes,
    training_flow,
    training_layout,
    auto_pronounce,
    pronounce_forms,
    pronounce_after_answer,
    speech_rate,
    loadSettings,
  } = useSettingsStore();

  const currentTask = tasks[taskIndex];
  const current = currentTask?.word;
  const lang = (app_language || 'ua') as AppLanguage;
  const ui = makeUi(lang);

  useEffect(() => {
    loadSettings();

    return () => {
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    loadWords();
  }, [
    app_language,
    translation_mode,
    category_filter,
    study_set,
    daily_limit,
    preferred_user,
    training_modes,
    mix_modes,
    training_flow,
  ]);

  useEffect(() => {
    if (!auto_pronounce || !currentTask || !current || loading) return;

    const timer = setTimeout(() => {
      speakCurrentTask();
    }, 350);

    return () => clearTimeout(timer);
  }, [
    auto_pronounce,
    currentTask?.id,
    loading,
    pronounce_forms,
    speech_rate,
  ]);

  async function loadWords() {
    try {
      setLoading(true);
      setError('');
      setTaskIndex(0);
      setAnswerVisible(false);
      setTypedAnswer('');
      setFeedback('');
      setReviewSaved(false);

      const data = await getLearningWordsFromSupabase({
        preferred_user,
        category_filter,
        study_set,
        daily_limit,
      });

      const queue = buildTaskQueue(data);

      setWords(data);
      setTasks(queue);

      console.log('WORDS:', data.length);
      console.log('TASKS:', queue.length);
      console.log('TRAINING FLOW:', training_flow);
    } catch (error: any) {
      console.log('API error:', error);
      setError(String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  function buildTaskQueue(sourceWords: any[]) {
    const modes: TrainingMode[] =
      training_modes?.length > 0 ? training_modes : ['flashcards'];

    const usableWords = sortWordsForSession(
      sourceWords.filter((word) => getMemoryStatusValue(word) !== 'passive_known')
    );

    const passiveWords = sortWordsForSession(
      sourceWords.filter((word) => getMemoryStatusValue(word) === 'passive_known')
    );

    const buckets: Record<string, any[]> = {
      weak: [],
      reading: [],
      reinforcement: [],
      new: [],
      passive: passiveWords.slice(0, Math.max(1, Math.floor(sourceWords.length * 0.08))),
    };

    usableWords.forEach((word) => {
      const bucket = getTrainingBucket(word);
      if (bucket === 'passive') return;
      buckets[bucket]?.push(word);
    });

    const balancedWords = buildBalancedWordOrder(buckets, sourceWords.length);
    const built: TrainingTask[] = [];

    balancedWords.forEach((word, wordIndex) => {
      if (training_flow === 'one_per_word') {
        const selectedMode = pickBalancedModeForWord(word, modes, sourceWords, wordIndex);
        const task = createTask(word, selectedMode, sourceWords);

        if (task) {
          built.push({
            ...task,
            id: `${task.id}-single`,
          });
          return;
        }

        for (const fallbackMode of modes) {
          const fallbackTask = createTask(word, fallbackMode, sourceWords);
          if (fallbackTask) {
            built.push({
              ...fallbackTask,
              id: `${fallbackTask.id}-single-fallback`,
            });
            break;
          }
        }

        return;
      }

      const selectedModes = mix_modes
        ? getBalancedModesForWord(word, modes, sourceWords, wordIndex)
        : [modes[0]];

      selectedModes.forEach((mode) => {
        const task = createTask(word, mode, sourceWords);
        if (task) built.push(task);
      });
    });

    return mix_modes || training_flow === 'one_per_word'
      ? balanceTaskOrder(built)
      : built;
  }

  function buildBalancedWordOrder(
    buckets: Record<string, any[]>,
    targetCount: number
  ) {
    const pattern = [
      'weak',
      'new',
      'reading',
      'reinforcement',
      'weak',
      'new',
      'reading',
      'passive',
    ];

    const result: any[] = [];
    const seen = new Set<string>();
    let guard = 0;

    while (result.length < targetCount && guard < targetCount * 8 + 50) {
      const bucketName = pattern[guard % pattern.length];
      const bucket = buckets[bucketName] || [];
      const candidate = bucket.shift();

      if (candidate?.id && !seen.has(candidate.id)) {
        const previous = result[result.length - 1];
        const previousBucket = previous ? getTrainingBucket(previous) : '';
        const candidateBucket = getTrainingBucket(candidate);

        if (
          result.length > 0 &&
          candidateBucket === 'weak' &&
          previousBucket === 'weak'
        ) {
          bucket.push(candidate);
        } else {
          seen.add(candidate.id);
          result.push(candidate);
        }
      }

      guard += 1;

      const remaining = Object.values(buckets).some((items) => items.length > 0);
      if (!remaining) break;
    }

    const leftovers = sortWordsForSession(
      Object.values(buckets).flat().filter((word) => word?.id && !seen.has(word.id))
    );

    leftovers.forEach((word) => {
      if (!seen.has(word.id)) {
        seen.add(word.id);
        result.push(word);
      }
    });

    return result.slice(0, targetCount);
  }

  function pickBalancedModeForWord(
    word: any,
    modes: TrainingMode[],
    allWords: any[],
    index: number
  ) {
    const bucket = getTrainingBucket(word);
    const available = modes.filter((mode) => createTask(word, mode, allWords));

    if (!available.length) return modes[0];

    if (bucket === 'weak') {
      const preferred = ['typing', 'cloze', 'forms', 'choice', 'flashcards'] as TrainingMode[];
      return preferred.find((mode) => available.includes(mode)) || available[0];
    }

    if (bucket === 'reading') {
      const preferred = ['cloze', 'choice', 'typing', 'flashcards', 'forms'] as TrainingMode[];
      return preferred.find((mode) => available.includes(mode)) || available[0];
    }

    if (bucket === 'reinforcement') {
      const preferred = ['choice', 'flashcards', 'typing', 'cloze', 'forms'] as TrainingMode[];
      return preferred.find((mode) => available.includes(mode)) || available[0];
    }

    return available[index % available.length];
  }

  function getBalancedModesForWord(
    word: any,
    modes: TrainingMode[],
    allWords: any[],
    index: number
  ) {
    const primary = pickBalancedModeForWord(word, modes, allWords, index);
    const available = modes.filter((mode) => mode !== primary && createTask(word, mode, allWords));
    const bucket = getTrainingBucket(word);

    const maxModes = bucket === 'weak' ? 2 : 1;
    return [primary, ...available.slice(0, maxModes - 1)];
  }

  function balanceTaskOrder(sourceTasks: TrainingTask[]) {
    const tasksByBucket: Record<string, TrainingTask[]> = {
      weak: [],
      reading: [],
      reinforcement: [],
      new: [],
      passive: [],
    };

    sourceTasks.forEach((task) => {
      const bucket = getTrainingBucket(task.word);
      tasksByBucket[bucket]?.push(task);
    });

    Object.keys(tasksByBucket).forEach((key) => {
      tasksByBucket[key] = shuffle(tasksByBucket[key]);
    });

    const pattern = [
      'weak',
      'new',
      'reading',
      'reinforcement',
      'weak',
      'new',
      'reading',
      'passive',
    ];

    const result: TrainingTask[] = [];
    let guard = 0;

    while (result.length < sourceTasks.length && guard < sourceTasks.length * 8 + 50) {
      const bucketName = pattern[guard % pattern.length];
      const candidate = tasksByBucket[bucketName]?.shift();

      if (candidate) {
        const previous = result[result.length - 1];
        const previousBucket = previous ? getTrainingBucket(previous.word) : '';
        const candidateBucket = getTrainingBucket(candidate.word);
        const sameWord = previous?.word?.id === candidate.word?.id;

        if (
          result.length > 0 &&
          (sameWord || (candidateBucket === 'weak' && previousBucket === 'weak'))
        ) {
          tasksByBucket[bucketName].push(candidate);
        } else {
          result.push(candidate);
        }
      }

      guard += 1;

      const remaining = Object.values(tasksByBucket).some((items) => items.length > 0);
      if (!remaining) break;
    }

    const leftovers = Object.values(tasksByBucket).flat();
    return [...result, ...leftovers];
  }

  function createTask(
    word: any,
    mode: TrainingMode,
    allWords: any[]
  ): TrainingTask | null {
    if (mode === 'flashcards') {
      return {
        id: `${word.id}-flashcards`,
        mode,
        word,
        expected: getTranslation(word),
      };
    }

    if (mode === 'choice') {
      const correct = getTranslation(word);
      if (!correct) return null;

      const distractors = getSmartChoiceDistractors(word, allWords, correct);

      if (distractors.length < 2) return null;

      return {
        id: `${word.id}-choice`,
        mode,
        word,
        expected: correct,
        options: shuffle([correct, ...distractors]),
      };
    }

    if (mode === 'typing') {
      return {
        id: `${word.id}-typing`,
        mode,
        word,
        prompt: getTranslation(word),
        expected: getCleanWord(word),
      };
    }

    if (mode === 'cloze') {
      const example = word.example || '';
      const cleanWord = getCleanWord(word);

      if (!example || !cleanWord) return null;

      const cloze = example.replace(new RegExp(cleanWord, 'i'), '____');

      return {
        id: `${word.id}-cloze`,
        mode,
        word,
        prompt: cloze === example ? example : cloze,
        expected: cleanWord,
      };
    }

    if (mode === 'forms') {
      const formTask = getFormTask(word);
      if (!formTask) return null;

      return {
        id: `${word.id}-forms-${formTask.label}`,
        mode,
        word,
        prompt: word.word,
        expected: formTask.value,
        formLabel: formTask.label,
      };
    }

    return null;
  }

  function getSmartChoiceDistractors(
    word: any,
    allWords: any[],
    correct: string
  ) {
    const targetFamily = getCategoryFamily(word);
    const targetFrequency = getFrequencyValue(word);
    const correctNormalized = normalizeChoiceValue(correct);

    const candidates = allWords
      .filter((item) => item.id !== word.id)
      .map((item) => {
        const translation = getTranslation(item);
        if (!translation) return null;

        const normalized = normalizeChoiceValue(translation);
        if (!normalized || normalized === correctNormalized) return null;

        const sameFamily = getCategoryFamily(item) === targetFamily;
        const frequencyDistance = Math.abs(
          getFrequencyValue(item) - targetFrequency
        );

        const priority = getPriorityValue(item);

        const score =
          (sameFamily ? 1000000 : 0) -
          Math.min(frequencyDistance, 999999) +
          priority * 10;

        return {
          translation,
          score,
        };
      })
      .filter(Boolean) as { translation: string; score: number }[];

    const sorted = candidates.sort((a, b) => b.score - a.score);

    const unique: string[] = [];

    for (const candidate of sorted) {
      if (unique.some((item) => normalizeChoiceValue(item) === normalizeChoiceValue(candidate.translation))) {
        continue;
      }

      unique.push(candidate.translation);

      if (unique.length >= 3) break;
    }

    if (unique.length < 3) {
      const fallback = shuffle(
        allWords
          .filter((item) => item.id !== word.id)
          .map(getTranslation)
          .filter(Boolean)
          .filter(
            (item) =>
              normalizeChoiceValue(item) !== correctNormalized &&
              !unique.some(
                (existing) =>
                  normalizeChoiceValue(existing) === normalizeChoiceValue(item)
              )
          )
      ).slice(0, 3 - unique.length);

      unique.push(...fallback);
    }

    return unique.slice(0, 3);
  }

  function getCleanWord(word: any) {
    return String(word?.word || word?.lemma || '')
      .replace(/^å\s+/i, '')
      .replace(/^(en|ei|et)\s+/i, '')
      .trim();
  }

  function getMainWord(word: any) {
    return displayNorwegianLemma(
      word?.word || word?.lemma || word?.text || 'Unknown',
      word
    );
  }

  function getTranslation(word: any) {
    const ua = word?.ua || '';
    const en = word?.en || '';

    if (translation_mode === 'ua') return ua || en;
    if (translation_mode === 'en') return en || ua;

    if (ua && en) return ua + '\n' + en;
    return ua || en;
  }

  function getClozeHint(word: any) {
    const ua = word?.ua || '';
    const en = word?.en || '';

    if (lang === 'ua') return ua || en || '';
    return en || ua || '';
  }

  function shouldShowSentenceFirstContext(task: TrainingTask | undefined, word: any) {
    if (training_layout !== 'sentence_first') return false;
    if (!task || !word?.example) return false;

    return task.mode === 'choice' || task.mode === 'typing' || task.mode === 'forms';
  }

  function getImageUrl(word: any) {
    return word?.image_url || word?.imageUrl || word?.image || '';
  }

  function getFormTask(word: any) {
    const type = String(word?.type || word?.category || word?.pos || '').toLowerCase();

    const forms = type.includes('verb')
      ? [
          {
            label: 'Presens',
            value: getFormValue(word, ['presens', 'present', 'f1']),
          },
          {
            label: 'Preteritum',
            value: getFormValue(word, ['preteritum', 'past', 'f2']),
          },
          {
            label: 'Perfektum',
            value: getFormValue(word, ['perfektum', 'perfect', 'f3']),
          },
        ]
      : type.includes('noun')
      ? [
          {
            label: 'Bestemt entall',
            value: getFormValue(word, ['best_entall', 'def_sg', 'f1']),
          },
          {
            label: 'Ubestemt flertall',
            value: getFormValue(word, ['ubest_flertall', 'indef_pl', 'f2']),
          },
          {
            label: 'Bestemt flertall',
            value: getFormValue(word, ['best_flertall', 'def_pl', 'f3']),
          },
        ]
      : type.includes('adjective')
      ? [
          {
            label: 'Intetkjønn',
            value: getFormValue(word, ['intetkjonn', 'neuter', 'f1']),
          },
          {
            label: 'Flertall',
            value: getFormValue(word, ['flertall', 'plural', 'f2']),
          },
          {
            label: 'Komparativ',
            value: getFormValue(word, ['komparativ', 'comparative', 'f3']),
          },
          {
            label: 'Superlativ',
            value: getFormValue(word, ['superlativ', 'superlative', 'f4']),
          },
          {
            label: 'Bestemt superlativ',
            value: getFormValue(word, ['best_superlativ', 'def_superlative', 'f5']),
          },
        ]
      : [];

    const available = forms.filter((item) => item.value);
    if (!available.length) return null;

    return available[Math.floor(Math.random() * available.length)];
  }

  function getAllForms(word: any) {
    const type = String(word?.type || word?.category || word?.pos || '').toLowerCase();

    if (type.includes('verb')) {
      const infinitive =
        getFormValue(word, ['infinitiv', 'infinitive']) ||
        word?.word ||
        word?.lemma;

      return [
        {
          label: 'Infinitiv',
          value: displayNorwegianLemma(infinitive, word),
        },
        {
          label: 'Presens',
          value: getFormValue(word, ['presens', 'present', 'f1']),
        },
        {
          label: 'Preteritum',
          value: getFormValue(word, ['preteritum', 'past', 'f2']),
        },
        {
          label: 'Perfektum',
          value: getFormValue(word, ['perfektum', 'perfect', 'f3'])
            ? `har ${getFormValue(word, ['perfektum', 'perfect', 'f3']).replace(/^har\s+/i, '')}`
            : '',
        },
      ].filter((item) => item.value);
    }

    if (type.includes('noun')) {
      return [
        {
          label: 'Ubestemt entall',
          value: getFormValue(word, ['ubest_entall', 'indef_sg']) || word.word || word.lemma,
        },
        {
          label: 'Bestemt entall',
          value: getFormValue(word, ['best_entall', 'def_sg', 'f1']),
        },
        {
          label: 'Ubestemt flertall',
          value: getFormValue(word, ['ubest_flertall', 'indef_pl', 'f2']),
        },
        {
          label: 'Bestemt flertall',
          value: getFormValue(word, ['best_flertall', 'def_pl', 'f3']),
        },
      ].filter((item) => item.value);
    }

    if (type.includes('adjective')) {
      return [
        {
          label: 'Positiv',
          value: getFormValue(word, ['positiv', 'positive']) || word.word || word.lemma,
        },
        {
          label: 'Intetkjønn',
          value: getFormValue(word, ['intetkjonn', 'neuter', 'f1']),
        },
        {
          label: 'Flertall',
          value: getFormValue(word, ['flertall', 'plural', 'f2']),
        },
        {
          label: 'Komparativ',
          value: getFormValue(word, ['komparativ', 'comparative', 'f3']),
        },
        {
          label: 'Superlativ',
          value: getFormValue(word, ['superlativ', 'superlative', 'f4']),
        },
        {
          label: 'Bestemt superlativ',
          value: getFormValue(word, ['best_superlativ', 'def_superlative', 'f5']),
        },
      ].filter((item) => item.value);
    }

    return [];
  }

  function getCategoryLabel(category: string) {
    const labels: Record<AppLanguage, Record<string, string>> = {
      ua: {
        verb: 'Дієслово',
        noun_masculine: 'Іменник · чоловічий рід',
        noun_feminine: 'Іменник · жіночий рід',
        noun_neuter: 'Іменник · середній рід',
        adjective: 'Прикметник',
        adverb: 'Прислівник',
        expression: 'Сталий вираз',
      },
      en: {
        verb: 'Verb',
        noun_masculine: 'Noun · masculine',
        noun_feminine: 'Noun · feminine',
        noun_neuter: 'Noun · neuter',
        adjective: 'Adjective',
        adverb: 'Adverb',
        expression: 'Expression',
      },
      no: {
        verb: 'Verb',
        noun_masculine: 'Substantiv · hankjønn',
        noun_feminine: 'Substantiv · hunkjønn',
        noun_neuter: 'Substantiv · intetkjønn',
        adjective: 'Adjektiv',
        adverb: 'Adverb',
        expression: 'Fast uttrykk',
      },
    };

    return labels[lang]?.[category] || labels.en[category] || category;
  }

  function getModeLabel(mode: TrainingMode) {
    const labels: Record<AppLanguage, Record<TrainingMode, string>> = {
      ua: {
        flashcards: 'Картка',
        choice: 'Вибір',
        typing: 'Введення',
        cloze: 'Пропуск',
        forms: 'Форми',
      },
      en: {
        flashcards: 'Card',
        choice: 'Choice',
        typing: 'Typing',
        cloze: 'Cloze',
        forms: 'Forms',
      },
      no: {
        flashcards: 'Kort',
        choice: 'Valg',
        typing: 'Skriving',
        cloze: 'Luke',
        forms: 'Former',
      },
    };

    return labels[lang]?.[mode] || labels.en[mode];
  }

  function getSafeSpeechRate() {
    if (typeof speech_rate !== 'number') return 0.85;
    if (speech_rate < 0.5) return 0.5;
    if (speech_rate > 1.2) return 1.2;
    return speech_rate;
  }

  async function speakCurrentTask() {
    if (!current || !currentTask) return;

    const rate = getSafeSpeechRate();

    if (pronounce_forms) {
      const forms = getAllForms(current);

      if (forms.length > 0) {
        await speakNorwegianForms(forms, { rate });
        return;
      }
    }

    const text =
      currentTask.mode === 'forms'
        ? currentTask.prompt || getMainWord(current)
        : getMainWord(current);

    await speakNorwegian(text, { rate });
  }

  async function speakCorrectAnswer() {
    if (!currentTask || !current) return;

    const rate = getSafeSpeechRate();

    if (pronounce_forms) {
      const forms = getAllForms(current);

      if (forms.length > 0) {
        await speakNorwegianForms(forms, { rate });
        return;
      }
    }

    const answer =
      currentTask.mode === 'choice'
        ? getMainWord(current)
        : currentTask.expected || getMainWord(current);

    await speakNorwegian(answer, { rate });
  }

  function nextTask() {
    stopSpeech();

    setAnswerVisible(false);
    setTypedAnswer('');
    setFeedback('');
    setReviewSaved(false);

    setTaskIndex((currentIndex) => {
      if (currentIndex >= tasks.length - 1) return 0;
      return currentIndex + 1;
    });
  }

  async function saveGrade(
    label: 'Hard' | 'OK' | 'Easy',
    answer?: string,
    goNext = false
  ) {
    if (!current || !currentTask || savingReview || reviewSaved) return;

    const difficulty =
      label === 'Hard' ? 'hard' : label === 'OK' ? 'medium' : 'easy';

    const correct = label !== 'Hard';

    try {
      setSavingReview(true);

      await saveReviewToSupabase({
        user: preferred_user,
        mode: currentTask.mode,
        word: current.word || '',
        answer: answer || getTranslation(current),
        correct,
        difficulty,
        lexemeId: current.id,
        wordId: current.id,
      });

      setReviewSaved(true);

      if (goNext) {
        nextTask();
      }
    } catch (error) {
      console.log('Save review error:', error);

      setError(ui('save_error'));
    } finally {
      setSavingReview(false);
    }
  }

  async function checkTypedAnswer() {
    if (!currentTask?.expected || reviewSaved) return;

    const ok = isAcceptedAnswer(
      typedAnswer,
      currentTask.expected,
      currentTask.mode
    );

    setAnswerVisible(true);

    setFeedback(
      ok ? ui('correct') : `${ui('correct_answer')} ${currentTask.expected}`
    );

    if (pronounce_after_answer) {
      await speakCorrectAnswer();
    }

    saveGrade(ok ? 'Easy' : 'Hard', typedAnswer, false);
  }

  async function selectChoice(option: string) {
    if (!currentTask?.expected || reviewSaved) return;

    const ok = isAcceptedAnswer(option, currentTask.expected, currentTask.mode);

    setAnswerVisible(true);

    setFeedback(
      ok ? ui('correct') : `${ui('correct_answer')} ${currentTask.expected}`
    );

    if (pronounce_after_answer) {
      await speakCorrectAnswer();
    }

    saveGrade(ok ? 'Easy' : 'Hard', option, false);
  }

  const taskTitle = useMemo(() => {
    if (!currentTask) return '';
    return getModeLabel(currentTask.mode);
  }, [currentTask, app_language]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{ui('title')}</Text>
          {currentTask ? (
            <Text style={styles.counterInline}>
              {taskIndex + 1}/{tasks.length}
            </Text>
          ) : null}
        </View>

        {loading ? <ActivityIndicator size="large" color="#0EA5E9" /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error && !currentTask ? (
          <Text style={styles.emptyText}>
            {ui('empty_tasks')}
          </Text>
        ) : null}

        {currentTask && current ? (
          <>
            <Pressable
              style={styles.card}
              onPress={() =>
                currentTask.mode === 'flashcards'
                  ? setAnswerVisible((value) => !value)
                  : undefined
              }
            >
              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <Text style={styles.meta}>
                    {getCategoryLabel(current.category || current.type || '')}
                  </Text>
                  <Text style={styles.modeMeta}>{taskTitle}</Text>
                </View>

                <View style={styles.cardTools}>
                  {hasVerification(current) ? (
                    <View
                      style={styles.toolButton}
                      accessibilityLabel={ui('verification')}
                    >
                      <VerificationBadge
                        tier={current.verification_tier}
                        sourceVerified={current.source_verified}
                        evidence={current.verification_evidence}
                        lemma={current.lemma || current.word}
                        size="sm"
                        lang={(app_language as any) || 'ua'}
                      />
                    </View>
                  ) : null}

                  {hasRelations(current) ? (
                    <View style={styles.lexemeTool}>
                      <Lexeme360
                        lexemeId={current.id}
                        lemma={getMainWord(current)}
                        pos={current.pos || current.category || current.type}
                        lang={(app_language as any) || 'ua'}
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              {getImageUrl(current) ? (
                <Image
                  source={{ uri: getImageUrl(current) }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : null}

              {shouldShowSentenceFirstContext(currentTask, current) ? (
                <SentenceContext
                  label={ui('context')}
                  sentence={current.example}
                />
              ) : null}

              {currentTask.mode === 'flashcards' ? (
                <>
                  <Text style={styles.word} onPress={speakCurrentTask}>
                    {getMainWord(current)}
                  </Text>

                  {current.example ? (
                    <Text style={styles.example}>{current.example}</Text>
                  ) : null}

                  <View style={styles.answerReserved}>
                    {answerVisible ? (
                      <>
                        <AnswerBox
                          label={ui('translation')}
                          value={getTranslation(current)}
                        />

                        <FormsList
                          title={ui('forms')}
                          forms={getAllForms(current)}
                        />
                      </>
                    ) : (
                      <Text style={styles.tapHint}>
                        {ui('tap_to_reveal')}
                      </Text>
                    )}
                  </View>
                </>
              ) : null}

              {currentTask.mode === 'choice' ? (
                <>
                  <Text style={styles.choiceWord} onPress={speakCurrentTask}>
                    {getMainWord(current)}
                  </Text>

                  <View style={styles.choiceBox}>
                    {currentTask.options?.map((option) => (
                      <Pressable
                        key={option}
                        style={[
                          styles.choiceButton,
                          reviewSaved && styles.disabledButton,
                        ]}
                        onPress={() => selectChoice(option)}
                        disabled={savingReview || reviewSaved}
                      >
                        <Text style={styles.choiceText}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>

                </>
              ) : null}

              {currentTask.mode === 'typing' ? (
                <>
                  <Text style={styles.promptText}>{currentTask.prompt}</Text>

                  <TextInput
                    style={styles.input}
                    value={typedAnswer}
                    onChangeText={setTypedAnswer}
                    placeholder={ui('type_word')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!reviewSaved && !savingReview}
                  />

                  <Pressable
                    style={[
                      styles.checkButton,
                      (savingReview || reviewSaved) && styles.disabledButton,
                    ]}
                    onPress={checkTypedAnswer}
                    disabled={savingReview || reviewSaved}
                  >
                    <Text style={styles.checkButtonText}>
                      {ui('check')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {currentTask.mode === 'cloze' ? (
                <>
                  <Text style={styles.promptText}>{currentTask.prompt}</Text>

                  {getClozeHint(current) ? (
                    <View style={styles.clozeHintBox}>
                      <Text style={styles.clozeHintLabel}>
                        {ui('hint')}
                      </Text>
                      <Text style={styles.clozeHintText}>{getClozeHint(current)}</Text>
                    </View>
                  ) : null}

                  <TextInput
                    style={styles.input}
                    value={typedAnswer}
                    onChangeText={setTypedAnswer}
                    placeholder={ui('fill_gap')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!reviewSaved && !savingReview}
                  />

                  <Pressable
                    style={[
                      styles.checkButton,
                      (savingReview || reviewSaved) && styles.disabledButton,
                    ]}
                    onPress={checkTypedAnswer}
                    disabled={savingReview || reviewSaved}
                  >
                    <Text style={styles.checkButtonText}>
                      {ui('check')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {currentTask.mode === 'forms' ? (
                <>
                  <Text style={styles.promptLabel}>{currentTask.formLabel}</Text>

                  <Text style={styles.choiceWord} onPress={speakCurrentTask}>
                    {currentTask.prompt}
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={typedAnswer}
                    onChangeText={setTypedAnswer}
                    placeholder={ui('type_form')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!reviewSaved && !savingReview}
                  />

                  <Pressable
                    style={[
                      styles.checkButton,
                      (savingReview || reviewSaved) && styles.disabledButton,
                    ]}
                    onPress={checkTypedAnswer}
                    disabled={savingReview || reviewSaved}
                  >
                    <Text style={styles.checkButtonText}>
                      {ui('check')}
                    </Text>
                  </Pressable>

                  {answerVisible ? (
                    <FormsList
                      title={ui('all_forms')}
                      forms={getAllForms(current)}
                    />
                  ) : null}
                </>
              ) : null}

              {answerVisible && currentTask.mode !== 'flashcards' && currentTask.mode !== 'forms' ? (
                <FormsList
                  title={ui('forms')}
                  forms={getAllForms(current)}
                />
              ) : null}

              {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
            </Pressable>

            {savingReview ? (
              <Text style={styles.savingText}>
                {ui('saving')}
              </Text>
            ) : null}

            {currentTask.mode === 'flashcards' ? (
              <View style={styles.gradeRow}>
                <GradeButton
                  label={ui('hard')}
                  style={styles.hardButton}
                  disabled={savingReview}
                  onPress={() => saveGrade('Hard', undefined, true)}
                />

                <GradeButton
                  label={ui('ok')}
                  style={styles.okButton}
                  disabled={savingReview}
                  onPress={() => saveGrade('OK', undefined, true)}
                />

                <GradeButton
                  label={ui('easy')}
                  style={styles.easyButton}
                  disabled={savingReview}
                  onPress={() => saveGrade('Easy', undefined, true)}
                />
              </View>
            ) : null}

            <Pressable
              style={[styles.nextButton, savingReview && styles.disabledButton]}
              disabled={savingReview}
              onPress={nextTask}
            >
              <Text style={styles.nextButtonText}>
                {ui('next_task')}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SentenceContext({
  label,
  sentence,
}: {
  label: string;
  sentence: string;
}) {
  return (
    <View style={styles.sentenceFirstBox}>
      <Text style={styles.sentenceFirstLabel}>{label}</Text>
      <Text style={styles.sentenceFirstText}>{sentence}</Text>
    </View>
  );
}

function AnswerBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.answerBox}>
      <Text style={styles.answerLabel}>{label}</Text>
      <Text style={styles.translation}>{value}</Text>
    </View>
  );
}

function FormsList({
  title,
  forms,
}: {
  title: string;
  forms: { label: string; value: string }[];
}) {
  if (!forms.length) return null;

  return (
    <View style={styles.formsList}>
      <Text style={styles.formsTitle}>{title}</Text>

      {forms.map((item) => (
        <View key={`${item.label}-${item.value}`} style={styles.formRow}>
          <Text style={styles.formLabel}>{item.label}</Text>
          <Text style={styles.formValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function GradeButton({
  label,
  style,
  disabled,
  onPress,
}: {
  label: string;
  style: any;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.gradeButton, style, disabled && styles.disabledButton]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.gradeText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4ED',
  },

  container: {
    flexGrow: 1,
    backgroundColor: '#F7F4ED',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  counterInline: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9CA3AF',
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 26,
    marginBottom: 18,
    minHeight: 420,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },

  metaLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  cardTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  toolButton: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  lexemeTool: {
    minHeight: 34,
    justifyContent: 'center',
  },

  meta: {
    backgroundColor: '#E0F2FE',
    color: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '800',
  },

  modeMeta: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '800',
  },

  image: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: '#E5E7EB',
  },

  word: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },

  choiceWord: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },

  promptText: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 18,
  },

  promptLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0EA5E9',
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  example: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 16,
  },

  sentenceFirstBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  sentenceFirstLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  sentenceFirstText: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '800',
    color: '#374151',
  },

  clozeHintBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  clozeHintLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },

  clozeHintText: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '900',
    color: '#0EA5E9',
  },

  answerReserved: {
    minHeight: 120,
  },

  tapHint: {
    backgroundColor: '#F8FAFC',
    color: '#94A3B8',
    padding: 16,
    borderRadius: 16,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },

  answerBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },

  answerLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  translation: {
    fontSize: 22,
    color: '#0EA5E9',
    fontWeight: '900',
    lineHeight: 32,
  },

  formsList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },

  formsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  formRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 7,
  },

  formLabel: {
    width: 130,
    fontSize: 13,
    fontWeight: '900',
    color: '#64748B',
  },

  formValue: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  choiceBox: {
    gap: 10,
  },

  choiceButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },

  choiceText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#111827',
  },

  input: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
  },

  checkButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },

  checkButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
  },

  feedback: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginTop: 8,
  },

  savingText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },

  gradeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  gradeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
  },

  hardButton: {
    backgroundColor: '#FCA5A5',
  },

  okButton: {
    backgroundColor: '#FCD34D',
  },

  easyButton: {
    backgroundColor: '#86EFAC',
  },

  gradeText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },

  nextButton: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  nextButtonText: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  disabledButton: {
    opacity: 0.55,
  },

  error: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },

  emptyText: {
    fontSize: 18,
    color: '#6B7280',
  },
});