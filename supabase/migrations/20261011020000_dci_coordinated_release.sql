-- Final DCI release is one database transaction. Stamped PDFs are staged before this RPC.
create or replace function public.qualisphere_release_dci_coordinated(p_dci_id uuid,p_effective_date date,p_manifest jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_dci record; v_doc record; v_item jsonb; v_count integer; v_email text;
begin
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 if auth.uid() is null or v_email='' then raise exception 'Authentication required'; end if;
 if p_effective_date is null or p_effective_date<current_date then raise exception 'Choose a current or future effective date'; end if;
 select * into v_dci from public.document_change_initiations where id=p_dci_id for update;
 if not found or v_dci.status<>'release_ready' or v_dci.release_strategy<>'coordinated' then raise exception 'DCI not eligible for coordinated release'; end if;
 if not public.qualisphere_is_active_tenant_member(v_dci.tenant_id) or not public.qualisphere_tenant_module_enabled(v_dci.tenant_id,'controlled_documents') then raise exception 'Company Account access denied'; end if;
 if not exists(select 1 from public.tenant_user_role_assignments a join public.customer_roles r on r.id=a.role_id where a.tenant_id=v_dci.tenant_id and lower(a.user_email)=v_email and a.is_active and r.is_active and lower(r.role_name)='document control coordinator')
 and not exists(select 1 from public.user_security_roles where lower(user_email)=v_email and role_code='document_control_coordinator') then raise exception 'Document Control Coordinator role required'; end if;
 if jsonb_typeof(p_manifest) is distinct from 'array' then raise exception 'Controlled-copy manifest required'; end if;
 if not exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_formal_approval' and status='approved')
 or exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_formal_approval' and status not in ('approved','cancelled')) then raise exception 'Formal approvals incomplete'; end if;
 if not exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_post_approval_coordination' and status='completed')
 or exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_post_approval_action' and status not in ('cancelled') and (status<>'completed' or implementation_verification_status is distinct from 'verified')) then raise exception 'Post-approval tasks incomplete'; end if;
 select count(*) into v_count from public.document_change_initiation_documents where dci_id=p_dci_id and tenant_id=v_dci.tenant_id;
 if v_count=0 or jsonb_array_length(p_manifest)<>v_count then raise exception 'Manifest must include every linked document exactly once'; end if;
 perform 1 from public.controlled_documents cd join public.document_change_initiation_documents l on l.document_id=cd.id where l.dci_id=p_dci_id order by cd.id for update of cd;
 for v_doc in select cd.* from public.controlled_documents cd join public.document_change_initiation_documents l on l.document_id=cd.id where l.dci_id=p_dci_id and l.tenant_id=v_dci.tenant_id order by cd.id loop
  if v_doc.tenant_id is distinct from v_dci.tenant_id or coalesce(v_doc.file_path,v_doc.file_url) is null or v_doc.release_pdf_file_path is null then raise exception 'Document master or final PDF missing: %',v_doc.document_number; end if;
  if not exists(select 1 from public.dci_pdf_verifications where dci_id=p_dci_id and document_id=v_doc.id and tenant_id=v_dci.tenant_id and pdf_storage_path=v_doc.release_pdf_file_path) then raise exception 'PDF verification missing: %',v_doc.document_number; end if;
  if exists(select 1 from public.document_training_requirements r join public.training_methods m on m.id=r.training_method_id where r.document_id=v_doc.id and m.release_blocking and not exists(select 1 from public.training_assignments a where a.training_requirement_id=r.id and a.document_id=v_doc.id and a.tenant_id=v_dci.tenant_id and a.release_blocking))
  or exists(select 1 from public.training_assignments a where a.document_id=v_doc.id and a.tenant_id=v_dci.tenant_id and a.release_blocking and a.status not in ('completed','waived')) then raise exception 'Blocking training incomplete: %',v_doc.document_number; end if;
  select value into v_item from jsonb_array_elements(p_manifest) where value->>'document_id'=v_doc.id::text;
  if v_item is null or (select count(*) from jsonb_array_elements(p_manifest) where value->>'document_id'=v_doc.id::text)<>1 then raise exception 'Controlled-copy manifest mismatch: %',v_doc.document_number; end if;
  if v_item->>'source_path' is distinct from v_doc.release_pdf_file_path or v_item->>'document_number' is distinct from v_doc.document_number or v_item->>'revision' is distinct from v_doc.revision then raise exception 'Controlled-copy identity mismatch: %',v_doc.document_number; end if;
  if coalesce(v_item->>'path','') not like 'tenant/'||v_dci.tenant_id::text||'/%/controlled-copies/%' then raise exception 'Invalid controlled-copy path: %',v_doc.document_number; end if;
  if not exists(select 1 from storage.objects where bucket_id='controlled-documents' and name=v_item->>'path') then raise exception 'Controlled-copy object missing: %',v_doc.document_number; end if;
  if v_doc.superseded_document_id is not null and not exists(select 1 from public.controlled_documents where id=v_doc.superseded_document_id and tenant_id=v_dci.tenant_id and document_number=v_doc.document_number) then raise exception 'Previous revision mismatch: %',v_doc.document_number; end if;
 end loop;
 for v_doc in select cd.* from public.controlled_documents cd join public.document_change_initiation_documents l on l.document_id=cd.id where l.dci_id=p_dci_id and l.tenant_id=v_dci.tenant_id order by cd.id loop
  select value into v_item from jsonb_array_elements(p_manifest) where value->>'document_id'=v_doc.id::text;
  update public.controlled_documents set status='release',effective_date=p_effective_date,controlled_copy_file_name=v_item->>'file_name',controlled_copy_file_path=v_item->>'path',controlled_copy_file_url=null,controlled_copy_generated_at=now(),controlled_copy_generated_by=v_email,release_approved_by=v_email,release_approved_at=now(),updated_at=now() where id=v_doc.id and tenant_id=v_dci.tenant_id;
  if v_doc.superseded_document_id is not null then update public.controlled_documents set status='superseded',superseded_by_document_id=v_doc.id,updated_at=now() where id=v_doc.superseded_document_id and tenant_id=v_dci.tenant_id; end if;
  perform public.qualisphere_add_audit_log('controlled_document',v_doc.id,'dci_coordinated_release','Released by '||v_email||' effective '||p_effective_date::text);
 end loop;
 update public.document_change_initiations set status='released',updated_at=now() where id=p_dci_id and tenant_id=v_dci.tenant_id;
 perform public.qualisphere_add_audit_log('document_change_initiation',p_dci_id,'dci_coordinated_release','Coordinated release of '||v_count||' documents by '||v_email);
end $$;
revoke all on function public.qualisphere_release_dci_coordinated(uuid,date,jsonb) from public;
grant execute on function public.qualisphere_release_dci_coordinated(uuid,date,jsonb) to authenticated;
