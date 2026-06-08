// run_audit_continue.mjs
// Продовжує аудит тільки для виразів які ще не пройшли аудит
// Використовує where: "missing_verification" або ids список

import * as fs from 'fs';

const SUPABASE_URL  = 'https://kevpkawrbtovrgyjkkvu.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_KEY || '';
const FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/verify-lexeme-audit`;
const REST_URL      = `${SUPABASE_URL}/rest/v1`;

const BATCH_SIZE    = 25;
const PAUSE_MS      = 4000;
const LOG_FILE      = `audit_continue_${Date.now()}.json`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mergeSummary(target, source) {
  for (const [k, v] of Object.entries(source || {})) {
    target[k] = (target[k] || 0) + v;
  }
}

// Отримати IDs виразів які ще не пройшли аудит
async function getUnauditedIds() {
  // Всі IDs з expression_catalog
  const allRes = await fetch(`${REST_URL}/expression_catalog?select=id&limit=1000`, {
    headers: { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'x-supabase-api-key': SUPABASE_KEY,
    }
  });
  const allData = await allRes.json();
  const allIds = new Set(allData.map(r => r.id));

  // Вже заауditовані IDs
  const auditedRes = await fetch(
    `${REST_URL}/lexical_quality_audit?select=entity_id&entity_table=eq.expression_catalog&limit=1000`,
    { headers: { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'x-supabase-api-key': SUPABASE_KEY,
    } }
  );
  const auditedData = await auditedRes.json();
  const auditedIds  = new Set(auditedData.map(r => r.entity_id));

  // Різниця
  const unaudited = [...allIds].filter(id => !auditedIds.has(id));
  console.log(`Total in catalog: ${allIds.size}`);
  console.log(`Already audited:  ${auditedIds.size}`);
  console.log(`Remaining:        ${unaudited.length}`);
  return unaudited;
}

async function runBatch(ids) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey':        SUPABASE_KEY,
      'x-supabase-api-key': SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode:              'quality_audit',
      entity:            'expression_catalog',
      ids,
      dry_run:           false,
      live_lookup:       true,
      requested_sources: ['NAOB', 'Ordbokene', 'Wiktionary'],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

async function main() {
  if (!SUPABASE_KEY) {
    console.error('❌ SUPABASE_KEY not set.');
    process.exit(1);
  }

  console.log('🔍 Fetching unaudited expressions...');
  const unauditedIds = await getUnauditedIds();

  if (!unauditedIds.length) {
    console.log('✅ All expressions already audited!');
    return;
  }

  const batches    = [];
  for (let i = 0; i < unauditedIds.length; i += BATCH_SIZE) {
    batches.push(unauditedIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n🚀 Running ${batches.length} batches of ${BATCH_SIZE}`);
  console.log(`📋 Log: ${LOG_FILE}\n`);

  const results = {
    started_at: new Date().toISOString(),
    total_remaining: unauditedIds.length,
    batches: [],
    summary: {
      byVerificationStatus: {},
      byRegisteredEntry:    {},
      bySource:             {},
      total_ok:     0,
      total_errors: 0,
    },
  };

  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    const batchNum = i + 1;
    const ids      = batches[i];
    process.stdout.write(`Batch ${batchNum}/${batches.length} (${ids.length} items)... `);

    try {
      const data = await runBatch(ids);

      results.batches.push({
        batch:   batchNum,
        count:   data.count || 0,
        errors:  data.error_count || 0,
        ok:      data.error_count === 0,
      });

      mergeSummary(results.summary.byVerificationStatus, data.summary?.byVerificationStatus);
      mergeSummary(results.summary.byRegisteredEntry,    data.summary?.byRegisteredEntry);
      mergeSummary(results.summary.bySource,             data.summary?.bySource);
      results.summary.total_ok     += (data.count || 0) - (data.error_count || 0);
      results.summary.total_errors += data.error_count || 0;

      const status = data.error_count === 0 ? '✅' : `⚠️  ${data.error_count} errors`;
      console.log(`${status}`);

      if (batchNum % 5 === 0 || batchNum === batches.length) {
        console.log(`\n📊 Progress ${batchNum}/${batches.length}:`);
        console.log(`   OK: ${results.summary.total_ok} | Errors: ${results.summary.total_errors}`);
        console.log('   Status:', JSON.stringify(results.summary.byVerificationStatus));
        console.log('   Registered:', JSON.stringify(results.summary.byRegisteredEntry));
        console.log('');
      }

      fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));

      if (i < batches.length - 1) await sleep(PAUSE_MS);

    } catch (err) {
      console.error(`❌ ${err.message}`);
      results.batches.push({ batch: batchNum, ok: false, error: err.message });
      results.summary.total_errors += ids.length;
      fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
      await sleep(10000);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  results.finished_at    = new Date().toISOString();
  results.elapsed_seconds = elapsed;
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('✅ AUDIT COMPLETE');
  console.log(`   OK: ${results.summary.total_ok} | Errors: ${results.summary.total_errors}`);
  console.log(`   Time: ${Math.floor(elapsed/60)}m ${elapsed%60}s`);
  console.log('\n📊 byVerificationStatus:');
  for (const [k, v] of Object.entries(results.summary.byVerificationStatus).sort((a,b)=>b[1]-a[1])) {
    console.log(`   ${k}: ${v}`);
  }
  console.log('\n📊 byRegisteredEntry (strict):');
  for (const [k, v] of Object.entries(results.summary.byRegisteredEntry).sort((a,b)=>b[1]-a[1])) {
    console.log(`   ${k}: ${v}`);
  }
  console.log(`\n📋 Log: ${LOG_FILE}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
