import { withSupabase } from "@supabase/server";
import { buildAuditReport, evaluateAuditCompletion, type ReviewItem } from "../_shared/completion-contract/v1/audit-report.ts";
import type { SnapshotRpcResult } from "../_shared/completion-contract/v1/runtime.ts";

import { buildExampleAudit } from '../_shared/example-audit.ts';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: {"cache-control":"no-store"} });
}

Deno.serve(withSupabase({ auth: "secret:secretkey" }, async (request, context) => {
  if (request.method !== "POST") return json({ok:false,error:"USE_POST"},405);
  let body;
  try { body = await request.json(); }
  catch { return json({ok:false,error:"INVALID_JSON"},400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof body.job_id !== "string" || !UUID.test(body.job_id.trim()))
    return json({ok:false,error:"JOB_ID_REQUIRED"},400);
  if (body.heal === true || (body.mode !== undefined && body.mode !== "audit_report"))
    return json({ok:false,error:"READ_ONLY_REPORT_REQUIRED"},400);
  const jobId = body.job_id.trim();
  // Generated DB types do not cover the existing internal RPC/table.
  const admin: any = context.supabaseAdmin;
  try {
    const {completion, content} = await evaluateAuditCompletion(async page => {
      const {data, error} = await admin.rpc("get_completion_evidence_snapshot_v1", {
        p_job_id:page.job_id, p_cursor:page.cursor, p_limit:page.limit,
        p_expected_snapshot_token:page.expected_snapshot_token,
      });
      if (error) throw new Error("REPORT_SNAPSHOT_FAILED");
      return data as SnapshotRpcResult;
    }, jobId);
    const ids = completion.unresolved_items.map(item => (item as {item_id:string}).item_id);
    let reviews: ReviewItem[] = [];
    if (ids.length > 0) {
      const {data,error} = await admin.from("lexeme_processing_items")
        .select("id,normalized_lemma,pos,current_stage,status,lexeme_id,expression_id,result_summary")
        .eq("job_id",jobId).in("id",ids);
      if (error) throw new Error("REPORT_CANDIDATE_READ_FAILED");
      reviews = data ?? [];
    }
    const lexemeIds=content.assessments.filter(a=>a.entity_kind==='lexeme').map(a=>a.entity_id);
    const {data:exampleData,error:exampleError}=await admin.rpc('get_example_audit_v1',{p_job_id:jobId,p_lexeme_ids:lexemeIds});
    if(exampleError)throw Error('REPORT_EXAMPLE_AUDIT_FAILED');
    if(exampleData?.lexemes?.length!==new Set(lexemeIds).size||exampleData.lexemes.some((l:any)=>!lexemeIds.includes(l.id)))throw Error('REPORT_EXAMPLE_SCOPE_CHANGED');
    return json({ok:true,job_id:jobId,mode:"audit_report",report:{...buildAuditReport(completion,reviews,content),
      examples:buildExampleAudit(exampleData)}});
  } catch (error) {
    // Do not expose request headers, credentials or internal database errors.
    const message = error instanceof Error ? error.message : "REPORT_FAILED";
    const known = /^(REPORT_|SNAPSHOT_|EXECUTION_|INVALID_|TERMINAL_|MAX_PAGES_|ASSESSMENT_|NON_CONTIGUOUS_|EARLY_TERMINAL_|INCOMPLETE_|DUPLICATE_ENTITY)/;
    return json({ok:false,error:known.test(message) ? message : "REPORT_FAILED"},
      message.includes("SNAPSHOT_CHANGED") ? 409 : 500);
  }
}));
