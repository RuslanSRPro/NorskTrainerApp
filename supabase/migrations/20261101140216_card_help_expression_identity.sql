DO $patch$
DECLARE def text:=pg_get_functiondef('public.get_card_help_context_v1(uuid)'::regprocedure);
BEGIN
 IF position('help_expression_identity' IN def)>0 THEN RETURN; END IF;
 def:=replace(def,'WITH card AS (SELECT id,lemma FROM public.lexemes WHERE id=p_lexeme_id)',
  'WITH card AS (SELECT id,lemma FROM public.lexemes WHERE id=p_lexeme_id
   UNION SELECT l.id,l.lemma FROM public.expression_catalog x JOIN public.lexemes l ON l.id=x.lexeme_id
    WHERE x.id=p_lexeme_id) /* help_expression_identity */');
 def:=replace(def,'ARRAY[p_lexeme_id]','ARRAY[(SELECT id FROM card LIMIT 1)]');
 def:=replace(def,'i.lexeme_id=p_lexeme_id','i.lexeme_id IN (SELECT id FROM card)');
 def:=replace(def,'x.lexeme_id=p_lexeme_id','x.lexeme_id IN (SELECT id FROM card)');
 EXECUTE def;
END $patch$;
