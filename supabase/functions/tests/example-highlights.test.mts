import test from 'node:test';
import assert from 'node:assert/strict';
import { fragmentRanges, proposalHighlights, reviewedHighlights, storedHighlightRanges } from '../_shared/example-highlights.ts';
const answer = { example_nb: 'Politiet grep tyven på fersk gjerning.', example_translation_ua: 'Поліція спіймала злодія на гарячому.',
  example_highlights_nb: ['grep', 'på fersk gjerning'], example_highlights_uk: ['спіймала', 'на гарячому'] };
test('discontinuous expression leaves intervening object uncoloured',()=>{
 const ranges=fragmentRanges(answer.example_nb,answer.example_highlights_nb)!;
 assert.deepEqual(ranges.map(r=>answer.example_nb.slice(r.start,r.end)),answer.example_highlights_nb);
 assert(!ranges.some(r=>answer.example_nb.slice(r.start,r.end).includes('tyven')));
});
test('reject invented accent, ellipsis, partial word, overlap, ambiguous occurrence',()=>{
 for(const [text,fragments] of [['спіймала',['спійма́ла']],['grep tyven på fersk gjerning',['grep ... på fersk gjerning']],['griper',['gripe']],['grep ham',['grep ham','ham']],['grep og grep',['grep']]] as const)
 assert.equal(fragmentRanges(text,fragments),null);
});
test('Ukrainian zero copula can explicitly have no highlight',()=>{
 assert.deepEqual(proposalHighlights({...answer,example_nb:'Hun er hjemme.',example_translation_ua:'Вона вдома.',example_highlights_nb:['er'],example_highlights_uk:[]}).uk.fragments,[]);
 assert.throws(()=>proposalHighlights({...answer,example_highlights_uk:undefined}));
});
test('only exact reviewed sentence pair can be stored; stale text not coloured',()=>{
 const review={status:'accepted',approved_proposal:{answer}};
 const h=reviewedHighlights(review,answer.example_nb,answer.example_translation_ua);
 assert.throws(()=>reviewedHighlights(review,answer.example_nb,'Інший текст'));
 assert.throws(()=>reviewedHighlights({...review,status:'rejected'},answer.example_nb,answer.example_translation_ua));
 const evidence={review,example_highlights:h};
 assert.equal(storedHighlightRanges(answer.example_nb,evidence,'nb')?.length,2);
 assert.equal(storedHighlightRanges(answer.example_nb,{...evidence,example_highlights:{uk:h.uk,nb:h.nb,version:1}},'nb')?.length,2);
 assert.equal(storedHighlightRanges('Другий приклад',evidence,'uk'),null);
});
