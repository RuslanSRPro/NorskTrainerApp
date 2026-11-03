DO $patch$
DECLARE def text:=pg_get_functiondef('public.d10_synonym_source_context_v1(uuid)'::regprocedure);
BEGIN
 IF position('ORDER BY ord LIMIT 8' IN def)=0 THEN RAISE EXCEPTION 'context limit anchor changed'; END IF;
 EXECUTE replace(def,'ORDER BY ord LIMIT 8','ORDER BY ord LIMIT 12');
END $patch$;
