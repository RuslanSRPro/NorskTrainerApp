# Project Status — 2026-06-22

## What's complete and working

### Core app loop
- Adaptive SRS training engine — fully implemented in `services/api.ts` (`calculateSrsUpdate`, `calculateAdaptiveIntervalDays`, `calculateMemoryScores`, `calculateMemoryStatus`, `calculateAdaptiveNextDueAt`). Runs client-side on every review.
- Training screen (`explore.tsx`) — all 5 modes (flashcards, choice, typing, cloze, forms) working. Two training flows (reinforcement / one_per_word). Sentence-first layout option. Mix-modes interleaving. Smart distractor selection for choice mode.
- Dashboard (`index.tsx`) — stats loading (total, learned, weak, due, reviews today, accuracy today), progress bar, action cards.
- Weak Words screen (`weak.tsx`) — loads weak set, shows memory heatmap with scores, reason, metrics grid.
- Settings screen (`settings.tsx`) — full settings UI with theme/font-size switcher, account section (Auth UUID), sign-out. Uses `useAppTheme()` for dynamic theming.
- Supabase Auth — OTP email sign-in via `authStore.ts`. User identity is now a real Supabase Auth UUID.
- Norwegian TTS — `speech.ts` with voice detection (`nb` → `no` → `nor`) and form sequence playback.
- Verification system — `services/verification.ts` resolves 6 tiers from evidence; `VerificationBadge` component shown in Training and Reading. Client-side tier logic is now fully reconciled with `semantic-audit-worker` (branch order, quality strings, source checks match exactly).
- Lexeme360 — semantic relation viewer component available in Training and Reading.
- i18n for 3 languages (UA/EN/NO) — `services/i18n.ts`, used in Settings, Reading, Training (UI_TEXT record).
- Theme system — 4 themes, 3 font sizes, `useAppTheme()` hook.

### Backend pipeline (edge functions)
- **Ordbokene pipeline** — article fetch → expression extraction → promotion → relation workers → fully connected to `job-orchestrator` via background `EdgeRuntime.waitUntil()` task after each `promote_verification_results_for_job`. `ordbokene-expression-promotion-worker` writes `ordbokene_status: 'sub_article'`; `promoteStandaloneExpression()` writes `ordbokene_status: 'expr_entry'`.
- **NAOB pipeline** — article fetch → structure extractor → expression batch → pipeline worker → also connected to `job-orchestrator` as a separate, independent background task (expression-only; NAOB has no lexeme mode).
- **`expression_review_status`** — recomputed automatically by a DB trigger (`trg_expression_catalog_recompute_review_status`) whenever `ordbokene_status` or `naob_status` changes. Rule: `verified` ⇔ `ordbokene_status = 'expr_entry'` OR `naob_status = 'uttrykk'`; `unverified` ⇔ both `not_listed` or `article_ref + not_listed`; otherwise `partial`.
- Authoritative enrichment pipeline worker — orchestrates both sources, produces evidence summary. Not yet connected to `job-orchestrator` directly (Ordbokene and NAOB are called individually instead).
- Lexical worker — processes source checks per lexeme.
- Semantic audit worker — single source of truth for trust verdicts (`trusted`/`candidate`/`weak`/`conflicted`). No other function overrides this.
- Job orchestrator — drives async processing jobs + fires background enrichment tasks.
- Relation resolver — resolves cross-lexeme semantic relations.
- analyze-text v7 — full NLP pipeline. Loads expression dictionary from `trusted_expressions_v1` (only expressions with `review_status='trusted'` from `semantic-audit-worker`), resolves surface forms, creates processing jobs, triggers `job-orchestrator`.
- Source adapters for all 5 sources: NAOB, Ordbokene, Lexin, Språkrådet, Wiktionary.
- Verification versioning — `verification_version`/`source_checked_at` columns on `expression_catalog`/`lexemes`; `verification_history` table with full before/after row snapshots; `record_verification_change()` RPC for atomic versioned updates.

## In progress / partially implemented

### Voice screen (stub)
- File: `app/(tabs)/voice.tsx`
- The entire screen is a placeholder that says "speech recognition needs a dev build." `expo-speech-recognition` (v3.1.3) is installed in `package.json` but not wired to any UI.
- What was planned: Start/Stop buttons, live transcript, translation, forwarding to Reading analyzer.
- Blocked by: needs `npx expo run:android` (development build), not Expo Go.

### Reading screen — analyze-text response mismatch (potential bug)
- File: `app/(tabs)/reading.tsx`
- Both `runPwaTextAnalysis()` and `runAiTextAnalysis()` call `analyzeTextViaAppsScript(text)` which routes to the `analyze-text` edge function.
- The current v7 `analyze-text` function returns a **job-based response** with `{ ok, job, ingestion, orchestrator }`. However, the reading screen expects the old format: `{ ok, known:[], missing:[], expressions:[] }`.
- The functions `rebuildAnalysisFromEdgeResult` and `buildAnalyzerCandidates` consume `result.known`, `result.missing`, `result.expressions` — fields that the v7 response does not return directly (it returns `job` and `ingestion.planned_items`).
- This means the AI/PWA text analysis will show empty results or fail silently after the pipeline was upgraded to v7. The `runPwaTextAnalysis` label says "PWA" but actually calls the same AI endpoint.

### enrich-word function is deleted
- ⚠️ `enrich-word` was deleted from Supabase via `supabase functions delete enrich-word` — it is no longer deployed.
- `services/api.ts` still references `ENRICH_WORD_URL` and calls it in `enrichWordViaEdgeFunction()`. This call will fail at runtime until `api.ts` is updated.
- Decision needed: either remove `enrichWordViaEdgeFunction` from `api.ts` entirely, or replace the deleted function with a new implementation.

### Theme system not applied app-wide
- `services/theme.ts` and `useAppTheme()` are used only in `settings.tsx`.
- All other screens (`index.tsx`, `explore.tsx`, `reading.tsx`, `weak.tsx`) hardcode the light palette (`#F7F4ED`, `#0EA5E9`, etc.). Switching to dark/reading/turquoise theme has no effect on these screens.

### Norwegian UI language incomplete in older screens
- `app_language` supports `'ua' | 'en' | 'no'` (3 options, including Norwegian).
- Settings screen and Reading screen handle `no` correctly via `i18n.ts`.
- `index.tsx` and `weak.tsx` use binary `isUa` checks — Norwegian gets English text.
- `explore.tsx` has a `UI_TEXT` object with `no` entries and handles it correctly.

## Known issues and technical debt

### analyze-text v7 API contract broken with Reading screen
See "In progress" section above. The most critical functional issue.
- `reading.tsx` lines ~1036-1110: `result.known`, `result.missing`, `result.expressions` are consumed but v7 returns `{ job, ingestion }` instead.

### enrichWordViaEdgeFunction calls a deleted function
- `services/api.ts`: `ENRICH_WORD_URL` points to the deleted `enrich-word` edge function. Every call to `enrichWordViaEdgeFunction()` will fail.

### Hardcoded Supabase project URLs in api.ts
- `services/api.ts` lines 8-18: `APPS_SCRIPT_URL` (unused), `ENRICH_WORD_URL`, `ANALYZE_TEXT_URL` are hardcoded strings, not read from env vars. `ANALYZE_TEXT_URL` is declared but never used (the function calls use `supabase.functions.invoke` instead for analyze-text).
- `APPS_SCRIPT_URL` on line 8-9 points to a Google Apps Script URL. This is completely unused dead code.

### Two user identity systems coexist
- `store/authStore.ts` — Supabase Auth UUID (correct current system). `getCurrentUserId()` exported from here.
- `services/settings.ts` — Has its own `getOrCreateUser()` that creates `u_xxx` random IDs and stores in AsyncStorage. This is legacy and appears unused by current flow.
- `store/settingsStore.ts` line 114: comment says "Використовуємо Auth UUID — не старий u_xxx" confirming the migration is intentional but the old code in `settings.ts` was left in place.

### settings.ts getCurrentUserId is a different function
- `services/settings.ts` exports `getCurrentUserId()` (reads AsyncStorage, returns `u_xxx` or `'user1'`).
- `store/authStore.ts` also exports `getCurrentUserId()` (returns Supabase Auth UUID or `'anonymous'`).
- `services/api.ts` imports from `@/store/authStore` (correct). The `settings.ts` version is effectively orphaned.

### form slots in reading.tsx differ from docs/api.ts
- `api.ts` maps: verb `f1`=presens. But `reading.tsx` line 443-448 fallback interprets: `f1`=infinitiv, `f2`=presens, `f3`=preteritum, `f4`=perfektum for verbs.
- This fallback is only reached when `verb_forms` join is absent. In practice `verb_forms` is always joined, so this discrepancy is dormant.

### cloze mode regex fragility
- `explore.tsx` line 763: `example.replace(new RegExp(cleanWord, 'i'), '____')` — uses the word directly as a regex pattern. Words containing regex special characters (e.g. parentheses, dots, plus signs) could cause errors. Low risk given the word set but not robust.

### Speech debug console.log in production
- `services/speech.ts` lines 152-159, 190-197: `console.log('Speaking Norwegian:', ...)` fires on every TTS call. Should be removed or gated behind a debug flag before production.

### reading.tsx is very long
- `app/(tabs)/reading.tsx` is 2579 lines. Has complex modal management, two analysis pipelines, and candidate batch-add logic all in one file. Refactoring candidate.

## Next logical steps

1. **Fix analyze-text response contract** — either update `reading.tsx` to handle the v7 job-based response (`result.job`, `result.ingestion.planned_items`) or add a compatibility shim to the edge function that returns the legacy `{ known, missing, expressions }` format alongside the job data.

2. **Fix enrichWordViaEdgeFunction** — `enrich-word` is deleted. Either remove `enrichWordViaEdgeFunction` from `api.ts` entirely (and `addLexemeToGlobalBaseFromSupabase` if it depends on it), or build a replacement edge function.

3. **Implement Voice screen** — requires `expo run:android` build. Wire up `expo-speech-recognition`, add Start/Stop buttons, live transcript display, and a "Send to Reading" button.

4. **Apply theme system to all screens** — replace hardcoded palette in `index.tsx`, `explore.tsx`, `reading.tsx`, `weak.tsx` with `useAppTheme()` values.

5. **Complete Norwegian UI** — fix `index.tsx` and `weak.tsx` to handle `app_language === 'no'` correctly using the i18n system instead of binary `isUa` checks.

6. **Clean up dead code** — remove unused `APPS_SCRIPT_URL` constant, remove `ANALYZE_TEXT_URL` constant (unused), consolidate the two `getCurrentUserId` functions (keep only the auth store version).

7. **Practical verification of B-pipeline** — run `analyze-text` on a text containing known expressions, check Supabase logs for `enqueueOrdbokeneEnrichment` and `enqueueNaobEnrichment` background task execution, verify new entries appear in `expression_catalog` within an hour.