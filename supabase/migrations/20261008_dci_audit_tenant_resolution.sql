-- Resolve DCI tenant for audited claims and administrative-review events.
create or replace function public.qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid)
returns uuid language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$
declare v_type text:=lower(trim(coalesce(p_entity_type,''))); v_tenant uuid;
begin
 if p_entity_id is null then return null; end if;
 case v_type
  when 'ncmr' then select tenant_id into v_tenant from public.ncmrs where id=p_entity_id;
  when 'capa' then select tenant_id into v_tenant from public.capas where id=p_entity_id;
  when 'audit' then select tenant_id into v_tenant from public.audits where id=p_entity_id;
  when 'audit_finding' then select tenant_id into v_tenant from public.audit_findings where id=p_entity_id;
  when 'management_review' then select tenant_id into v_tenant from public.management_reviews where id=p_entity_id;
  when 'management_review_approver' then select tenant_id into v_tenant from public.management_review_approvers where id=p_entity_id;
  when 'scar' then select tenant_id into v_tenant from public.scars where id=p_entity_id;
  when 'oos_oot' then select tenant_id into v_tenant from public.oos_oot_investigations where id=p_entity_id;
  when 'equipment' then select tenant_id into v_tenant from public.equipment where id=p_entity_id;
  when 'receiving_inspection' then select tenant_id into v_tenant from public.receiving_inspections where id=p_entity_id;
  when 'supplier' then select tenant_id into v_tenant from public.suppliers where id=p_entity_id;
  when 'supplier_audit' then select tenant_id into v_tenant from public.supplier_audits where id=p_entity_id;
  when 'supplier_document' then select tenant_id into v_tenant from public.supplier_documents where id=p_entity_id;
  when 'document_change_initiation' then select tenant_id into v_tenant from public.document_change_initiations where id=p_entity_id;
  when 'tenant_user' then select id into v_tenant from public.tenants where id=p_entity_id;
  else v_tenant:=null;
 end case;
 return v_tenant;
end $$;