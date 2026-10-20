from __future__ import annotations
import argparse, csv, hashlib, json, subprocess, re
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
def git_result(*args):
    return subprocess.run(
        ["git", "-C", str(ROOT), *args],
        capture_output=True,
        check=False,
    )

def resolve_source_revision(revision):
    result = git_result("rev-parse", "--verify", revision + "^{commit}")
    if result.returncode != 0:
        raise SystemExit("SOURCE_REVISION_INVALID: " + revision)
    return result.stdout.decode("ascii").strip()

def git_blob(revision, relpath):
    tree = git_result("ls-tree", "-r", "--name-only", revision, "--", relpath)
    if tree.returncode != 0:
        raise RuntimeError("GIT_ERROR: cannot inspect source tree")

    names = tree.stdout.decode("utf-8").splitlines()
    if relpath not in names:
        return None

    result = git_result("rev-parse", "--verify", revision + ":" + relpath)
    if result.returncode != 0:
        raise RuntimeError("GIT_ERROR: cannot resolve source blob")

    return result.stdout.decode("ascii").strip()

def dependency_change_reason(commit, relpath, source_rev):
    try:
        baseline = resolve_source_revision(commit)
        original = git_blob(baseline, relpath)
        current = git_blob(source_rev, relpath)
    except (RuntimeError, SystemExit):
        return "GIT_ERROR: " + relpath

    if original is None:
        return "SOURCE_DEPENDENCY_BASELINE_MISSING: " + relpath
    if current is None:
        return "SOURCE_DEPENDENCY_MISSING_AT_HEAD: " + relpath
    if original != current:
        return "SOURCE_DEPENDENCY_CHANGED: " + relpath
    return None

def parse_utc(value):
    if not value: return None
    try:
        d=datetime.fromisoformat(str(value).replace("Z","+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError: return None
def collect_files(source_rev):
    rows = []
    roots = (
        "supabase/functions/_shared/nlp",
        "supabase/functions/canonical-graph-shadow-v1",
    )
    for root in roots:
        result = git_result("ls-tree", "-r", "--name-only", source_rev, "--", root)
        if result.returncode != 0:
            raise SystemExit("SOURCE_TREE_SCAN_FAILED: " + root)

        paths = sorted(
            p for p in result.stdout.decode("utf-8").splitlines()
            if p.endswith(".ts")
        )

        for rel in paths:
            result = git_result("show", source_rev + ":" + rel)
            if result.returncode != 0:
                raise SystemExit("SOURCE_FILE_READ_FAILED: " + rel)

            data = result.stdout
            text = data.decode("utf-8", errors="replace")

            rows.append({
                "path": rel,
                "sha256": hashlib.sha256(data).hexdigest(),
                "symbols": {
                    "create_dependency": "create_dependency" in text,
                    "clausePatchFromLegacyV11": "clausePatchFromLegacyV11" in text,
                    "projectLegacyNonPhraseStructureIntoCanonicalGraphV143":
                        "projectLegacyNonPhraseStructureIntoCanonicalGraphV143" in text,
                    "buildCanonicalPhraseCandidateLatticePatchV1":
                        "buildCanonicalPhraseCandidateLatticePatchV1" in text,
                    "canonical_dependency_action_activation_authority_v1":
                        "canonical_dependency_action_activation_authority_v1" in text,
                },
            })
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
def effective_status(proof,events,proof_map,source_rev,stack=None):
    declared=proof["status"]; reasons=[]
    if declared!="PROVEN": return declared,reasons
    stack=set() if stack is None else set(stack)
    if proof["proof_id"] in stack: return "STALE",["proof dependency cycle"]
    stack.add(proof["proof_id"])
    head=proof.get("proved_at_head")
    for dep in proof.get("dependencies",[]):
        if dep.startswith("supabase/") and head:
            reason = dependency_change_reason(head, dep, source_rev)
            if reason:
                reasons.append(reason)
    for blocker in proof.get("blocked_by",[]):
        bp=proof_map.get(blocker)
        if bp:
            bs,_=effective_status(bp,events,proof_map,source_rev,stack)
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-rev", required=True)
    args = parser.parse_args()
    source_rev = resolve_source_revision(args.source_rev)

    registry=json.loads(REGISTRY.read_text(encoding="utf-8-sig")); proofs=registry["proofs"]; proof_map={p["proof_id"]:p for p in proofs}
    events=load_history()
    unknown=sorted({pid for e in events for pid in e.get("updates_proofs",[]) if pid not in proof_map})
    if unknown: raise SystemExit("Unknown proof ids in history: "+", ".join(unknown))
    strict=validate_history(events,proof_map)
    head=git("rev-parse","HEAD"); branch=git("branch","--show-current"); files=collect_files(source_rev); rows=[]
    for p in proofs:
        eff,reasons=effective_status(p,events,proof_map,source_rev)
        rows.append({"proof_id":p["proof_id"],"declared_status":p["status"],"effective_status":eff,"proof_kind":p["proof_kind"],
          "proved_at_head":p.get("proved_at_head"),"claim":p["claim"],"result":p.get("result",""),
          "evidence_runs":p.get("evidence_runs",[]),"dependencies":p.get("dependencies",[]),
          "blocked_by":p.get("blocked_by",[]),"stale_reasons":reasons,"notes":p.get("notes","")})
    index={"schema_version":"grammar-evidence-index-v2","head":head,"branch":branch,"archive_head":head,"source_head":source_rev,"source_revision":args.source_rev,"registry_baseline_head":registry.get("baseline_head"),
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
        "stale_inputs":["source dependency missing or changed at selected source revision","Git inspection failure","non-PROVEN blocked_by dependency","expired/unverifiable DB snapshot freshness"]}}
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
