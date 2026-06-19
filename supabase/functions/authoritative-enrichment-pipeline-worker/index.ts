import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { EnrichmentInput } from './types.ts';
import { runNaobPipeline, runOrdbokenePipeline } from './source-runners.ts';
import { buildUnifiedEvidenceSummary } from './evidence-summary.ts';

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const input = await req.json() as EnrichmentInput;

    validateInput(input);

    const itemId =
      input.item_type === 'expression'
        ? input.expression_id ?? input.lemma!
        : input.lexeme_id ?? input.lemma!;

    const ordbokene = await runOrdbokenePipeline(input);
    const naob = await runNaobPipeline(input);

    const evidence = buildUnifiedEvidenceSummary({
      item_type: input.item_type,
      item_id: itemId,
      ordbokene,
      naob,
    });

    return json({
      ok: true,
      worker: 'authoritative-enrichment-pipeline-worker',
      version: 'v1',
      input: {
        item_type: input.item_type,
        lemma: input.lemma ?? null,
        expression_id: input.expression_id ?? null,
        lexeme_id: input.lexeme_id ?? null,
        source_lemma: input.source_lemma ?? null,
        candidate_slugs: input.candidate_slugs ?? null,
        force_refresh: input.force_refresh ?? false,
        update_catalog: input.update_catalog ?? true,
      },
      evidence,
    });
  } catch (error) {
    return json({
      ok: false,
      worker: 'authoritative-enrichment-pipeline-worker',
      version: 'v1',
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

function validateInput(input: EnrichmentInput) {
  if (!input.item_type) {
    throw new Error('item_type is required');
  }

  if (!['expression', 'lexeme'].includes(input.item_type)) {
    throw new Error('item_type must be expression or lexeme');
  }

  const lemma = normalizeText(input.lemma);

  if (input.item_type === 'expression') {
    const hasExpressionId =
      typeof input.expression_id === 'string' &&
      input.expression_id.trim().length > 0;

    if (!hasExpressionId && !lemma) {
      throw new Error(
        'expression input requires either expression_id or lemma',
      );
    }

    if (lemma && !normalizeText(input.source_lemma)) {
      throw new Error(
        'expression input with lemma requires source_lemma for NAOB lookup',
      );
    }
  }

  if (input.item_type === 'lexeme') {
    const hasLexemeId =
      typeof input.lexeme_id === 'string' &&
      input.lexeme_id.trim().length > 0;

    if (!hasLexemeId && !lemma) {
      throw new Error(
        'lexeme input requires either lexeme_id or lemma',
      );
    }
  }
}

function normalizeText(value?: string): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ');

  return normalized.length > 0 ? normalized : undefined;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}