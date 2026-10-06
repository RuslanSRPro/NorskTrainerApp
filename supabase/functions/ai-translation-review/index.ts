import { withSupabase } from '@supabase/server';
import { loadSelectedContext, reviewGenerated, buildEnrichmentEvidence } from '../ai-enrichment-worker/pos-sense-guard.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (body: unknown, status = 200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
const idsValid = (v: unknown, max: number): v is string[] => Array.isArray(v) &&
  v.length >= 1 && v.length <= max && new Set(v).size === v.length && v.every(x=>typeof x==='string'&&uuid.test(x));
Deno.serve(withSupabase({auth:'secret:secretkey'}, async(req,ctx)=>{
  if(req.method!=='POST') return respond({ok:false,error:'USE_POST'},405);
  const body = await req.json().catch(()=>null);
  if(!body || !idsValid(body.lexeme_ids,2) || !idsValid(body.translation_ids,4))
    return respond({ok:false,error:'EXPLICIT_1_2_LEXEMES_AND_1_4_TRANSLATIONS_REQUIRED'},400);
  const dryRun = body.dry_run !== false;
  const diagnoseOnly = body.diagnose_only === true;
  const db: any = ctx.supabaseAdmin;
  try {
    const {data:lexemes,error:le} = await db.from('lexemes')
      .select('id,lemma,pos,verification_evidence').in('id',body.lexeme_ids);
    if(le || lexemes?.length!==body.lexeme_ids.length) throw Error('REVIEW_LEXEME_READ_FAILED');
    const {data:translations,error:te} = await db.from('entity_translations')
      .select('id,lexeme_id,expression_id,source,source_pos,language_code,translation,translation_type,translation_rank,canonical_translation,canonicalization_metadata')
      .in('id',body.translation_ids).in('lexeme_id',body.lexeme_ids);
    if(te || translations?.length!==body.translation_ids.length) throw Error('REVIEW_TRANSLATION_READ_FAILED');
    const targets: any[] = [];
    // Validate all identities before any model calls or writes.
    for(const row of translations){
      const l=lexemes.find((x:any)=>x.id===row.lexeme_id);
      if(!l || row.expression_id!==null || row.source!=='ai_fallback' || row.source_pos!==l.pos ||
        row.translation_type!=='primary' || row.translation_rank!==1 ||
        !['en','uk'].includes(row.language_code) || typeof row.translation!=='string' || !row.translation.trim() ||
        (row.canonical_translation && row.canonical_translation.trim()!==row.translation.trim()) ||
        row.canonicalization_metadata?.status==='needs_review') throw Error('REVIEW_TRANSLATION_NOT_ELIGIBLE');
      const context=await loadSelectedContext(l.verification_evidence,l.lemma,l.pos);
      const field=row.language_code==='uk'?'translation_ua':'translation_en';
      targets.push({row,l,context,input:{ref:targets.length,lemma:l.lemma,pos:l.pos,context,missing:[field],answer:{[field]:[row.translation.trim()]}}});
    }
    if(dryRun) return respond({ok:true,dry_run:true,candidates:targets.map(t=>({translation_id:t.row.id,lexeme_id:t.l.id,
      lemma:t.l.lemma,pos:t.l.pos,language_code:t.row.language_code,text:t.row.translation,
      article_id:JSON.parse(t.context).article_id,would_call_review:true,would_generate:false})),writes:0});
    const approved=new Map<number,Record<string,unknown>>();
    const rejected=new Map<number,Record<string,unknown>>();
    const decisions=await reviewGenerated(targets.map(t=>t.input),(ref,e)=>approved.set(ref,e),
      (ref,e)=>rejected.set(ref,e));
    const processed: any[]=[];
    for(let ref=0;ref<targets.length;ref++){
      const t=targets[ref];const reason=decisions.get(ref);
      if(reason!==null){processed.push({translation_id:t.row.id,lexeme_id:t.l.id,lemma:t.l.lemma,pos:t.l.pos,
        language_code:t.row.language_code,text:t.row.translation,article_id:JSON.parse(t.context).article_id,
        status:'rejected',reason:reason??'AI_REVIEW_MISSING',review:rejected.get(ref)??null,writes:0});continue;}
      const evidence=buildEnrichmentEvidence(t.context,approved.get(ref),{lexemeId:t.l.id,languageCode:t.row.language_code,value:t.row.translation.trim()});
      if(diagnoseOnly){processed.push({translation_id:t.row.id,status:'accepted',diagnostic_only:true,evidence,writes:0});continue;}
      const {data,error}=await db.rpc('bind_reviewed_ai_translation_v1',{
        p_translation_id:t.row.id,p_lexeme_id:t.l.id,p_lemma:t.l.lemma,p_pos:t.l.pos,
        p_language_code:t.row.language_code,p_value:t.row.translation.trim(),
        p_article_id:JSON.parse(t.context).article_id,p_evidence:evidence});
      processed.push(error?{translation_id:t.row.id,status:'write_rejected',reason:'REVIEW_ROW_OR_SOURCE_CHANGED',writes:0}:
        {translation_id:data,status:'review_bound',writes:1});
    }
    return respond({ok:processed.every(x=>x.status==='accepted'||x.status==='review_bound'),dry_run:false,
      diagnose_only:diagnoseOnly,generated_count:0,translations_changed:0,processed,
      metadata_written:processed.reduce((n,x)=>n+x.writes,0)});
  }catch(e){const message=e instanceof Error?e.message:'REVIEW_FAILED';
    return respond({ok:false,error:/^(REVIEW_|AI_|SELECTED_ARTICLE_)/.test(message)?message:'REVIEW_FAILED'},500);}
}));
