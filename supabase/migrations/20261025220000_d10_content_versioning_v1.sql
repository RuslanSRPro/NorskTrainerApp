-- D10 25.10.2026 (agreed): content versioning.
--
-- The existing final versioning (change_type 'final_version', job-orchestrator)
-- compares only the lexemes / expression_catalog row, and its "after" is taken
-- before enrichment. Translations, forms and examples live in other tables and
-- were never versioned. This adds them to the same journal:
--
--   1. d10_entity_content_v1(table, id): the card content as one small jsonb
--      (card fields, translations uk/en, Bokmaal forms, NAOB forms, examples).
--   2. d10_capture_job_content_before_v1(job): "before", called by
--      job-orchestrator at the start of the job and again before its final
--      versioning (the first capture of an entity wins).
--   3. d10_log_job_content_changes_v1(job): "after", called by
--      pipeline-supervisor when the job reaches completed / needs_manual_review.
--      Only the changed parts are written, through the existing
--      public.log_lexicon_final_change, change_type 'content_version'.
--      Re-running it for the same job replaces its own rows (same run_id).
--
-- Nothing existing is changed or removed. A failure never breaks a job: both
-- functions catch their errors and return -1.

CREATE TABLE IF NOT EXISTS private.d10_job_content_before_v1 (
  job_id uuid NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  lemma text,
  content jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, entity_table, entity_id)
);
CREATE INDEX IF NOT EXISTS d10_job_content_before_v1_captured_idx
  ON private.d10_job_content_before_v1 (captured_at);
REVOKE ALL ON TABLE private.d10_job_content_before_v1 FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.d10_entity_content_v1(p_entity_table text, p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_is_lexeme boolean := p_entity_table = 'lexemes';
  v_card jsonb;
  v_translations jsonb;
  v_forms jsonb;
  v_naob jsonb;
  v_examples jsonb;
begin
  if v_is_lexeme then
    select jsonb_strip_nulls(jsonb_build_object(
             'translation_ua', l.translation_ua,
             'translation_en', l.translation_en,
             'example', l.example))
      into v_card
      from public.lexemes l where l.id = p_entity_id;
  elsif p_entity_table = 'expression_catalog' then
    v_card := '{}'::jsonb;
  else
    return '{}'::jsonb;
  end if;

  select jsonb_object_agg(t.language_code, t.items)
    into v_translations
    from (
      select et.language_code,
             jsonb_agg(
               coalesce(nullif(et.canonical_translation, ''), et.translation, '')
                 || coalesce(' [' || et.source || ']', '')
               order by et.translation_rank nulls last, et.sense_rank nulls last, et.id
             ) as items
        from public.entity_translations et
       where et.language_code in ('uk', 'en')
         and case when v_is_lexeme then et.lexeme_id = p_entity_id
                  else et.expression_id = p_entity_id end
       group by et.language_code
    ) t;

  if v_is_lexeme then
    select jsonb_object_agg(f.form_key, f.vals)
      into v_forms
      from (
        select d.form_key,
               string_agg(distinct array_to_string(d.primary_values, '/')
                 || case when cardinality(d.alternative_values) > 0
                         then ' (' || array_to_string(d.alternative_values, '/') || ')' else '' end,
                 ' | ') as vals
          from public.lexeme_form_display_v2 d
         where d.lexeme_id = p_entity_id and d.dictionary_code = 'bm'
         group by d.form_key
      ) f;

    if to_regclass('public.lexeme_naob_forms_v1') is not null then
      execute $q$
        select jsonb_object_agg(n.form_key,
                 array_to_string(n.primary_values, '/')
                 || case when cardinality(n.alternative_values) > 0
                         then ' (' || array_to_string(n.alternative_values, '/') || ')' else '' end)
          from public.lexeme_naob_forms_v1 n
         where n.lexeme_id = $1
      $q$ into v_naob using p_entity_id;
    end if;
  end if;

  select jsonb_agg(x.e order by x.ord)
    into v_examples
    from (
      select ee.example_text || coalesce(' — ' || nullif(ee.translation_uk, ''), '') as e,
             row_number() over (order by ee.created_at, ee.id) as ord
        from public.entity_examples ee
       where case when v_is_lexeme then ee.lexeme_id = p_entity_id
                  else ee.expression_id = p_entity_id end
       order by ee.created_at, ee.id
       limit 5
    ) x;

  return jsonb_strip_nulls(jsonb_build_object(
    'card', nullif(v_card, '{}'::jsonb),
    'translations', v_translations,
    'forms', v_forms,
    'naob_forms', v_naob,
    'examples', v_examples));
end;
$function$;

CREATE OR REPLACE FUNCTION public.d10_capture_job_content_before_v1(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_count integer := 0;
begin
  insert into private.d10_job_content_before_v1 (job_id, entity_table, entity_id, lemma, content)
  select p_job_id, e.entity_table, e.entity_id, e.lemma,
         public.d10_entity_content_v1(e.entity_table, e.entity_id)
    from (
      select distinct 'lexemes'::text as entity_table, i.lexeme_id as entity_id, l.lemma
        from public.lexeme_processing_items i
        join public.lexemes l on l.id = i.lexeme_id
       where i.job_id = p_job_id and i.lexeme_id is not null
      union
      select distinct 'expression_catalog', i.expression_id, x.lemma
        from public.lexeme_processing_items i
        join public.expression_catalog x on x.id = i.expression_id
       where i.job_id = p_job_id and i.expression_id is not null
    ) e
  on conflict (job_id, entity_table, entity_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
exception when others then
  raise warning 'd10_capture_job_content_before_v1 % failed: %', p_job_id, sqlerrm;
  return -1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d10_log_job_content_changes_v1(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_run_id text;
  v_logged integer := 0;
  r record;
  v_old jsonb;
  v_new jsonb;
  v_old_d jsonb;
  v_new_d jsonb;
  v_key text;
begin
  -- jobs started before this migration have no "before": nothing to compare
  if not exists (select 1 from private.d10_job_content_before_v1 b where b.job_id = p_job_id) then
    return 0;
  end if;

  select coalesce(j.summary->>'run_id', 'text-analysis-' || j.id::text)
    into v_run_id
    from public.lexeme_processing_jobs j where j.id = p_job_id;
  v_run_id := coalesce(v_run_id, 'text-analysis-' || p_job_id::text);

  for r in
    select e.entity_table, e.entity_id, max(e.lemma) as lemma
      from (
        select 'lexemes'::text as entity_table, i.lexeme_id as entity_id, l.lemma
          from public.lexeme_processing_items i
          join public.lexemes l on l.id = i.lexeme_id
         where i.job_id = p_job_id and i.lexeme_id is not null
        union all
        select 'expression_catalog', i.expression_id, x.lemma
          from public.lexeme_processing_items i
          join public.expression_catalog x on x.id = i.expression_id
         where i.job_id = p_job_id and i.expression_id is not null
        union all
        select b.entity_table, b.entity_id, b.lemma
          from private.d10_job_content_before_v1 b
         where b.job_id = p_job_id
      ) e
     group by e.entity_table, e.entity_id
  loop
    begin
      select b.content into v_old
        from private.d10_job_content_before_v1 b
       where b.job_id = p_job_id and b.entity_table = r.entity_table and b.entity_id = r.entity_id;
      v_old := coalesce(v_old, '{}'::jsonb);
      v_new := public.d10_entity_content_v1(r.entity_table, r.entity_id);

      -- only the parts that changed
      v_old_d := '{}'::jsonb;
      v_new_d := '{}'::jsonb;
      for v_key in
        select k from jsonb_object_keys(v_old) k
        union
        select k from jsonb_object_keys(v_new) k
      loop
        if (v_old -> v_key) is distinct from (v_new -> v_key) then
          v_old_d := v_old_d || jsonb_build_object(v_key, coalesce(v_old -> v_key, 'null'::jsonb));
          v_new_d := v_new_d || jsonb_build_object(v_key, coalesce(v_new -> v_key, 'null'::jsonb));
        end if;
      end loop;

      if v_new_d <> '{}'::jsonb then
        perform public.log_lexicon_final_change(
          r.entity_table,
          case when r.entity_table = 'lexemes' then 'lexeme' else 'expression' end,
          r.entity_id,
          r.lemma,
          v_run_id,
          'content_version',
          'final-versioning',
          v_old_d,
          v_new_d,
          5,
          1,
          'final-versioning',
          p_job_id::text,
          'final-versioning');
        v_logged := v_logged + 1;
      end if;
    exception when others then
      raise warning 'd10_log_job_content_changes_v1 % %/% failed: %',
        p_job_id, r.entity_table, r.entity_id, sqlerrm;
    end;
  end loop;

  -- the "before" of old jobs is no longer needed
  delete from private.d10_job_content_before_v1 where captured_at < now() - interval '14 days';

  return v_logged;
exception when others then
  raise warning 'd10_log_job_content_changes_v1 % failed: %', p_job_id, sqlerrm;
  return -1;
end;
$function$;

REVOKE ALL ON FUNCTION public.d10_entity_content_v1(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_capture_job_content_before_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_log_job_content_changes_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_entity_content_v1(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_capture_job_content_before_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_log_job_content_changes_v1(uuid) TO service_role;
