-- R061: keep existing read behavior while removing public control-plane writes.
-- Narrow SELECT separately after all SQL and Edge readers are inventoried.

GRANT ALL PRIVILEGES ON TABLE
  public.grammar_runtime_releases,
  public.grammar_runtime_release_rules,
  public.grammar_rule_triggers,
  public.grammar_rule_sources
TO service_role;

REVOKE ALL PRIVILEGES ON TABLE
  public.grammar_runtime_releases,
  public.grammar_runtime_release_rules,
  public.grammar_rule_triggers,
  public.grammar_rule_sources
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.grammar_runtime_releases,
  public.grammar_runtime_release_rules,
  public.grammar_rule_triggers,
  public.grammar_rule_sources
TO anon, authenticated;

ALTER TABLE public.grammar_runtime_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_runtime_release_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_rule_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_rule_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY grammar_runtime_releases_read_v1
  ON public.grammar_runtime_releases FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY grammar_runtime_release_rules_read_v1
  ON public.grammar_runtime_release_rules FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY grammar_rule_triggers_read_v1
  ON public.grammar_rule_triggers FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY grammar_rule_sources_read_v1
  ON public.grammar_rule_sources FOR SELECT TO anon, authenticated
  USING (true);

DO $verify$
DECLARE
  v_table text;
  v_role text;
  v_oid oid;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'grammar_runtime_releases',
    'grammar_runtime_release_rules',
    'grammar_rule_triggers',
    'grammar_rule_sources'
  ] LOOP
    v_oid := to_regclass('public.' || v_table);
    IF v_oid IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_oid) THEN
      RAISE EXCEPTION 'R061 RLS missing: %', v_table;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF NOT has_table_privilege(v_role, v_oid, 'SELECT')
         OR has_table_privilege(v_role, v_oid, 'INSERT')
         OR has_table_privilege(v_role, v_oid, 'UPDATE')
         OR has_table_privilege(v_role, v_oid, 'DELETE')
         OR has_table_privilege(v_role, v_oid, 'TRUNCATE') THEN
        RAISE EXCEPTION 'R061 privilege mismatch: %.%', v_role, v_table;
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role', v_oid, 'SELECT')
       OR NOT has_table_privilege('service_role', v_oid, 'INSERT')
       OR NOT has_table_privilege('service_role', v_oid, 'UPDATE')
       OR NOT has_table_privilege('service_role', v_oid, 'DELETE') THEN
      RAISE EXCEPTION 'R061 service privilege mismatch: %', v_table;
    END IF;
  END LOOP;
END;
$verify$;
