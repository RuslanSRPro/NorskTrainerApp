// app/(tabs)/explore.tsx
// Training screen — Liquid Glass UI 2.0 + preserved training logic

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeBackground } from '@/components/home/HomeBackground';
import { GlassSurface } from '@/components/ui/glass/GlassSurface';

import { getLearningWordsFromSupabase, saveReviewToSupabase } from '@/services/api';
import { TrainingMode } from '@/services/settings';
import { speakNorwegian, speakNorwegianForms, stopSpeech } from '@/services/speech';
import { AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';
import {
  TrainingBottomBar,
  TrainingCard,
} from '@/components/training';
import {
  getBucket,
  getCategoryFamily,
  getCleanWord,
  getFormValue,
  getFreq,
  getImageUrl,
  getMainWord,
  getMemStatus,
  getPriority,
  hasRelations,
  hasVerification,
  isAccepted,
  normalizeChoice,
  shuffle,
  sortWords,
  type TrainingTask,
} from '@/services/training/trainingEngine';


type UiKey =
  | 'title' | 'empty_tasks' | 'save_error' | 'correct' | 'correct_answer'
  | 'context' | 'translation' | 'forms' | 'all_forms' | 'tap_to_reveal'
  | 'type_word' | 'type_form' | 'fill_gap' | 'check' | 'hint'
  | 'next_task' | 'saving' | 'hard' | 'ok' | 'easy' | 'open_360' | 'verification';

const UI_TEXT: Record<AppLanguage, Record<UiKey, string>> = {
  ua: {
    title: '🎯 Тренування', empty_tasks: 'Завдань немає.', save_error: 'Не вдалося зберегти.',
    correct: '✅ Правильно', correct_answer: '❌ Правильно:', context: 'Контекст',
    translation: 'Переклад', forms: 'Форми', all_forms: 'Усі форми',
    tap_to_reveal: 'Натисни щоб показати відповідь', type_word: 'Введи слово',
    type_form: 'Введи форму', fill_gap: 'Встав слово', check: 'Перевірити',
    hint: 'Підказка', next_task: 'Наступне', saving: 'Збереження...', hard: 'Складно',
    ok: 'OK', easy: 'Легко', open_360: '360°', verification: 'Джерела',
  },
  en: {
    title: '🎯 Training', empty_tasks: 'No tasks.', save_error: 'Failed to save.',
    correct: '✅ Correct', correct_answer: '❌ Correct:', context: 'Context',
    translation: 'Translation', forms: 'Forms', all_forms: 'All forms',
    tap_to_reveal: 'Tap to reveal', type_word: 'Type the word', type_form: 'Type the form',
    fill_gap: 'Fill the gap', check: 'Check', hint: 'Hint', next_task: 'Next',
    saving: 'Saving...', hard: 'Hard', ok: 'OK', easy: 'Easy', open_360: '360°', verification: 'Sources',
  },
  no: {
    title: '🎯 Trening', empty_tasks: 'Ingen oppgaver.', save_error: 'Kunne ikke lagre.',
    correct: '✅ Riktig', correct_answer: '❌ Riktig:', context: 'Kontekst',
    translation: 'Oversettelse', forms: 'Former', all_forms: 'Alle former',
    tap_to_reveal: 'Trykk for å vise', type_word: 'Skriv ordet', type_form: 'Skriv formen',
    fill_gap: 'Fyll inn', check: 'Sjekk', hint: 'Hint', next_task: 'Neste',
    saving: 'Lagrer...', hard: 'Vanskelig', ok: 'OK', easy: 'Lett', open_360: '360°', verification: 'Kilder',
  },
};

function makeUi(lang: AppLanguage) {
  return (key: UiKey) => UI_TEXT[lang]?.[key] ?? UI_TEXT.en[key] ?? key;
}

export default function TrainScreen() {
  const { theme, fonts, themeName } = useTheme() as any;
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDark = themeName === 'dark';

  const [loading, setLoading] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [error, setError] = useState('');
  const [answerVisible, setAnswerVisible] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback] = useState('');

  const {
    app_language, translation_mode, category_filter, study_set,
    daily_limit, preferred_user, training_modes, mix_modes,
    training_flow, auto_pronounce, pronounce_forms,
    pronounce_after_answer, speech_rate, loadSettings,
  } = useSettingsStore();

  const currentTask = tasks[taskIndex];
  const current = currentTask?.word;
  const lang = (app_language || 'ua') as AppLanguage;
  const ui = makeUi(lang);

  const textColor = isDark ? '#FFFFFF' : theme.textPrimary ?? theme.text ?? '#111827';
  const mutedColor = isDark ? 'rgba(255,255,255,0.62)' : theme.textMuted ?? theme.textSecondary ?? 'rgba(17,24,39,0.55)';
  const accent = theme.accent ?? '#0A84FF';

  const s = useMemo(
    () => makeStyles(theme, fonts, height, insets.bottom, isDark, textColor, mutedColor, accent),
    [theme, fonts, height, insets.bottom, isDark, textColor, mutedColor, accent],
  );

  useEffect(() => { loadSettings(); return () => { stopSpeech(); }; }, []);

  useEffect(() => { loadWords(); }, [
    app_language, translation_mode, category_filter, study_set,
    daily_limit, preferred_user, training_modes, mix_modes, training_flow,
  ]);

  useEffect(() => {
    if (!auto_pronounce || !currentTask || !current || loading) return;
    const t = setTimeout(() => speakCurrentTask(), 350);
    return () => clearTimeout(t);
  }, [auto_pronounce, currentTask?.id, loading, pronounce_forms, speech_rate]);

  async function loadWords() {
    try {
      setLoading(true); setError(''); setTaskIndex(0);
      setAnswerVisible(false); setTypedAnswer(''); setFeedback(''); setReviewSaved(false);
      const data = await getLearningWordsFromSupabase({ preferred_user, category_filter, study_set, daily_limit });
      const queue = buildTaskQueue(data);
      setTasks(queue);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally { setLoading(false); }
  }

  function getTranslation(w: any) {
    const ua = w?.ua || '', en = w?.en || '';
    if (translation_mode === 'ua') return ua || en;
    if (translation_mode === 'en') return en || ua;
    if (ua && en) return ua + '\n' + en;
    return ua || en;
  }
  function getCleanWord(w: any) {
    return String(w?.word || w?.lemma || '')
      .replace(/^å\s+/i, '')
      .replace(/^(en|ei|et)\s+/i, '')
      .trim();
  }

  function displayLemma(lemma: string, w?: any) {
    const text = String(lemma || '').trim();

    const pos = String(
      w?.type ||
      w?.category ||
      w?.pos ||
      ''
    ).toLowerCase();

    if (
      pos.includes('verb') &&
      text &&
      !/^å\s/i.test(text)
    ) {
      return `å ${text}`;
    }

    return text;
  }

  function getMainWord(w: any) {
    return displayLemma(w?.word || w?.lemma || w?.text || '', w);
  }

  function getClozeHint(w: any) {
    return (lang === 'ua' ? w?.ua : w?.en) || w?.ua || w?.en || '';
  }

  function getFormTask(w: any) {
    const type = String(w?.type || w?.category || w?.pos || '').toLowerCase();
    const forms = type.includes('verb') ? [
      { label: 'Presens', value: getFormValue(w, ['presens', 'f1']) },
      { label: 'Preteritum', value: getFormValue(w, ['preteritum', 'f2']) },
      { label: 'Perfektum', value: getFormValue(w, ['perfektum', 'f3']) },
    ] : type.includes('noun') ? [
      { label: 'Bestemt entall', value: getFormValue(w, ['best_entall', 'f1']) },
      { label: 'Ubest. flertall', value: getFormValue(w, ['ubest_flertall', 'f2']) },
      { label: 'Bestemt flertall', value: getFormValue(w, ['best_flertall', 'f3']) },
    ] : type.includes('adj') ? [
      { label: 'Intetkjønn', value: getFormValue(w, ['intetkjonn', 'f1']) },
      { label: 'Flertall', value: getFormValue(w, ['flertall', 'f2']) },
      { label: 'Komparativ', value: getFormValue(w, ['komparativ', 'f3']) },
      { label: 'Superlativ', value: getFormValue(w, ['superlativ', 'f4']) },
    ] : [];
    const avail = forms.filter(f => f.value);
    if (!avail.length) return null;
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function getAllForms(w: any) {
    const type = String(w?.type || w?.category || w?.pos || '').toLowerCase();
    const vf: any = (!Array.isArray(w?.verb_forms) ? w?.verb_forms : w?.verb_forms?.[0]) || {};
    const nf: any = (!Array.isArray(w?.noun_forms) ? w?.noun_forms : w?.noun_forms?.[0]) || {};
    const af: any = (!Array.isArray(w?.adjective_forms) ? w?.adjective_forms : w?.adjective_forms?.[0]) || {};

    if (type.includes('verb')) {
      const inf = vf.infinitiv || getFormValue(w, ['infinitiv']) || w?.word || w?.lemma || '';
      const presens = vf.presens || getFormValue(w, ['presens', 'f1']) || '';
      const preteritum = vf.preteritum || getFormValue(w, ['preteritum', 'f2']) || '';
      const perfRaw = vf.perfektum || getFormValue(w, ['perfektum', 'f3']) || '';
      const perfektum = perfRaw ? `har ${perfRaw.replace(/^har\s+/i, '')}` : '';
      return [
        { label: 'Infinitiv', value: displayLemma(inf, w) },
        { label: 'Presens', value: presens },
        { label: 'Preteritum', value: preteritum },
        { label: 'Perfektum', value: perfektum },
      ].filter(f => f.value);
    }
    if (type.includes('noun')) return [
      { label: 'Ubest. entall', value: nf.ubest_entall || getFormValue(w, ['ubest_entall', 'indef_sg']) || w?.word || w?.lemma || '' },
      { label: 'Bestemt entall', value: nf.best_entall || getFormValue(w, ['best_entall', 'f1']) || '' },
      { label: 'Ubest. flt.', value: nf.ubest_flertall || getFormValue(w, ['ubest_flertall', 'f2']) || '' },
      { label: 'Bestemt flt.', value: nf.best_flertall || getFormValue(w, ['best_flertall', 'f3']) || '' },
    ].filter(f => f.value);
    if (type.includes('adj')) return [
      { label: 'Positiv', value: af.positiv || getFormValue(w, ['positiv', 'positive']) || w?.word || w?.lemma || '' },
      { label: 'Intetkjønn', value: af.intetkjonn || getFormValue(w, ['intetkjonn', 'f1']) || '' },
      { label: 'Flertall', value: af.flertall || getFormValue(w, ['flertall', 'f2']) || '' },
      { label: 'Komparativ', value: af.komparativ || getFormValue(w, ['komparativ', 'f3']) || '' },
      { label: 'Superlativ', value: af.superlativ || getFormValue(w, ['superlativ', 'f4']) || '' },
    ].filter(f => f.value);
    return [];
  }

  function getCategoryLabel(cat: string) {
    const map: Record<AppLanguage, Record<string, string>> = {
      ua: { verb: 'Дієслово', noun_masculine: 'Іменник · ч.р.', noun_feminine: 'Іменник · ж.р.', noun_neuter: 'Іменник · с.р.', adjective: 'Прикметник', adverb: 'Прислівник', expression: 'Сталий вираз' },
      en: { verb: 'Verb', noun_masculine: 'Noun · masc.', noun_feminine: 'Noun · fem.', noun_neuter: 'Noun · neuter', adjective: 'Adjective', adverb: 'Adverb', expression: 'Expression' },
      no: { verb: 'Verb', noun_masculine: 'Subst. · hankjønn', noun_feminine: 'Subst. · hunkjønn', noun_neuter: 'Subst. · intetkjønn', adjective: 'Adjektiv', adverb: 'Adverb', expression: 'Fast uttrykk' },
    };
    return map[lang]?.[cat] || map.en[cat] || cat;
  }

  function getModeLabel(mode: TrainingMode) {
    const map: Record<AppLanguage, Record<TrainingMode, string>> = {
      ua: { flashcards: 'Картка', choice: 'Вибір', typing: 'Введення', cloze: 'Пропуск', forms: 'Форми' },
      en: { flashcards: 'Card', choice: 'Choice', typing: 'Typing', cloze: 'Cloze', forms: 'Forms' },
      no: { flashcards: 'Kort', choice: 'Valg', typing: 'Skriving', cloze: 'Luke', forms: 'Former' },
    };
    return map[lang]?.[mode] || map.en[mode];
  }

  function getSpeechRate() {
    const r = speech_rate;
    return !Number.isFinite(r) ? 0.85 : Math.min(1.2, Math.max(0.5, r));
  }

  async function speakCurrentTask() {
    if (!current || !currentTask) return;
    const rate = getSpeechRate();
    if (pronounce_forms) {
      const f = getAllForms(current);
      if (f.length) { await speakNorwegianForms(f, { rate }); return; }
    }
    await speakNorwegian(currentTask.mode === 'forms' ? currentTask.prompt || getMainWord(current) : getMainWord(current), { rate });
  }

  async function speakAnswer() {
    if (!currentTask || !current) return;
    const rate = getSpeechRate();
    if (pronounce_forms) {
      const f = getAllForms(current);
      if (f.length) { await speakNorwegianForms(f, { rate }); return; }
    }
    await speakNorwegian(currentTask.mode === 'choice' ? getMainWord(current) : currentTask.expected || getMainWord(current), { rate });
  }

  function nextTask() {
    stopSpeech(); setAnswerVisible(false); setTypedAnswer(''); setFeedback(''); setReviewSaved(false);
    setTaskIndex(i => (i >= tasks.length - 1 ? 0 : i + 1));
  }

  async function saveGrade(label: 'Hard' | 'OK' | 'Easy', answer?: string, goNext = false) {
    if (!current || !currentTask || savingReview || reviewSaved) return;
    const difficulty = label === 'Hard' ? 'hard' : label === 'OK' ? 'medium' : 'easy';
    try {
      setSavingReview(true);
      await saveReviewToSupabase({
        user: preferred_user,
        mode: currentTask.mode,
        word: current.word || '',
        answer: answer || getTranslation(current),
        correct: label !== 'Hard',
        difficulty,
        lexemeId: current.id,
        wordId: current.id,
      });
      setReviewSaved(true);
      if (goNext) nextTask();
    } catch {
      setError(ui('save_error'));
    } finally {
      setSavingReview(false);
    }
  }

  async function checkTyped() {
    if (!currentTask?.expected || reviewSaved) return;
    const ok = isAccepted(typedAnswer, currentTask.expected, currentTask.mode);
    setAnswerVisible(true);
    setFeedback(ok ? ui('correct') : `${ui('correct_answer')} ${currentTask.expected}`);
    if (pronounce_after_answer) await speakAnswer();
    saveGrade(ok ? 'Easy' : 'Hard', typedAnswer, false);
  }

  async function selectChoice(option: string) {
    if (!currentTask?.expected || reviewSaved) return;
    const ok = isAccepted(option, currentTask.expected, currentTask.mode);
    setAnswerVisible(true);
    setFeedback(ok ? ui('correct') : `${ui('correct_answer')} ${currentTask.expected}`);
    if (pronounce_after_answer) await speakAnswer();
    saveGrade(ok ? 'Easy' : 'Hard', option, false);
  }

  function createTask(w: any, mode: TrainingMode, allWords: any[]): TrainingTask | null {
    if (mode === 'flashcards') return { id: `${w.id}-fc`, mode, word: w, expected: getTranslation(w) };
    if (mode === 'choice') {
      const correct = getTranslation(w); if (!correct) return null;
      const dist = getDistractors(w, allWords, correct); if (dist.length < 2) return null;
      return { id: `${w.id}-ch`, mode, word: w, expected: correct, options: shuffle([correct, ...dist]) };
    }
    if (mode === 'typing') return { id: `${w.id}-ty`, mode, word: w, prompt: getTranslation(w), expected: getCleanWord(w) };
    if (mode === 'cloze') {
      const ex = w.example || '', cw = getCleanWord(w); if (!ex || !cw) return null;
      const cloze = ex.replace(new RegExp(cw, 'i'), '____');
      return { id: `${w.id}-cl`, mode, word: w, prompt: cloze === ex ? ex : cloze, expected: cw };
    }
    if (mode === 'forms') {
      const ft = getFormTask(w); if (!ft) return null;
      return { id: `${w.id}-fo-${ft.label}`, mode, word: w, prompt: w.word, expected: ft.value, formLabel: ft.label };
    }
    return null;
  }

  function getDistractors(w: any, all: any[], correct: string) {
    const tf = getCategoryFamily(w), tfreq = getFreq(w), cn = normalizeChoice(correct);
    const cands = all.filter(it => it.id !== w.id).map(it => {
      const tr = getTranslation(it); if (!tr) return null;
      const n = normalizeChoice(tr); if (!n || n === cn) return null;
      return { translation: tr, score: (getCategoryFamily(it) === tf ? 1000000 : 0) - Math.min(Math.abs(getFreq(it) - tfreq), 999999) + getPriority(it) * 10 };
    }).filter(Boolean) as { translation: string; score: number }[];

    const sorted = cands.sort((a, b) => b.score - a.score);
    const unique: string[] = [];

    for (const c of sorted) {
      if (unique.some(u => normalizeChoice(u) === normalizeChoice(c.translation))) continue;
      unique.push(c.translation); if (unique.length >= 3) break;
    }

    if (unique.length < 3) {
      const fb = shuffle(
        all.filter(it => it.id !== w.id)
          .map(getTranslation)
          .filter(Boolean)
          .filter(t => normalizeChoice(t) !== cn && !unique.some(u => normalizeChoice(u) === normalizeChoice(t))),
      ).slice(0, 3 - unique.length);
      unique.push(...fb);
    }

    return unique.slice(0, 3);
  }

  function pickMode(w: any, modes: TrainingMode[], all: any[], idx: number) {
    const bucket = getBucket(w), avail = modes.filter(m => createTask(w, m, all));
    if (!avail.length) return modes[0];
    const prefs: Record<string, TrainingMode[]> = {
      weak: ['typing', 'cloze', 'forms', 'choice', 'flashcards'],
      reading: ['cloze', 'choice', 'typing', 'flashcards', 'forms'],
      reinforcement: ['choice', 'flashcards', 'typing', 'cloze', 'forms'],
    };
    return (prefs[bucket] || []).find(m => avail.includes(m as TrainingMode)) as TrainingMode || avail[idx % avail.length];
  }

  function buildTaskQueue(src: any[]) {
    const modes: TrainingMode[] = training_modes?.length > 0 ? training_modes : ['flashcards'];
    const usable = sortWords(src.filter(w => getMemStatus(w) !== 'passive_known'));
    const passive = sortWords(src.filter(w => getMemStatus(w) === 'passive_known')).slice(0, Math.max(1, Math.floor(src.length * 0.08)));
    const buckets: Record<string, any[]> = { weak: [], reading: [], reinforcement: [], new: [], passive };
    usable.forEach(w => { const b = getBucket(w); if (b !== 'passive') buckets[b]?.push(w); });

    const pattern = ['weak', 'new', 'reading', 'reinforcement', 'weak', 'new', 'reading', 'passive'];
    const result: any[] = []; const seen = new Set<string>(); let g = 0;

    while (result.length < src.length && g < src.length * 8 + 50) {
      const bn = pattern[g % pattern.length]; const bucket = buckets[bn] || []; const cand = bucket.shift();
      if (cand?.id && !seen.has(cand.id)) {
        const prev = result[result.length - 1];
        if (result.length > 0 && getBucket(cand) === 'weak' && getBucket(prev) === 'weak') { bucket.push(cand); }
        else { seen.add(cand.id); result.push(cand); }
      }
      g++;
      if (!Object.values(buckets).some(b => b.length > 0)) break;
    }

    const leftovers = sortWords(Object.values(buckets).flat().filter(w => w?.id && !seen.has(w.id)));
    leftovers.forEach(w => { if (!seen.has(w.id)) { seen.add(w.id); result.push(w); } });

    const words2 = result.slice(0, src.length);
    const built: TrainingTask[] = [];

    words2.forEach((w, idx) => {
      if (training_flow === 'one_per_word') {
        const m = pickMode(w, modes, src, idx); const t = createTask(w, m, src);
        if (t) { built.push({ ...t, id: `${t.id}-single` }); return; }
        for (const fm of modes) { const ft = createTask(w, fm, src); if (ft) { built.push({ ...ft, id: `${ft.id}-sfb` }); break; } }
        return;
      }

      const sel = mix_modes
        ? [pickMode(w, modes, src, idx), ...(() => {
          const p = pickMode(w, modes, src, idx);
          return modes.filter(m => m !== p && createTask(w, m, src));
        })().slice(0, 0)]
        : [modes[0]];

      sel.forEach(m => { const t = createTask(w, m, src); if (t) built.push(t); });
    });

    return built;
  }

  const taskTitle = useMemo(() => currentTask ? getModeLabel(currentTask.mode) : '', [currentTask, app_language]);

  return (
    <HomeBackground dark={isDark}>
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Text style={s.title}>{ui('title')}</Text>
          {currentTask ? <Text style={s.counter}>{taskIndex + 1}/{tasks.length}</Text> : null}
        </View>

        {loading ? <ActivityIndicator size="large" color={accent} style={s.loader} /> : null}

        {error ? (
          <GlassSurface variant="card" style={s.stateBox} contentStyle={s.stateInner} dark={isDark}>
            <Text style={s.error}>{error}</Text>
          </GlassSurface>
        ) : null}

        {!loading && !error && !currentTask ? (
          <GlassSurface variant="card" style={s.stateBox} contentStyle={s.stateInner} dark={isDark}>
            <Text style={s.empty}>{ui('empty_tasks')}</Text>
          </GlassSurface>
        ) : null}

        {currentTask && current ? (
          <>
            <TrainingCard
              currentTask={currentTask}
              current={current}
              isDark={isDark}
              s={s}
              appLanguage={app_language as AppLanguage}
              taskTitle={taskTitle}
              textColor={textColor}
              mutedColor={mutedColor}
              fonts={fonts}
              answerVisible={answerVisible}
              typedAnswer={typedAnswer}
              feedback={feedback}
              savingReview={savingReview}
              reviewSaved={reviewSaved}
              ui={ui}
              getCategoryLabel={getCategoryLabel}
              getMainWord={getMainWord}
              getImageUrl={getImageUrl}
              getTranslation={getTranslation}
              getAllForms={getAllForms}
              getClozeHint={getClozeHint}
              hasVerification={hasVerification}
              hasRelations={hasRelations}
              speakCurrentTask={speakCurrentTask}
              selectChoice={selectChoice}
              setTypedAnswer={setTypedAnswer}
              checkTyped={checkTyped}
              onToggleFlashcard={() => setAnswerVisible((v) => !v)}
            />

            <TrainingBottomBar
              mode={currentTask.mode}
              isDark={isDark}
              s={s}
              savingReview={savingReview}
              ui={ui}
              onNext={nextTask}
              onGrade={(label) => saveGrade(label, undefined, true)}
            />
          </>
        ) : null}

      </SafeAreaView>
    </HomeBackground>
  );
}
  

function makeStyles(
  theme: any,
  fonts: any,
  height: number,
  bottomInset: number,
  isDark: boolean,
  textColor: string,
  mutedColor: string,
  accent: string,
) {
  const bottomPadding = Math.max(86, bottomInset + 80);
  const cardHeight = Math.max(420, height - bottomPadding - 150);

  return StyleSheet.create({
    root: { flex: 1 },

    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 10,
    },
    title: {
      fontSize: 18,
      lineHeight: 20,
      fontWeight: '800',
      color: textColor,
      letterSpacing: -0.7,
    },
    counter: {
      fontSize: 18,
      fontWeight: '800',
      color: mutedColor,
    },

    loader: { marginTop: 40 },

    stateBox: {
      marginHorizontal: 16,
      marginTop: 16,
    },
    stateInner: {
      padding: 18,
    },
    error: {
      color: isDark ? '#FFD1D1' : '#991B1B',
      fontSize: fonts.base,
      fontWeight: '700',
    },
    empty: {
      fontSize: fonts.base,
      color: mutedColor,
      fontWeight: '700',
    },

    cardPress: {
  marginHorizontal: 16,
},
cardGlass: {
  height: cardHeight,
},
cardGlassInner: {
  minHeight: cardHeight,
},
cardInner: {
  padding: 20,
  paddingBottom: 28,
  minHeight: cardHeight,
},

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 10,
    },
    metaLeft: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      flex: 1,
    },
    tools: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    tagGlass: {},
    tagInner: {
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    tagText: {
      fontSize: fonts.meta,
      fontWeight: '800',
      color: accent,
    },
    tagTextMuted: {
      fontSize: fonts.meta,
      fontWeight: '800',
      color: mutedColor,
    },

    image: {
      width: '100%',
      height: 130,
      borderRadius: 18,
      marginBottom: 16,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },

    word: {
      fontSize: Math.max(30, fonts.word),
      lineHeight: Math.max(36, fonts.word * 1.16),
      fontWeight: '900',
      color: textColor,
      marginBottom: 14,
      letterSpacing: -0.7,
    },
    example: {
      fontSize: fonts.base,
      color: mutedColor,
      lineHeight: fonts.base * 1.5,
      marginBottom: 14,
      fontWeight: '600',
    },

    answerArea: {
      minHeight: 100,
    },
    
    answerLabel: {
      fontSize: fonts.meta,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
      color: mutedColor,
    },
    answerText: {
      fontWeight: '900',
      lineHeight: Math.min(fonts.translation, 22) * 1.45,
      color: accent,
      flexShrink: 1,
    },
    tapHintText: {
      fontSize: fonts.base,
      fontWeight: '800',
      textAlign: 'center',
      color: mutedColor,
    },

    prompt: {
      fontSize: Math.max(24, fonts.prompt),
      color: textColor,
      fontWeight: '900',
      lineHeight: Math.max(24, fonts.prompt) * 1.32,
      marginBottom: 16,
      letterSpacing: -0.4,
    },
    formLabel2: {
      color: accent,
      fontSize: fonts.meta,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 8,
    },

    choiceGrid: {
      gap: 11,
      marginBottom: 4,
    },
    choiceBtn: {},
    choiceInner: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    choiceText: {
      color: textColor,
      fontSize: fonts.base,
      fontWeight: '800',
    },

    input: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.72)',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 15,
      fontWeight: '800',
      marginBottom: 14,
      backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.36)',
      color: textColor,
      fontSize: fonts.base,
    },

    hintLabel: {
      fontSize: fonts.meta,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
      color: mutedColor,
    },
    hintText: {
      fontWeight: '900',
      color: accent,
      fontSize: fonts.base,
    },

    feedbackText: {
      fontWeight: '900',
      color: textColor,
      fontSize: fonts.base,
    },

    bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: bottomPadding - 2,
    paddingTop: 18,
    gap: 10,
},
    savingText: {
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '700',
      color: mutedColor,
    },
    gradeRow: {
      flexDirection: 'row',
      gap: 10,
    },

    disabled: {
      opacity: 0.55,
    },
  });
}