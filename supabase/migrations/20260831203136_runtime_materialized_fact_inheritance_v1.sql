create or replace function public.inherit_runtime_release_materialized_facts_v1(p_parent_code text,p_child_code text)
returns jsonb language plpgsql set search_path to 'public','pg_catalog' as $$
declare pid uuid; cid uuid; o int:=0; d int:=0;
begin
 select id into pid from public.grammar_runtime_releases where code=p_parent_code;
 select id into cid from public.grammar_runtime_releases where code=p_child_code;
 if pid is null or cid is null then raise exception 'Parent or child release not found'; end if;
 insert into public.grammar_runtime_lexical_overlays_v1(release_id,overlay_type,normalized_surface,lexical_class_code,pos,payload,provenance,is_enabled)
 select cid,overlay_type,normalized_surface,lexical_class_code,pos,payload,provenance,is_enabled
 from public.grammar_runtime_lexical_overlays_v1 where release_id=pid
 on conflict (release_id,overlay_type,normalized_surface,lexical_class_code) do update set pos=excluded.pos,payload=excluded.payload,provenance=excluded.provenance,is_enabled=excluded.is_enabled;
 get diagnostics o = row_count;
 insert into public.grammar_runtime_release_dependency_facts_v1(release_id,fact_type,fact_key,source_kind,provenance,is_enabled)
 select cid,fact_type,fact_key,source_kind,provenance,is_enabled
 from public.grammar_runtime_release_dependency_facts_v1 where release_id=pid
 on conflict (release_id,fact_type,fact_key) do update set source_kind=excluded.source_kind,provenance=excluded.provenance,is_enabled=excluded.is_enabled;
 get diagnostics d = row_count;
 update public.grammar_runtime_releases set metadata=metadata||jsonb_build_object('runtime_fact_inheritance',jsonb_build_object('version','runtime-materialized-fact-inheritance-v1','parent_release',p_parent_code,'lexical_overlay_count',(select count(*) from public.grammar_runtime_lexical_overlays_v1 where release_id=cid),'dependency_fact_count',(select count(*) from public.grammar_runtime_release_dependency_facts_v1 where release_id=cid))) where id=cid;
 return jsonb_build_object('version','runtime-materialized-fact-inheritance-v1','parent_release',p_parent_code,'child_release',p_child_code,'lexical_overlay_count',(select count(*) from public.grammar_runtime_lexical_overlays_v1 where release_id=cid),'dependency_fact_count',(select count(*) from public.grammar_runtime_release_dependency_facts_v1 where release_id=cid));
end;
$$;

create or replace function public.create_runtime_child_release_v2(p_parent_code text,p_child_code text,p_engine_version text,p_purpose text,p_next_layer text,p_metadata_overrides jsonb default '{}'::jsonb)
returns uuid language plpgsql set search_path to 'public','pg_catalog' as $$
declare cid uuid;
begin
 cid:=public.create_runtime_child_release_v1(p_parent_code,p_child_code,p_engine_version,p_purpose,p_next_layer,coalesce(p_metadata_overrides,'{}'::jsonb)||jsonb_build_object('release_factory','runtime-child-release-v2','runtime_materialized_fact_inheritance',true));
 perform public.inherit_runtime_release_materialized_facts_v1(p_parent_code,p_child_code);
 return cid;
end;
$$;

create or replace function public.validate_runtime_materialized_fact_inheritance_v1(p_child_code text,p_parent_code text)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
with p as (select id from public.grammar_runtime_releases where code=p_parent_code), c as (select id from public.grammar_runtime_releases where code=p_child_code),
po as (select overlay_type,normalized_surface,lexical_class_code,pos,payload,provenance,is_enabled from public.grammar_runtime_lexical_overlays_v1 where release_id=(select id from p)),
co as (select overlay_type,normalized_surface,lexical_class_code,pos,payload,provenance,is_enabled from public.grammar_runtime_lexical_overlays_v1 where release_id=(select id from c)),
pd as (select fact_type,fact_key,source_kind,provenance,is_enabled from public.grammar_runtime_release_dependency_facts_v1 where release_id=(select id from p)),
cd as (select fact_type,fact_key,source_kind,provenance,is_enabled from public.grammar_runtime_release_dependency_facts_v1 where release_id=(select id from c))
select jsonb_build_object('version','runtime-materialized-fact-inheritance-validation-v1','parent',p_parent_code,'child',p_child_code,
 'parent_overlay_count',(select count(*) from po),'child_overlay_count',(select count(*) from co),
 'parent_dependency_count',(select count(*) from pd),'child_dependency_count',(select count(*) from cd),
 'missing_overlays',(select count(*) from (select * from po except select * from co) x),
 'missing_dependencies',(select count(*) from (select * from pd except select * from cd) x),
 'valid',not exists(select 1 from (select * from po except select * from co) x) and not exists(select 1 from (select * from pd except select * from cd) x));
$$;
