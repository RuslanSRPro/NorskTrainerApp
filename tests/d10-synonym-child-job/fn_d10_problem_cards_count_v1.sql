CREATE OR REPLACE FUNCTION public.d10_problem_cards_count_v1()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT count(*)::integer FROM public.d10_problem_cards_v1(1000);
$function$

