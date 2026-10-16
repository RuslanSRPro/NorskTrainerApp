import { resolveExpressionArticleIdentity } from '../verification/adapters/expression-article.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processSourceCheck } from './process-source-check.ts';
import type { SourceCheck } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env variables');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));

    const limit =
      typeof body.limit === 'number' && body.limit > 0
        ? body.limit
        : 5;

    const jobId =
      typeof body.job_id === 'string' && body.job_id.trim().length > 0
        ? body.job_id.trim()
        : null;

    const claimResult = await supabase.rpc(
      'claim_next_source_checks',
      {
        p_limit: limit,
        p_job_id: jobId,
      },
    );

    if (!claimResult) {
      throw new Error('claim_next_source_checks returned undefined');
    }

    if (claimResult.error) {
      throw claimResult.error;
    }

    const checks = claimResult.data;

    const results = [];

    for (const check of (checks ?? []) as SourceCheck[]) {
      try {
        if (check.source === 'Ordbokene' && check.query_type === 'token') {
          const { data: item, error: itemError } = await supabase
            .from('lexeme_processing_items')
            .select('pos')
            .eq('id', check.item_id)
            .single();
          if (itemError) throw itemError;
          check.pos = item.pos;
          // Homonym articles (several Bokmål articles with this POS): the
          // resolved lexeme may already be bound to exactly one of them by
          // its authoritative forms projection. Pass that identity so the
          // Ordbøkene check can select it. No binding -> unchanged behaviour.
          check.bound_token_article_ids = null;
          if (check.lexeme_id && item.pos) {
            const { data: bindings, error: bindingError } = await supabase
              .from('lexeme_form_display_v2')
              .select('article_ids')
              .eq('lexeme_id', check.lexeme_id)
              .eq('dictionary_code', 'bm')
              .eq('pos', item.pos);
            if (bindingError) throw bindingError;
            const bound = new Set<string>();
            for (const row of bindings ?? []) {
              for (const id of (row as { article_ids: unknown[] | null }).article_ids ?? []) {
                if (id !== null && id !== undefined) bound.add(String(id));
              }
            }
            // D10 15.10.2026 (R9): plus the card's article bindings, so a new
            // second card (no forms yet) is checked against its own article.
            const { data: cardArticles, error: cardArticlesError } = await supabase
              .rpc('d10_lexeme_article_ids_v1', { p_lexeme_id: check.lexeme_id });
            if (cardArticlesError) throw cardArticlesError;
            for (const id of (cardArticles as unknown[] | null) ?? []) {
              if (id !== null && id !== undefined) bound.add(String(id));
            }
            check.bound_token_article_ids = bound.size ? [...bound] : null;
          }
          // D10 15.10.2026: cache level for an Ordbøkene outage. Without a
          // bound article, remember the article numbers of the last
          // successful exact search of this word (read only, no live call).
          check.cached_search_article_ids = null;
          check.cached_search_checked_at = null;
          if (!check.bound_token_article_ids?.length && item.pos) {
            const { data: cached, error: cachedError } = await supabase
              .rpc('d10_last_ordbokene_search_v1', { p_query: check.query, p_pos: item.pos });
            if (cachedError) throw cachedError;
            const row = Array.isArray(cached) ? cached[0] : null;
            if (row && Array.isArray(row.article_ids) && row.article_ids.length) {
              check.cached_search_article_ids = row.article_ids.map(String);
              check.cached_search_checked_at = row.checked_at ?? null;
            }
          }
        }
        // D10 15.10.2026 (step B): the other sources also get the card POS,
        // so their answer records whether it shows that part of speech.
        if (check.source !== 'Ordbokene' && check.query_type === 'token') {
          const { data: item, error: itemError } = await supabase
            .from('lexeme_processing_items')
            .select('pos')
            .eq('id', check.item_id)
            .single();
          if (itemError) throw itemError;
          check.pos = item?.pos ?? null;
        }
        if (check.source === 'Ordbokene' && check.query_type === 'expression') {
          const { data: item, error: itemError } = await supabase
            .from('lexeme_processing_items').select('expression_id')
            .eq('id', check.item_id).single();
          if (itemError) throw itemError;
          if (!item?.expression_id) throw new Error('Expression check without its own expression_id');
          check.expression_id = item.expression_id;
          const { data: expression, error: expressionError } = await supabase
            .from('expression_catalog').select('lemma, normalized_key')
            .eq('id', check.expression_id).single();
          if (expressionError) throw expressionError;
          const { data: candidates, error: candidatesError } = await supabase
            .from('ordbokene_expression_candidates')
            .select('candidate_article_id,parent_article_id,normalized_key')
            .eq('promoted_expression_id', check.expression_id)
            .ilike('candidate_dictionary_code', 'bm')
            .ilike('parent_dictionary_code', 'bm')
            .eq('candidate_kind', 'expression')
            .in('status', ['promoted', 'duplicate']);
          if (candidatesError) throw candidatesError;
          const normalize = (s: string) => s.normalize('NFC').toLocaleLowerCase('nb-NO').trim().replace(/\s+/g, ' ');
          check.expected_expression_article = normalize(expression.lemma) === normalize(check.query)
            ? resolveExpressionArticleIdentity(candidates ?? [], expression.normalized_key)
            : null;
        }
        await processSourceCheck(supabase, check);

        results.push({
          id: check.id,
          job_id: check.job_id,
          item_id: check.item_id,
          source: check.source,
          query: check.query,
          ok: true,
        });
      } catch (err) {
        results.push({
          id: check.id,
          job_id: check.job_id,
          item_id: check.item_id,
          source: check.source,
          query: check.query,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        job_id: jobId,
        claimed: checks?.length ?? 0,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
