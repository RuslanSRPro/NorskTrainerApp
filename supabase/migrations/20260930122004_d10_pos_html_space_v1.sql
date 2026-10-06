-- D10 POS HTML whitespace v1. No data updates or job resets.
BEGIN;
CREATE OR REPLACE FUNCTION public.extract_pos_from_source_evidence(
  p_verification_evidence jsonb,
  p_lemma text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $function$
declare
  v_naob jsonb;
  v_lexin jsonb;
  v_preview text;
  v_lemma_norm text;
  v_pos text;
begin
  if p_verification_evidence is null or p_lemma is null then
    return null;
  end if;

  v_lemma_norm := lower(trim(p_lemma));
  if v_lemma_norm = '' then
    return null;
  end if;

  v_naob := p_verification_evidence -> 'NAOB';
  if v_naob is not null then
    v_preview := lower(coalesce(
      v_naob -> 'evidence' ->> 'raw_preview',
      v_naob ->> 'raw_preview'
    ));
    if v_preview is not null then
      -- Decode only whitespace entities. Keep the exact lemma-to-POS anchor.
      v_preview := replace(v_preview, chr(160), ' ');
      v_preview := regexp_replace(v_preview,
        '&nbsp;|&#0*160;|&#x0*a0;', ' ', 'g');
      if v_preview ~ ('\m' || v_lemma_norm || '\s+verb\M') then return 'verb';
      elsif v_preview ~ ('\m' || v_lemma_norm || '\s+substantiv\M') then return 'noun';
      elsif v_preview ~ ('\m' || v_lemma_norm || '\s+adjektiv\M') then return 'adjective';
      elsif v_preview ~ ('\m' || v_lemma_norm || '\s+adverb\M') then return 'adverb';
      end if;
    end if;
  end if;

  v_lexin := p_verification_evidence -> 'Lexin';
  if v_lexin is not null then
    v_preview := coalesce(
      v_lexin -> 'evidence' ->> 'raw_preview',
      v_lexin ->> 'raw_preview'
    );
    if v_preview is not null then
      v_pos := (regexp_match(
        v_preview,
        '"type":"[EN]-kat"[^}]*?"text":"(verb|substantiv|adjektiv|adverb)"'
      ))[1];
      if v_pos = 'verb' then return 'verb';
      elsif v_pos = 'substantiv' then return 'noun';
      elsif v_pos = 'adjektiv' then return 'adjective';
      elsif v_pos = 'adverb' then return 'adverb';
      end if;
    end if;
  end if;

  return null;
end;
$function$;
COMMIT;
