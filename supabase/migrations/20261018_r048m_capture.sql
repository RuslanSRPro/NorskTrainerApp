-- R048M: MANUAL production migration. Do not apply from installer.
-- The existing private schema must remain absent from exposed API schemas.
CREATE TABLE IF NOT EXISTS private.grammar_rpc_capture_v1 (
  capture_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  rpc_input jsonb NOT NULL,
  rpc_output jsonb NOT NULL,
  CONSTRAINT grammar_rpc_capture_input_object CHECK (jsonb_typeof(rpc_input) = 'object'),
  CONSTRAINT grammar_rpc_capture_output_object CHECK (jsonb_typeof(rpc_output) = 'object')
);
REVOKE ALL ON private.grammar_rpc_capture_v1 FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.grammar_rpc_capture_v1 ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.r048m_store_structural_rpc_evidence_v1(
  p_capture_id uuid, p_input jsonb, p_output jsonb
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A transaction-scoped lock prevents two concurrent first captures.
  PERFORM pg_catalog.pg_advisory_xact_lock(48048, 13);
  IF EXISTS (SELECT 1 FROM private.grammar_rpc_capture_v1) THEN
    RETURN false;
  END IF;
  IF p_capture_id IS NULL OR p_input IS NULL OR p_output IS NULL
     OR pg_catalog.jsonb_typeof(p_input) <> 'object'
     OR pg_catalog.jsonb_typeof(p_output) <> 'object'
     OR NOT (p_input ? 'rpcTokens')
     OR NOT (p_input ? 'structuralReleaseCode')
     OR NOT (p_input ? 'sentenceIndex') THEN
    RETURN false;
  END IF;
  INSERT INTO private.grammar_rpc_capture_v1(capture_id,rpc_input,rpc_output)
  VALUES(p_capture_id,p_input,p_output);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.r048m_store_structural_rpc_evidence_v1(uuid,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.r048m_store_structural_rpc_evidence_v1(uuid,jsonb,jsonb)
  TO service_role;
-- IMPORTANT: verify function owner is a trusted migration role; no direct table grants.
