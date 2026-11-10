import test from 'node:test';
import assert from 'node:assert/strict';
import { expressionContext } from '../ai-enrichment-worker/expression-quality.ts';
import { reviewExpressions } from '../ai-enrichment-worker/expression-ai.ts';
const row={id:'expr',lemma:'gripe dypt i [pungen|lommene]',pos:'expression',raw_sources:{source:'NAOB',source_type:'uttrykk',glosses:[{type:'direct',naob_form:'gripe dypt i pungen/lommene',slug:'gripe',context:'overført',gloss:'betale, gi en betydelig sum penger'}]},verification_evidence:{NAOB:{status:'done',whole_unit_match:true}}};
test('same NAOB alternatives and figurative usage retained, wrong expression refused',()=>{
 assert.match(JSON.parse(expressionContext(row)).definitions[0],/^\[overført\]/);
 assert.throws(()=>expressionContext({...row,lemma:'gripe feil'}),/OWN_DEFINITION_REQUIRED/);
});
test('each quality dimension must be true; identity and missing verdict fail closed',async()=>{
 const originalFetch=globalThis.fetch, originalDeno=(globalThis as any).Deno;
 (globalThis as any).Deno={env:{get:()=> 'test'}};
 const context=expressionContext(row);
 const input={ref:0,lemma:row.lemma,pos:'expression',context,missing:['translation_ua'],answer:{translation_ua:['витратити значну суму']}};
 const good={ref:0,lemma:row.lemma,meaning_uk:true,meaning_en:true,natural_uk:true,example_sense:true,example_translation:true,highlights:true,reason:'Fits definition'};
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({items:[{...good,reason:''}]})}]}]}));
  assert.equal((await reviewExpressions([input])).get(0),null,'all checks passing needs no rejection reason');
  for(const bad of ['meaning_uk','meaning_en','natural_uk','example_sense','example_translation','highlights','lemma','missing']){
   const verdict={...good,...(bad==='lemma'?{lemma:'wrong'}:bad==='missing'?{}:{[bad]:false})};
   globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({items:bad==='missing'?[]:[verdict]})}]}]}));
   assert.equal((await reviewExpressions([input])).get(0),'AI_POS_SENSE_REVIEW_REJECTED');
  }
 }finally{globalThis.fetch=originalFetch;(globalThis as any).Deno=originalDeno;}
});
