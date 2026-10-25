import { handleAdjectiveDegreeSqlShadowV1 } from "./handler.ts";

Deno.serve((request) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!url || !serviceRoleKey)
    return Response.json({ ok: false, error: "runtime_configuration_missing" }, { status: 503 });
  return handleAdjectiveDegreeSqlShadowV1(request, serviceRoleKey, secretKeysJson, async (lexemeId) => {
    const response = await fetch(`${url}/rest/v1/rpc/run_adjective_degree_rule_first_shadow_v1`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json" },
      body: JSON.stringify({ p_lexeme_id: lexemeId }),
    });
    if (!response.ok) throw new Error("sql_shadow_call_failed");
    return await response.json();
  });
});
