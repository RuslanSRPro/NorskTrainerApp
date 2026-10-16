from __future__ import annotations
import csv, hashlib, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "grammar-evidence"
REGISTRY = BASE / "registry.json"
INDEX = BASE / "index.json"
MATRIX = BASE / "matrix.csv"

SCAN_ROOTS = [
    ROOT / "supabase" / "functions" / "_shared" / "nlp",
    ROOT / "supabase" / "functions" / "canonical-graph-shadow-v1",
]

def git(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def changed_since(commit: str, relpath: str) -> bool:
    try:
        out = git("diff", "--name-only", f"{commit}..HEAD", "--", relpath)
        return bool(out.strip())
    except subprocess.CalledProcessError:
        return True

def collect_files():
    rows = []
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for p in sorted(root.rglob("*.ts")):
            rel = p.relative_to(ROOT).as_posix()
            text = p.read_text(encoding="utf-8", errors="replace")
            rows.append({
                "path": rel,
                "sha256": sha256(p),
                "symbols": {
                    "create_dependency": "create_dependency" in text,
                    "clausePatchFromLegacyV11": "clausePatchFromLegacyV11" in text,
                    "projectLegacyNonPhraseStructureIntoCanonicalGraphV143":
                        "projectLegacyNonPhraseStructureIntoCanonicalGraphV143" in text,
                    "buildCanonicalPhraseCandidateLatticePatchV1":
                        "buildCanonicalPhraseCandidateLatticePatchV1" in text,
                    "canonical_dependency_action_activation_authority_v1":
                        "canonical_dependency_action_activation_authority_v1" in text,
                }
            })
    return rows

def effective_status(proof):
    declared = proof["status"]
    reasons = []
    if declared == "PROVEN":
        head = proof.get("proved_at_head")
        for dep in proof.get("dependencies", []):
            if dep.startswith("supabase/") and head and changed_since(head, dep):
                reasons.append(f"dependency changed: {dep}")
        if reasons:
            return "STALE", reasons
    return declared, reasons

def main():
    registry = json.loads(REGISTRY.read_text(encoding="utf-8-sig"))
    history_path = BASE / "history.jsonl"
    history = []
    if history_path.exists():
        for line_no, raw in enumerate(history_path.read_text(encoding="utf-8-sig").splitlines(), 1):
            if not raw.strip():
                continue
            event = json.loads(raw)
            event["_line"] = line_no
            history.append(event)
    known_proofs = {p["proof_id"] for p in registry["proofs"]}
    unknown_history_proofs = sorted({
        proof_id
        for event in history
        for proof_id in event.get("updates_proofs", [])
        if proof_id not in known_proofs
    })
    if unknown_history_proofs:
        raise SystemExit("Unknown proof ids in history: " + ", ".join(unknown_history_proofs))
    head = git("rev-parse", "HEAD")
    files = collect_files()
    proof_rows = []
    for p in registry["proofs"]:
        eff, stale_reasons = effective_status(p)
        proof_rows.append({
            "proof_id": p["proof_id"],
            "declared_status": p["status"],
            "effective_status": eff,
            "proof_kind": p["proof_kind"],
            "claim": p["claim"],
            "proved_at_head": p.get("proved_at_head"),
            "evidence_runs": p.get("evidence_runs", []),
            "dependencies": p.get("dependencies", []),
            "stale_reasons": stale_reasons,
            "result": p.get("result", ""),
            "notes": p.get("notes", ""),
        })

    index = {
        "schema_version": "grammar-evidence-index-v1",
        "head": head,
        "registry_baseline_head": registry.get("baseline_head"),
        "file_count": len(files),
        "history_event_count": len(history),
        "history_runs": [event.get("run") for event in history],
        "files": files,
        "proofs": proof_rows,
        "policy": {
            "index_can_promote_proof": False,
            "automatic_transition": "PROVEN->STALE only when tracked source dependency changed",
        }
    }
    INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    with MATRIX.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["proof_id","declared_status","effective_status","proof_kind",
                    "proved_at_head","claim","result","evidence_runs","dependencies","stale_reasons"])
        for r in proof_rows:
            w.writerow([
                r["proof_id"], r["declared_status"], r["effective_status"], r["proof_kind"],
                r["proved_at_head"] or "", r["claim"], r["result"],
                " | ".join(r["evidence_runs"]), " | ".join(r["dependencies"]),
                " | ".join(r["stale_reasons"])
            ])

    counts = {}
    for r in proof_rows:
        counts[r["effective_status"]] = counts.get(r["effective_status"], 0) + 1
    print("GRAMMAR_EVIDENCE_INDEX=PASS")
    print("HEAD="+head)
    print("SCANNED_TS_FILE_COUNT="+str(len(files)))
    print("PROOF_COUNT="+str(len(proof_rows)))
    for k in ("PROVEN","INFERRED","UNVERIFIED","STALE"):
        print(k+"_COUNT="+str(counts.get(k,0)))

if __name__ == "__main__":
    main()
