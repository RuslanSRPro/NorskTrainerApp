// D10 stage A (plan D10_homonym_pos_plan_v1): pure rules only, no network.
// Run: deno test supabase/functions/tests/d10-stage-a/
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { selectBoundHomonymArticles } from '../../verification/adapters/ordbokene.ts';
import { supervisorStillRunning } from '../../_shared/job-status-policy.ts';

// A1 ------------------------------------------------------------------------
Deno.test('A1 single candidate: unchanged', () => {
  assertEquals(selectBoundHomonymArticles(['60578'], ['60578']),
    { articleIds: ['60578'], articleSelection: 'single_article' });
  assertEquals(selectBoundHomonymArticles(['60578'], null),
    { articleIds: ['60578'], articleSelection: 'single_article' });
});

Deno.test('A1 være: exactly one bound candidate is selected (previous rule)', () => {
  assertEquals(selectBoundHomonymArticles(['69211', '69212'], ['69211']),
    { articleIds: ['69211'], articleSelection: 'bound_lexeme_article' });
});

Deno.test('A1 huske: every candidate bound to the lexeme -> the bound set', () => {
  assertEquals(selectBoundHomonymArticles(['24686', '24687'], ['24686', '24687']),
    { articleIds: ['24686', '24687'], articleSelection: 'bound_lexeme_article_set' });
  // numbers from lexeme_form_display_v2 compare as strings
  assertEquals(selectBoundHomonymArticles(['24686', '24687'], [24687, 24686]),
    { articleIds: ['24686', '24687'], articleSelection: 'bound_lexeme_article_set' });
});

Deno.test('A1 only the bound part of the candidates is kept', () => {
  assertEquals(selectBoundHomonymArticles(['47367', '47368', '47369'], ['47367', '47369']),
    { articleIds: ['47367', '47369'], articleSelection: 'bound_lexeme_article_set' });
});

Deno.test('A1 no bound candidate or no binding: still ambiguous, unchanged', () => {
  assertEquals(selectBoundHomonymArticles(['24686', '24687'], ['99999']),
    { articleIds: ['24686', '24687'], articleSelection: 'single_article' });
  assertEquals(selectBoundHomonymArticles(['24686', '24687'], []),
    { articleIds: ['24686', '24687'], articleSelection: 'single_article' });
  assertEquals(selectBoundHomonymArticles(['24686', '24687'], null),
    { articleIds: ['24686', '24687'], articleSelection: 'single_article' });
});

// A2 ------------------------------------------------------------------------
Deno.test('A2 orchestrator done + supervisor still working -> processing', () => {
  for (const stage of ['orchestrator', 'enrichment', 'audit']) {
    assertEquals(supervisorStillRunning('done', 'completed', stage), true, stage);
  }
});

Deno.test('A2 supervisor finished -> previous logic', () => {
  assertEquals(supervisorStillRunning('done', 'completed', 'done'), false);
  assertEquals(supervisorStillRunning('done', 'completed', 'needs_manual_review'), false);
});

Deno.test('A2 no supervisor row or unreadable -> previous logic', () => {
  assertEquals(supervisorStillRunning('done', 'completed', null), false);
  assertEquals(supervisorStillRunning('done', 'completed', ''), false);
});

Deno.test('A2 supervisor final statuses and other states are never overridden', () => {
  assertEquals(supervisorStillRunning('completed', 'completed', 'enrichment'), false);
  assertEquals(supervisorStillRunning('needs_manual_review', 'needs_manual_review', 'enrichment'), false);
  assertEquals(supervisorStillRunning('failed', 'failed', 'enrichment'), false);
  assertEquals(supervisorStillRunning('processing', 'running', 'enrichment'), false);
});
