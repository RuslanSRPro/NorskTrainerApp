create or replace function public.inherit_runtime_release_materialized_facts_v1(p_parent_code text,p_child_code text)
returns jsonb language plpgsql set search_path to 'public','pg_catalog' as $$
declare pid uuid; cid uuid;
begin
 select id into pid from public.grammar_runtime_releases where code=p_parent_code;
 select id into cid from public.grammar_runtime_releases where code=p_child_code;
 if pid is null or cid is null then raise exception 'Parent or child release not found'; end if;
 insert into public.grammar_runtime_lexical_overlays_v1(release_id,overlay_type,normalized_surface,lexical_class_code,pos,payload,provenance,is_enabled)
 select cid,overlay_type,normalized_surface,lexical_class_code,pos,payload,provenance,is_enabled
 from public.grammar_runtime_lexical_overlays_v1 where release_id=pid
 on conflict (release_id,overlay_type,normalized_surface,lexical_class_code) do update set pos=excluded.pos,payload=excluded.payload,provenance=excluded.provenance,is_enabled=excluded.is_enabled;
 insert into public.grammar_runtime_release_dependency_facts_v1(release_id,fact_type,fact_key,source_kind,provenance,is_enabled)
 select cid,fact_type,fact_key,source_kind,provenance,is_enabled
 from public.grammar_runtime_release_dependency_facts_v1 where release_id=pid
 on conflict (release_id,fact_type,fact_key,source_kind) do update set provenance=excluded.provenance,is_enabled=excluded.is_enabled;
 update public.grammar_runtime_releases set metadata=metadata||jsonb_build_object('runtime_fact_inheritance',jsonb_build_object('version','runtime-materialized-fact-inheritance-v1','parent_release',p_parent_code,'lexical_overlay_count',(select count(*) from public.grammar_runtime_lexical_overlays_v1 where release_id=cid),'dependency_fact_count',(select count(*) from public.grammar_runtime_release_dependency_facts_v1 where release_id=cid))) where id=cid;
 return jsonb_build_object('version','runtime-materialized-fact-inheritance-v1','parent_release',p_parent_code,'child_release',p_child_code,'lexical_overlay_count',(select count(*) from public.grammar_runtime_lexical_overlays_v1 where release_id=cid),'dependency_fact_count',(select count(*) from public.grammar_runtime_release_dependency_facts_v1 where release_id=cid));
end;
$$;
