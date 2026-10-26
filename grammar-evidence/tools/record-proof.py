#!/usr/bin/env python3
"""Record one proof in the grammar-evidence matrix in a single command.

Creates artifacts/<artifact>.json (session artifact with the raw result),
appends the proof to registry.json (2-space JSON, items indented 4, no rewrite
of existing entries), appends one event to history.jsonl, then rebuilds
index.json / matrix.csv / queue.json with the existing tools.

Example (run from the repo root):
  python3 grammar-evidence/tools/record-proof.py \
    --proof-id R135_ACTIVE_RELEASE_SELECTOR --kind SQL_GATE \
    --claim "..." --result "..." --raw-file ~/Downloads/r142.txt \
    --artifact R135-active-release-selector --session-step S-R142 \
    --dep supabase/... --next-action "..." [--sql-patch file.sql] [--dry-run]

proved_at_head defaults to the current HEAD; commit the code first, then record.
"""
import argparse, collections, datetime, hashlib, json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # grammar-evidence/
REPO = os.path.dirname(ROOT)

def git_head():
    return subprocess.run(["git", "-c", "safe.directory=*", "--no-optional-locks", "rev-parse", "HEAD"],
                          cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--proof-id", required=True)
    a.add_argument("--status", default="PROVEN", choices=["PROVEN", "INFERRED", "UNVERIFIED", "STALE"])
    a.add_argument("--kind", required=True, help="proof_kind / classification, e.g. SQL_GATE, LIVE_SHADOW_CALL")
    a.add_argument("--claim", required=True)
    a.add_argument("--result", required=True)
    a.add_argument("--raw-file", required=True, help="raw result file (SQL column, script output)")
    a.add_argument("--artifact", required=True, help="artifact base name, e.g. R135-active-release-selector")
    a.add_argument("--session-step", default="")
    a.add_argument("--dep", action="append", default=[], help="repo-relative dependency (repeatable)")
    a.add_argument("--blocked-by", action="append", default=[])
    a.add_argument("--invalidation", default="Recheck after any dependency changes.")
    a.add_argument("--notes", default="")
    a.add_argument("--next-action", required=True)
    a.add_argument("--result-type", default="")
    a.add_argument("--sql-patch", default="", help="applied SQL file to copy into patches/")
    a.add_argument("--status-before", default="UNVERIFIED")
    a.add_argument("--head", default="")
    a.add_argument("--dry-run", action="store_true")
    o = a.parse_args()

    reg_path = os.path.join(ROOT, "registry.json")
    reg_text = open(reg_path, encoding="utf-8").read()
    if any(p.get("proof_id") == o.proof_id for p in json.loads(reg_text).get("proofs", [])):
        sys.exit(f"proof_id already in registry: {o.proof_id}")
    raw = open(os.path.expanduser(o.raw_file), encoding="utf-8-sig").read()
    head = o.head or git_head()
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run = o.proof_id.replace("_", "-") + "-" + today
    art_rel = f"artifacts/{o.artifact}.json"
    deps = list(o.dep)
    patch_rel = ""
    if o.sql_patch:
        patch_rel = f"patches/{today}_{(o.session_step or o.proof_id.split('_')[0])}_{os.path.basename(o.sql_patch)}"
    art = collections.OrderedDict([
        ("schema", "grammar-evidence-session-artifact-v1"),
        ("project_ref", "kevpkawrbtovrgyjkkvu"),
        ("proof_id", o.proof_id),
        ("recorded_at_utc", now),
        ("summary", o.result),
        ("applied_sql", "grammar-evidence/" + patch_rel if patch_rel else None),
        ("captured_results", [{"session_step": o.session_step, "source_file": os.path.basename(o.raw_file), "raw_result": raw}]),
    ])
    data = (json.dumps(art, indent=1, ensure_ascii=False) + "\n").encode("utf-8")
    digest = hashlib.sha256(data).hexdigest()
    deps.append("grammar-evidence/" + art_rel)
    if patch_rel:
        deps.append("grammar-evidence/" + patch_rel)
    entry = collections.OrderedDict([
        ("proof_id", o.proof_id), ("status", o.status), ("proof_kind", o.kind), ("claim", o.claim),
        ("proved_at_head", head), ("evidence_runs", [run]), ("result", o.result), ("dependencies", deps),
        ("blocked_by", o.blocked_by), ("invalidation", o.invalidation),
        ("notes", (o.notes + (f" Session step {o.session_step}." if o.session_step else "")).strip()),
        ("next_action", o.next_action),
    ])
    s = reg_text.rstrip()
    idx = s.rfind("\n  ]")
    body = "\n".join("    " + line for line in json.dumps(entry, indent=2, ensure_ascii=False).splitlines())
    new_reg = s[:idx] + ",\n" + body + "\n  ]\n}\n"
    json.loads(new_reg)
    event = collections.OrderedDict([
        ("schema_version", "grammar-evidence-event-v2"), ("run", run), ("timestamp_utc", now), ("commit", head),
        ("proof_id", o.proof_id), ("updates_proofs", [o.proof_id]), ("result_type", o.result_type or o.kind),
        ("artifact_path", "grammar-evidence/" + art_rel), ("artifact_hash", digest),
        ("status_before", o.status_before), ("status_after", o.status), ("classification", o.kind),
        ("project_failure", False), ("notes", o.result),
    ])
    if o.dry_run:
        print(json.dumps({"dry_run": True, "artifact": art_rel, "patch": patch_rel, "entry": entry}, ensure_ascii=False, indent=1)[:3000])
        return
    open(os.path.join(ROOT, art_rel), "wb").write(data)
    if patch_rel:
        shutil.copyfile(os.path.expanduser(o.sql_patch), os.path.join(ROOT, patch_rel))
    open(reg_path, "w", encoding="utf-8").write(new_reg)
    with open(os.path.join(ROOT, "history.jsonl"), "a", encoding="utf-8") as h:
        h.write(json.dumps(event, ensure_ascii=False) + "\n")
    for tool in (["build-evidence-index.py", "--source-rev", "HEAD"], ["build-proof-queue.py"]):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", tool[0])] + tool[1:], cwd=ROOT, capture_output=True, text=True)
        print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip())
    print(f"RECORDED {o.proof_id} status={o.status} head={head[:8]} artifact={art_rel}")

if __name__ == "__main__":
    main()
