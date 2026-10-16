export type ResidueWorkerResult={status:number;data:unknown};

export function isResidueRetryable(status:number,data:unknown):boolean {
  const text=JSON.stringify(data??'').toLowerCase();
  return status===0||status===429||(status>=500&&status<=599)||
    /"status"\s*:\s*5\d\d/.test(text)||text.includes('timeout')||
    text.includes('temporarily')||text.includes('unavailable')||
    text.includes('high demand')||text.includes('wallclocktime')||
    text.includes('worker_resource_limit')||text.includes('resource_exhausted')||
    text.includes('quota')||text.includes('missing_in_batch_response')||
    /"code"\s*:\s*429/.test(text)||
    // D10 15.10.2026: Ordbøkene server failure reported in an error text
    // ("Ordbokene returned HTTP 502") with a 4xx/200 wrapper status.
    ORDBOKENE_SERVER_ERROR.test(text);
}

// D10 15.10.2026: Ordbøkene 5xx in a nested error text.
const ORDBOKENE_SERVER_ERROR=/ordbokene returned http 5\d\d/i;

export function residueRetryDelaySeconds(result:ResidueWorkerResult):number {
  const data=result.data as Record<string,unknown>|null;
  const supplied=Number(data?.retry_after_seconds??data?.retry_after);
  if(Number.isFinite(supplied)&&supplied>0)return Math.min(Math.ceil(supplied),86400);
  const text=JSON.stringify(result.data??'');
  // D10 15.10.2026: an Ordbøkene outage lasts minutes, not seconds.
  if(ORDBOKENE_SERVER_ERROR.test(text))return 300;
  return result.status===429||/(?:\b429\b|resource_exhausted|quota)/i.test(text)
    ?120:30;
}
