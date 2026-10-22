#!/usr/bin/env python3
from pathlib import Path
import json
B=Path(__file__).resolve().parents[1]
r=json.loads((B/"registry.json").read_text(encoding="utf-8-sig"))
idx=json.loads((B/"index.json").read_text(encoding="utf-8-sig"))
proofs={p["proof_id"]:p for p in r["proofs"]}
effective={p["proof_id"]:p["effective_status"] for p in idx["proofs"]}
rows=[]
for p in r["proofs"]:
    status=effective.get(p["proof_id"],p["status"])
    if status not in ("UNVERIFIED","INFERRED","STALE"): continue
    blockers=[x for x in p.get("blocked_by",[]) if effective.get(x,proofs.get(x,{}).get("status"))!="PROVEN"]
    rows.append({"proof_id":p["proof_id"],"declared_status":p["status"],"effective_status":status,"blocked_by":blockers,
                 "ready_for_next_action":not blockers,"next_action":p.get("next_action",""),"search_gate":p.get("search_gate"),
                 "queue_priority":p.get("queue_priority",100)})
rows.sort(key=lambda x:(not (x["ready_for_next_action"] and x["search_gate"] is not None),not x["ready_for_next_action"],x["queue_priority"],x["proof_id"]))
n=next((x for x in rows if x["ready_for_next_action"]),None)
(B/"queue.json").write_text(json.dumps({"queue":rows,"next":n},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("GRAMMAR_EVIDENCE_QUEUE=PASS");print("QUEUE_COUNT="+str(len(rows)));print("NEXT_PROOF="+(n["proof_id"] if n else "NONE"));print("NEXT_ACTION="+(n["next_action"] if n else "NONE"))
