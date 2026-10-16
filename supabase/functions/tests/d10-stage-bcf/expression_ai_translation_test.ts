// D10 stage C (owner decision 13.10.2026): one AI translation is enough for
// an expression whose whole-unit identity is confirmed by a dictionary.
// Fixture: the real snapshot of "være til" from job 3779546f (12.10.2026),
// before the own-article evidence existed.
// Run: deno test supabase/functions/tests/d10-stage-bcf/
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { evaluateCompletion } from '../../_shared/completion-contract/v1/evaluator.ts';

const BASE = {
  "pos": "expression",
  "forms": [],
  "lemma": "være til",
  "identity": {
    "accepted": false,
    "source_refs": [],
    "paradigm_type": null,
    "is_learning_lexeme": true,
    "verification_status": "authoritative",
    "paradigm_source_refs": [],
    "allowed_missing_slots": [],
    "expression_whole_unit_source_refs": []
  },
  "item_ids": [
    "5a19628b-b8b9-4bbf-befa-df9bf3f374b3"
  ],
  "entity_id": "336c9c5a-e3f8-4c8b-8abf-603c38f379d1",
  "relations": [],
  "entity_key": "expression:336c9c5a-e3f8-4c8b-8abf-603c38f379d1",
  "captured_at": "2026-10-12T21:35:03.261726+00:00",
  "entity_kind": "expression",
  "translations": [
    {
      "id": "37027bc6-f555-4960-b0e0-707ae2aa907a",
      "value": "to exist",
      "locale": "en",
      "provider": "ai_fallback",
      "canonical": false,
      "lexeme_id": null,
      "source_pos": null,
      "source_refs": [
        "ai_fallback:translation:37027bc6-f555-4960-b0e0-707ae2aa907a"
      ],
      "needs_review": false,
      "expression_id": "336c9c5a-e3f8-4c8b-8abf-603c38f379d1",
      "original_value": "to exist",
      "translation_rank": 1,
      "translation_type": "expression_primary",
      "current_article_ids": [],
      "enrichment_evidence": null
    },
    {
      "id": "f7a63230-a1ce-4339-9b2a-6f53130a1e46",
      "value": "to be present",
      "locale": "en",
      "provider": "ai_fallback",
      "canonical": false,
      "lexeme_id": null,
      "source_pos": null,
      "source_refs": [
        "ai_fallback:translation:f7a63230-a1ce-4339-9b2a-6f53130a1e46"
      ],
      "needs_review": false,
      "expression_id": "336c9c5a-e3f8-4c8b-8abf-603c38f379d1",
      "original_value": "to be present",
      "translation_rank": 2,
      "translation_type": "expression_primary",
      "current_article_ids": [],
      "enrichment_evidence": null
    },
    {
      "id": "29393b3f-52f2-4b8d-9d5a-93e860de540e",
      "value": "існувати",
      "locale": "uk",
      "provider": "ai_fallback",
      "canonical": false,
      "lexeme_id": null,
      "source_pos": null,
      "source_refs": [
        "ai_fallback:translation:29393b3f-52f2-4b8d-9d5a-93e860de540e"
      ],
      "needs_review": false,
      "expression_id": "336c9c5a-e3f8-4c8b-8abf-603c38f379d1",
      "original_value": "існувати",
      "translation_rank": 1,
      "translation_type": "expression_primary",
      "current_article_ids": [],
      "enrichment_evidence": null
    },
    {
      "id": "d0a315dd-c66c-4ec4-bf41-decf0adafdfa",
      "value": "бути присутнім",
      "locale": "uk",
      "provider": "ai_fallback",
      "canonical": false,
      "lexeme_id": null,
      "source_pos": null,
      "source_refs": [
        "ai_fallback:translation:d0a315dd-c66c-4ec4-bf41-decf0adafdfa"
      ],
      "needs_review": false,
      "expression_id": "336c9c5a-e3f8-4c8b-8abf-603c38f379d1",
      "original_value": "бути присутнім",
      "translation_rank": 2,
      "translation_type": "expression_primary",
      "current_article_ids": [],
      "enrichment_evidence": null
    }
  ],
  "snapshot_token": "md5:98284ec59fa2ed3c616f2077d1270eff",
  "execution_state": "completed",
  "snapshot_version": "completion-evidence-snapshot/v1"
};

function snapshot(patch: (s: any) => void): any {
  const s = structuredClone(BASE);
  patch(s);
  return s;
}

function stage(s: any, capability: string): string {
  return (evaluateCompletion(s) as any).capabilities[capability].status;
}

Deno.test('expression without own-article evidence stays blocked (unchanged)', () => {
  const s = snapshot(() => {});
  assertEquals(stage(s, 'analysis_ready'), 'blocked');
  assertEquals(stage(s, 'training_ready_uk'), 'blocked');
});

Deno.test('own-article evidence + verified identity: AI translation is enough', () => {
  const s = snapshot((x) => {
    x.identity.accepted = true;
    x.identity.source_refs = ['ordbokene:expression-evidence:test'];
    x.identity.expression_whole_unit_source_refs = ['ordbokene:expression-whole:test'];
  });
  assertEquals(stage(s, 'analysis_ready'), 'ready');
  assertEquals(stage(s, 'dictionary_ready_uk'), 'ready');
  assertEquals(stage(s, 'training_ready_uk'), 'ready');
  assertEquals(stage(s, 'training_ready_en'), 'ready');
});

Deno.test('one AI translation per locale is enough', () => {
  const s = snapshot((x) => {
    x.identity.accepted = true;
    x.identity.source_refs = ['ordbokene:expression-evidence:test'];
    x.identity.expression_whole_unit_source_refs = ['ordbokene:expression-whole:test'];
    const seen = new Set<string>();
    x.translations = x.translations.filter((t: any) => !seen.has(t.locale) && seen.add(t.locale));
  });
  assertEquals(s.translations.length, 2);
  assertEquals(stage(s, 'training_ready_uk'), 'ready');
});

Deno.test('AI translation of a LEXEME still needs the bound AI review (unchanged)', () => {
  const s = snapshot((x) => {
    x.entity_kind = 'lexeme';
    x.identity.accepted = true;
    x.translations = x.translations.map((t: any) => ({ ...t, expression_id: null, lexeme_id: x.entity_id }));
  });
  const uk = stage(s, 'dictionary_ready_uk');
  assertEquals(uk === 'ready', false);
});
