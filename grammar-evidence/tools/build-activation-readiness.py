#!/usr/bin/env python3
"""Classify one SQL grammar release in one pass from a read-only snapshot.

This is an evidence inventory, not an activation command. OPEN means proof is
missing; BLOCKED means the captured input/contract cannot execute as claimed.
"""
import argparse
import csv
import json
from pathlib import Path

SUBJECT = "nrg_rt_v1.structural.dependency.subject_of_predicate"


def assess(row, context, pilot, corpus):
    code = row["code"]
    pattern = row["pattern_type"]
    reasons = []
    if not row["is_enabled"] or not row["hash_matches"]:
        reasons.append("RELEASE_INTEGRITY_FAILED")
    if not row["manifest_code"]:
        reasons.append("MANIFEST_MAPPING_UNVERIFIED")
    elif row["manifest_status"] != "validated":
        reasons.append("MANIFEST_NOT_VALIDATED")
    if pattern == "morphological_inflection":
        if row["generation_strategy"] == "attested_pair_only":
            reasons.append("PRODUCTIVE_GENERATION_DISABLED")
        if context["legacy_form_rows"] == 0 and context["legacy_adjective_rows"] == 0:
            reasons.append("LEGACY_FORM_INPUT_EMPTY")
        reasons.append("RULE_FIRST_SHADOW_NOT_RELEASE_EXECUTOR")
        cohort = "adjective_form_input"
    elif code == SUBJECT:
        if context["rpc_md5"] != pilot["preflight"]["upstream_source_definition_md5"]:
            reasons.append("RPC_SOURCE_PARITY_REFRESH_REQUIRED")
        if context["pilot_producer_md5"] != pilot["preflight"]["private_producer_definition_md5"]:
            reasons.append("PILOT_PRODUCER_PARITY_REFRESH_REQUIRED")
        if corpus["summary"]["expected_subject_edges_missing"]:
            reasons.append("SUBJECT_CORPUS_GAPS_OPEN")
        cohort = "subject_dependency"
    else:
        reasons.append("RULE_SPECIFIC_EXECUTION_AND_CORPUS_UNVERIFIED")
        cohort = {
            "phrase_pattern": "structure_phrase",
            "graph_pattern": "structure_graph",
            "clause_pattern": "structure_clause",
            "relative_order": "word_order",
            "candidate_constraint": "preposition_constraint",
            "feature_unification": "adjective_agreement_controller",
        }.get(pattern, "other")
    if code != SUBJECT:
        reasons.append("PATTERN_TYPE_ADMISSION_NOT_PROVEN")
    if context["live_grants"] == 0:
        reasons.append("NO_LIVE_GRANT")
    if "RELEASE_INTEGRITY_FAILED" in reasons or "LEGACY_FORM_INPUT_EMPTY" in reasons:
        state = "BLOCKED"
    else:
        state = "OPEN"
    return {
        **row,
        "cohort": cohort,
        "readiness": state,
        "activation_ready": False,
        "reasons": reasons,
        "next_gate": (
            "refresh_current_source_and_subject_corpus"
            if code == SUBJECT else
            "replace_form_input_and_prove_class_applicability"
            if pattern == "morphological_inflection" else
            "prove_manifest_mapping_operator_input_and_rule_corpus"
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--pilot", required=True, type=Path)
    parser.add_argument("--corpus", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    pilot = json.loads(args.pilot.read_text(encoding="utf-8"))
    corpus = json.loads(args.corpus.read_text(encoding="utf-8"))
    rows = snapshot["rules"]
    if not rows or len(rows) != snapshot["context"]["release_rule_count"] or len({r["code"] for r in rows}) != len(rows):
        raise SystemExit("R125_RELEASE_MEMBERSHIP_DRIFT")
    if snapshot["context"]["release_status"] != "shadow":
        raise SystemExit("R125_RELEASE_STATUS_DRIFT")
    assessed = [assess(row, snapshot["context"], pilot, corpus) for row in rows]
    counts = {}
    for row in assessed:
        counts[row["cohort"]] = counts.get(row["cohort"], 0) + 1
    result = {
        "schema_version": "grammar-evidence-batch-readiness-v1",
        "run": "R125-BATCH-READINESS-2026-10-25",
        "observed_at_utc": snapshot["observed_at_utc"],
        "project_id": snapshot["project_id"],
        "release_code": snapshot["release_code"],
        "source_snapshot": args.snapshot.as_posix(),
        "historical_pilot": args.pilot.as_posix(),
        "historical_corpus": args.corpus.as_posix(),
        "summary": {
            "rules": len(assessed),
            "ready": sum(r["activation_ready"] for r in assessed),
            "blocked": sum(r["readiness"] == "BLOCKED" for r in assessed),
            "open": sum(r["readiness"] == "OPEN" for r in assessed),
            "cohorts": counts,
        },
        "rules": assessed,
        "scope": "Read-only snapshot classification; no grant or rule activation.",
    }
    args.output.write_bytes((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print("R125_BATCH_READINESS=PASS")
    print(json.dumps(result["summary"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
