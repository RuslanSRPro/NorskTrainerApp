create or replace function public.build_structural_tokens_v140(
  p_tokens jsonb,
  p_release_code text default 'runtime-structural-v1.37'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_release_id uuid;
  v_release_status text;
  v_item jsonb;
  v_out jsonb := '[]'::jsonb;
  v_expected_index integer := 0;
  v_index integer;
  v_surface text;
  v_normalized text;
  v_prev text;
  v_next text;
begin
  if p_tokens is null or jsonb_typeof(p_tokens) <> 'array' then
    raise exception 'p_tokens must be a JSON array';
  end if;

  select r.id, r.status
    into v_release_id, v_release_status
  from public.grammar_runtime_releases r
  where r.code = p_release_code;

  if v_release_id is null then
    raise exception 'Runtime release % not found', p_release_code;
  end if;

  if v_release_status not in ('build','golden','shadow','canary','active') then
    raise exception 'Runtime release % has unsupported status %', p_release_code, v_release_status;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_tokens)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each p_tokens item must be a JSON object';
    end if;

    if not (v_item ? 'legacy_index') then
      raise exception 'Each p_tokens item must contain legacy_index';
    end if;

    begin
      v_index := (v_item->>'legacy_index')::integer;
    exception when others then
      raise exception 'legacy_index must be an integer';
    end;

    if v_index <> v_expected_index then
      raise exception 'legacy_index must be contiguous 0-based; expected %, got %', v_expected_index, v_index;
    end if;

    v_surface := v_item->>'surface';
    v_normalized := v_item->>'normalized_surface';
    v_prev := nullif(v_item->>'prev_surface','');
    v_next := nullif(v_item->>'next_surface','');

    if v_surface is null or v_surface = '' then
      raise exception 'surface must be a non-empty string at legacy_index %', v_index;
    end if;

    if v_normalized is null then
      raise exception 'normalized_surface is required at legacy_index %', v_index;
    end if;

    v_out := v_out || jsonb_build_array(
      public.build_structural_token_v2(
        v_index,
        v_surface,
        v_normalized,
        v_prev,
        v_next,
        v_release_id
      )
    );

    v_expected_index := v_expected_index + 1;
  end loop;

  return v_out;
end;
$$;

revoke all on function public.build_structural_tokens_v140(jsonb,text) from public;
revoke all on function public.build_structural_tokens_v140(jsonb,text) from anon;
revoke all on function public.build_structural_tokens_v140(jsonb,text) from authenticated;
grant execute on function public.build_structural_tokens_v140(jsonb,text) to service_role;

comment on function public.build_structural_tokens_v140(jsonb,text) is
'v1.40 shadow-only batch bridge from explicit canonical compatibility tokens to proven structural token builder. Does not tokenize or change grammar activation.';
