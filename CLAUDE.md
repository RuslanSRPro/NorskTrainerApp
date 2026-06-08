# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npx expo start       # start dev server (scan QR with Expo Go or simulator)
npm run android      # start with Android target
npm run ios          # start with iOS target
npm run web          # start with web target
npm run lint         # run eslint
```

There are no automated tests. The app connects to a live Supabase backend.

## Environment

Create `.env.local` with:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Architecture

**Norwegian vocabulary learning app** — React Native (Expo) with a Supabase backend.

### Routing

Expo Router file-based routing. All screens live in `app/(tabs)/`. The tab order: Home (`index.tsx`), Training (`explore.tsx`), Reading (`reading.tsx`), Voice (`voice.tsx`), Weak Words (`weak.tsx`), Settings (`settings.tsx`).

### Data layer (`services/`)

- **`supabase.ts`** — Supabase client, reads env vars.
- **`api.ts`** — All data operations. The most complex file. Contains:
  - Adaptive SRS (spaced repetition) engine: `calculateSrsUpdate`, `calculateAdaptiveIntervalDays`, `calculateMemoryScores`. These run client-side on every review.
  - Fetch functions that compose word sets from Supabase: `fetchNewWords`, `fetchDueWords`, `fetchWeakWords`, `fetchPriorityWords`, merged in `fetchAllLearningWords`.
  - Public API called from screens: `getLearningWordsFromSupabase`, `saveReviewToSupabase`, `getDashboardStatsFromSupabase`, `getReadingLexemesFromSupabase`, `enrichWordViaEdgeFunction`, `analyzeTextViaGemini`, `translateSentenceWithAI`.
- **`settings.ts`** — User identity (auto-created on first run, stored in AsyncStorage), profile management, `UserSettings` type, Supabase `user_settings` table operations.
- **`speech.ts`** — Norwegian TTS via `expo-speech`, caches the detected `nb-NO`/`no` voice. Exports `speakNorwegian`, `speakNorwegianForms`, `stopSpeech`.

### State (`store/settingsStore.ts`)

Single Zustand store. On app start, `loadSettings()` calls `getOrCreateUser()` (creates a new user UUID if none stored) then loads `UserSettings` from Supabase. All screen components read from this store via `useSettingsStore()`.

Key settings: `preferred_user` (user ID), `app_language` (`ua`/`en` — controls UI language), `translation_mode` (`ua`/`en`/`ua_en`), `training_modes` (array of active modes), `training_flow` (`reinforcement`/`one_per_word`), `daily_limit`.

### Database schema (key tables)

- **`lexemes`** — core vocabulary. `pos` is one of: `verb`, `noun`, `adjective`, `adverb`, `expression`. `status` = `'New'` for all entries.
- **`verb_forms`**, **`noun_forms`**, **`adjective_forms`** — grammatical forms joined 1-to-1 via `lexeme_id`.
- **`learning_progress`** — one row per `(user_id, lexeme_id)`. Holds all SRS state: `memory_status` (`active`/`weak`/`reinforcement`/`passive_known`), `memory_score`, `weak_score`, `priority_score`, `queue_score`, `personal_hits` (encounters in Reading), `next_due_at`.
- **`reviews`** — log of every training answer.
- **`users`**, **`user_settings`** — user identity and persisted settings.

### Word object shape

`mapLexemeRow()` in `api.ts` maps Supabase rows to the app's word shape. `f1–f5` are form slots shared across POS:
- verb: `f1`=presens, `f2`=preteritum, `f3`=perfektum
- noun: `f1`=bestemt entall, `f2`=ubestemt flertall, `f3`=bestemt flertall
- adjective: `f1`=intetkjønn, `f2`=flertall, `f3`=komparativ, `f4`=superlativ, `f5`=bestemt superlativ

### Training engine (`app/(tabs)/explore.tsx`)

Builds a `TrainingTask[]` queue from loaded words. Words are bucketed (`weak`/`reading`/`reinforcement`/`new`/`passive`) based on SRS scores, then interleaved via `buildBalancedWordOrder`. Each word generates tasks per `training_modes`. Five modes: `flashcards` (Hard/OK/Easy grading), `choice` (4-option multiple choice), `typing` (type Norwegian from translation), `cloze` (fill-in-the-blank from `example`), `forms` (type a grammatical form). Answers normalize input to strip articles (`en`/`ei`/`et`/`å`) before comparison.

### Edge Functions (`supabase/functions/`)

Deno-based, deployed to Supabase:
- **`enrich-word`** — Queries the Ordbokene API (Norwegian dictionary) for morphological data, then calls Gemini (`gemini-1.5-flash` → `gemini-2.0-flash` → `gemini-1.5-pro` fallback chain) for translations/examples. Saves to `lexemes` + form tables. Called from `enrichWordViaEdgeFunction()` in `api.ts`.
- **`analyze-text`** — Gemini-powered text analysis (tokenizes Norwegian text, identifies known/unknown words).
- **`translate-sentence`** — Gemini translation to UA or EN.

Env vars required in edge functions: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Styling

All styles use React Native `StyleSheet.create()` inline per file. No CSS framework. Primary palette: sky blue `#0EA5E9`, background `#F7F4ED`, white cards `#FFFFFF`. UI language switches between Ukrainian and English based on `app_language` — text is inlined as ternaries (`isUa ? 'Тренування' : 'Training'`).
