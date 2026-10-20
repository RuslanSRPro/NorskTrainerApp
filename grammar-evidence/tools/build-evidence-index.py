from __future__ import annotations
import csv, hashlib, json, subprocess, re
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"grammar-evidence"
REGISTRY=BASE/"registry.json"; HISTORY=BASE/"history.jsonl"; INDEX=BASE/"index.json"; MATRIX=BASE/"matrix.csv"
STRICT_EVENT_SCHEMA="grammar-evidence-event-v2"
STRICT_REQUIRED=("run","timestamp_utc","commit","proof_id","result_type","artifact_hash","status_before","status_after")
DB_SNAPSHOT_MAX_AGE_HOURS=24

def git(*args): return subprocess.check_output(["git","-C",str(ROOT),*args],text=True).strip()
def sha256(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()
def changed_since(commit,relpath):
    try: return bool(git("diff","--name-only",f"{commit}..HEAD","--",relpath).strip())
    except subprocess.CalledProcessError: return True
def parse_utc(value):
    if not value: return None
    try:
        d=datetime.fromisoformat(str(value).replace("Z","+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError: return None
def collect_files():
    rows=[]
    for root in (ROOT/"supabase/functions/_shared/nlp",ROOT/"supabase/functions/canonical-graph-shadow-v1"):
        if not root.exists(): continue
        for p in sorted(root.rglob("*.ts")):
            rel=p.relative_to(ROOT).as_posix(); text=p.read_text(encoding="utf-8",errors="replace")
            rows.append({"path":rel,"sha256":sha256(p),"symbols":{
              "create_dependency":"create_dependency" in text,
              "clausePatchFromLegacyV11":"clausePatchFromLegacyV11" in text,
              "projectLegacyNonPhraseStructureIntoCanonicalGraphV143":"projectLegacyNonPhraseStructureIntoCanonicalGraphV143" in text,
              "buildCanonicalPhraseCandidateLatticePatchV1":"buildCanonicalPhraseCandidateLatticePatchV1" in text,
              "canonical_dependency_action_activation_authority_v1":"canonical_dependency_action_activation_authority_v1" in text}})
    return rows
def load_history():
    events=[]
    if not HISTORY.exists(): return events
    for line_no,raw in enumerate(HISTORY.read_text(encoding="utf-8-sig").splitlines(),1):
        if not raw.strip(): continue
        e=json.loads(raw); e["_line"]=line_no; events.append(e)
    return events
def validate_history(events,known):
    strict=[e for e in events if e.get("schema_version")==STRICT_EVENT_SCHEMA]
    seen=set(); last_time=None
    for e in strict:
        missing=[k for k in STRICT_REQUIRED if e.get(k) in (None,"")]
        if missing: raise SystemExit(f"Strict history event line {e['_line']} missing: {','.join(missing)}")
        if e["run"] in seen: raise SystemExit("Duplicate strict run id: "+e["run"])
        seen.add(e["run"])
        if e["proof_id"] not in known: raise SystemExit("Unknown strict proof id: "+e["proof_id"])
        t=parse_utc(e["timestamp_utc"])
        if t is None: raise SystemExit("Invalid timestamp_utc at line "+str(e["_line"]))
        if last_time and t<last_time: raise SystemExit("Strict events out of chronological order")
        last_time=t
        if e["status_before"] not in ("PROVEN","INFERRED","UNVERIFIED","STALE") or e["status_after"] not in ("PROVEN","INFERRED","UNVERIFIED","STALE"):
            raise SystemExit("Invalid strict status transition value")
        if not re.fullmatch(r"[0-9a-fA-F]{64}", str(e["artifact_hash"])):
            raise SystemExit("Invalid artifact_hash SHA-256 at line "+str(e["_line"]))
        ap=e.get("artifact_path")
        if ap:
            candidate=(ROOT/ap) if not Path(ap).is_absolute() else Path(ap)
            if candidate.exists() and candidate.is_file() and sha256(candidate).lower()!=str(e["artifact_hash"]).lower():
                raise SystemExit("artifact_hash mismatch at line "+str(e["_line"]))
    by_proof={}
    for e in strict: by_proof.setdefault(e["proof_id"],[]).append(e)
    for proof_id,xs in by_proof.items():
        for prev,cur in zip(xs,xs[1:]):
            if cur["status_before"]!=prev["status_after"]:
                raise SystemExit(f"Broken strict transition chain for {proof_id}: {prev['status_after']} -> {cur['status_before']}")
        if xs[-1]["status_after"]!=known[proof_id]["status"]:
            raise SystemExit(f"Strict transition final status disagrees with registry for {proof_id}")
    return strict
def latest_strict_event(events,proof_id):
    xs=[e for e in events if e.get("schema_version")==STRICT_EVENT_SCHEMA and e.get("proof_id")==proof_id]
    return xs[-1] if xs else None
def effective_status(proof,events,proof_map,stack=None):
    declared=proof["status"]; reasons=[]
    if declared!="PROVEN": return declared,reasons
    stack=set() if stack is None else set(stack)
    if proof["proof_id"] in stack: return "STALE",["proof dependency cycle"]
    stack.add(proof["proof_id"])
    head=proof.get("proved_at_head")
    for dep in proof.get("dependencies",[]):
        if dep.startswith("supabase/") and head and changed_since(head,dep): reasons.append("source dependency changed: "+dep)
    for blocker in proof.get("blocked_by",[]):
        bp=proof_map.get(blocker)
        if bp:
            bs,_=effective_status(bp,events,proof_map,stack)
            if bs!="PROVEN": reasons.append(f"proof dependency not effectively PROVEN: {blocker}={bs}")
    if proof.get("proof_kind")=="DB_SNAPSHOT":
        e=latest_strict_event(events,proof["proof_id"])
        if e is None:
            reasons.append("DB snapshot lacks strict freshness-bearing event")
        else:
            t=parse_utc(e.get("timestamp_utc"))
            age=(datetime.now(timezone.utc)-t).total_seconds()/3600 if t else 10**9
            max_age=float(proof.get("freshness_max_age_hours",DB_SNAPSHOT_MAX_AGE_HOURS))
            if age>max_age: reasons.append(f"DB snapshot expired: age_hours={age:.2f} max={max_age:g}")
    return ("STALE",reasons) if reasons else ("PROVEN",[])
def main():
    registry=json.loads(REGISTRY.read_text(encoding="utf-8-sig")); proofs=registry["proofs"]; proof_map={p["proof_id"]:p for p in proofs}
    events=load_history()
    unknown=sorted({pid for e in events for pid in e.get("updates_proofs",[]) if pid not in proof_map})
    if unknown: raise SystemExit("Unknown proof ids in history: "+", ".join(unknown))
    strict=validate_history(events,proof_map)
    head=git("rev-parse","HEAD"); files=collect_files(); rows=[]
    for p in proofs:
        eff,reasons=effective_status(p,events,proof_map)
        rows.append({"proof_id":p["proof_id"],"declared_status":p["status"],"effective_status":eff,"proof_kind":p["proof_kind"],
          "proved_at_head":p.get("proved_at_head"),"claim":p["claim"],"result":p.get("result",""),
          "evidence_runs":p.get("evidence_runs",[]),"dependencies":p.get("dependencies",[]),
          "blocked_by":p.get("blocked_by",[]),"stale_reasons":reasons,"notes":p.get("notes","")})
    index={"schema_version":"grammar-evidence-index-v2","head":head,"registry_baseline_head":registry.get("baseline_head"),
      "file_count":len(files),"history_event_count":len(events),"strict_history_event_count":len(strict),"history_runs":[e.get("run") for e in events],
      "history_policy":{"legacy_events_preserved":True,"strict_event_schema":STRICT_EVENT_SCHEMA,
        "strict_required_fields":list(STRICT_REQUIRED),"duplicate_strict_run_ids_rejected":True,
        "strict_event_chronology_validated":True,"strict_transition_chain_validated":True,"artifact_sha256_validated":True,"db_snapshot_default_max_age_hours":DB_SNAPSHOT_MAX_AGE_HOURS},
      "proof_dependencies":{p["proof_id"]:p.get("blocked_by",[]) for p in proofs},
      "proof_source_dependencies":{p["proof_id"]:p.get("dependencies",[]) for p in proofs},
      "proof_next_actions":{p["proof_id"]:p.get("next_action","") for p in proofs},
      "files":files,"proofs":rows,
      "policy":{"index_can_promote_proof":False,
        "automatic_transition":"effective PROVEN->STALE only; never auto-promote declared proof status",
        "stale_inputs":["tracked source dependency change","non-PROVEN blocked_by dependency","expired/unverifiable DB snapshot freshness"]}}
    INDEX.write_text(json.dumps(index,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    with MATRIX.open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["proof_id","declared_status","effective_status","proof_kind","proved_at_head","claim","result","evidence_runs","dependencies","blocked_by","stale_reasons","notes"])
        for r in rows:w.writerow([r["proof_id"],r["declared_status"],r["effective_status"],r["proof_kind"],r["proved_at_head"] or "",r["claim"],r["result"],
          " | ".join(r["evidence_runs"])," | ".join(r["dependencies"])," | ".join(r["blocked_by"])," | ".join(r["stale_reasons"]),r["notes"]])
    counts={}
    for r in rows: counts[r["effective_status"]]=counts.get(r["effective_status"],0)+1
    print("GRAMMAR_EVIDENCE_INDEX=PASS");print("HEAD="+head);print("HISTORY_EVENT_COUNT="+str(len(events)));print("STRICT_HISTORY_EVENT_COUNT="+str(len(strict)))
    for k in ("PROVEN","INFERRED","UNVERIFIED","STALE"):print(k+"_COUNT="+str(counts.get(k,0)))
if __name__=="__main__": main()
