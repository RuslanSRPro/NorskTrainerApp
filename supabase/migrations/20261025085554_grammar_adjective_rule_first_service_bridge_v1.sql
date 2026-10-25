-- Only a trusted service-role caller can bridge PostgREST to the private pilot.
create function public.run_adjective_degree_rule_first_shadow_v1(p_lexeme_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $function$
  select grammar_pilot.execute_adjective_degree_rule_first_v1(p_lexeme_id);
$function$;

revoke all on function public.run_adjective_degree_rule_first_shadow_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.run_adjective_degree_rule_first_shadow_v1(uuid)
  to service_role;
