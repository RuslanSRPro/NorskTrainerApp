-- Read-only: all senses and homographs, not just cards displayed in the application.
SELECT l.lemma,l.pos,c.id candidate_id,c.target_text,c.source_sense_anchor,
 c.naob_gloss source_gloss,c.dispatch_status,c.stage1_status,
 p.id pair_id,p.status,p.decision,p.rule_reason,p.verified_at,
 p.snapshot->'source' source_snapshot,p.snapshot->'target' target_snapshot,
 p.verification_evidence
FROM public.synonym_candidate_queue c
JOIN public.lexemes l ON c.source_entity_type='lexeme' AND l.id=c.source_entity_id
LEFT JOIN public.synonym_pair_v1 p ON p.candidate_id=c.id
WHERE l.lemma IN ('rask','vanskelig','starte','samtale','prate','snakke')
 AND c.source_active
ORDER BY l.lemma,l.pos,c.target_text,c.source_sense_anchor;
