// run_enrich.mjs
// Запускає enrich-lexeme-data батчами по 10
// node run_enrich.mjs

import * as fs from 'fs';

const SUPABASE_URL  = 'https://kevpkawrbtovrgyjkkvu.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_KEY || '';
const FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/enrich-lexeme-data`;

const BATCH_SIZE    = 10;   // менше ніж аудит бо Gemini повільніший
const PAUSE_MS      = 3000; // 3 сек між батчами
const TOTAL         = 2363;
const BATCHES       = Math.ceil(TOTAL / BATCH_SIZE);
const POS           = 'all'; // або 'expression', 'noun', 'verb', 'adjective', 'adverb'
const LOG_FILE      = `enrich_run_${Date.now()}.json`;

const results = {
  started_at:   new Date().toISOString(),
  total_target: TOTAL,
  batch_size:   BATCH_SIZE,
  pos:          POS,
  batches:      [],
  summary: {
    byField:       {},
    total_ok:      0,
    total_skipped: 0,
    total_errors:  0,
  },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mergeSummary(target, source) {
  for (const [k, v] of Object.entries(source || {})) {
    target[k] = (target[k] || 0) + v;
  }
}

async function runBatch(offset) {
  const res = await fetch(FUNCTION_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey':        SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode:     'fill_gaps',
      pos:      POS,
      limit:    BATCH_SIZE,
      offset,
      dry_run:  false,
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

  console.log(`🚀 Starting enrichment: ${TOTAL} lexemes, ${BATCHES} batches of ${BATCH_SIZE}`);
  console.log(`📋 Log: ${LOG_FILE}\n`);

  const startTime = Date.now();

  for (let batch = 0; batch < BATCHES; batch++) {
    const offset   = batch * BATCH_SIZE;
    const batchNum = batch + 1;

    process.stdout.write(`Batch ${batchNum}/${BATCHES} (offset ${offset})... `);

    try {
      const data = await runBatch(offset);

      const batchResult = {
        batch:    batchNum,
        offset,
        count:    data.count    || 0,
        enriched: data.summary?.enriched || 0,
        skipped:  data.summary?.skipped  || 0,
        errors:   data.summary?.errors   || 0,
        byField:  data.summary?.byField  || {},
      };

      results.batches.push(batchResult);
      mergeSummary(results.summary.byField, data.summary?.byField);
      results.summary.total_ok      += data.summary?.enriched || 0;
      results.summary.total_skipped += data.summary?.skipped  || 0;
      results.summary.total_errors  += data.summary?.errors   || 0;

      const enriched = data.summary?.enriched || 0;
      const skipped  = data.summary?.skipped  || 0;
      const errors   = data.summary?.errors   || 0;

      const status = errors > 0 ? `⚠️  ${errors} errors` : '✅';
      console.log(`${status} enriched:${enriched} skipped:${skipped}`);

      // Progress every 10 batches
      if (batchNum % 10 === 0 || batchNum === BATCHES) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`\n📊 Progress ${batchNum}/${BATCHES} (${elapsed}s):`);
        console.log(`   Enriched: ${results.summary.total_ok}`);
        console.log(`   Skipped:  ${results.summary.total_skipped}`);
        console.log(`   Errors:   ${results.summary.total_errors}`);
        console.log('   byField:', JSON.stringify(results.summary.byField));
        console.log('');
      }

      fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));

      if (batch < BATCHES - 1) await sleep(PAUSE_MS);

    } catch (err) {
      console.error(`❌ ${err.message}`);
      results.batches.push({ batch: batchNum, offset, ok: false, error: err.message });
      results.summary.total_errors += BATCH_SIZE;
      fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
      console.log('   Waiting 10s...');
      await sleep(10000);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  results.finished_at     = new Date().toISOString();
  results.elapsed_seconds = elapsed;
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('✅ ENRICHMENT COMPLETE');
  console.log(`   Enriched: ${results.summary.total_ok}`);
  console.log(`   Skipped:  ${results.summary.total_skipped}`);
  console.log(`   Errors:   ${results.summary.total_errors}`);
  console.log(`   Time:     ${Math.floor(elapsed/60)}m ${elapsed%60}s`);
  console.log('\n📊 byField:');
  for (const [k, v] of Object.entries(results.summary.byField).sort((a,b) => b[1]-a[1])) {
    console.log(`   ${k}: ${v}`);
  }
  console.log(`\n📋 Log: ${LOG_FILE}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
