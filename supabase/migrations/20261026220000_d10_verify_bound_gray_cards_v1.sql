-- D10 26.10.2026 (agreed, variant 1: "audit rewrites everything"): a card of
-- the job WITHOUT an accepted verification status (old record, grey path of
-- 17.10.2026 that does not change an existing card: spille verb, vare noun)
-- but WITH an active binding to an Ordbøkene article (bm) of ITS OWN part of
-- speech gets its verification written like the normal verification:
--   verification_status 'authoritative', verification_tier 'dictionary_entry',
--   source_verified (+ 'Ordbokene'), verification_source 'Ordbokene',
--   verification_evidence + key 'Ordbokene_bound_article' (article ids, job),
--   verification_version 5, last_verification_run 'd10-bound-gray-card-v1'.
-- Logged in lexicon_change_log (change_type 'verification').
-- Not touched: cards already verified, cards marked for review
-- (needs_review / manual_review / disputed), cards not active in the
-- dictionary, cards without such a binding, expressions.
-- Called by pipeline-supervisor when the job ends. Never raises: -1 on error.

CREATE OR REPLACE FUNCTION public.d10_verify_bound_gray_cards_v1(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  r record;
  v_ids jsonb;
  v_old jsonb;
  v_new jsonb;
  v_count integer := 0;
  v_run text := 'd10-bound-gray-card-v1';
begin
  for r in
    select distinct l.id, l.lemma, l.pos, l.verification_status, l.verification_tier,
      l.source_verified, l.verification_source, l.verification_version, l.last_verification_run
    from public.lexeme_processing_items i
    join public.lexemes l on l.id = i.lexeme_id
    where i.job_id = p_job_id
      and i.expression_id is null
      and i.status = 'done'
      and l.dictionary_status = 'active'
      and nullif(l.pos, '') is not null and l.pos <> 'unknown'
      and coalesce(l.verification_status, '') not in
        ('accepted', 'approved', 'authoritative', 'multi_source', 'verified', 'usage_verified',
         'source_verified', 'multi_source_verified', 'manual_verified',
         'needs_review', 'manual_review', 'disputed')
  loop
    select jsonb_agg(distinct b.article_id order by b.article_id)
      into v_ids
      from private.authoritative_morphology_article_bindings_v2 b
     where b.lexeme_id = r.id and b.is_active and b.dictionary_code = 'bm' and b.pos = r.pos;
    continue when v_ids is null;

    v_old := jsonb_build_object(
      'verification_status', r.verification_status, 'verification_tier', r.verification_tier,
      'source_verified', r.source_verified, 'verification_source', r.verification_source,
      'verification_version', r.verification_version, 'last_verification_run', r.last_verification_run);

    update public.lexemes l
       set verification_status = 'authoritative',
           verification_tier = 'dictionary_entry',
           source_verified = case
             when coalesce(l.source_verified, '') ~ '(^|\+)Ordbokene(\+|$)' then l.source_verified
             else concat_ws('+', nullif(l.source_verified, ''), 'Ordbokene') end,
           verification_source = 'Ordbokene',
           verification_evidence = coalesce(l.verification_evidence, '{}'::jsonb) || jsonb_build_object(
             'Ordbokene_bound_article', jsonb_build_object(
               'article_ids', v_ids, 'dictionary_code', 'bm', 'pos', r.pos,
               'rule', 'd10_verify_bound_gray_cards_v1', 'job_id', p_job_id, 'verified_at', now())),
           verification_version = 5,
           last_verification_run = v_run,
           updated_at = now()
     where l.id = r.id
     returning jsonb_build_object(
       'verification_status', l.verification_status, 'verification_tier', l.verification_tier,
       'source_verified', l.source_verified, 'verification_source', l.verification_source,
       'verification_version', l.verification_version, 'last_verification_run', l.last_verification_run,
       'bound_article_ids', v_ids)
      into v_new;

    begin
      perform public.log_lexicon_final_change('lexemes', 'lexeme', r.id, r.lemma,
        'text-analysis-' || p_job_id::text, 'verification', 'd10-bound-gray-card',
        v_old, v_new, 5, 1, 'd10-bound-gray-card', p_job_id::text, 'd10-bound-gray-card');
    exception when others then
      raise warning 'd10_verify_bound_gray_cards_v1 log % failed: %', r.id, sqlerrm;
    end;
    v_count := v_count + 1;
  end loop;
  return v_count;
exception when others then
  raise warning 'd10_verify_bound_gray_cards_v1 % failed: %', p_job_id, sqlerrm;
  return -1;
end;
$function$;

REVOKE ALL ON FUNCTION public.d10_verify_bound_gray_cards_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_verify_bound_gray_cards_v1(uuid) TO service_role;
