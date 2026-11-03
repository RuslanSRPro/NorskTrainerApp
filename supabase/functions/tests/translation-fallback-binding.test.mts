import assert from 'node:assert/strict';
import { createTranslationBinding, boundAiReviewReason, publicationProofs, AI_QUALITY_VERSION, PUBLISHED_WITHOUT_EXPLANATION } from '../_shared/ai-review-binding.ts';
import { noArticleContext, buildEnrichmentEvidence } from '../ai-enrichment-worker/pos-sense-guard.ts';
const id='eadd338c-e163-49fa-8c8a-923f29c9e867';
const entity={entity_id:id,lemma:'frisk',pos:'noun'};
function exercise(context:string, articles:string[]) {
 const source=JSON.parse(context);
 const review={version:AI_QUALITY_VERSION,status:'accepted',provider:'gemini',model:'test',reason:'test only',reviewed_at:'2026-11-03T00:00:00Z',
 approved_proposal:{context:source,missing:['translation_en'],answer:{translation_en:['test equivalent']}}};
 const identity={lexemeId:id,languageCode:'en' as const,value:'test equivalent'};
 const evidence=buildEnrichmentEvidence(context,review,identity);
 const translation={locale:'en',value:identity.value,original_value:identity.value,lexeme_id:id,expression_id:null,provider:'ai_fallback',canonical:true,
 source_pos:'noun',translation_rank:1,translation_type:'primary',current_article_ids:articles,enrichment_evidence:evidence};
 assert.equal(boundAiReviewReason(entity,translation),null);
 assert.equal(boundAiReviewReason({...entity,pos:'adjective'},translation),'AI_REVIEW_IDENTITY_CHANGED');
 assert.equal(boundAiReviewReason(entity,{...translation,value:'changed'}),'AI_REVIEW_TEXT_CHANGED');
 assert.equal(boundAiReviewReason(entity,{...translation,current_article_ids:['999999']}),'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS');
 assert.throws(()=>createTranslationBinding(context,review,{...identity,value:'changed'}),/PROPOSAL_OR_IDENTITY/);
 return {review,identity};
}
exercise(noArticleContext('frisk','noun',{}, {allowEmpty:true,step:'none',note:'ordbokene_article_without_explanation',articleIds:['18087']}),['18087']);
for(const source of ['Ordbokene','NAOB','Lexin','Wiktionary']) {
 const evidence={ [source]:{status:'done',registered_entry:true,evidence:{pos_match:'match',requested_pos:'noun',canonical_query:'frisk'}}};
 const publications=publicationProofs(evidence,'frisk','noun');assert.equal(publications.length,1);
 exercise(noArticleContext('frisk','noun',{}, {allowEmpty:true,note:PUBLISHED_WITHOUT_EXPLANATION,publications}),[]);
 assert.equal(publicationProofs(evidence,'frisk','adjective').length,0);
 assert.equal(publicationProofs(evidence,'other','noun').length,0);
 evidence[source].evidence.pos_match='mismatch';assert.equal(publicationProofs(evidence,'frisk','noun').length,0);
 evidence[source].evidence.pos_match='match';evidence[source].registered_entry=false;assert.equal(publicationProofs(evidence,'frisk','noun').length,0);
}
const context=noArticleContext('frisk','noun',{}, {allowEmpty:true});
const review={version:AI_QUALITY_VERSION,status:'accepted',provider:'gemini',model:'test',reason:'test',reviewed_at:'2026-11-03T00:00:00Z',approved_proposal:{context:JSON.parse(context),missing:['translation_en'],answer:{translation_en:['test']}}};
assert.throws(()=>createTranslationBinding(context,review,{lexemeId:id,languageCode:'en',value:'test'}),/FALLBACK_BASIS_MISSING/);
console.log('PASS: fallback round trip, all four sources, POS/lemma/search rejection, changed translation and article, unconfirmed empty context');
