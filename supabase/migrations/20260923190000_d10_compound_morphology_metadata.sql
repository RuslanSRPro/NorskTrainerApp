-- D10: persist compound morphology metadata for authoritative display.
-- Existing rows remain valid and receive neutral defaults.

alter table public.lexeme_form_display_v2
  add column if not exists is_compound boolean not null default false,
  add column if not exists compound_parts text[] not null default '{}'::text[],
  add column if not exists headword text,
  add column if not exists morphology_source_lemma text;

do $migration$
declare
  v_definition text;
  v_old_columns text := $old$
      lexeme_id, snapshot_id, dictionary_code, article_id, article_ids, pos,
      lemma, form_key, primary_values, alternative_values,
      regularity_marker, evidence_ids, policy_version, display_order
  $old$;
  v_new_columns text := $new$
      lexeme_id, snapshot_id, dictionary_code, article_id, article_ids, pos,
      lemma, is_compound, compound_parts, headword,
      morphology_source_lemma, form_key, primary_values, alternative_values,
      regularity_marker, evidence_ids, policy_version, display_order
  $new$;
  v_old_values text := $old$
      v_group ->> 'lemma',
      v_group ->> 'formKey',
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'primary') as form),
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'alternatives') as form),
      coalesce(v_group ->> 'regularityMarker', 'unknown'),
      v_evidence_ids,
      v_group ->> 'policyVersion',
      v_display_order
  $old$;
  v_new_values text := $new$
      v_group ->> 'lemma',
      coalesce((v_group ->> 'isCompound')::boolean, false),
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(v_group -> 'compoundParts', '[]'::jsonb)
          )
        ),
        '{}'::text[]
      ),
      nullif(v_group ->> 'headword', ''),
      nullif(v_group ->> 'morphologySourceLemma', ''),
      v_group ->> 'formKey',
      array(select form ->> 'value'
        from jsonb_array_elements(v_group -> 'primary') as form),
      array(select form ->> 'value'
        from jsonb_array_elements(v_group -> 'alternatives') as form),
      coalesce(v_group ->> 'regularityMarker', 'unknown'),
      v_evidence_ids,
      v_group ->> 'policyVersion',
      v_display_order
  $new$;
begin
  v_definition := replace(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    E'\r\n',
    E'\n'
  );

  v_old_columns := replace(v_old_columns, E'\r\n', E'\n');
  v_new_columns := replace(v_new_columns, E'\r\n', E'\n');
  v_old_values := replace(v_old_values, E'\r\n', E'\n');
  v_new_values := replace(v_new_values, E'\r\n', E'\n');

  if strpos(v_definition, v_old_columns) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_COMPOUND_PUBLISHER_COLUMNS_NOT_FOUND';
  end if;

  if strpos(v_definition, v_old_values) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_COMPOUND_PUBLISHER_VALUES_NOT_FOUND';
  end if;

  v_definition := replace(
    v_definition,
    v_old_columns,
    v_new_columns
  );

  v_definition := replace(
    v_definition,
    v_old_values,
    v_new_values
  );

  execute v_definition;
end;
$migration$;

comment on column public.lexeme_form_display_v2.is_compound is
  'Whether the authoritative source lemma is a compound headword.';

comment on column public.lexeme_form_display_v2.compound_parts is
  'Ordered source components of the compound headword.';

comment on column public.lexeme_form_display_v2.headword is
  'Morphological headword used for the inflectional component.';

comment on column public.lexeme_form_display_v2.morphology_source_lemma is
  'Final source lemma used by authoritative morphology parsing.';
