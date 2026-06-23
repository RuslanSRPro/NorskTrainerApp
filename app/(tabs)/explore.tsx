// app/(tabs)/explore.tsx
// Training screen — Apple-style theme + no outer scroll (card fills screen)

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLearningWordsFromSupabase, saveReviewToSupabase } from '@/services/api';
import { TrainingMode } from '@/services/settings';
import { speakNorwegian, speakNorwegianForms, stopSpeech } from '@/services/speech';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Lexeme360 } from '@/components/Lexeme360';
import { AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';

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

function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5); }

function normalizeAnswer(v: string) {
  return String(v || '').toLowerCase()
    .replace(/[.,!?;:()"«»]/g, '').replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '').replace(/^(den|det|de)\s+/i, '')
    .replace(/\s+/g, ' ').trim();
}
function normalizeFormAnswer(v: string) { return normalizeAnswer(v).replace(/^(den|det|de)\s+/i, '').trim(); }
function splitAccepted(v: string) {
  const raw = String(v || '').trim();
  if (!raw) return [];
  return Array.from(new Set([raw, ...raw.split(/[,;\/|]/g).map(s => s.trim()).filter(Boolean)]));
}
function isAccepted(input: string, expected: string, mode?: TrainingMode) {
  const norm = mode === 'forms' ? normalizeFormAnswer : normalizeAnswer;
  const typed = norm(input);
  if (!typed) return false;
  return splitAccepted(expected).map(norm).filter(Boolean).some(a => a === typed);
}
function normalizeChoice(v: string) { return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function getCategoryFamily(w: any) {
  const c = String(w?.category || w?.type || '').toLowerCase();
  if (c.includes('verb')) return 'verb';
  if (c.includes('noun')) return 'noun';
  if (c.includes('adj')) return 'adjective';
  if (c.includes('adv')) return 'adverb';
  if (c.includes('expr')) return 'expression';
  return c || 'unknown';
}
function isVerbLike(w: any) { return String(w?.category || w?.type || w?.pos || '').toLowerCase().includes('verb'); }
function displayLemma(v: string, w?: any) {
  const raw = String(v || '').trim();
  if (!raw) return raw;
  if (/^å\s+/i.test(raw)) return raw;
  return isVerbLike(w) ? `å ${raw}` : raw;
}
function getNestedFirst(v: any) { return Array.isArray(v) ? v[0] || {} : v || {}; }
function getFormValue(w: any, keys: string[]) {
  for (const k of keys) { if (w?.[k]) return w[k]; }
  const vf = getNestedFirst(w?.verb_forms), nf = getNestedFirst(w?.noun_forms), af = getNestedFirst(w?.adjective_forms);
  for (const k of keys) { const v = vf?.[k] || nf?.[k] || af?.[k]; if (v) return v; }
  return '';
}
function getNum(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function getFreq(w: any) { const v = getNum(w?.frequency, getNum(w?.srs?.frequency)); return v > 0 ? v : 999999; }
function getPriority(w: any) { return getNum(w?.priorityScore ?? w?.priority_score ?? w?.srs?.priority_score); }
function getWeak(w: any) { return getNum(w?.weakScore ?? w?.weak_score ?? w?.srs?.weak_score); }
function getHits(w: any) { return getNum(w?.personalHits ?? w?.personal_hits ?? w?.srs?.personal_hits); }
function getMemStatus(w: any) { return String(w?.memoryStatus ?? w?.memory_status ?? w?.srs?.memory_status ?? 'active'); }
function getQueue(w: any) { return getNum(w?.queueScore ?? w?.queue_score ?? w?.srs?.queue_score); }
function getBucket(w: any) {
  const s = getMemStatus(w), wk = getWeak(w), q = getQueue(w), hits = getHits(w), p = getPriority(w);
  if (s === 'passive_known') return 'passive';
  if (s === 'weak' || wk >= 45 || q >= 70) return 'weak';
  if (hits > 0 || p >= 55) return 'reading';
  if (s === 'reinforcement') return 'reinforcement';
  return 'new';
}
function getScore(w: any) {
  const freq = getFreq(w), fb = freq > 0 ? Math.max(0, 60 - Math.log10(freq + 1) * 12) : 0;
  const s = getMemStatus(w);
  const sb = s === 'weak' ? 70 : s === 'active' ? 25 : s === 'reinforcement' ? 10 : s === 'passive_known' ? -120 : 0;
  return getPriority(w) + getWeak(w) * 1.6 + getQueue(w) * 0.7 + Math.min(getHits(w), 30) * 5 + fb + sb;
}
function sortWords(ws: any[]) { return [...ws].sort((a, b) => getScore(b) - getScore(a)); }
function uniqueById(items: any[]) {
  const seen = new Set<string>(); const out: any[] = [];
  for (const it of items) { if (!it?.id || seen.has(it.id)) continue; seen.add(it.id); out.push(it); }
  return out;
}
function hasVerification(w: any) { return Boolean(w?.verification_tier || w?.verification_evidence || w?.source_verified); }
function hasRelations(w: any) { return Boolean(w?.relations_count > 0 || w?.has_relations || Array.isArray(w?.relations) && w.relations.length > 0); }
function getImageUrl(w: any) { return w?.image_url || w?.imageUrl || w?.image || ''; }

export default function TrainScreen() {
  const { theme, fonts } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [loading, setLoading]           = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaved, setReviewSaved]   = useState(false);
  const [words, setWords]               = useState<any[]>([]);
  const [tasks, setTasks]               = useState<TrainingTask[]>([]);
  const [taskIndex, setTaskIndex]       = useState(0);
  const [error, setError]               = useState('');
  const [answerVisible, setAnswerVisible] = useState(false);
  const [typedAnswer, setTypedAnswer]   = useState('');
  const [feedback, setFeedback]         = useState('');

  const {
    app_language, translation_mode, category_filter, study_set,
    daily_limit, preferred_user, training_modes, mix_modes,
    training_flow, training_layout, auto_pronounce, pronounce_forms,
    pronounce_after_answer, speech_rate, loadSettings,
  } = useSettingsStore();

  const currentTask = tasks[taskIndex];
  const current     = currentTask?.word;
  const lang        = (app_language || 'ua') as AppLanguage;
  const ui          = makeUi(lang);

  // Dynamic styles driven by theme + fonts
  const s = useMemo(() => makeStyles(theme, fonts, height, insets.bottom), [theme, fonts, height, insets.bottom]);

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
      const data  = await getLearningWordsFromSupabase({ preferred_user, category_filter, study_set, daily_limit });
      const queue = buildTaskQueue(data);
      setWords(data); setTasks(queue);
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
  function getCleanWord(w: any) { return String(w?.word || w?.lemma || '').replace(/^å\s+/i, '').replace(/^(en|ei|et)\s+/i, '').trim(); }
  function getMainWord(w: any) { return displayLemma(w?.word || w?.lemma || w?.text || '', w); }
  function getClozeHint(w: any) { return (lang === 'ua' ? w?.ua : w?.en) || w?.ua || w?.en || ''; }

  function getFormTask(w: any) {
    const type = String(w?.type || w?.category || w?.pos || '').toLowerCase();
    const forms = type.includes('verb') ? [
      { label: 'Presens',    value: getFormValue(w, ['presens',      'f1']) },
      { label: 'Preteritum', value: getFormValue(w, ['preteritum',   'f2']) },
      { label: 'Perfektum',  value: getFormValue(w, ['perfektum',    'f3']) },
    ] : type.includes('noun') ? [
      { label: 'Bestemt entall',    value: getFormValue(w, ['best_entall',   'f1']) },
      { label: 'Ubest. flertall',   value: getFormValue(w, ['ubest_flertall','f2']) },
      { label: 'Bestemt flertall',  value: getFormValue(w, ['best_flertall', 'f3']) },
    ] : type.includes('adj') ? [
      { label: 'Intetkjønn', value: getFormValue(w, ['intetkjonn',  'f1']) },
      { label: 'Flertall',   value: getFormValue(w, ['flertall',    'f2']) },
      { label: 'Komparativ', value: getFormValue(w, ['komparativ',  'f3']) },
      { label: 'Superlativ', value: getFormValue(w, ['superlativ',  'f4']) },
    ] : [];
    const avail = forms.filter(f => f.value);
    if (!avail.length) return null;
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function getAllForms(w: any) {
    const type = String(w?.type || w?.category || w?.pos || '').toLowerCase();
    // verb_forms/noun_forms/adjective_forms are pre-flattened objects from mapLexemeRow
    const vf: any = (!Array.isArray(w?.verb_forms)      ? w?.verb_forms      : w?.verb_forms?.[0])      || {};
    const nf: any = (!Array.isArray(w?.noun_forms)      ? w?.noun_forms      : w?.noun_forms?.[0])      || {};
    const af: any = (!Array.isArray(w?.adjective_forms) ? w?.adjective_forms : w?.adjective_forms?.[0]) || {};

    if (type.includes('verb')) {
      const inf        = vf.infinitiv  || getFormValue(w, ['infinitiv'])  || w?.word || w?.lemma || '';
      const presens    = vf.presens    || getFormValue(w, ['presens',    'f1']) || '';
      const preteritum = vf.preteritum || getFormValue(w, ['preteritum', 'f2']) || '';
      const perfRaw    = vf.perfektum  || getFormValue(w, ['perfektum',  'f3']) || '';
      const perfektum  = perfRaw ? `har ${perfRaw.replace(/^har\s+/i, '')}` : '';
      return [
        { label: 'Infinitiv',   value: displayLemma(inf, w) },
        { label: 'Presens',     value: presens },
        { label: 'Preteritum',  value: preteritum },
        { label: 'Perfektum',   value: perfektum },
      ].filter(f => f.value);
    }
    if (type.includes('noun')) return [
      { label: 'Ubest. entall',  value: nf.ubest_entall   || getFormValue(w, ['ubest_entall',   'indef_sg']) || w?.word || w?.lemma || '' },
      { label: 'Bestemt entall', value: nf.best_entall    || getFormValue(w, ['best_entall',    'f1']) || '' },
      { label: 'Ubest. flt.',    value: nf.ubest_flertall || getFormValue(w, ['ubest_flertall', 'f2']) || '' },
      { label: 'Bestemt flt.',   value: nf.best_flertall  || getFormValue(w, ['best_flertall',  'f3']) || '' },
    ].filter(f => f.value);
    if (type.includes('adj')) return [
      { label: 'Positiv',    value: af.positiv    || getFormValue(w, ['positiv',    'positive']) || w?.word || w?.lemma || '' },
      { label: 'Intetkjønn', value: af.intetkjonn || getFormValue(w, ['intetkjonn', 'f1']) || '' },
      { label: 'Flertall',   value: af.flertall   || getFormValue(w, ['flertall',   'f2']) || '' },
      { label: 'Komparativ', value: af.komparativ || getFormValue(w, ['komparativ', 'f3']) || '' },
      { label: 'Superlativ', value: af.superlativ || getFormValue(w, ['superlativ', 'f4']) || '' },
    ].filter(f => f.value);
    return [];
  }

  function getCategoryLabel(cat: string) {
    const map: Record<AppLanguage, Record<string, string>> = {
      ua: { verb:'Дієслово', noun_masculine:'Іменник · ч.р.', noun_feminine:'Іменник · ж.р.', noun_neuter:'Іменник · с.р.', adjective:'Прикметник', adverb:'Прислівник', expression:'Сталий вираз' },
      en: { verb:'Verb', noun_masculine:'Noun · masc.', noun_feminine:'Noun · fem.', noun_neuter:'Noun · neuter', adjective:'Adjective', adverb:'Adverb', expression:'Expression' },
      no: { verb:'Verb', noun_masculine:'Subst. · hankjønn', noun_feminine:'Subst. · hunkjønn', noun_neuter:'Subst. · intetkjønn', adjective:'Adjektiv', adverb:'Adverb', expression:'Fast uttrykk' },
    };
    return map[lang]?.[cat] || map.en[cat] || cat;
  }
  function getModeLabel(mode: TrainingMode) {
    const map: Record<AppLanguage, Record<TrainingMode, string>> = {
      ua: { flashcards:'Картка', choice:'Вибір', typing:'Введення', cloze:'Пропуск', forms:'Форми' },
      en: { flashcards:'Card',   choice:'Choice', typing:'Typing',   cloze:'Cloze',   forms:'Forms' },
      no: { flashcards:'Kort',   choice:'Valg',   typing:'Skriving', cloze:'Luke',    forms:'Former' },
    };
    return map[lang]?.[mode] || map.en[mode];
  }

  function getSpeechRate() { const r = speech_rate; return !Number.isFinite(r) ? 0.85 : Math.min(1.2, Math.max(0.5, r)); }

  async function speakCurrentTask() {
    if (!current || !currentTask) return;
    const rate = getSpeechRate();
    if (pronounce_forms) { const f = getAllForms(current); if (f.length) { await speakNorwegianForms(f, { rate }); return; } }
    await speakNorwegian(currentTask.mode === 'forms' ? currentTask.prompt || getMainWord(current) : getMainWord(current), { rate });
  }
  async function speakAnswer() {
    if (!currentTask || !current) return;
    const rate = getSpeechRate();
    if (pronounce_forms) { const f = getAllForms(current); if (f.length) { await speakNorwegianForms(f, { rate }); return; } }
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
      await saveReviewToSupabase({ user: preferred_user, mode: currentTask.mode, word: current.word || '', answer: answer || getTranslation(current), correct: label !== 'Hard', difficulty, lexemeId: current.id, wordId: current.id });
      setReviewSaved(true);
      if (goNext) nextTask();
    } catch { setError(ui('save_error')); }
    finally { setSavingReview(false); }
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

  // ---- task queue builders (same logic as original) ----
  function createTask(w: any, mode: TrainingMode, allWords: any[]): TrainingTask | null {
    if (mode === 'flashcards') return { id:`${w.id}-fc`, mode, word:w, expected:getTranslation(w) };
    if (mode === 'choice') {
      const correct = getTranslation(w); if (!correct) return null;
      const dist = getDistractors(w, allWords, correct); if (dist.length < 2) return null;
      return { id:`${w.id}-ch`, mode, word:w, expected:correct, options:shuffle([correct,...dist]) };
    }
    if (mode === 'typing') return { id:`${w.id}-ty`, mode, word:w, prompt:getTranslation(w), expected:getCleanWord(w) };
    if (mode === 'cloze') {
      const ex = w.example||'', cw = getCleanWord(w); if (!ex||!cw) return null;
      const cloze = ex.replace(new RegExp(cw,'i'),'____');
      return { id:`${w.id}-cl`, mode, word:w, prompt:cloze===ex?ex:cloze, expected:cw };
    }
    if (mode === 'forms') {
      const ft = getFormTask(w); if (!ft) return null;
      return { id:`${w.id}-fo-${ft.label}`, mode, word:w, prompt:w.word, expected:ft.value, formLabel:ft.label };
    }
    return null;
  }
  function getDistractors(w: any, all: any[], correct: string) {
    const tf = getCategoryFamily(w), tfreq = getFreq(w), cn = normalizeChoice(correct);
    const cands = all.filter(it=>it.id!==w.id).map(it=>{
      const tr = getTranslation(it); if(!tr) return null;
      const n = normalizeChoice(tr); if(!n||n===cn) return null;
      return { translation:tr, score:(getCategoryFamily(it)===tf?1000000:0)-Math.min(Math.abs(getFreq(it)-tfreq),999999)+getPriority(it)*10 };
    }).filter(Boolean) as {translation:string,score:number}[];
    const sorted = cands.sort((a,b)=>b.score-a.score);
    const unique: string[] = [];
    for (const c of sorted) {
      if (unique.some(u=>normalizeChoice(u)===normalizeChoice(c.translation))) continue;
      unique.push(c.translation); if (unique.length>=3) break;
    }
    if (unique.length<3) {
      const fb = shuffle(all.filter(it=>it.id!==w.id).map(getTranslation).filter(Boolean).filter(t=>normalizeChoice(t)!==cn&&!unique.some(u=>normalizeChoice(u)===normalizeChoice(t)))).slice(0,3-unique.length);
      unique.push(...fb);
    }
    return unique.slice(0,3);
  }
  function pickMode(w:any,modes:TrainingMode[],all:any[],idx:number) {
    const bucket=getBucket(w), avail=modes.filter(m=>createTask(w,m,all));
    if(!avail.length) return modes[0];
    const prefs:Record<string,TrainingMode[]>={
      weak:['typing','cloze','forms','choice','flashcards'],
      reading:['cloze','choice','typing','flashcards','forms'],
      reinforcement:['choice','flashcards','typing','cloze','forms'],
    };
    return (prefs[bucket]||[]).find(m=>avail.includes(m as TrainingMode)) as TrainingMode || avail[idx%avail.length];
  }
  function buildTaskQueue(src: any[]) {
    const modes: TrainingMode[] = training_modes?.length>0 ? training_modes : ['flashcards'];
    const usable = sortWords(src.filter(w=>getMemStatus(w)!=='passive_known'));
    const passive = sortWords(src.filter(w=>getMemStatus(w)==='passive_known')).slice(0,Math.max(1,Math.floor(src.length*0.08)));
    const buckets:Record<string,any[]>={weak:[],reading:[],reinforcement:[],new:[],passive};
    usable.forEach(w=>{const b=getBucket(w);if(b!=='passive')buckets[b]?.push(w);});
    const pattern=['weak','new','reading','reinforcement','weak','new','reading','passive'];
    const result:any[]=[]; const seen=new Set<string>(); let g=0;
    while(result.length<src.length&&g<src.length*8+50){
      const bn=pattern[g%pattern.length]; const bucket=buckets[bn]||[]; const cand=bucket.shift();
      if(cand?.id&&!seen.has(cand.id)){
        const prev=result[result.length-1];
        if(result.length>0&&getBucket(cand)==='weak'&&getBucket(prev)==='weak'){bucket.push(cand);}
        else{seen.add(cand.id);result.push(cand);}
      }
      g++;
      if(!Object.values(buckets).some(b=>b.length>0))break;
    }
    const leftovers=sortWords(Object.values(buckets).flat().filter(w=>w?.id&&!seen.has(w.id)));
    leftovers.forEach(w=>{if(!seen.has(w.id)){seen.add(w.id);result.push(w);}});
    const words2=result.slice(0,src.length);
    const built:TrainingTask[]=[];
    words2.forEach((w,idx)=>{
      if(training_flow==='one_per_word'){
        const m=pickMode(w,modes,src,idx); const t=createTask(w,m,src);
        if(t){built.push({...t,id:`${t.id}-single`});return;}
        for(const fm of modes){const ft=createTask(w,fm,src);if(ft){built.push({...ft,id:`${ft.id}-sfb`});break;}}
        return;
      }
      const sel=mix_modes?[pickMode(w,modes,src,idx),...(()=>{const p=pickMode(w,modes,src,idx);return modes.filter(m=>m!==p&&createTask(w,m,src));})().slice(0,0)]:[modes[0]];
      sel.forEach(m=>{const t=createTask(w,m,src);if(t)built.push(t);});
    });
    return built;
  }

  const taskTitle = useMemo(() => currentTask ? getModeLabel(currentTask.mode) : '', [currentTask, app_language]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>

      {/* ── Header (fixed, never scrolls) */}
      <View style={s.header}>
        <Text style={s.title}>{ui('title')}</Text>
        {currentTask ? (
          <Text style={s.counter}>{taskIndex + 1}/{tasks.length}</Text>
        ) : null}
      </View>

      {/* ── States: loading / error / empty */}
      {loading ? <ActivityIndicator size="large" color={theme.accent} style={s.loader} /> : null}
      {error    ? <Text style={s.error}>{error}</Text> : null}
      {!loading && !error && !currentTask ? <Text style={s.empty}>{ui('empty_tasks')}</Text> : null}

      {/* ── Main card (flex: 1, grows to fill all remaining space) */}
      {currentTask && current ? (
        <>
          <Pressable
            style={s.card}
            onPress={() => currentTask.mode === 'flashcards' ? setAnswerVisible(v => !v) : undefined}
          >
            {/* Card has its own internal scroll so content never clips */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.cardInner}
            >
              {/* Meta row */}
              <View style={s.metaRow}>
                <View style={s.metaLeft}>
                  <View style={[s.tag, { backgroundColor: theme.tagBg }]}>
                    <Text style={[s.tagText, { color: theme.tagText }]}>
                      {getCategoryLabel(current.category || current.type || '')}
                    </Text>
                  </View>
                  <View style={[s.tag, { backgroundColor: theme.cardInner }]}>
                    <Text style={[s.tagText, { color: theme.textSecondary }]}>{taskTitle}</Text>
                  </View>
                </View>
                <View style={s.tools}>
                  {hasVerification(current) ? (
                    <VerificationBadge tier={current.verification_tier} sourceVerified={current.source_verified} evidence={current.verification_evidence} lemma={current.lemma||current.word} size="sm" lang={app_language as any||'ua'} />
                  ) : null}
                  {hasRelations(current) ? (
                    <Lexeme360 lexemeId={current.id} lemma={getMainWord(current)} pos={current.pos||current.category||current.type} lang={app_language as any||'ua'} />
                  ) : null}
                </View>
              </View>

              {getImageUrl(current) ? (
                <Image source={{ uri: getImageUrl(current) }} style={s.image} resizeMode="cover" />
              ) : null}

              {/* ── Flashcard mode */}
              {currentTask.mode === 'flashcards' ? (
                <>
                  <Text style={s.word} onPress={speakCurrentTask}>{getMainWord(current)}</Text>
                  {current.example ? <Text style={s.example}>{current.example}</Text> : null}
                  <View style={s.answerArea}>
                    {answerVisible ? (
                      <>
                        <View style={[s.answerBox, { backgroundColor: theme.accentBg }]}>
                          <Text style={[s.answerLabel, { color: theme.textMuted }]}>{ui('translation')}</Text>
                          <Text style={[s.answerText, { color: theme.accent, fontSize: getTranslation(current).length > 30 ? fonts.base : fonts.translation }]}>{getTranslation(current)}</Text>
                        </View>
                        <FormsList forms={getAllForms(current)} title={ui('forms')} theme={theme} fonts={fonts} />
                      </>
                    ) : (
                      <View style={[s.tapHint, { backgroundColor: theme.cardInner }]}>
                        <Text style={[s.tapHintText, { color: theme.textMuted }]}>{ui('tap_to_reveal')}</Text>
                      </View>
                    )}
                  </View>
                </>
              ) : null}

              {/* ── Choice mode */}
              {currentTask.mode === 'choice' ? (
                <>
                  <Text style={s.word} onPress={speakCurrentTask}>{getMainWord(current)}</Text>
                  <View style={s.choiceGrid}>
                    {currentTask.options?.map(opt => (
                      <Pressable key={opt} style={[s.choiceBtn, { backgroundColor: theme.cardInner, borderColor: theme.border }, reviewSaved && s.disabled]} onPress={() => selectChoice(opt)} disabled={savingReview || reviewSaved}>
                        <Text style={[s.choiceText, { color: theme.text, fontSize: fonts.base }]}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {answerVisible ? <FormsList forms={getAllForms(current)} title={ui('forms')} theme={theme} fonts={fonts} /> : null}
                </>
              ) : null}

              {/* ── Typing mode */}
              {currentTask.mode === 'typing' ? (
                <>
                  <Text style={[s.prompt, { color: theme.textSecondary, fontSize: fonts.prompt }]}>{currentTask.prompt}</Text>
                  <TextInput style={[s.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, fontSize: fonts.base }]} value={typedAnswer} onChangeText={setTypedAnswer} placeholder={ui('type_word')} placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} editable={!reviewSaved && !savingReview} />
                  <Pressable style={[s.checkBtn, { backgroundColor: theme.accent }, (savingReview||reviewSaved)&&s.disabled]} onPress={checkTyped} disabled={savingReview||reviewSaved}>
                    <Text style={s.checkBtnText}>{ui('check')}</Text>
                  </Pressable>
                  {answerVisible ? <FormsList forms={getAllForms(current)} title={ui('forms')} theme={theme} fonts={fonts} /> : null}
                </>
              ) : null}

              {/* ── Cloze mode */}
              {currentTask.mode === 'cloze' ? (
                <>
                  <Text style={[s.prompt, { color: theme.text, fontSize: fonts.prompt }]}>{currentTask.prompt}</Text>
                  {getClozeHint(current) ? (
                    <View style={[s.hintBox, { backgroundColor: theme.accentBg }]}>
                      <Text style={[s.hintLabel, { color: theme.textMuted }]}>{ui('hint')}</Text>
                      <Text style={[s.hintText, { color: theme.accent, fontSize: fonts.base }]}>{getClozeHint(current)}</Text>
                    </View>
                  ) : null}
                  <TextInput style={[s.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, fontSize: fonts.base }]} value={typedAnswer} onChangeText={setTypedAnswer} placeholder={ui('fill_gap')} placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} editable={!reviewSaved && !savingReview} />
                  <Pressable style={[s.checkBtn, { backgroundColor: theme.accent }, (savingReview||reviewSaved)&&s.disabled]} onPress={checkTyped} disabled={savingReview||reviewSaved}>
                    <Text style={s.checkBtnText}>{ui('check')}</Text>
                  </Pressable>
                  {answerVisible ? <FormsList forms={getAllForms(current)} title={ui('forms')} theme={theme} fonts={fonts} /> : null}
                </>
              ) : null}

              {/* ── Forms mode */}
              {currentTask.mode === 'forms' ? (
                <>
                  <Text style={[s.formLabel2, { color: theme.accent, fontSize: fonts.meta }]}>{currentTask.formLabel}</Text>
                  <Text style={s.word} onPress={speakCurrentTask}>{currentTask.prompt}</Text>
                  <TextInput style={[s.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, fontSize: fonts.base }]} value={typedAnswer} onChangeText={setTypedAnswer} placeholder={ui('type_form')} placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} editable={!reviewSaved && !savingReview} />
                  <Pressable style={[s.checkBtn, { backgroundColor: theme.accent }, (savingReview||reviewSaved)&&s.disabled]} onPress={checkTyped} disabled={savingReview||reviewSaved}>
                    <Text style={s.checkBtnText}>{ui('check')}</Text>
                  </Pressable>
                  {answerVisible ? <FormsList forms={getAllForms(current)} title={ui('all_forms')} theme={theme} fonts={fonts} /> : null}
                </>
              ) : null}

              {feedback ? (
                <View style={[s.feedbackBox, { backgroundColor: theme.cardInner }]}>
                  <Text style={[s.feedbackText, { color: theme.text, fontSize: fonts.base }]}>{feedback}</Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>

          {/* ── Bottom actions (fixed, always visible) */}
          <View style={s.bottomBar}>
            {savingReview ? <Text style={[s.savingText, { color: theme.textMuted }]}>{ui('saving')}</Text> : null}

            {currentTask.mode === 'flashcards' ? (
              <View style={s.gradeRow}>
                <Pressable style={[s.gradeBtn, { backgroundColor: theme.hardBtn }, savingReview && s.disabled]} disabled={savingReview} onPress={() => saveGrade('Hard', undefined, true)}>
                  <Text style={[s.gradeText, { color: theme.hardText }]}>{ui('hard')}</Text>
                </Pressable>
                <Pressable style={[s.gradeBtn, { backgroundColor: theme.okBtn }, savingReview && s.disabled]} disabled={savingReview} onPress={() => saveGrade('OK', undefined, true)}>
                  <Text style={[s.gradeText, { color: theme.okText }]}>{ui('ok')}</Text>
                </Pressable>
                <Pressable style={[s.gradeBtn, { backgroundColor: theme.easyBtn }, savingReview && s.disabled]} disabled={savingReview} onPress={() => saveGrade('Easy', undefined, true)}>
                  <Text style={[s.gradeText, { color: theme.easyText }]}>{ui('easy')}</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable style={[s.nextBtn, { backgroundColor: theme.nextBtn, borderColor: theme.nextBorder }, savingReview && s.disabled]} disabled={savingReview} onPress={nextTask}>
              <Text style={[s.nextText, { color: theme.nextText, fontSize: fonts.base }]}>{ui('next_task')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FormsList({ forms, title, theme, fonts }: { forms:{label:string;value:string}[]; title:string; theme:any; fonts:any }) {
  if (!forms.length) return null;
  return (
    <View style={{ backgroundColor: theme.cardInner, borderRadius: 14, padding: 14, marginTop: 12 }}>
      <Text style={{ fontSize: fonts.meta, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{title}</Text>
      {forms.map(f => (
        <View key={`${f.label}-${f.value}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <Text style={{ width: 130, fontSize: fonts.meta, fontWeight: '600', color: theme.textMuted }}>{f.label}</Text>
          <Text style={{ flex: 1, fontSize: fonts.base, fontWeight: '600', color: theme.text }}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(theme: any, fonts: any, height: number, bottomInset: number) {
  const TAB_BAR = 80; // tab bar height
  return StyleSheet.create({
    root:       { flex: 1 },
    header:     { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
    title:      { fontSize: 20, fontWeight: '700', color: theme.text },
    counter:    { fontSize: 14, fontWeight: '500', color: theme.textMuted },
    loader:     { marginTop: 40 },
    error:      { margin: 20, padding: 14, borderRadius: 12, backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: fonts.base },
    empty:      { margin: 20, fontSize: fonts.base, color: theme.textMuted },

    // Card grows to fill all remaining space between header and bottom bar
    card:       { flex: 1, marginHorizontal: 14, borderRadius: 22, backgroundColor: theme.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, overflow: 'hidden' },
    cardInner:  { padding: 18, paddingBottom: 24 },

    metaRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 },
    metaLeft:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
    tools:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tag:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    tagText:    { fontSize: fonts.meta, fontWeight: '600' },

    image:      { width: '100%', height: 130, borderRadius: 14, marginBottom: 14, backgroundColor: theme.border },

    word:       { fontSize: fonts.word, lineHeight: fonts.word * 1.2, fontWeight: '700', color: theme.text, marginBottom: 10 },
    example:    { fontSize: fonts.base, color: theme.textMuted, lineHeight: fonts.base * 1.5, marginBottom: 12 },

    answerArea: { minHeight: 100 },
    answerBox:  { borderRadius: 14, padding: 14, marginBottom: 10 },
    answerLabel:{ fontSize: fonts.meta, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
    answerText: { fontWeight: '700', lineHeight: Math.min(fonts.translation, 22) * 1.4, flexShrink: 1 },
    tapHint:    { borderRadius: 14, padding: 18 },
    tapHintText:{ fontSize: fonts.base, fontWeight: '500', textAlign: 'center' },

    prompt:     { fontWeight: '700', lineHeight: fonts.prompt * 1.35, marginBottom: 14 },
    formLabel2: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },

    choiceGrid: { gap: 10, marginBottom: 4 },
    choiceBtn:  { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 0.5 },
    choiceText: { fontWeight: '600' },

    input:      { borderWidth: 0.5, borderRadius: 14, padding: 14, fontWeight: '600', marginBottom: 12 },
    checkBtn:   { borderRadius: 14, paddingVertical: 15, marginBottom: 8 },
    checkBtnText:{ color: '#FFFFFF', textAlign: 'center', fontSize: fonts.base, fontWeight: '700' },

    hintBox:    { borderRadius: 14, padding: 12, marginBottom: 12 },
    hintLabel:  { fontSize: fonts.meta, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
    hintText:   { fontWeight: '700' },

    feedbackBox:{ borderRadius: 14, padding: 14, marginTop: 10 },
    feedbackText:{ fontWeight: '700' },

    // Fixed bottom bar
    bottomBar:  { paddingHorizontal: 14, paddingBottom: TAB_BAR + 8, paddingTop: 8, gap: 4 },
    savingText: { textAlign: 'center', fontSize: 13, fontWeight: '500' },
    gradeRow:   { flexDirection: 'row', gap: 10 },
    gradeBtn:   { flex: 1, paddingVertical: 15, borderRadius: 14 },
    gradeText:  { textAlign: 'center', fontSize: fonts.base, fontWeight: '700' },
    nextBtn:    { borderRadius: 14, paddingVertical: 10, borderWidth: 0.5, marginTop: 10 },
    nextText:   { textAlign: 'center', fontWeight: '600', fontSize: 14 },

    disabled:   { opacity: 0.5 },
  });
}
