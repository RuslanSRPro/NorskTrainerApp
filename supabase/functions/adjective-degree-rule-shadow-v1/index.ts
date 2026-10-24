import { handleAdjectiveDegreeShadowV1 } from "../_shared/nlp/adjective-degree-shadow-handler-v1.ts";
import type { PositiveDisplayRowV1 } from "../_shared/nlp/adjective-degree-display-row-adapter-v1.ts";

Deno.serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return Response.json({ ok: false, error: "runtime_configuration_missing" }, { status: 503 });
  return handleAdjectiveDegreeShadowV1(request, key, async (lexemeId) => {
    const query = new URL(`${url}/rest/v1/lexeme_form_display_v2`);
    query.searchParams.set("select", "lexeme_id,snapshot_id,dictionary_code,article_id,pos,lemma,form_key,primary_values,article_ids,evidence_ids");
    query.searchParams.set("lexeme_id", `eq.${lexemeId}`);
    query.searchParams.set("form_key", "eq.positive_singular_indefinite_common");
    query.searchParams.set("dictionary_code", "eq.bm");
    query.searchParams.set("limit", "2");
    const response = await fetch(query, { method: "GET", headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error("positive_source_read_failed");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("positive_source_shape_invalid");
    return rows as PositiveDisplayRowV1[];
  });
});
