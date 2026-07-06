-- Dictionary Admission Gate V2
-- Controls which tokens may be promoted into lexemes.
-- Principle:
--   lexemes = clean learning dictionary
--   processing_items/source_checks = full text analysis trace
--
-- Default policy:
--   allow: noun, verb, adjective, adverb, expression
--   reject/review: function words, unknown POS, bad encoding, proper names, dialect/nynorsk candidates

create table if not exists public.dictionary_admission_rules (
  id uuid primary key default gen_random_uuid(),

  rule_type text not null,
  normalized_value text not null,

  pos text null,
  match_type text null,

  action text not null check (action in ('allow', 'reject', 'review')),
  reason text not null,

  priority integer not null default 100,
  is_active boolean not null default true,

  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_dictionary_admission_rules_key
on public.dictionary_admission_rules (
  rule_type,
  normalized_value,
  coalesce(pos, ''),
  coalesce(match_type, '')
);

create index if not exists idx_dictionary_admission_rules_lookup
on public.dictionary_admission_rules (
  is_active,
  normalized_value,
  priority
);

insert into public.dictionary_admission_rules
  (rule_type, normalized_value, pos, match_type, action, reason, priority, notes)
values
  -- Explicit function words: never promote as learning lexemes.
  ('function_word', 'en', null, 'token', 'reject', 'function_word_article', 10, 'Indefinite article / numeral'),
  ('function_word', 'ei', null, 'token', 'reject', 'function_word_article', 10, 'Indefinite article'),
  ('function_word', 'et', null, 'token', 'reject', 'function_word_article', 10, 'Indefinite article'),

  ('function_word', 'og', null, 'token', 'reject', 'function_word_conjunction', 10, 'Conjunction'),
  ('function_word', 'eller', null, 'token', 'reject', 'function_word_conjunction', 10, 'Conjunction'),
  ('function_word', 'men', null, 'token', 'reject', 'function_word_conjunction', 10, 'Conjunction'),

  ('function_word', 'som', null, 'token', 'reject', 'function_word_subjunction', 10, 'Relative marker / subjunction'),
  ('function_word', 'at', null, 'token', 'reject', 'function_word_subjunction', 10, 'Subjunction'),
  ('function_word', 'om', null, 'token', 'reject', 'function_word_subjunction', 10, 'Subjunction / preposition'),

  ('function_word', 'i', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'på', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'til', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'fra', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'av', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'for', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'med', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'ved', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),
  ('function_word', 'hos', null, 'token', 'reject', 'function_word_preposition', 10, 'Preposition'),

  ('function_word', 'jeg', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'du', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'han', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'hun', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'vi', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'dere', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'de', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'meg', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'deg', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'seg', null, 'token', 'reject', 'function_word_pronoun', 10, 'Reflexive pronoun'),
  ('function_word', 'oss', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun'),
  ('function_word', 'den', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun / determiner'),
  ('function_word', 'det', null, 'token', 'reject', 'function_word_pronoun', 10, 'Pronoun / determiner'),

  ('function_word', 'ikke', null, 'token', 'reject', 'function_word_particle', 10, 'Negation particle'),
  ('function_word', 'jo', null, 'token', 'reject', 'function_word_particle', 10, 'Particle'),
  ('function_word', 'da', null, 'token', 'reject', 'function_word_particle', 10, 'Particle / adverb'),
  ('function_word', 'så', null, 'token', 'reject', 'function_word_particle', 10, 'Particle / adverb'),
  ('function_word', 'også', null, 'token', 'reject', 'function_word_particle', 10, 'Particle / adverb'),

  -- Common modal / auxiliary verbs can still be real learning lexemes.
  -- Keep them allowed if POS is verb.
  ('allow_lexical', 'være', 'verb', 'token', 'allow', 'core_verb', 5, 'Core verb'),
  ('allow_lexical', 'ha', 'verb', 'token', 'allow', 'core_verb', 5, 'Core verb'),
  ('allow_lexical', 'kunne', 'verb', 'token', 'allow', 'core_verb', 5, 'Modal verb'),
  ('allow_lexical', 'skulle', 'verb', 'token', 'allow', 'core_verb', 5, 'Modal verb'),
  ('allow_lexical', 'måtte', 'verb', 'token', 'allow', 'core_verb', 5, 'Modal verb'),
  ('allow_lexical', 'ville', 'verb', 'token', 'allow', 'core_verb', 5, 'Modal verb'),
  ('allow_lexical', 'bli', 'verb', 'token', 'allow', 'core_verb', 5, 'Core verb')

on conflict do nothing;

create or replace function public.dictionary_admission_decision(
  p_lemma text,
  p_surface_form text default null,
  p_pos text default null,
  p_match_type text default 'token',
  p_verification_tier text default null
)
returns jsonb
language plpgsql
stable
as $function$
declare
  v_lemma text := lower(trim(coalesce(p_lemma, '')));
  v_surface text := lower(trim(coalesce(p_surface_form, '')));
  v_pos text := lower(trim(coalesce(p_pos, '')));
  v_match_type text := lower(trim(coalesce(p_match_type, 'token')));
  v_rule record;
begin
  if v_lemma = '' then
    return jsonb_build_object(
      'admit', false,
      'status', 'rejected',
      'reason', 'empty_lemma'
    );
  end if;

  -- Reject broken encoding before everything else.
  if v_lemma ~ '(Ã|Ð|Ñ)' or v_surface ~ '(Ã|Ð|Ñ)' then
    return jsonb_build_object(
      'admit', false,
      'status', 'rejected',
      'reason', 'bad_encoding'
    );
  end if;

  -- Reject one-letter tokens by default.
  if length(v_lemma) < 2 then
    return jsonb_build_object(
      'admit', false,
      'status', 'rejected',
      'reason', 'too_short'
    );
  end if;

  -- Proper-name / capitalized unknown heuristic.
  if p_surface_form is not null
     and p_surface_form ~ '^[A-ZÆØÅ]'
     and v_pos in ('', 'unknown')
     and v_lemma = lower(p_surface_form) then
    return jsonb_build_object(
      'admit', false,
      'status', 'review',
      'reason', 'possible_proper_name'
    );
  end if;

  -- Explicit registry rule lookup.
  select *
  into v_rule
  from public.dictionary_admission_rules r
  where r.is_active = true
    and r.normalized_value = v_lemma
    and (r.match_type is null or r.match_type = v_match_type)
    and (r.pos is null or r.pos = v_pos)
  order by r.priority asc
  limit 1;

  if found then
    return jsonb_build_object(
      'admit', v_rule.action = 'allow',
      'status',
        case
          when v_rule.action = 'allow' then 'allowed'
          when v_rule.action = 'review' then 'review'
          else 'rejected'
        end,
      'reason', v_rule.reason,
      'rule_id', v_rule.id,
      'rule_type', v_rule.rule_type
    );
  end if;

  -- Verified expressions are allowed.
  if v_match_type = 'expression' then
    return jsonb_build_object(
      'admit', true,
      'status', 'allowed',
      'reason', 'verified_expression'
    );
  end if;

  -- Main whitelist:
  -- only real learning lexical POS are auto-promoted.
  if v_pos in ('noun', 'verb', 'adjective', 'adverb') then
    return jsonb_build_object(
      'admit', true,
      'status', 'allowed',
      'reason', 'lexical_pos_whitelist'
    );
  end if;

  -- Unknown POS is never automatically admitted anymore.
  return jsonb_build_object(
    'admit', false,
    'status', 'review',
    'reason', 'unknown_pos_requires_review'
  );
end;
$function$;

comment on table public.dictionary_admission_rules is
'Registry controlling which tokens may be promoted into the clean learning dictionary.';

comment on function public.dictionary_admission_decision(text, text, text, text, text) is
'Returns JSON admission decision for dictionary promotion: allowed/review/rejected.';