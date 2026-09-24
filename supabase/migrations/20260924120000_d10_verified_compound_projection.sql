-- Use only verified decomposition whose ordered surface exactly spells the lemma.
-- Reapply on every publisher INSERT so rebuilding V2 cannot erase the metadata.
create or replace function public.d10_verified_compound_parts(p_lexeme_id uuid, p_lemma text)
returns text[]
language sql stable
set search_path = public
as $$
  select array_agg(c.component_surface || coalesce(c.linking_element_after, '') order by c.component_position)
  from public.lexeme_compound_analyses a
  join public.lexeme_compound_components c on c.compound_analysis_id = a.id
  where a.compound_lexeme_id = p_lexeme_id
    and a.status = 'source_verified'
    and a.analysis_type = 'compound'
  group by a.id, a.component_count
  having count(*) = a.component_count
    and count(*) >= 2
    and lower(string_agg(c.component_surface || coalesce(c.linking_element_after, '')
      , '' order by c.component_position)) = lower(trim(p_lemma))
  order by count(*) desc
  limit 1
$$;

create or replace function public.d10_apply_verified_compound_projection()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_parts text[];
begin
  v_parts := public.d10_verified_compound_parts(new.lexeme_id, new.lemma);
  if coalesce(array_length(v_parts, 1), 0) >= 2 then
    new.is_compound := true;
    new.compound_parts := v_parts;
    new.headword := new.lemma;
    new.morphology_source_lemma := coalesce(new.morphology_source_lemma, new.lemma);
  end if;
  return new;
end;
$$;

drop trigger if exists d10_verified_compound_projection on public.lexeme_form_display_v2;
create trigger d10_verified_compound_projection
before insert or update on public.lexeme_form_display_v2
for each row execute function public.d10_apply_verified_compound_projection();

update public.lexeme_form_display_v2 f
set is_compound = true,
    compound_parts = public.d10_verified_compound_parts(f.lexeme_id, f.lemma),
    headword = f.lemma,
    morphology_source_lemma = coalesce(f.morphology_source_lemma, f.lemma)
where public.d10_verified_compound_parts(f.lexeme_id, f.lemma) is not null
  and (not f.is_compound or cardinality(f.compound_parts) < 2);
