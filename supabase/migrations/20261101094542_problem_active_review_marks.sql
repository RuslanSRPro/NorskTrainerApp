BEGIN;
DO $patch$
DECLARE def text:=pg_get_functiondef('private.d10_problem_cards_all_v4()'::regprocedure);
BEGIN
 IF position('LEFT JOIN private.d10_lexin_r9_review_v1' IN def)>0 THEN RETURN; END IF;
 IF position('r.reason review_reason' IN def)=0 OR position('OR d.lexeme_id IS NOT NULL)' IN def)=0 THEN
  RAISE EXCEPTION 'problem list definition differs; no change applied';
 END IF;
 def:=replace(def,'r.reason review_reason','coalesce(r.reason,lr.reason) review_reason');
 def:=replace(def,'LEFT JOIN private.d10_deferred_enrichment_v1 d ON d.lexeme_id=c.id',
  'LEFT JOIN private.d10_lexin_r9_review_v1 lr ON lr.lexeme_id=c.id
 LEFT JOIN private.d10_deferred_enrichment_v1 d ON d.lexeme_id=c.id');
 def:=replace(def,'OR d.lexeme_id IS NOT NULL)',
  'OR d.lexeme_id IS NOT NULL OR r.lexeme_id IS NOT NULL OR lr.lexeme_id IS NOT NULL)');
 EXECUTE def;
END $patch$;
COMMIT;
