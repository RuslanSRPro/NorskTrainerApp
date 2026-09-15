-- D10: canonical lexeme lemma is the only persisted morphology identity.
-- Correct active functions without rewriting already-applied migrations.

do $migration$
declare
  v_publish_definition text;
  v_binding_definition text;

  v_publish_old text := $old$lower(btrim(regexp_replace(coalesce(v_lexeme.display_form, v_lexeme.lemma),
       '^(å|en|ei|et)[[:space:]]+', '', 'i')))$old$;

  v_publish_new text := $new$lower(btrim(v_lexeme.lemma))$new$;

  v_binding_old text := $old$lower(btrim(regexp_replace(coalesce(lexeme.display_form, lexeme.lemma),
      '^(å|en|ei|et)[[:space:]]+', '', 'i')))$old$;

  v_binding_new text := $new$lower(btrim(lexeme.lemma))$new$;
begin
  -- Functions created from Windows migrations can retain CRLF inside their
  -- stored source. Normalize both operands before the exact fail-closed patch.
  v_publish_old := replace(v_publish_old, E'\r\n', E'\n');
  v_publish_new := replace(v_publish_new, E'\r\n', E'\n');
  v_binding_old := replace(v_binding_old, E'\r\n', E'\n');
  v_binding_new := replace(v_binding_new, E'\r\n', E'\n');

  v_publish_definition := replace(
    pg_get_functiondef(
      'public.publish_authoritative_morphology_snapshot_v2(uuid,jsonb,jsonb,jsonb)'::regprocedure
    ),
    E'\r\n',
    E'\n'
  );

  if strpos(v_publish_definition, v_publish_old) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_PUBLISHER_IDENTITY_PATTERN_NOT_FOUND';
  end if;

  execute replace(
    v_publish_definition,
    v_publish_old,
    v_publish_new
  );

  v_binding_definition := replace(
    pg_get_functiondef(
      'private.validate_authoritative_article_binding_v2()'::regprocedure
    ),
    E'\r\n',
    E'\n'
  );

  if strpos(v_binding_definition, v_binding_old) = 0 then
    raise exception using
      errcode = '55000',
      message = 'D10_BINDING_IDENTITY_PATTERN_NOT_FOUND';
  end if;

  execute replace(
    v_binding_definition,
    v_binding_old,
    v_binding_new
  );
end;
$migration$;

comment on function public.publish_authoritative_morphology_snapshot_v2(
  uuid,
  jsonb,
  jsonb,
  jsonb
) is
  'Service-role-only atomic D10 publisher; canonical lexemes.lemma is the dictionary identity and display_form is presentation-only.';

comment on function private.validate_authoritative_article_binding_v2() is
  'Validates article bindings against canonical lexemes.lemma and POS; display_form is presentation-only.';
