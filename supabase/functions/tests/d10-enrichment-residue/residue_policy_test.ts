import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {isResidueRetryable,residueRetryDelaySeconds} from '../../_shared/d10-enrichment-residue-policy.ts';

Deno.test('classifies each aggregate item from its own error',()=>{
  assertEquals(isResidueRetryable(200,{error:'missing_in_batch_response'}),true);
  assertEquals(isResidueRetryable(200,{error:'invalid permanent payload'}),false);
  assertEquals(isResidueRetryable(200,{error:'Gemini timeout'}),true);
});

Deno.test('honours Retry-After and gives quota a safer default',()=>{
  assertEquals(residueRetryDelaySeconds({status:429,data:{retry_after_seconds:275}}),275);
  assertEquals(residueRetryDelaySeconds({status:429,data:{}}),120);
  assertEquals(residueRetryDelaySeconds({status:500,data:{}}),30);
});
