-- D10 / AUTHORITATIVE MORPHOLOGY V2.1
-- Retain every equivalent Ordbokene article identity while publishing one
-- learner-facing canonical projection. Divergent articles still fail closed.

alter table private.authoritative_morphology_snapshots_v2
  add column source_article_ids bigint[],
  add column article_resolution text;

update private.authoritative_morphology_snapshots_v2 as snapshot
set
  source_article_ids = source.ids,
  article_resolution = case
    when cardinality(source.ids) = 1 then 'single_source_article'
    else 'equivalent_source_articles'
  end
from (
  select
    paradigm.snapshot_id,
    array_agg(distinct paradigm.article_id order by paradigm.article_id) as ids
  from private.authoritative_morphology_paradigms_v2 as paradigm
  group by paradigm.snapshot_id
) as source
where source.snapshot_id = snapshot.id;

alter table private.authoritative_morphology_snapshots_v2
  alter column source_article_ids set not null,
  alter column article_resolution set not null,
  add constraint authoritative_morphology_snapshots_v2_source_articles_check
    check (cardinality(source_article_ids) > 0),
  add constraint authoritative_morphology_snapshots_v2_article_resolution_check
    check (article_resolution in (
      'single_source_article',
      'equivalent_source_articles'
    )),
  add constraint authoritative_morphology_snapshots_v2_resolution_cardinality_check
    check (
      (article_resolution = 'single_source_article' and cardinality(source_article_ids) = 1)
      or
      (article_resolution = 'equivalent_source_articles' and cardinality(source_article_ids) > 1)
    );

alter table public.lexeme_form_display_v2
  add column article_ids bigint[];

update public.lexeme_form_display_v2
set article_ids = array[article_id];

alter table public.lexeme_form_display_v2
  alter column article_ids set not null,
  alter column article_id drop not null,
  add constraint lexeme_form_display_v2_article_ids_check
    check (cardinality(article_ids) > 0),
  add constraint lexeme_form_display_v2_article_identity_shape_check
    check (
      (cardinality(article_ids) = 1 and article_id = article_ids[1])
      or
      (cardinality(article_ids) > 1 and article_id is null)
    );

create or replace function public.publish_authoritative_morphology_snapshot_v2(
  p_lexeme_id uuid,
  p_resolution jsonb,
  p_display_groups jsonb,
  p_comparison jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_lexeme public.lexemes%rowtype;
  v_lookup jsonb := p_resolution -> 'lookup';
  v_paradigms jsonb := p_resolution -> 'paradigms';
  v_snapshot_id uuid;
  v_paradigm_id uuid;
  v_paradigm jsonb;
  v_form jsonb;
  v_group jsonb;
  v_article_ids bigint[];
  v_paradigm_article_ids bigint[];
  v_article_resolution text;
  v_projection_signature_count integer;
  v_expected_count integer;
  v_fetched_count integer;
  v_display_order integer := 0;
  v_evidence_ids text[];
begin
  if jsonb_typeof(p_resolution) <> 'object'
     or jsonb_typeof(v_lookup) <> 'object'
     or jsonb_typeof(v_paradigms) <> 'array'
     or jsonb_typeof(p_display_groups) <> 'array'
     or jsonb_typeof(p_comparison) <> 'object'
     or jsonb_array_length(v_paradigms) = 0
     or jsonb_array_length(p_display_groups) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_PUBLISH_PAYLOAD';
  end if;

  select lexeme.* into v_lexeme
  from public.lexemes as lexeme
  where lexeme.id = p_lexeme_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  end if;

  if p_resolution ->> 'status' <> 'resolved'
     or jsonb_typeof(v_lookup -> 'errors') <> 'array'
     or jsonb_array_length(v_lookup -> 'errors') <> 0 then
    raise exception using errcode = '55000', message = 'SOURCE_RESULT_INCOMPLETE';
  end if;

  if v_lookup -> 'requestedDictionaries' <> '["bm"]'::jsonb then
    raise exception using errcode = '55000', message = 'BOKMAL_ONLY_REQUIRED';
  end if;

  if p_resolution ->> 'requestedPos' is distinct from v_lexeme.pos then
    raise exception using errcode = '55000', message = 'LEXEME_POS_MISMATCH';
  end if;

  if lower(btrim(v_lookup ->> 'normalizedQuery')) is distinct from
     lower(btrim(regexp_replace(coalesce(v_lexeme.display_form, v_lexeme.lemma),
       '^(å|en|ei|et)[[:space:]]+', '', 'i'))) then
    raise exception using errcode = '55000', message = 'LEXEME_QUERY_MISMATCH';
  end if;

  if jsonb_typeof(v_lookup -> 'articleReferences') <> 'array'
     or jsonb_typeof(v_lookup -> 'articles') <> 'array' then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLES_INCOMPLETE';
  end if;

  v_expected_count := jsonb_array_length(v_lookup -> 'articleReferences');
  v_fetched_count := jsonb_array_length(v_lookup -> 'articles');
  if v_expected_count = 0 or v_expected_count <> v_fetched_count then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLES_INCOMPLETE';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    where item ->> 'dictionaryCode' <> 'bm'
       or item ->> 'pos' <> v_lexeme.pos
       or lower(btrim(item ->> 'lemma')) <> lower(btrim(v_lookup ->> 'normalizedQuery'))
       or coalesce(item ->> 'articleId', '') !~ '^[1-9][0-9]*$'
       or btrim(coalesce(item ->> 'formKey', '')) = ''
       or jsonb_typeof(item -> 'primary') <> 'array'
       or jsonb_array_length(item -> 'primary') = 0
       or jsonb_typeof(item -> 'alternatives') <> 'array'
       or jsonb_typeof(item -> 'evidenceIds') <> 'array'
       or jsonb_array_length(item -> 'evidenceIds') = 0
       or btrim(coalesce(item ->> 'policyVersion', '')) = ''
       or coalesce(item ->> 'regularityMarker', 'unknown') not in
          ('regular', 'irregular', 'suppletive', 'unknown')
  ) then
    raise exception using errcode = '55000', message = 'INVALID_DISPLAY_GROUPS';
  end if;

  if (
    select count(distinct item ->> 'policyVersion')
    from jsonb_array_elements(p_display_groups) as item
  ) <> 1 then
    raise exception using errcode = '55000', message = 'DISPLAY_POLICY_VERSION_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    cross join lateral jsonb_array_elements(
      (item -> 'primary') || (item -> 'alternatives')
    ) as selected
    where jsonb_typeof(selected) <> 'object'
       or btrim(coalesce(selected ->> 'value', '')) = ''
       or btrim(coalesce(selected ->> 'normalizedValue', '')) = ''
  ) then
    raise exception using errcode = '55000', message = 'INVALID_DISPLAY_FORMS';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    group by (item ->> 'articleId')::bigint, item ->> 'formKey'
    having count(*) <> 1
  ) then
    raise exception using errcode = '55000', message = 'DUPLICATE_DISPLAY_GROUP';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    where exists (
      select 1
      from jsonb_array_elements(item -> 'primary') as primary_form
      join jsonb_array_elements(item -> 'alternatives') as alternative_form
        on alternative_form ->> 'normalizedValue' = primary_form ->> 'normalizedValue'
    )
    or exists (
      select 1
      from jsonb_array_elements(item -> 'primary') as selected
      group by selected ->> 'normalizedValue'
      having count(*) > 1
    )
    or exists (
      select 1
      from jsonb_array_elements(item -> 'alternatives') as selected
      group by selected ->> 'normalizedValue'
      having count(*) > 1
    )
  ) then
    raise exception using errcode = '55000', message = 'DUPLICATE_OR_OVERLAPPING_DISPLAY_FORM';
  end if;

  select array_agg(
    distinct (item ->> 'articleId')::bigint
    order by (item ->> 'articleId')::bigint
  )
  into v_article_ids
  from jsonb_array_elements(p_display_groups) as item;

  v_article_resolution := case
    when cardinality(v_article_ids) = 1 then 'single_source_article'
    else 'equivalent_source_articles'
  end;

  select count(distinct projection.signature)
  into v_projection_signature_count
  from (
    select
      (item ->> 'articleId')::bigint as article_id,
      jsonb_agg(
        jsonb_build_object(
          'formKey', item ->> 'formKey',
          'lemma', item ->> 'lemma',
          'primary', (
            select jsonb_agg(
              jsonb_build_object(
                'value', selected.value ->> 'value',
                'normalizedValue', selected.value ->> 'normalizedValue'
              )
              order by selected.ordinality
            )
            from jsonb_array_elements(item -> 'primary')
              with ordinality as selected(value, ordinality)
          ),
          'alternatives', (
            select jsonb_agg(
              jsonb_build_object(
                'value', selected.value ->> 'value',
                'normalizedValue', selected.value ->> 'normalizedValue'
              )
              order by selected.ordinality
            )
            from jsonb_array_elements(item -> 'alternatives')
              with ordinality as selected(value, ordinality)
          ),
          'regularityMarker', coalesce(item ->> 'regularityMarker', 'unknown'),
          'policyVersion', item ->> 'policyVersion'
        )
        order by item ->> 'formKey'
      ) as signature
    from jsonb_array_elements(p_display_groups) as item
    group by (item ->> 'articleId')::bigint
  ) as projection;

  if v_projection_signature_count <> 1 then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLE_PROJECTIONS_DIVERGE';
  end if;

  select array_agg(
    distinct (item ->> 'articleId')::bigint
    order by (item ->> 'articleId')::bigint
  )
  into v_paradigm_article_ids
  from jsonb_array_elements(v_paradigms) as item;

  if v_paradigm_article_ids is distinct from v_article_ids then
    raise exception using errcode = '55000', message = 'PARADIGM_ARTICLE_SET_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_paradigms) as paradigm
    where paradigm ->> 'dictionaryCode' <> 'bm'
       or paradigm ->> 'pos' <> v_lexeme.pos
       or paradigm ->> 'source' <> 'Ordbokene'
       or lower(btrim(paradigm ->> 'lemma')) <> lower(btrim(v_lookup ->> 'normalizedQuery'))
       or coalesce(paradigm ->> 'articleId', '') !~ '^[1-9][0-9]*$'
       or coalesce(paradigm ->> 'articleUrl', '') !~ '^https://ord[.]uib[.]no/'
       or btrim(coalesce(paradigm ->> 'identity', '')) = ''
       or btrim(coalesce(paradigm ->> 'paradigmId', '')) = ''
       or jsonb_typeof(paradigm -> 'forms') <> 'array'
       or jsonb_array_length(paradigm -> 'forms') = 0
       or not exists (
         select 1
         from jsonb_array_elements(v_lookup -> 'articles') as source_article
         where source_article ->> 'dictionaryCode' = paradigm ->> 'dictionaryCode'
           and source_article ->> 'articleId' = paradigm ->> 'articleId'
       )
  ) then
    raise exception using errcode = '55000', message = 'PARADIGM_IDENTITY_MISMATCH';
  end if;

  -- A selected value must be backed by an exact form in the same source
  -- article and form group. The publisher never accepts invented forms.
  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as display_group
    cross join lateral jsonb_array_elements(
      (display_group -> 'primary') || (display_group -> 'alternatives')
    ) as selected
    where not exists (
      select 1
      from jsonb_array_elements(v_paradigms) as paradigm
      cross join lateral jsonb_array_elements(paradigm -> 'forms') as source_form
      where paradigm ->> 'articleId' = display_group ->> 'articleId'
        and paradigm ->> 'dictionaryCode' = display_group ->> 'dictionaryCode'
        and paradigm ->> 'pos' = display_group ->> 'pos'
        and source_form ->> 'formKey' = display_group ->> 'formKey'
        and source_form ->> 'normalizedValue' = selected ->> 'normalizedValue'
        and source_form ->> 'value' = selected ->> 'value'
    )
  ) then
    raise exception using errcode = '55000', message = 'DISPLAY_FORM_NOT_IN_SOURCE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_lexeme_id::text, 0)
  );

  insert into private.authoritative_morphology_snapshots_v2 (
    lexeme_id, lookup_query, normalized_query, requested_pos, dictionaries,
    scope_used, resolver_version, policy_version, is_complete,
    expected_article_count, fetched_article_count, checked_at,
    source_article_ids, article_resolution
  ) values (
    p_lexeme_id,
    v_lookup ->> 'query',
    v_lookup ->> 'normalizedQuery',
    p_resolution ->> 'requestedPos',
    array(select jsonb_array_elements_text(v_lookup -> 'requestedDictionaries')),
    v_lookup ->> 'scopeUsed',
    p_resolution ->> 'version',
    p_display_groups -> 0 ->> 'policyVersion',
    true,
    v_expected_count,
    v_fetched_count,
    (v_lookup ->> 'checkedAt')::timestamptz,
    v_article_ids,
    v_article_resolution
  ) returning id into v_snapshot_id;

  for v_paradigm in select value from jsonb_array_elements(v_paradigms)
  loop
    insert into private.authoritative_morphology_paradigms_v2 (
      snapshot_id, dictionary_code, article_id, pos, paradigm_id, identity,
      lemma, source_url, source_article_version, paradigm_tags,
      inflection_group, standardisation, regularity_marker, preference
    ) values (
      v_snapshot_id,
      v_paradigm ->> 'dictionaryCode',
      (v_paradigm ->> 'articleId')::bigint,
      v_paradigm ->> 'pos',
      v_paradigm ->> 'paradigmId',
      v_paradigm ->> 'identity',
      v_paradigm ->> 'lemma',
      v_paradigm ->> 'articleUrl',
      v_paradigm ->> 'articleVersion',
      array(select jsonb_array_elements_text(v_paradigm -> 'paradigmTags')),
      v_paradigm ->> 'inflectionGroup',
      v_paradigm ->> 'standardisation',
      coalesce(v_paradigm -> 'preference' ->> 'regularity', 'unknown'),
      nullif(v_paradigm -> 'preference', 'null'::jsonb)
    ) returning id into v_paradigm_id;

    for v_form in select value from jsonb_array_elements(v_paradigm -> 'forms')
    loop
      insert into private.authoritative_morphology_forms_v2 (
        paradigm_id, form_key, value, normalized_value, tags, source_ordinal
      ) values (
        v_paradigm_id,
        v_form ->> 'formKey',
        v_form ->> 'value',
        v_form ->> 'normalizedValue',
        array(select jsonb_array_elements_text(v_form -> 'tags')),
        (v_form ->> 'sourceOrdinal')::integer
      );
    end loop;
  end loop;

  insert into private.authoritative_morphology_comparisons_v2 (
    snapshot_id, lexeme_id, comparison
  ) values (v_snapshot_id, p_lexeme_id, p_comparison);

  update private.authoritative_morphology_snapshots_v2 as previous
  set state = 'superseded', is_active = false, superseded_at = now()
  where previous.lexeme_id = p_lexeme_id
    and previous.is_active
    and previous.id <> v_snapshot_id;

  delete from public.lexeme_form_display_v2 as display
  where display.lexeme_id = p_lexeme_id;

  -- Every source article has already been proven to have the same ordered
  -- projection. Select one deterministic representative for the values, but
  -- persist the complete article ID set and never label one article primary.
  for v_group in
    select distinct on (value ->> 'formKey') value
    from jsonb_array_elements(p_display_groups)
    order by value ->> 'formKey', (value ->> 'articleId')::bigint
  loop
    select array_agg(distinct evidence.value order by evidence.value)
    into v_evidence_ids
    from jsonb_array_elements(p_display_groups) as same_group
    cross join lateral jsonb_array_elements_text(same_group -> 'evidenceIds') as evidence(value)
    where same_group ->> 'formKey' = v_group ->> 'formKey';

    insert into public.lexeme_form_display_v2 (
      lexeme_id, snapshot_id, dictionary_code, article_id, article_ids, pos,
      lemma, form_key, primary_values, alternative_values,
      regularity_marker, evidence_ids, policy_version, display_order
    ) values (
      p_lexeme_id,
      v_snapshot_id,
      v_group ->> 'dictionaryCode',
      case when cardinality(v_article_ids) = 1 then v_article_ids[1] else null end,
      v_article_ids,
      v_group ->> 'pos',
      v_group ->> 'lemma',
      v_group ->> 'formKey',
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'primary') as form),
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'alternatives') as form),
      coalesce(v_group ->> 'regularityMarker', 'unknown'),
      v_evidence_ids,
      v_group ->> 'policyVersion',
      v_display_order
    );
    v_display_order := v_display_order + 1;
  end loop;

  update private.authoritative_morphology_snapshots_v2
  set state = 'ready', is_active = true, finalized_at = now()
  where id = v_snapshot_id;

  delete from private.authoritative_morphology_snapshots_v2 as expired
  where expired.id in (
    select old.id
    from private.authoritative_morphology_snapshots_v2 as old
    where old.lexeme_id = p_lexeme_id and old.state = 'superseded'
    order by old.superseded_at desc nulls last, old.created_at desc
    offset 3
  );

  return v_snapshot_id;
end;
$function$;

revoke all on function public.publish_authoritative_morphology_snapshot_v2(
  uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.publish_authoritative_morphology_snapshot_v2(
  uuid, jsonb, jsonb, jsonb
) to service_role;

comment on column private.authoritative_morphology_snapshots_v2.source_article_ids is
  'Sorted complete Ordbokene article identity set used by this snapshot.';
comment on column private.authoritative_morphology_snapshots_v2.article_resolution is
  'Single article, or multiple articles whose complete learner-facing projections are equivalent.';
comment on column public.lexeme_form_display_v2.article_id is
  'Compatibility identity for single-article projections; NULL when multiple equivalent articles contribute.';
comment on column public.lexeme_form_display_v2.article_ids is
  'Sorted complete Ordbokene article identity set for the canonical projection.';
comment on function public.publish_authoritative_morphology_snapshot_v2(uuid, jsonb, jsonb, jsonb) is
  'Service-role-only atomic D10 publisher; preserves all equivalent article identities and rejects partial, Nynorsk, divergent, or non-source-backed forms.';
