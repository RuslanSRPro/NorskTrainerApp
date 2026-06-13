update lexemes
set
  pos = 'verb',
  updated_at = now()
where lemma = 'må'
  and (pos is null or pos = 'unknown');

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
  'må',
  'må',
  'måtte',
  'måttet',
  'modal',
  'manual_modal_bootstrap',
  now()
from lexemes l
where l.lemma = 'må'
  and not exists (
    select 1
    from verb_forms v
    where v.lexeme_id = l.id
  );