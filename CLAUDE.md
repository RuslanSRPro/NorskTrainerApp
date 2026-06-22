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

Edge functions also require these Supabase secrets (set via `supabase secrets set`):
```
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Architecture

**Norwegian vocabulary learning app** — React Native (Expo) with a Supabase backend.

### Routing

Expo Router file-based routing. All screens live in `app/(tabs)/`. The tab order (as defined in `_layout.tsx`):

| File | Tab title | Purpose |
|---|---|---|
| `index.tsx` | Home | Dashboard with stats |
| `explore.tsx` | Training | Adaptive training engine |
| `reading.tsx` | Reading | Text analysis + word lookup |
| `voice.tsx` | Voice | Stub — requires dev build |
| `weak.tsx` | Weak | Weak word heatmap |
| `settings.tsx` | Settings | All user settings |

### Data layer (`services/`)

- **`supabase.ts`** — Supabase client, reads env vars.
- **`api.ts`** — All data operations (~1225 lines). Contains:
  - Adaptive SRS engine: `calculateSrsUpdate`, `calculateAdaptiveIntervalDays`, `calculateMemoryScores`, `calculateMemoryStatus`, `calculateAdaptiveNextDueAt`. All run client-side on every review result.
  - Fetch functions: `fetchNewWords`, `fetchDueWords`, `fetchWeakWords`, `fetchPriorityWords`, composed in `fetchAllLearningWords`.
  - Public API: `getLearningWordsFromSupabase`, `saveReviewToSupabase`, `getDashboardStatsFromSupabase`, `getReadingLexemesFromSupabase`, `enrichWordViaEdgeFunction`, `analyzeTextViaGemini` (calls `analyze-text` edge function), `analyzeTextViaAppsScript` (alias for `analyzeTextViaGemini`), `translateSentenceWithAI`.
  - Additional public API: `searchLexemeInSupabase`, `addLexemeToLearningFromSupabase`, `boostReadingLexemeHitsInSupabase`, `addExpressionCandidateToSupabase`, `addLexemeToGlobalBaseFromSupabase`.
  - Deprecated stubs (backward compat): `inspectWordViaAppsScript`, `addPreviewWordViaAppsScript`, `getLearningWords`, `saveReview`.
  - ⚠️ **`enrichWordViaEdgeFunction` calls `ENRICH_WORD_URL` which pointed to the `enrich-word` edge function — that function has been deleted. This call will fail at runtime until `api.ts` is updated.**
- **`settings.ts`** — User identity, `UserSettings` type, Supabase `user_settings` table operations. User ID is a Supabase Auth UUID (not the old `u_xxx` random ID). Exports: `getOrCreateUser`, `getCurrentUserId`, `getUserSettings`, `saveUserSettings`, `updateUserProfile`, `regenerateSyncCode`, `restoreUserByEmail`, plus profile compatibility shims.
- **`speech.ts`** — Norwegian TTS via `expo-speech`. Voice detection priority: `nb` → `no` → `nor` language codes. Exports: `speakNorwegian`, `speakNorwegianSlow`, `speakNorwegianForms`, `speakNorwegianPhraseSequence`, `stopSpeech`, `isSpeechPlaying`, plus aliases `speakWord`, `speakForms`, `speakSlow`.
- **`verification.ts`** — Unified verification tier resolver. Defines 6 tiers (`dictionary_entry`, `dictionary_match`, `normative_reference`, `usage_evidence`, `component_match`, `ai_candidate`). Used by `VerificationBadge` component and Reading screen. Key export: `resolveVerification(input, lang)`. **Client-side tier logic is fully reconciled with `aggregateVerificationTier()` in `semantic-audit-worker` — branch order, quality strings, and source checks match exactly.**
- **`i18n.ts`** — Translation strings for UA/EN/NO. Used by Settings and some components via `t(key, lang)`. Supports Norwegian (`no`) as a third UI language (not just UA/EN as older docs stated).
- **`localizedText.ts`** — Additional localized strings.
- **`theme.ts`** — Theme system with 4 themes (`light`, `dark`, `reading`, `turquoise`) and 3 font sizes (`small`, `medium`, `large`). Used via `useAppTheme()` hook in Settings. Exports `THEME_LABELS`, `FONT_SIZE_LABELS`, `AppColors`, `ThemeName`, `FontSizeName`.

### State management

Two Zustand stores:

**`store/settingsStore.ts`** — Primary settings store. On app start, `loadSettings()` gets the current user ID from `authStore` (Supabase Auth UUID) then loads `UserSettings` from Supabase. Training layout is also persisted locally in AsyncStorage (`norsk_trainer_training_layout`).

Key settings: `preferred_user` (Supabase Auth UUID), `app_language` (`ua`/`en`/`no` — three options, not two), `translation_mode` (`ua`/`en`/`ua_en`), `training_modes` (array of active modes), `training_flow` (`reinforcement`/`one_per_word`), `training_layout` (`standard`/`sentence_first`), `daily_limit` (20/50/100/200), plus speech/theme/font settings.

**`store/authStore.ts`** — Supabase Auth state. Handles OTP email sign-in (`signInWithOtp`, `verifyOtp`). Exports `getCurrentUserId()` which returns the Supabase Auth user UUID or `'anonymous'`. This is the real user identity — the old `u_xxx` random IDs in `settings.ts` are now legacy.

### Database schema (key tables)

- **`lexemes`** — core vocabulary. `pos` is one of: `verb`, `noun`, `adjective`, `adverb`, `expression`. Verification fields: `verification_tier`, `verification_status`, `verification_evidence` (JSONB), `source_verified`, `verification_version`, `source_checked_at`. Enrichment fields: `enrichment_status`, `enrichment_error`.
- **`verb_forms`** — joined 1-to-1 via `lexeme_id`. Fields: `infinitiv`, `presens`, `preteritum`, `perfektum`, `gruppe`, `expression_subtype`, `base_verb`, `particle`, `requires_seg`.
- **`noun_forms`** — Fields: `official_gender`, `accepted_articles`, `preferred_article`, `ubest_entall`, `best_entall`, `ubest_flertall`, `best_flertall`.
- **`adjective_forms`** — Fields: `positiv`, `intetkjonn`, `flertall`, `komparativ`, `superlativ`, `best_superlativ`.
- **`expression_data`** — Stores `expression_subtype` for expressions.
- **`synonyms`** — `synonym_no`, `synonym_type`, `synonym_ua`, `antonym_no`, `antonym_ua`, `synonym_status`.
- **`learning_progress`** — one row per `(user_id, lexeme_id)`. SRS state: `memory_status` (`active`/`weak`/`reinforcement`/`passive_known`), `memory_score`, `weak_score`, `priority_score`, `queue_score`, `personal_hits`, `next_due_at`, `repetitions`, `lapses`, `stability`, `difficulty_val`, `last_seen_in_reading`.
- **`reviews`** — log of every training answer: `mode`, `answer`, `correct`, `difficulty`.
- **`users`**, **`user_settings`** — user identity and persisted settings.
- **`expression_catalog`** — used by the `analyze-text` edge function for expression matching (with `normalized_key` column). Also has `ordbokene_status`, `naob_status`, `expression_review_status` columns — the last is recomputed automatically by a DB trigger whenever either source status changes.
- **`lexeme_processing_jobs`**, **`lexeme_processing_items`**, **`lexeme_source_checks`** — pipeline tables for the authoritative enrichment system (backend only, not touched by app code).
- **`verification_history`** — audit log of every `verification_tier`/`verification_status` change, with full before/after row snapshots.
- **`trusted_expressions_v1`** — view: `expression_catalog JOIN expression_semantic_enrichment WHERE review_status = 'trusted'`. Used by `analyze-text` to load the expression dictionary.

### Word object shape

`mapLexemeRow()` in `api.ts` maps Supabase rows to the app's word shape. `f1–f5` are shortcut slots for common forms:
- verb: `f1`=presens, `f2`=preteritum, `f3`=perfektum
- noun: `f1`=best_entall, `f2`=ubest_flertall, `f3`=best_flertall
- adjective: `f1`=intetkjonn, `f2`=flertall, `f3`=komparativ, `f4`=superlativ, `f5`=best_superlativ

Full form objects (`verb_forms`, `noun_forms`, `adjective_forms`) are also included on the word object for components that need the complete field set. Verification fields (`verification_tier`, `verification_status`, `verification_evidence`, `source_verified`) are included too.

### Training engine (`app/(tabs)/explore.tsx`)

Builds a `TrainingTask[]` queue from loaded words.

1. Words are sorted by `getWordLearningScore()` (factors: priority, weak, queue scores, personal_hits, frequency, memory status).
2. Words are bucketed: `weak` / `reading` / `reinforcement` / `new` / `passive` via `getTrainingBucket()`.
3. Buckets are interleaved via `buildBalancedWordOrder` using the pattern `[weak, new, reading, reinforcement, weak, new, reading, passive]`.
4. Tasks are created via `createTask(word, mode, allWords)`.
5. If `mix_modes` is on, `balanceTaskOrder()` re-shuffles to avoid same-word consecutive tasks.

**Training modes (5):**
- `flashcards` — Show Norwegian word, tap to reveal translation. Hard/OK/Easy grade buttons.
- `choice` — 4-option multiple choice (shows Norwegian, pick translation). Distractors chosen by same POS + frequency proximity.
- `typing` — Show translation, type the Norwegian word. Normalized for articles.
- `cloze` — Fill-in-the-blank from `example` sentence.
- `forms` — Type a grammatical form (randomly chosen from available forms for that POS).

**Answer normalization** strips: punctuation, leading `å `, leading `en/ei/et `, leading `den/det/de `. `forms` mode additionally strips definite article prefixes via `normalizeFormAnswer`.

**Training flow modes:**
- `reinforcement` — Multiple modes per word per session (up to 2 for weak words, 1 for others).
- `one_per_word` — Exactly one task per word, mode chosen by bucket priority.

**Training layout modes:**
- `standard` — Word shown first.
- `sentence_first` — Example sentence shown as context for `choice`, `typing`, `forms` modes.

**UI language** in explore.tsx uses a `UI_TEXT` record keyed by `AppLanguage` (`ua`/`en`/`no`) — three languages, not two.

### Reading screen (`app/(tabs)/reading.tsx`)

Two analysis modes:
- **PWA analysis** — Calls `analyzeTextViaAppsScript` (which routes to the `analyze-text` edge function), combined with a local dictionary lookup from all lexemes.
- **AI analysis** — Same function call (currently both routes call `analyzeTextViaGemini`/`analyze-text` — functionally identical at the API layer).

Both modes display a color-coded word map (green=learned, yellow=in_base, red=unknown), candidate selection for batch-adding missing words, and per-sentence AI explanation via `translateSentenceWithAI`.

The `analyze-text` edge function (v7) is **not a simple Gemini call** — it is a full pipeline that tokenizes text, matches against `trusted_expressions_v1` (expressions with `review_status='trusted'`), resolves surface forms via `resolve_surface_form` RPC, creates processing jobs, and triggers the `job-orchestrator` edge function. It returns a job result, not a simple word list. The Reading screen must handle the job-based response format.

### Components (`components/`)

- **`VerificationBadge.tsx`** — Displays verification tier as a colored badge. Used in Training and Reading.
- **`Lexeme360.tsx`** — Semantic relation viewer ("360°"). Shows synonyms, expressions, particle verbs, etc.
- **`Lexeme360Carousel.tsx`** — Carousel variant of Lexeme360.
- **`ScreenHeader.tsx`** — Reusable screen header with icon + title.
- Standard Expo template components: `external-link`, `haptic-tab`, `hello-wave`, `parallax-scroll-view`, `themed-text`, `themed-view`, `ui/collapsible`, `ui/icon-symbol`.

### Edge Functions (`supabase/functions/`)

Deno-based, deployed to Supabase. Active functions:

- **`analyze-text/`** — Full NLP pipeline. Tokenizes Norwegian text, matches expressions from `trusted_expressions_v1` (not raw `expression_catalog`), resolves surface forms via DB RPC, creates `lexeme_processing_jobs` and `lexeme_processing_items`, triggers `job-orchestrator`. NOT a simple Gemini call.
- **`job-orchestrator/`** — Orchestrates processing jobs. After `promote_verification_results_for_job`, fires two independent background tasks via `EdgeRuntime.waitUntil()`: Ordbokene enrichment (`ordbokene-lexeme-pipeline-worker`) and NAOB enrichment (`naob-pipeline-worker`) for newly promoted items.
- **`lexical-worker/`** — Processes individual lexemes through source checks.
- **`semantic-audit-worker/`** — Audits semantic quality and assigns `review_status` (`trusted`/`candidate`/`weak`/`conflicted`). Single source of truth for trust verdicts — no other function should override this.
- **`relation-resolver/`** — Resolves semantic relations between lexemes.
- **`ordbokene-article-fetcher/`** — Fetches and caches Ordbokene article JSON.
- **`ordbokene-expression-extractor/`** — Extracts expression candidates from a cached article.
- **`ordbokene-expression-promotion-worker/`** — Promotes expression candidates to `expression_catalog`, writes `ordbokene_status: 'sub_article'`.
- **`ordbokene-sub-article-relation-worker/`** — Creates `has_expression` relations between a lexeme and its sub-article expressions.
- **`ordbokene-article-ref-relation-worker/`** — Creates `related_candidate` relations from article cross-references.
- **`ordbokene-lexeme-pipeline-worker/`** — Main Ordbokene orchestrator (v4). Calls all the above Ordbokene workers in sequence. Writes `ordbokene_status: 'expr_entry'` for standalone expression articles.
- **`naob-article-fetcher/`** — Fetches and caches NAOB article HTML.
- **`naob-structure-extractor/`** — Parses NAOB HTML, detects expression presence (uttrykk/example), writes `naob_status` to `expression_catalog`. Does NOT compute `expression_review_status` — that is handled by a DB trigger.
- **`naob-expression-batch-worker/`** — Tries candidate NAOB slugs in order, delegates to `naob-structure-extractor`.
- **`naob-pipeline-worker/`** — NAOB entry point. Builds candidate slugs from `expression_lemma` and orchestrates the batch worker.
- **`authoritative-enrichment-pipeline-worker/`** — Orchestrates both Ordbokene and NAOB via `source-runners.ts`. Not yet connected to `job-orchestrator` directly (Ordbokene and NAOB are called individually instead). Contains `evidence-summary.ts` which reports raw evidence facts only — trust verdict is left to `semantic-audit-worker`.
- **`verification/adapters/`** — Source-specific adapters: `naob.ts`, `ordbokene.ts`, `lexin.ts`, `sprakradet.ts`, `wiktionary.ts`, `shared.ts`. Called by `lexical-worker`.

**Deleted legacy functions** (removed via `supabase functions delete`, no longer deployed):
`translate-sentence`, `enrich-word`, `verify-lexeme`, `verify-lexeme-audit`, `enrich-lexeme-data`, `form-enrichment-worker`, `semantic-normalization-worker`, `semantic-relation-worker`, `grammar-family-worker`, `ordbokene-debug`, `ordbokene-expression-dedup-worker`.

Local copies may still exist in `supabase/functions/_archive/` for reference, but they are not deployed and not called by anything.

⚠️ **`api.ts` still references `ENRICH_WORD_URL` (the deleted `enrich-word` function) — `enrichWordViaEdgeFunction` will fail at runtime until this is updated.**

### Voice screen (`app/(tabs)/voice.tsx`)

Currently a stub. Displays a message that speech recognition requires a development build (`npx expo run:android`). The `expo-speech-recognition` package is installed but not yet integrated into a working UI.

### norsk-expressions/

Contains one-time Gemini bulk import scripts (`gemini_bulk.mjs`, `fix.mjs`, `test_gemini.mjs`) and result JSON files (`gemini_expressions.json`, `gemini_expressions_partial.json`). Used historically to seed the expression database. Not part of the running app. Has its own `node_modules`.

### scripts/

- `reset-project.js` — Expo default project reset script.
- `testSupabase.ts` — Manual Supabase connection test.
- `syncSheetsToSupabase.ts`, `syncSheetsToSupabase_v2.ts` — Google Sheets → Supabase sync scripts (historical data import).

### Styling

All styles use React Native `StyleSheet.create()` inline per file. No CSS framework. Primary palette: sky blue `#0EA5E9`, background `#F7F4ED`, white cards `#FFFFFF`. The theme system (`services/theme.ts`) adds 4 named themes (light/dark/reading/turquoise) but Settings is the only screen that uses `useAppTheme()` — most screens hardcode the light palette.

UI language is controlled by `app_language`. The app supports three languages: Ukrainian (`ua`), English (`en`), and Norwegian (`no`). Older screens (index, weak, explore) use binary `isUa` ternaries. Newer screens (settings, reading) use the `i18n.ts` `t(key, lang)` system which handles all three languages.