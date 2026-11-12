-- D10_hete_naob_run_reset_v1 (11.11.2026): the NAOB family step runs once per verb root and remembers it in
-- private.d10_family_naob_runs_v1, so the hete run after D10_hete_naob_family_reset_v1 did not bind NAOB
-- expressions again ("hete etter" / "hete opp" became "not confirmed"). The run records of the two hete verb cards
-- are removed (saved first); the next analysis of "hete" runs the fixed worker for each card.
-- The first SELECT shows the records being removed (with the worker's last answer, if stored).
CREATE TABLE IF NOT EXISTS private.d10_naob_run_reset_backup_v1 (
  id bigserial PRIMARY KEY, row_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_naob_run_reset_backup_v1 FROM PUBLIC;

INSERT INTO private.d10_naob_run_reset_backup_v1 (row_data)
SELECT to_jsonb(n) FROM private.d10_family_naob_runs_v1 n
JOIN public.lexemes l ON l.id = n.root_lexeme_id
WHERE l.lemma = 'hete' AND l.pos = 'verb';

DELETE FROM private.d10_family_naob_runs_v1 n
USING public.lexemes l
WHERE l.id = n.root_lexeme_id AND l.lemma = 'hete' AND l.pos = 'verb';

SELECT row_data FROM private.d10_naob_run_reset_backup_v1
WHERE created_at > now() - interval '5 minutes' ORDER BY id;
