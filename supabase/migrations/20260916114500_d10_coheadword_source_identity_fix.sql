-- D10: accept complete Ordbokene headwords when final_lexeme is also present.
-- Allow an official primary headword to reclaim an alias previously registered
-- only as a non-primary co-headword of another canonical lexeme.

do $migration$
declare
  v_definition text;

  v_coheadword_old text := $old$and lower(btrim(coalesce(
            nullif(btrim(source_lemma ->> 'final_lexeme'), ''),
            source_lemma ->> 'lemma'
          ))) = lower(btrim(paradigm ->> 'lemma'))$old$;

  v_coheadword_new text := $new$and (
            lower(btrim(source_lemma ->> 'lemma')) =
              lower(btrim(paradigm ->> 'lemma'))
            or lower(btrim(source_lemma ->> 'final_lexeme')) =
              lower(btrim(paradigm ->> 'lemma'))
          )$new$;

  v_alias_where_old text := $old$where public.lexeme_headword_aliases_v2.lexeme_id = excluded.lexeme_id$old$;

  v_alias_where_new text := $new$where public.lexeme_headword_aliases_v2.lexeme_id = excluded.lexeme_id
       or (
         not public.lexeme_headword_aliases_v2.is_primary
         and excluded.is_primary
       )$new$;

  v_alias_update_old text := $old$do update set
      headword = excluded.headword,$old$;

  v_alias_update_new text := $new$do update set
      lexeme_id = excluded.lexeme_id,
      headword = excluded.headword,$new$;

  v_conflict_old text := $old$if v_bound_lexeme_id is null then
      raise exception using errcode = '55000',
        message = 'SOURCE_HEADWORD_ALREADY_BOUND';
    end if;$old$;

  v_conflict_new text := $new$if v_bound_lexeme_id is null
       and lower(btrim(v_paradigm ->> 'lemma')) =
         lower(btrim(v_lookup ->> 'normalizedQuery'))
    then
      raise exception using errcode = '55000',
        message = 'SOURCE_HEADWORD_ALREADY_BOUND';
    end if;$new$;
begin
  v_coheadword_old := replace(v_coheadword_old, E'\r\n', E'\n');
  v_coheadword_new := replace(v_coheadword_new, E'\r\n', E'\n');
  v_alias_where_old := replace(v_alias_where_old, E'\r\n', E'\n');
  v_alias_where_new := replace(v_alias_where_new, E'\r\n', E'\n');
  v_alias_update_old := replace(v_alias_update_old, E'\r\n', E'\n');
  v_alias_update_new := replace(v_alias_update_new, E'\r\n', E'\n');
  v_conflict_old := replace(v_conflict_old, E'\r\n', E'\n');
  v_conflict_new := replace(v_conflict_new, E'\r\n', E'\n');

  v_definition := replace(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    E'\r\n',
    E'\n'
  );

  if strpos(v_definition, v_coheadword_old) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_COHEADWORD_VALIDATOR_PATTERN_NOT_FOUND';
  end if;

  v_definition := replace(
    v_definition,
    v_coheadword_old,
    v_coheadword_new
  );

  if strpos(v_definition, v_alias_update_old) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_ALIAS_UPDATE_PATTERN_NOT_FOUND';
  end if;

  v_definition := replace(
    v_definition,
    v_alias_update_old,
    v_alias_update_new
  );

  if strpos(v_definition, v_alias_where_old) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_ALIAS_CONFLICT_PATTERN_NOT_FOUND';
  end if;

  v_definition := replace(
    v_definition,
    v_alias_where_old,
    v_alias_where_new
  );

  if strpos(v_definition, v_conflict_old) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_ALIAS_FAILURE_PATTERN_NOT_FOUND';
  end if;

  v_definition := replace(
    v_definition,
    v_conflict_old,
    v_conflict_new
  );

  execute v_definition;
end;
$migration$;

comment on function public.publish_authoritative_morphology_snapshot_v2(
  uuid,
  jsonb,
  jsonb,
  jsonb
) is
  'Service-role-only atomic D10 publisher; accepts complete Ordbokene headwords alongside final_lexeme and preserves canonical primary alias ownership.';
