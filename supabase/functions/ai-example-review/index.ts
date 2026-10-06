import { withSupabase } from '@supabase/server';
import { loadSelectedContext, reviewGenerated, buildEnrichmentEvidence } from '../ai-enrichment-worker/pos-sense-guard.ts';
import { norwegianExample, linguisticText, createAiExampleBinding } from '../_shared/example-evidence.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (body: unknown, status = 200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
const idsValid = (v: unknown, max: number): v is string[] => Array.isArray(v) &&
  v.length >= 1 && v.length <= max && new Set(v).size === v.length && v.every(x=>typeof x==='string'&&uuid.test(x));
Deno.serve(withSupabase({auth:'secret:secretkey'}, async(req,ctx)=>{
  if(req.method!=='POST') return respond({ok:false,error:'USE_POST'},405);
  const body = await req.json().catch(()=>null);
  if(!body || !idsValid(body.lexeme_ids,2) || !idsValid(body.example_ids,2))
    return respond({ok:false,error:'EXPLICIT_1_2_LEXEMES_AND_1_2_EXAMPLES_REQUIRED'},400);
  const dryRun = body.dry_run !== false;
  const diagnoseOnly = body.diagnose_only === true;
  const manual=body.manual_review;
  if(manual!==undefined&&(!manual||typeof manual!=='object'||body.example_ids.length!==1||
    !['accepted','rejected'].includes(manual.status)||!linguisticText(manual.reviewer)||!linguisticText(manual.reason)||
    !Array.isArray(manual.references)||manual.references.length<1||manual.references.length>10||
    manual.references.some((x:unknown)=>typeof x!=='string'||!x.startsWith('https://'))||
    !linguisticText(manual.example_nb)||!linguisticText(manual.translation_uk)))
    return respond({ok:false,error:'EXPLICIT_MANUAL_REVIEW_REQUIRED'},400);
  const db: any = ctx.supabaseAdmin;
  try {
    const {data:lexemes,error:le} = await db.from('lexemes')
      .select('id,lemma,pos,verification_evidence').in('id',body.lexeme_ids);
    if(le || lexemes?.length!==body.lexeme_ids.length) throw Error('REVIEW_LEXEME_READ_FAILED');
    const {data:translations,error:te} = await db.from('entity_examples')
      .select('id,lexeme_id,expression_id,source,language_code,example_text,translation_uk,updated_at,enrichment_evidence')
      .in('id',body.example_ids).in('lexeme_id',body.lexeme_ids);
    if(te || translations?.length!==body.example_ids.length) throw Error('REVIEW_EXAMPLE_READ_FAILED');
    const targets: any[] = [];
    // Validate all identities before any model calls or writes.
    for(const row of translations){
      const l=lexemes.find((x:any)=>x.id===row.lexeme_id);
      if(!l || row.expression_id!==null || row.source!=='ai_fallback' || !norwegianExample(row) ||
        !linguisticText(row.translation_uk) || !row.updated_at) throw Error('REVIEW_EXAMPLE_NOT_ELIGIBLE');
      if(manual&&(manual.example_nb!==row.example_text||manual.translation_uk!==row.translation_uk))throw Error('REVIEW_MANUAL_PAIR_CHANGED');
      const context=await loadSelectedContext(l.verification_evidence,l.lemma,l.pos);
      targets.push({row,l,context,input:{ref:targets.length,lemma:l.lemma,pos:l.pos,context,missing:['example'],
        answer:{example_nb:row.example_text.trim(),example_translation_ua:row.translation_uk.trim()}}});
    }
    if(dryRun) return respond({ok:true,dry_run:true,candidates:targets.map(t=>({example_id:t.row.id,lexeme_id:t.l.id,
      lemma:t.l.lemma,pos:t.l.pos,language_code:t.row.language_code,text:t.row.example_text,translation_uk:t.row.translation_uk,
      article_id:JSON.parse(t.context).article_id,would_call_review:!manual,would_generate:false,manual_review:manual??null})),writes:0});
    const approved=new Map<number,Record<string,unknown>>();
    const rejected=new Map<number,Record<string,unknown>>();
    const decisions=manual?null:await reviewGenerated(targets.map(t=>t.input),(ref,e)=>approved.set(ref,e),(ref,e)=>rejected.set(ref,e));
    const processed:any[]=[];
    for(let ref=0;ref<targets.length;ref++){
      const t=targets[ref],context=JSON.parse(t.context);
      let decision:any;
      if(manual){
        decision={kind:'manual',status:manual.status,reason:manual.reason,reviewer:manual.reviewer,
          references:manual.references,prior_ai_rejection:manual.prior_ai_rejection??null,context,example_nb:t.row.example_text,translation_uk:t.row.translation_uk,
          manual_binding:{version:'d10_example_audit_v1',kind:'manual_example',lexeme_id:t.l.id,expression_id:null,
            lemma:t.l.lemma,pos:t.l.pos,dictionary:'bm',article_id:String(context.article_id),
            language_code:'nb',value:t.row.example_text.trim(),translation_language_code:'uk',translation_value:t.row.translation_uk.trim()}};
      }else if(decisions?.get(ref)!==null){
        const review=rejected.get(ref);
        if(!review)throw Error('REVIEW_REJECTION_PROOF_MISSING');
        decision={kind:'ai',status:'rejected',reason:review.reason,review,context,
          example_nb:t.row.example_text,translation_uk:t.row.translation_uk};
      }else{
        const evidence={...buildEnrichmentEvidence(t.context,approved.get(ref)),
          example_binding:createAiExampleBinding(t.context,approved.get(ref),{lexemeId:t.l.id,exampleNb:t.row.example_text,translationUk:t.row.translation_uk})};
        decision={kind:'ai',status:'accepted',reason:approved.get(ref)?.reason,context,evidence,
          example_nb:t.row.example_text,translation_uk:t.row.translation_uk};
      }
      if(diagnoseOnly){processed.push({example_id:t.row.id,status:decision.status,diagnostic_only:true,decision,writes:0});continue;}
      const {data,error}=await db.rpc('record_example_review_v1',{
        p_example_id:t.row.id,p_lexeme_id:t.l.id,p_lemma:t.l.lemma,p_pos:t.l.pos,
        p_example_nb:t.row.example_text,p_translation_uk:t.row.translation_uk,p_expected_updated_at:t.row.updated_at,
        p_article_id:String(context.article_id),p_decision:decision});
      processed.push(error?{example_id:t.row.id,status:'write_rejected',reason:'REVIEW_ROW_OR_SOURCE_CHANGED',writes:0}:
        {example_id:t.row.id,status:decision.status,review_recorded:true,kind:decision.kind,history_id:data.history_id,
          metadata_updated:data.metadata_updated,writes:1});
    }
    return respond({ok:processed.every(x=>x.status==='accepted'),dry_run:false,diagnose_only:diagnoseOnly,
      generated_count:0,examples_changed:0,processed,history_written:processed.reduce((n,x)=>n+x.writes,0)});
  }catch(e){const message=e instanceof Error?e.message:'REVIEW_FAILED';
    return respond({ok:false,error:/^(REVIEW_|AI_|SELECTED_ARTICLE_)/.test(message)?message:'REVIEW_FAILED'},500);}
}));
