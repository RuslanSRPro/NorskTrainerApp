DO $patch$
DECLARE def text:=pg_get_functiondef('private.refresh_homonym_count_v1()'::regprocedure);
BEGIN
 IF position('pg_advisory_xact_lock' IN def)>0 THEN RETURN; END IF;
 IF position('SELECT count(*) INTO n FROM public.lexemes' IN def)=0 THEN
  RAISE EXCEPTION 'homonym trigger definition changed';
 END IF;
 def:=replace(def,'SELECT count(*) INTO n FROM public.lexemes',
 'PERFORM pg_advisory_xact_lock(hashtextextended(k,20261101));
  SELECT count(*) INTO n FROM public.lexemes');
 EXECUTE def;
END $patch$;
