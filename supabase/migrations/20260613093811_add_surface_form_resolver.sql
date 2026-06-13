create or replace function public.normalize_surface_form(
  p_value text
)
returns text
language sql
immutable
as $function$
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(trim(coalesce(p_value, ''))),
        '[\.,!\?;:"“”''«»\(\)\[\]\{\}]',
        '',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );
$function$;

create or replace function public.resolve_surface_form(
  p_surface_form text
)
returns table (
  lexeme_id uuid,
  lemma text,
  pos text,
  form_type text,
  grammatical_features jsonb,
  confidence text,
  source text
)
language plpgsql
security definer
as $function$
declare
  v_norm text;
begin
  v_norm := public.normalize_surface_form(p_surface_form);

  if v_norm is null then
    return;
  end if;

  -- 1. exact lexeme match
  return query
  select
    l.id,
    l.lemma,
    l.pos,
    'base'::text,
    jsonb_build_object(
      'resolver', 'exact_lexeme',
      'surface', p_surface_form
    ),
    'high'::text,
    'lexemes'::text
  from lexemes l
  where public.normalize_surface_form(l.lemma) = v_norm
     or public.normalize_surface_form(l.display_form) = v_norm
  limit 1;

  if found then
    return;
  end if;

  -- 2. accepted variants
  return query
  select
    l.id,
    l.lemma,
    coalesce(v.pos, l.pos),
    coalesce(v.form_type, 'variant')::text,
    jsonb_build_object(
      'resolver', 'lexeme_form_variants',
      'variant_type', v.variant_type,
      'is_primary', v.is_primary,
      'is_accepted', v.is_accepted,
      'surface', p_surface_form
    ),
    case
      when v.is_primary = true then 'high'
      when v.is_accepted = true then 'medium'
      else 'low'
    end::text,
    'lexeme_form_variants'::text
  from lexeme_form_variants v
  join lexemes l on l.id = v.lexeme_id
  where v.normalized_value = v_norm
     or public.normalize_surface_form(v.value) = v_norm
  order by
    v.is_primary desc,
    v.is_accepted desc,
    v.confidence desc nulls last
  limit 1;

  if found then
    return;
  end if;

  -- 3. verb forms
  return query
  select
    l.id,
    l.lemma,
    'verb'::text,
    case
      when public.normalize_surface_form(v.infinitiv) = v_norm then 'infinitive'
      when public.normalize_surface_form(v.presens) = v_norm then 'present'
      when public.normalize_surface_form(v.preteritum) = v_norm then 'past'
      when public.normalize_surface_form(v.perfektum) = v_norm then 'past_participle'
      else 'verb_form'
    end::text,
    jsonb_build_object(
      'resolver', 'verb_forms',
      'infinitiv', v.infinitiv,
      'presens', v.presens,
      'preteritum', v.preteritum,
      'perfektum', v.perfektum,
      'gruppe', v.gruppe,
      'requires_seg', v.requires_seg,
      'particle', v.particle,
      'surface', p_surface_form
    ),
    'high'::text,
    'verb_forms'::text
  from verb_forms v
  join lexemes l on l.id = v.lexeme_id
  where public.normalize_surface_form(v.infinitiv) = v_norm
     or public.normalize_surface_form(v.presens) = v_norm
     or public.normalize_surface_form(v.preteritum) = v_norm
     or public.normalize_surface_form(v.perfektum) = v_norm
  limit 1;

  if found then
    return;
  end if;

  -- 4. noun forms
  return query
  select
    l.id,
    l.lemma,
    'noun'::text,
    case
      when public.normalize_surface_form(n.ubest_entall) = v_norm then 'singular_indefinite'
      when public.normalize_surface_form(n.best_entall) = v_norm then 'singular_definite'
      when public.normalize_surface_form(n.ubest_flertall) = v_norm then 'plural_indefinite'
      when public.normalize_surface_form(n.best_flertall) = v_norm then 'plural_definite'
      else 'noun_form'
    end::text,
    jsonb_build_object(
      'resolver', 'noun_forms',
      'official_gender', n.official_gender,
      'accepted_articles', n.accepted_articles,
      'preferred_article', n.preferred_article,
      'inflection_class', n.inflection_class,
      'surface', p_surface_form
    ),
    'high'::text,
    'noun_forms'::text
  from noun_forms n
  join lexemes l on l.id = n.lexeme_id
  where public.normalize_surface_form(n.ubest_entall) = v_norm
     or public.normalize_surface_form(n.best_entall) = v_norm
     or public.normalize_surface_form(n.ubest_flertall) = v_norm
     or public.normalize_surface_form(n.best_flertall) = v_norm
  limit 1;

  if found then
    return;
  end if;

  -- 5. adjective forms
  return query
  select
    l.id,
    l.lemma,
    'adjective'::text,
    case
      when public.normalize_surface_form(a.positiv) = v_norm then 'positive'
      when public.normalize_surface_form(a.intetkjonn) = v_norm then 'neuter'
      when public.normalize_surface_form(a.flertall) = v_norm then 'plural_or_definite'
      when public.normalize_surface_form(a.komparativ) = v_norm then 'comparative'
      when public.normalize_surface_form(a.superlativ) = v_norm then 'superlative'
      when public.normalize_surface_form(a.best_superlativ) = v_norm then 'definite_superlative'
      else 'adjective_form'
    end::text,
    jsonb_build_object(
      'resolver', 'adjective_forms',
      'comparison_mode', a.comparison_mode,
      'comparison_status', a.comparison_status,
      'preferred_comparison', a.preferred_comparison,
      'lexical_subtype', a.lexical_subtype,
      'surface', p_surface_form
    ),
    'high'::text,
    'adjective_forms'::text
  from adjective_forms a
  join lexemes l on l.id = a.lexeme_id
  where public.normalize_surface_form(a.positiv) = v_norm
     or public.normalize_surface_form(a.intetkjonn) = v_norm
     or public.normalize_surface_form(a.flertall) = v_norm
     or public.normalize_surface_form(a.komparativ) = v_norm
     or public.normalize_surface_form(a.superlativ) = v_norm
     or public.normalize_surface_form(a.best_superlativ) = v_norm
  limit 1;

  return;
end;
$function$;