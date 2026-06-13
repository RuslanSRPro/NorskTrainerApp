insert into lexemes (
  lemma,
  pos,
  display_form,
  source,
  verification_status,
  verification_tier,
  created_at,
  updated_at
)
values (
  'glede',
  'verb',
  'glede',
  'manual_morphology_bootstrap',
  'promoted',
  'dictionary_match',
  now(),
  now()
)
on conflict do nothing;

insert into verb_forms (
  lexeme_id,
  infinitiv,
  presens,
  preteritum,
  perfektum,
  gruppe,
  source_verified,
  created_at
)
select
  l.id,
  'glede',
  'gleder',
  'gledet',
  'gledet',
  'weak',
  'manual_morphology_bootstrap',
  now()
from lexemes l
where l.lemma = 'glede'
  and not exists (
    select 1
    from verb_forms v
    where v.lexeme_id = l.id
  );

insert into lexeme_form_variants (
  lexeme_id,
  pos,
  form_type,
  value,
  normalized_value,
  is_primary,
  is_accepted,
  variant_type,
  source_verified,
  verification_status,
  confidence,
  evidence,
  created_at,
  updated_at
)
select
  l.id,
  'verb',
  x.form_type,
  x.value,
  x.value,
  true,
  true,
  'canonical',
  'manual_morphology_bootstrap',
  'promoted',
  1,
  jsonb_build_object(
    'source', 'bootstrap_glede_verb_forms'
  ),
  now(),
  now()
from lexemes l
cross join (
  values
    ('infinitiv', 'glede'),
    ('presens', 'gleder'),
    ('preteritum', 'gledet'),
    ('perfektum', 'gledet')
) as x(form_type, value)
where l.lemma = 'glede'
  and not exists (
    select 1
    from lexeme_form_variants v
    where v.lexeme_id = l.id
      and v.normalized_value = x.value
  );