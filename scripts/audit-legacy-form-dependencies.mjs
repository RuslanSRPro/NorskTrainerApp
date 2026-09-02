import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const assertZero = process.argv.includes('--assert-zero');
const tracked = spawnSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
);
if (tracked.status !== 0) {
  throw new Error(tracked.stderr || 'git ls-files failed');
}

const roots = ['app/', 'components/', 'features/', 'hooks/', 'services/', 'supabase/functions/', 'scripts/'];
const excluded = [
  'supabase/functions/_archive/',
  'supabase/functions/analyze-text-legacy/',
  'scripts/audit-legacy-form-dependencies.mjs',
];
const rules = [
  { id: 'legacy_variants_table', pattern: /\.from\(['"]lexeme_form_variants['"]\)/g },
  { id: 'legacy_verb_table', pattern: /\.from\(['"]verb_forms['"]\)|\bverb_forms\s*\(/g },
  { id: 'legacy_noun_table', pattern: /\.from\(['"]noun_forms['"]\)|\bnoun_forms\s*\(/g },
  { id: 'legacy_adjective_table', pattern: /\.from\(['"]adjective_forms['"]\)|\badjective_forms\s*\(/g },
  { id: 'legacy_worker', pattern: /['"]forms-enrichment-worker['"]/g },
];

const findings = [];
const files = tracked.stdout.split('\0').filter(Boolean).filter((file) =>
  roots.some((root) => file.startsWith(root)) &&
  !excluded.some((prefix) => file.startsWith(prefix)) &&
  !file.endsWith('.bak')
);

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        findings.push({ rule: rule.id, file, line: index + 1 });
      }
    }
  });
}

process.stdout.write(`${JSON.stringify({ count: findings.length, findings }, null, 2)}\n`);
if (assertZero && findings.length > 0) process.exitCode = 1;
