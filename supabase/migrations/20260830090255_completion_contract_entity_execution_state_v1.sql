-- D09-C4 / Package 2
-- Fail-closed execution-state correction for completion-contract/v1 snapshots.
-- Replaces only the read-only RPC body; creates no learner-facing state and performs no writes.

create or replace function public.get_completion_evidence_snapshot_v1(
  p_job_id uuid,
  p_cursor text default null,
  p_limit integer default 20,
  p_expected_snapshot_token text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_job public.lexeme_processing_jobs%rowtype;
  v_supervisor public.pipeline_supervisor_state%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_snapshot_token text;
  v_captured_at timestamptz;
  v_execution_state text;
  v_entities jsonb;
  v_unresolved jsonb;
  v_total_entities integer;
  v_total_items integer;
  v_unresolved_count integer;
  v_has_more boolean;
  v_next_cursor text;
begin
  if p_job_id is null then
    raise exception using errcode = '22023', message = 'JOB_ID_REQUIRED';
  end if;

  select j.*
  into v_job
  from public.lexeme_processing_jobs as j
  where j.id = p_job_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND';
  end if;

  select s.*
  into v_supervisor
  from public.pipeline_supervisor_state as s
  where s.job_id = p_job_id;

  if v_job.status not in ('completed', 'done', 'partial', 'failed', 'needs_manual_review')
     and coalesce(v_supervisor.stage, '') not in ('done', 'needs_manual_review') then
    raise exception using errcode = '55000', message = 'TERMINAL_JOB_REQUIRED';
  end if;

  -- A terminal job is not complete merely because its job/supervisor row says so.
  -- Fail closed when any scoped item has not reached the canonical done state.
  v_execution_state := case
    when v_job.status = 'failed' then 'failed'
    when v_job.status in ('partial', 'needs_manual_review')
      or coalesce(v_supervisor.stage, '') = 'needs_manual_review'
      then 'needs_manual_review'
    when exists (
      select 1
      from public.lexeme_processing_items as state_item
      where state_item.job_id = p_job_id
        and state_item.status = 'failed'
    ) then 'failed'
    when exists (
      select 1
      from public.lexeme_processing_items as state_item
      where state_item.job_id = p_job_id
        and state_item.status is distinct from 'done'
    ) then 'needs_manual_review'
    else 'completed'
  end;

  -- Hash every scoped source row, rather than trusting counters or updated_at alone.
  -- jsonb::text has stable key ordering; the row prefix prevents cross-table collisions.
  with scoped_items as (
    select i.*
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id
  ),
  scoped_lexemes as (
    select distinct i.lexeme_id as id
    from scoped_items as i
    where i.lexeme_id is not null
  ),
  scoped_expressions as (
    select distinct i.expression_id as id
    from scoped_items as i
    where i.expression_id is not null
  ),
  scoped_relations as (
    select r.*
    from public.authoritative_semantic_relations as r
    join scoped_lexemes as sl
      on r.source_entity_type = 'lexeme'
     and r.source_entity_id = sl.id
    where r.target_entity_type = 'expression'
      and r.target_entity_id is not null
  ),
  related_expressions as (
    select id from scoped_expressions
    union
    select distinct r.target_entity_id from scoped_relations as r
  ),
  fingerprint_rows as (
    select 'job:' || to_jsonb(j)::text as value, j.updated_at as changed_at
    from public.lexeme_processing_jobs as j where j.id = p_job_id
    union all
    select 'supervisor:' || to_jsonb(s)::text, s.updated_at
    from public.pipeline_supervisor_state as s where s.job_id = p_job_id
    union all
    select 'item:' || to_jsonb(i)::text, i.updated_at from scoped_items as i
    union all
    select 'lexeme:' || to_jsonb(l)::text, l.updated_at
    from public.lexemes as l join scoped_lexemes as sl on sl.id = l.id
    union all
    select 'expression:' || to_jsonb(e)::text, e.updated_at
    from public.expression_catalog as e join related_expressions as re on re.id = e.id
    union all
    select 'form:' || to_jsonb(f)::text, f.updated_at
    from public.lexeme_form_variants as f join scoped_lexemes as sl on sl.id = f.lexeme_id
    union all
    select 'translation:' || to_jsonb(t)::text, t.updated_at
    from public.entity_translations as t
    where t.lexeme_id in (select id from scoped_lexemes)
       or t.expression_id in (select id from related_expressions)
    union all
    select 'expression-evidence:' || to_jsonb(e)::text, e.updated_at
    from public.expression_source_evidence as e
    where e.expression_id in (select id from related_expressions)
    union all
    select 'relation:' || to_jsonb(r)::text, r.updated_at from scoped_relations as r
  )
  select
    'md5:' || md5(coalesce(string_agg(fr.value, E'\n' order by fr.value), 'empty')),
    greatest(v_job.updated_at, max(fr.changed_at))
  into v_snapshot_token, v_captured_at
  from fingerprint_rows as fr;

  if p_expected_snapshot_token is not null
     and p_expected_snapshot_token <> v_snapshot_token then
    raise exception using errcode = '40001', message = 'SNAPSHOT_CHANGED';
  end if;

  select
    count(*),
    count(*) filter (where i.lexeme_id is null and i.expression_id is null)
  into v_total_items, v_unresolved_count
  from public.lexeme_processing_items as i
  where i.job_id = p_job_id;

  with entity_index as (
    select
      'lexeme:' || i.lexeme_id::text as entity_key,
      'lexeme'::text as entity_kind,
      i.lexeme_id as entity_id,
      array_agg(i.id order by i.id) as item_ids
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id and i.lexeme_id is not null
    group by i.lexeme_id
    union all
    select
      'expression:' || i.expression_id::text,
      'expression'::text,
      i.expression_id,
      array_agg(i.id order by i.id)
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id and i.expression_id is not null
    group by i.expression_id
  )
  select count(*) into v_total_entities from entity_index;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', i.id,
    'raw_input', i.raw_input,
    'normalized_input', i.normalized_input,
    'status', i.status,
    'current_stage', i.current_stage,
    'last_error', i.last_error
  ) order by i.id), '[]'::jsonb)
  into v_unresolved
  from public.lexeme_processing_items as i
  where i.job_id = p_job_id
    and i.lexeme_id is null
    and i.expression_id is null;

  with entity_index as (
    select
      'lexeme:' || i.lexeme_id::text as entity_key,
      'lexeme'::text as entity_kind,
      i.lexeme_id as entity_id,
      array_agg(i.id order by i.id) as item_ids
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id and i.lexeme_id is not null
    group by i.lexeme_id
    union all
    select
      'expression:' || i.expression_id::text,
      'expression'::text,
      i.expression_id,
      array_agg(i.id order by i.id)
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id and i.expression_id is not null
    group by i.expression_id
  ),
  page_rows as (
    select ei.*
    from entity_index as ei
    where p_cursor is null or ei.entity_key > p_cursor
    order by ei.entity_key
    limit v_limit + 1
  ),
  selected_rows as (
    select pr.* from page_rows as pr order by pr.entity_key limit v_limit
  )
  select
    count(*) > v_limit,
    case when count(*) > v_limit then (select max(sr.entity_key) from selected_rows as sr) else null end
  into v_has_more, v_next_cursor
  from page_rows;

  with entity_index as (
    select
      'lexeme:' || i.lexeme_id::text as entity_key,
      'lexeme'::text as entity_kind,
      i.lexeme_id as entity_id,
      array_agg(i.id order by i.id) as item_ids
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id and i.lexeme_id is not null
    group by i.lexeme_id
    union all
    select
      'expression:' || i.expression_id::text,
      'expression'::text,
      i.expression_id,
      array_agg(i.id order by i.id)
    from public.lexeme_processing_items as i
    where i.job_id = p_job_id and i.expression_id is not null
    group by i.expression_id
  ),
  selected_rows as (
    select ei.*
    from entity_index as ei
    where p_cursor is null or ei.entity_key > p_cursor
    order by ei.entity_key
    limit v_limit
  )
  select coalesce(jsonb_agg(entity_json order by entity_key), '[]'::jsonb)
  into v_entities
  from (
    select
      sr.entity_key,
      jsonb_build_object(
        'snapshot_version', 'completion-evidence-snapshot/v1',
        'snapshot_token', v_snapshot_token,
        'captured_at', v_captured_at,
        'entity_key', sr.entity_key,
        'entity_kind', sr.entity_kind,
        'entity_id', sr.entity_id,
        'lemma', case when sr.entity_kind = 'lexeme' then l.lemma else e.lemma end,
        'pos', case when sr.entity_kind = 'lexeme' then l.pos else coalesce(e.pos, 'expression') end,
        'item_ids', to_jsonb(sr.item_ids),
        'execution_state', case
          when v_job.status = 'failed' then 'failed'
          when v_job.status in ('partial', 'needs_manual_review')
            or coalesce(v_supervisor.stage, '') = 'needs_manual_review'
            then 'needs_manual_review'
          when exists (
            select 1
            from public.lexeme_processing_items as state_item
            where state_item.id = any(sr.item_ids)
              and state_item.status = 'failed'
          ) then 'failed'
          when exists (
            select 1
            from public.lexeme_processing_items as state_item
            where state_item.id = any(sr.item_ids)
              and state_item.status is distinct from 'done'
          ) then 'needs_manual_review'
          else 'completed'
        end,
        'identity', case when sr.entity_kind = 'lexeme' then
          jsonb_build_object(
            'accepted',
              (
                l.dictionary_status = 'active'
                and coalesce(l.verification_status, '') in
                  ('multi_source', 'usage_verified', 'authoritative', 'verified',
                   'source_verified', 'multi_source_verified')
                and (
                  nullif(l.source_verified, '') is not null
                  or nullif(l.verification_source, '') is not null
                  or coalesce(l.verification_evidence, '{}'::jsonb) <> '{}'::jsonb
                )
              )
              or (
                l.dictionary_status = 'excluded'
                and l.is_learning_lexeme = false
                and l.pos in ('adposition', 'article', 'auxiliary', 'conjunction',
                              'determiner', 'interjection', 'particle', 'preposition',
                              'pronoun', 'subjunction')
                and nullif(l.dictionary_exclusion_reason, '') is not null
              ),
            'verification_status', case
              when l.dictionary_status = 'excluded'
                and l.is_learning_lexeme = false
                and l.pos in ('adposition', 'article', 'auxiliary', 'conjunction',
                              'determiner', 'interjection', 'particle', 'preposition',
                              'pronoun', 'subjunction')
              then 'verified'
              else l.verification_status
            end,
            'source_refs', to_jsonb(array_remove(array[
              case when nullif(l.source_verified, '') is not null
                then 'lexeme:source_verified:' || l.source_verified end,
              case when nullif(l.verification_source, '') is not null
                then 'lexeme:verification_source:' || l.verification_source end,
              case when coalesce(l.verification_evidence, '{}'::jsonb) <> '{}'::jsonb
                then 'lexeme:verification_evidence:' || l.id::text end,
              case when l.dictionary_status = 'excluded'
                  and nullif(l.dictionary_exclusion_reason, '') is not null
                then 'lexeme:dictionary_exclusion:' || l.id::text end
            ], null)),
            'expression_whole_unit_source_refs', '[]'::jsonb,
            'is_learning_lexeme', l.is_learning_lexeme,
            'paradigm_type', nullif(l.verification_evidence ->> 'paradigm_type', ''),
            'paradigm_source_refs', case
              when nullif(l.verification_evidence ->> 'paradigm_type', '') is not null
                and coalesce(l.verification_evidence -> 'paradigm_source_refs', '[]'::jsonb) <> '[]'::jsonb
              then l.verification_evidence -> 'paradigm_source_refs'
              else '[]'::jsonb
            end,
            'allowed_missing_slots', case
              when jsonb_typeof(l.verification_evidence -> 'allowed_missing_slots') = 'array'
              then l.verification_evidence -> 'allowed_missing_slots'
              else '[]'::jsonb
            end
          )
        else
          jsonb_build_object(
            'accepted',
              coalesce(e.expression_review_status, '') = 'verified'
              and exists (
                select 1 from public.expression_source_evidence as ese
                where ese.expression_id = e.id
                  and lower(ese.source) not in ('ai', 'gemini', 'ai_fallback')
                  and (
                    nullif(ese.expression_text, '') is not null
                    or nullif(ese.surface_form, '') is not null
                    or coalesce(ese.evidence, '{}'::jsonb) <> '{}'::jsonb
                  )
              ),
            'verification_status', coalesce(e.verification_status, e.expression_review_status, e.verification),
            'source_refs', coalesce((
              select jsonb_agg(distinct ese.source || ':expression-evidence:' || ese.id::text)
              from public.expression_source_evidence as ese
              where ese.expression_id = e.id
                and lower(ese.source) not in ('ai', 'gemini', 'ai_fallback')
            ), '[]'::jsonb),
            'expression_whole_unit_source_refs', coalesce((
              select jsonb_agg(distinct ese.source || ':expression-whole:' || ese.id::text)
              from public.expression_source_evidence as ese
              where ese.expression_id = e.id
                and lower(ese.source) not in ('ai', 'gemini', 'ai_fallback')
                and (
                  nullif(ese.expression_text, '') is not null
                  or nullif(ese.surface_form, '') is not null
                  or coalesce(ese.evidence, '{}'::jsonb) <> '{}'::jsonb
                )
            ), '[]'::jsonb),
            'is_learning_lexeme', true,
            'paradigm_type', null,
            'paradigm_source_refs', '[]'::jsonb,
            'allowed_missing_slots', '[]'::jsonb
          )
        end,
        'forms', case when sr.entity_kind = 'lexeme' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id,
            'form_type', coalesce(f.form_type, f.form_key),
            'normalized_form', coalesce(nullif(f.normalized_value, ''), nullif(f.value, '')),
            'is_accepted', coalesce(f.is_accepted, false) and coalesce(f.variant_rank, 0) <= 2,
            'needs_review', coalesce(f.needs_review, false),
            'verification_status', f.verification_status,
            'is_irregular', coalesce(f.is_irregular, false),
            'source_refs', to_jsonb(array_remove(array[
              case when nullif(f.source_dictionary, '') is not null
                then f.source_dictionary || ':form:' || coalesce(f.source_article_id, f.id::text) end,
              case when nullif(f.source_verified, '') is not null
                then 'form:source_verified:' || f.source_verified end,
              case when coalesce(f.evidence, '{}'::jsonb) <> '{}'::jsonb
                then 'form:evidence:' || f.id::text end
            ], null))
          ) order by coalesce(f.form_type, f.form_key), coalesce(f.variant_rank, 0), f.id)
          from public.lexeme_form_variants as f
          where f.lexeme_id = l.id
        ), '[]'::jsonb) else '[]'::jsonb end,
        'translations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id,
            'locale', t.language_code,
            'value', coalesce(nullif(t.canonical_translation, ''), nullif(t.translation, '')),
            'provider', t.source,
            'canonical', nullif(t.canonical_translation, '') is not null,
            'needs_review', coalesce(t.canonicalization_metadata ->> 'status', '') = 'needs_review',
            'source_refs', case
              when lower(t.source) = 'lexin'
                and coalesce(t.source_entry_id, t.source_sub_id, t.source_sense_id) is not null
              then jsonb_build_array(
                'lexin:translation:' || coalesce(
                  t.source_entry_id::text,
                  t.source_sub_id::text,
                  t.source_sense_id::text
                )
              )
              when lower(t.source) <> 'lexin'
              then jsonb_build_array(lower(t.source) || ':translation:' || t.id::text)
              else '[]'::jsonb
            end,
            'lexeme_id', t.lexeme_id,
            'expression_id', t.expression_id
          ) order by t.language_code, t.translation_rank, t.id)
          from public.entity_translations as t
          where (sr.entity_kind = 'lexeme' and t.lexeme_id = sr.entity_id and t.expression_id is null)
             or (sr.entity_kind = 'expression' and t.expression_id = sr.entity_id and t.lexeme_id is null)
        ), '[]'::jsonb),
        'relations', case when sr.entity_kind = 'lexeme' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', r.id,
            'relation_type', r.relation_type,
            'status', r.status,
            'needs_review', coalesce(r.status, '') not in ('trusted', 'resolved', 'verified', 'accepted'),
            'expression_id', r.target_entity_id,
            'source_refs', case
              when coalesce(r.status, '') in ('trusted', 'resolved', 'verified', 'accepted')
                and nullif(r.source, '') is not null
                and coalesce(r.evidence, '{}'::jsonb) <> '{}'::jsonb
              then jsonb_build_array(lower(r.source) || ':relation:' || r.id::text)
              else '[]'::jsonb
            end,
            'translations', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', rt.id,
                'locale', rt.language_code,
                'value', coalesce(nullif(rt.canonical_translation, ''), nullif(rt.translation, '')),
                'provider', rt.source,
                'canonical', nullif(rt.canonical_translation, '') is not null,
                'needs_review', coalesce(rt.canonicalization_metadata ->> 'status', '') = 'needs_review',
                'source_refs', case
                  when lower(rt.source) = 'lexin'
                    and coalesce(rt.source_entry_id, rt.source_sub_id, rt.source_sense_id) is not null
                  then jsonb_build_array(
                    'lexin:translation:' || coalesce(
                      rt.source_entry_id::text,
                      rt.source_sub_id::text,
                      rt.source_sense_id::text
                    )
                  )
                  when lower(rt.source) <> 'lexin'
                  then jsonb_build_array(lower(rt.source) || ':translation:' || rt.id::text)
                  else '[]'::jsonb
                end,
                'lexeme_id', rt.lexeme_id,
                'expression_id', rt.expression_id
              ) order by rt.language_code, rt.translation_rank, rt.id)
              from public.entity_translations as rt
              where rt.expression_id = r.target_entity_id and rt.lexeme_id is null
            ), '[]'::jsonb)
          ) order by r.relation_type, r.id)
          from public.authoritative_semantic_relations as r
          where r.source_entity_type = 'lexeme'
            and r.source_entity_id = l.id
            and r.target_entity_type = 'expression'
            and r.target_entity_id is not null
        ), '[]'::jsonb) else '[]'::jsonb end
      ) as entity_json
    from selected_rows as sr
    left join public.lexemes as l
      on sr.entity_kind = 'lexeme' and l.id = sr.entity_id
    left join public.expression_catalog as e
      on sr.entity_kind = 'expression' and e.id = sr.entity_id
  ) as built;

  return jsonb_build_object(
    'snapshot_version', 'completion-evidence-snapshot/v1',
    'snapshot_token', v_snapshot_token,
    'captured_at', v_captured_at,
    'job', jsonb_build_object(
      'id', v_job.id,
      'status', v_job.status,
      'supervisor_stage', v_supervisor.stage,
      'updated_at', v_job.updated_at
    ),
    'execution_state', v_execution_state,
    'counts', jsonb_build_object(
      'total_items', coalesce(v_total_items, 0),
      'total_entities', coalesce(v_total_entities, 0),
      'unresolved_items', coalesce(v_unresolved_count, 0)
    ),
    'unresolved_items', v_unresolved,
    'page', jsonb_build_object(
      'cursor', p_cursor,
      'next_cursor', v_next_cursor,
      'has_more', coalesce(v_has_more, false),
      'entities', v_entities
    )
  );
end;
$function$;

comment on function public.get_completion_evidence_snapshot_v1(uuid, text, integer, text) is
'Read-only, stable, fail-closed evidence snapshot for completion-contract/v1 shadow evaluation. Entity execution state is item-aware. Service-role only.';

revoke all on function public.get_completion_evidence_snapshot_v1(uuid, text, integer, text) from public;
revoke all on function public.get_completion_evidence_snapshot_v1(uuid, text, integer, text) from anon;
revoke all on function public.get_completion_evidence_snapshot_v1(uuid, text, integer, text) from authenticated;
grant execute on function public.get_completion_evidence_snapshot_v1(uuid, text, integer, text) to service_role;
