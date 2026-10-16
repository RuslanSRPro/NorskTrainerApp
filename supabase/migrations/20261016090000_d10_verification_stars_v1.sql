-- D10 16.10.2026 (agreed, step B part 2): one star rating on the server.
--
-- verification_status / verification_tier stay as they are: they are the
-- workflow state (a word becomes a card at rank >= 4, expression admission
-- needs status authoritative/multi_source). Nothing here changes them.
-- The stars are a separate rating, computed by one function from the stored
-- evidence, kept in public.verification_stars_v1 by triggers. The app shows
-- these stars (part 3).
--
-- Words (card part of speech known), agreed table:
--   5 / 4  Ordbøkene article of this part of speech (registered / structured)
--   4      NAOB article of this POS + Lexin or Wiktionary entry of this POS
--   3      only one of them
--   2      only mentions (NAOB search, Lexin/Wiktionary without POS, components)
--   1      nothing but AI
-- A source that shows the word only with ANOTHER part of speech does not count.
-- Språkrådet (agreed 16.10): a hit is a mention (2 stars), for words and
-- expressions; it never gives more. AI never raises stars.
-- Expressions: the same table without part of speech. Expression admission
-- itself is unchanged.
-- Evidence without the new pos fields (older checks): Lexin / Wiktionary /
-- NAOB count as before (lemma level); an Ordbøkene article without a part of
-- speech counts as one article signal (not 5 stars).
-- Read-only for everything else: no existing table or function is changed.

create or replace function private.d10_base_pos_v1(p_pos text)
returns text language sql immutable as $$
  select case
    when v is null or v = '' then null
    when v in ('noun','substantiv','subst') then 'noun'
    when v = 'verb' then 'verb'
    when v in ('adjective','adjektiv','adj') then 'adjective'
    when v in ('adverb','adv') then 'adverb'
    when v in ('preposition','preposisjon','prep') then 'preposition'
    when v in ('pronoun','pronomen','pron') then 'pronoun'
    when v in ('conjunction','konjunksjon','konj') then 'conjunction'
    when v in ('subjunction','subjunksjon','subj') then 'subjunction'
    when v in ('interjection','interjeksjon','interj') then 'interjection'
    when v in ('determiner','determinativ','det') then 'determiner'
    when v in ('numeral','tallord','number') then 'numeral'
    when v in ('proper_noun','proper noun','egennavn') then 'proper_noun'
    else null end
  from (select coalesce(nullif(split_part(lower(btrim(p_pos)), '_', 1), ''), lower(btrim(p_pos))) as v) x
$$;

create or replace function public.d10_verification_rating_v1(p_evidence jsonb, p_pos text)
returns jsonb language plpgsql immutable as $$
declare
  v_word boolean;
  v_card_pos text;
  v_src text;
  s jsonb;
  v_found boolean; v_reg boolean; v_whole boolean; v_usage boolean; v_comp boolean;
  v_oq text; v_pm text; v_basis text; v_rp_pos text;
  v_ord text := 'none'; v_ord_stars int := 0; v_sprak text := 'none';
  v_naob text := 'none'; v_lexin text := 'none'; v_wikt text := 'none';
  v_mention boolean := false;
  v_a boolean; v_b boolean; v_stars int;
begin
  v_card_pos := private.d10_base_pos_v1(p_pos);
  v_word := coalesce(lower(btrim(p_pos)), '') not in ('', 'expression', 'unknown')
            and lower(btrim(p_pos)) not like 'expression%';

  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object' then
    return jsonb_build_object('version', 'd10_stars_v1', 'stars', 1, 'kind',
      case when v_word then 'word' else 'expression' end, 'basis', 'no_evidence');
  end if;

  foreach v_src in array array['Ordbokene', 'NAOB', 'Lexin', 'Wiktionary', 'Språkrådet'] loop
    s := p_evidence -> v_src;
    if s is null or jsonb_typeof(s) <> 'object' then continue; end if;
    v_found := (s ->> 'found') = 'true';
    if not v_found then continue; end if;
    v_reg   := (s ->> 'registered_entry') = 'true';
    v_whole := (s ->> 'whole_unit_match') = 'true';
    v_usage := (s ->> 'usage_match') = 'true';
    v_comp  := (s ->> 'component_match') = 'true';
    v_oq    := coalesce(s -> 'evidence' ->> 'original_quality', s ->> 'quality');
    v_pm    := s -> 'evidence' ->> 'pos_match';          -- null: older check
    v_basis := s -> 'evidence' ->> 'pos_basis';
    v_rp_pos := s -> 'evidence' -> 'raw_preview' ->> 'pos';

    if v_src = 'Språkrådet' then
      -- a mention only, for words and expressions
      v_sprak := 'mention'; v_mention := true;
      continue;
    end if;

    if v_comp or v_oq in ('component_match', 'search_page_match') then v_mention := true; end if;

    if v_src = 'Ordbokene' then
      if v_reg and v_oq = 'registered_entry' then v_ord_stars := 5;
      elsif v_whole and v_oq = 'structured_entry_match' then v_ord_stars := 4;
      end if;
      if v_ord_stars > 0 then
        if not v_word then
          v_ord := 'article';
        elsif v_pm = 'mismatch'
           or (v_rp_pos is not null and private.d10_base_pos_v1(v_rp_pos) is distinct from v_card_pos) then
          v_ord := 'other_pos'; v_ord_stars := 0;
        elsif v_pm = 'match' or (v_rp_pos is not null and private.d10_base_pos_v1(v_rp_pos) = v_card_pos) then
          v_ord := 'article';
        else
          v_ord := 'article_pos_unknown'; v_ord_stars := 0;
        end if;
      end if;

    elsif v_src = 'NAOB' then
      if not v_word then
        v_naob := case when v_whole and v_oq in ('registered_entry', 'exact_expression_match') then 'article' else 'mention' end;
      elsif v_pm = 'mismatch' then v_naob := 'other_pos';
      elsif v_pm = 'match' then
        v_naob := case when v_reg or v_basis in ('naob_article_heading', 'naob_search_listing') then 'article' else 'mention' end;
      elsif v_pm = 'unknown' then v_naob := 'mention';
      else v_naob := case when v_reg then 'article' else 'mention' end;   -- older check
      end if;

    elsif v_src = 'Lexin' then
      if not v_word then
        v_lexin := case when v_reg or v_usage then 'entry' else 'mention' end;
      elsif v_pm = 'mismatch' then v_lexin := 'other_pos';
      elsif v_pm = 'match' then v_lexin := 'entry';
      elsif v_pm = 'unknown' then v_lexin := 'mention';
      else v_lexin := case when v_reg or v_usage then 'entry' else 'mention' end;
      end if;

    elsif v_src = 'Wiktionary' then
      if not v_word then
        v_wikt := case when v_oq in ('registered_entry', 'exact_expression_match') then 'entry' else 'mention' end;
      elsif v_pm = 'mismatch' then v_wikt := 'other_pos';
      elsif v_pm = 'match' then
        v_wikt := case when v_reg or v_oq = 'exact_expression_match' then 'entry' else 'mention' end;
      elsif v_pm = 'unknown' then v_wikt := 'mention';
      else v_wikt := case when v_reg then 'entry' else 'mention' end;
      end if;
    end if;
  end loop;

  v_a := v_naob = 'article' or v_ord = 'article_pos_unknown';
  v_b := v_lexin = 'entry' or v_wikt = 'entry';
  v_mention := v_mention or 'mention' in (v_naob, v_lexin, v_wikt);
  v_stars := case
    when v_ord = 'article' then v_ord_stars
    when v_a and v_b then 4
    when v_a or v_b then 3
    when v_mention then 2
    else 1 end;

  return jsonb_build_object(
    'version', 'd10_stars_v1',
    'stars', v_stars,
    'kind', case when v_word then 'word' else 'expression' end,
    'card_pos', v_card_pos,
    'ordbokene', v_ord, 'naob', v_naob, 'lexin', v_lexin, 'wiktionary', v_wikt,
    'sprakradet', v_sprak,
    'note', case when v_stars in (3, 4) and v_ord <> 'article' then 'no_ordbokene_article' end);
end;
$$;

create table if not exists public.verification_stars_v1 (
  entity_type text not null check (entity_type in ('lexeme', 'expression')),
  entity_id uuid not null,
  stars smallint not null check (stars between 1 and 5),
  rating jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);
alter table public.verification_stars_v1 enable row level security;
drop policy if exists verification_stars_v1_read on public.verification_stars_v1;
create policy verification_stars_v1_read on public.verification_stars_v1
  for select to authenticated, anon using (true);
grant select on public.verification_stars_v1 to authenticated, anon;

create or replace function private.d10_stars_upsert_v1(p_type text, p_id uuid, p_evidence jsonb, p_pos text)
returns void language plpgsql security definer set search_path = public, private as $$
declare v jsonb := public.d10_verification_rating_v1(p_evidence, p_pos);
begin
  insert into public.verification_stars_v1 (entity_type, entity_id, stars, rating, computed_at)
  values (p_type, p_id, (v ->> 'stars')::smallint, v, now())
  on conflict (entity_type, entity_id) do update
    set stars = excluded.stars, rating = excluded.rating, computed_at = excluded.computed_at
    where verification_stars_v1.rating is distinct from excluded.rating;
end;
$$;

-- Triggers: AFTER, only on evidence / pos changes; they never touch the row.
-- A failure here must not block the pipeline: it is logged as a WARNING.
create or replace function private.d10_stars_lexeme_trg_v1()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'DELETE' then
    delete from public.verification_stars_v1 where entity_type = 'lexeme' and entity_id = old.id;
    return old;
  end if;
  begin
    perform private.d10_stars_upsert_v1('lexeme', new.id, new.verification_evidence, new.pos);
  exception when others then
    raise warning 'd10 stars (lexeme %): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function private.d10_stars_expression_trg_v1()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'DELETE' then
    delete from public.verification_stars_v1 where entity_type = 'expression' and entity_id = old.id;
    return old;
  end if;
  begin
    perform private.d10_stars_upsert_v1('expression', new.id, new.verification_evidence, 'expression');
  exception when others then
    raise warning 'd10 stars (expression %): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_d10_stars_lexeme_v1 on public.lexemes;
create trigger trg_d10_stars_lexeme_v1
  after insert or update of verification_evidence, pos or delete on public.lexemes
  for each row execute function private.d10_stars_lexeme_trg_v1();

drop trigger if exists trg_d10_stars_expression_v1 on public.expression_catalog;
create trigger trg_d10_stars_expression_v1
  after insert or update of verification_evidence or delete on public.expression_catalog
  for each row execute function private.d10_stars_expression_trg_v1();

-- Backfill: writes only public.verification_stars_v1 (no lexeme / expression
-- row is updated, so none of their triggers runs). Re-running is a no-op.
insert into public.verification_stars_v1 (entity_type, entity_id, stars, rating)
select 'lexeme', l.id, (r ->> 'stars')::smallint, r
from public.lexemes l
cross join lateral (select public.d10_verification_rating_v1(l.verification_evidence, l.pos) as r) x
on conflict (entity_type, entity_id) do update
  set stars = excluded.stars, rating = excluded.rating, computed_at = now()
  where verification_stars_v1.rating is distinct from excluded.rating;

insert into public.verification_stars_v1 (entity_type, entity_id, stars, rating)
select 'expression', e.id, (r ->> 'stars')::smallint, r
from public.expression_catalog e
cross join lateral (select public.d10_verification_rating_v1(e.verification_evidence, 'expression') as r) x
on conflict (entity_type, entity_id) do update
  set stars = excluded.stars, rating = excluded.rating, computed_at = now()
  where verification_stars_v1.rating is distinct from excluded.rating;

do $$ begin raise notice 'd10 verification stars v1 installed'; end $$;
