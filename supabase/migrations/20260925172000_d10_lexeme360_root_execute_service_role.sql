-- D10 promotion RPC invokes this private helper as service_role.
-- Production received this grant on 2026-09-25; keep it in migration history.
grant execute on function private.normalize_lexeme360_root_v1(text)
to service_role;
