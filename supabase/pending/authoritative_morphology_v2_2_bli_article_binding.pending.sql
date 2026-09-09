-- D10 / pending only: bind the ordinary learner lexeme "bli" to BM 6390.
-- BM 6460 is a distinct same-lemma/POS homograph meaning "drukne" and must
-- remain outside this learner lexeme's morphology snapshot.

do $block$
declare
  v_inserted_count integer;
begin
  insert into private.authoritative_morphology_article_bindings_v2 (
    lexeme_id,
    dictionary_code,
    article_id,
    normalized_lemma,
    pos,
    evidence_ids,
    provider_version,
    evidence
  )
  select
    lexeme.id,
    'bm',
    6390,
    'bli',
    'verb',
    array[
      'ordbokene:bm:6390',
      'manual:lexeme-semantic-binding:bli-become-stay-passive'
    ]::text[],
    'authoritative-article-binding/v1',
    jsonb_build_object(
      'decision', 'ordinary_bli_become_stay_passive',
      'acceptedArticleId', 6390,
      'rejectedHomographArticleIds', jsonb_build_array(6460),
      'learnerMeaning', jsonb_build_object(
        'translationUa', lexeme.translation_ua,
        'translationEn', lexeme.translation_en,
        'notes', lexeme.notes,
        'example', lexeme.example,
        'verificationVersion', lexeme.verification_version
      ),
      'reason',
        'learner meaning become/stay/passive matches BM 6390; BM 6460 means drukne'
    )
  from public.lexemes as lexeme
  where lexeme.id = 'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0'::uuid
    and lexeme.lemma = 'bli'
    and lexeme.pos = 'verb';

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> 1 then
    raise exception using
      errcode = '55000',
      message = 'BLI_ARTICLE_BINDING_NOT_CREATED';
  end if;
end;
$block$;
