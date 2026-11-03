#!/usr/bin/env python3
"""Register R050-A31..A35 as source-only findings, without activation promotion."""
import copy, hashlib, json, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path.cwd()
BASE = ROOT / 'grammar-evidence'
REG = BASE / 'registry.json'
HIST = BASE / 'history.jsonl'
ART = BASE / 'artifacts'
RUNS = {
 'R050-A31': ('SOURCE_INSPECTION', 'Token-construction function inventory identifies build_shadow_token_v1 and build_structural_token_v1/v2; text-reference flags alone do not establish runtime behavior.', 'Metadata query returned six named functions and boolean source-text references; no function executed.'),
 'R050-A32': ('SOURCE_INSPECTION', 'build_structural_token_v2 constructs morphology.readings by normalizing existing surface_resolution.candidates; an empty candidate array produces no readings. build_shadow_token_v1 uses surface resolver and registered lexical-class members.', 'Definitions inspected; no independent productive morphology generator observed inside these functions.'),
 'R050-A33': ('SOURCE_INSPECTION', 'build_shadow_token_lexical_v2 delegates to build_shadow_token_v1 and lexical-class resolver; resolve_surface_form_v2 returns no rows when merge_surface_candidates returns zero.', 'Definitions inspected; context_applied=false and grammar_engine_version=null in resolver output construction.'),
 'R050-A34': ('SOURCE_INSPECTION', 'merge_surface_candidates groups collect_surface_candidates rows by lexeme_id and POS, initializes grammar score=0 and trace=[]; token lexical-class wrapper delegates to resolve_grammar_lexical_classes_v2.', 'Definitions inspected; neither wrapper itself implements productive unknown-form generation.'),
 'R050-A35': ('SOURCE_INSPECTION', 'collect_surface_candidates matches existing D10 V2, compound-head, NAOB and lexeme forms; resolve_grammar_lexical_classes_v2 matches registered members by lexeme_id or normalized_lemma.', 'Definitions inspected; these implementations do not generate new lemmas or arbitrary unknown-word inflections.'),
}
DECISION = ('ARCHITECTURE_DECISION', 'Plan shared per-rule applicability and execution, bidirectional morphology, independent downstream D10 verification; implement in Production with separate explicit activation control.', 'Decision only; no implementation, rule activation, runtime test, or readiness promotion.')

def sha(b): return hashlib.sha256(b).hexdigest()
def run(*args): return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
def abort(msg): raise SystemExit('STOP: '+msg)

def main():
 if not (REG.is_file() and HIST.is_file() and (BASE/'tools/build-evidence-index.py').is_file()): abort('Run from NorskTrainerApp project root with grammar-evidence present')
 if run('git','rev-parse','--show-toplevel').returncode: abort('Not a Git worktree')
 head=run('git','rev-parse','HEAD').stdout.strip()
 if len(head)!=40: abort('Cannot read Git HEAD')
 # Validate existing evidence before touching it. Never repair or rewrite old evidence.
 check=run(sys.executable,str(BASE/'tools/build-evidence-index.py'),'--source-rev',head)
 if check.returncode: abort('Existing evidence validation failed. No registration performed.\n'+check.stdout+'\n'+check.stderr)
 registry=json.loads(REG.read_text(encoding='utf-8-sig'))
 if registry.get('schema_version')!='grammar-evidence-registry-v1' or not isinstance(registry.get('proofs'),list): abort('Unexpected registry schema')
 events=[json.loads(x) for x in HIST.read_text(encoding='utf-8-sig').splitlines() if x.strip()]
 ids={p['proof_id'] for p in registry['proofs']}
 old_runs={e.get('run') for e in events}
 specs={**RUNS,'R050-DECISION-01':DECISION}
 for key in specs:
  if key in ids or 'R050-REGISTER-'+key in old_runs: abort('Already registered (or partial registration): '+key)
 if run('git','status','--porcelain','--',str(REG.relative_to(ROOT)),str(HIST.relative_to(ROOT))).stdout.strip(): abort('Registry/history have uncommitted changes; inspect first')
 if any((ART/(key+'-architecture-evidence.json')).exists() for key in specs): abort('An output artifact already exists; inspect first')
 timestamp=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
 newevents=[]; newarts={}
 for key,(kind,claim,result) in specs.items():
  status='INFERRED' if key=='R050-DECISION-01' else 'PROVEN'
  # PROVEN here refers only to a narrow source-definition claim.
  artifact={'schema_version':'r050-architecture-source-evidence-v1','run':key,'captured_at_utc':timestamp,'basis':'User-transcribed Supabase pg_get_functiondef/pg_proc output in project conversation, 2026-10-21','evidence_kind':kind,'claim':claim,'observation':result,'limits':['Source inspection only; no executable Golden test','No complete-system absence claim','No readiness or activation claim','No Production writes performed by this recorder'],'release_code':'runtime-structural-v1.37','activation_ready_change':False,'bulk_activation_ready_change':False}
  if key=='R050-A31': artifact['functions']=['build_phrase_layer_v1','build_shadow_token_v1','build_structural_token_v1','build_structural_token_v2','build_structural_tokens_v140','normalize_morph_readings_v1']
  if key=='R050-A35': artifact['dictionary_independence_note']='Registered lexical class membership may match without a surface candidate, but this is not productive generation.'
  b=(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
  rel='grammar-evidence/artifacts/'+key+'-architecture-evidence.json'
  newarts[ART/(key+'-architecture-evidence.json')]=b
  registry['proofs'].append({'proof_id':key,'status':status,'proof_kind':kind,'claim':claim,'proved_at_head':head if status=='PROVEN' else None,'evidence_runs':['R050-REGISTER-'+key],'result':result,'dependencies':[],'invalidation':'Source definition is a user-transcribed Production snapshot; re-inspect after function changes. No runtime claim.','notes':'Architectural scope only. No readiness or activation promotion. User-transcribed source definitions.'})
  newevents.append({'schema_version':'grammar-evidence-event-v2','run':'R050-REGISTER-'+key,'timestamp_utc':timestamp,'commit':head,'proof_id':key,'result_type':'DISCOVERY','artifact_path':rel,'artifact_hash':sha(b),'status_before':status,'status_after':status,'classification':'USER_TRANSCRIBED_PRODUCTION_SOURCE_INSPECTION' if key!='R050-DECISION-01' else 'ARCHITECTURE_DECISION_NOT_IMPLEMENTED','project_failure':False,'notes':'Source/decision evidence only; no execution proof, no activation, no readiness promotion.'})
 newreg=(json.dumps(registry,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
 existing=HIST.read_bytes(); ending=b'' if not existing or existing.endswith(b'\n') else b'\n'
 newhist=existing+ending+b''.join((json.dumps(e,ensure_ascii=False)+'\n').encode('utf-8') for e in newevents)
 # Snapshot old files before writes, and rollback if builder rejects the new evidence.
 backups={p:p.read_bytes() for p in (REG,HIST,BASE/'index.json',BASE/'matrix.csv',BASE/'queue.json') if p.exists()}
 created=[]
 try:
  ART.mkdir(parents=True,exist_ok=True)
  for p,b in newarts.items(): p.write_bytes(b); created.append(p)
  REG.write_bytes(newreg); HIST.write_bytes(newhist)
  build=run(sys.executable,str(BASE/'tools/build-evidence-index.py'),'--source-rev',head)
  if build.returncode: raise RuntimeError('Index validation failed: '+build.stdout+' '+build.stderr)
  queue_tool=BASE/'tools/build-proof-queue.py'
  if queue_tool.is_file():
   q=run(sys.executable,str(queue_tool))
   if q.returncode: raise RuntimeError('Queue generation failed: '+q.stdout+' '+q.stderr)
  print('REGISTERED: '+', '.join(specs))
  print(build.stdout)
  print('HEAD:',head)
  print('Git status (scoped):\n'+run('git','status','--short','--','grammar-evidence').stdout)
  print('No commit created. Review changes, then commit selected files only.')
 except Exception as ex:
  for p,b in backups.items(): p.write_bytes(b)
  for p in created: p.unlink(missing_ok=True)
  abort('Registration rolled back: '+str(ex))

if __name__=='__main__': main()
