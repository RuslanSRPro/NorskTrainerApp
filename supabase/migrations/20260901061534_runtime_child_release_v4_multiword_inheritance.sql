create or replace function public.create_runtime_child_release_v4(p_parent_code text,p_child_code text,p_engine_version text,p_purpose text,p_next_layer text,p_metadata_overrides jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path='public','pg_catalog' as $$
declare v_id uuid; p_id uuid;
begin
 v_id:=public.create_runtime_child_release_v3(p_parent_code,p_child_code,p_engine_version,p_purpose,p_next_layer,coalesce(p_metadata_overrides,'{}'::jsonb)||jsonb_build_object('release_inheritance_contract','runtime-child-release-v4','runtime_multiword_fact_inheritance',true));
 select id into p_id from public.grammar_runtime_releases where code=p_parent_code;
 insert into public.grammar_runtime_multiword_facts_v1(release_id,mwe_code,mwe_family,match_mode,normalized_tokens,first_token,token_count,head_offset,head_lemma,function_class,resolution_policy,conditions,payload,provenance,is_enabled)
 select v_id,mwe_code,mwe_family,match_mode,normalized_tokens,first_token,token_count,head_offset,head_lemma,function_class,resolution_policy,conditions,payload,provenance,is_enabled
 from public.grammar_runtime_multiword_facts_v1 where release_id=p_id
 on conflict (release_id,mwe_code) do nothing;
 return v_id;
end;
$$;
