-- Audit Trail tenantization
alter table public.audit_logs add column if not exists tenant_id uuid references public.tenants(id);

create or replace function public.qualisphere_audit_entity_tenant(p_entity_type text,p_entity_id uuid)
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
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
  when 'tenant_user' then select id into v_tenant from public.tenants where id=p_entity_id;
  else v_tenant:=null;
 end case;
 return v_tenant;
end $$;

update public.audit_logs al set tenant_id=public.qualisphere_audit_entity_tenant(al.entity_type,al.entity_id) where al.tenant_id is null;

do $$ declare v_unresolved bigint; begin
 select count(*) into v_unresolved from public.audit_logs where tenant_id is null;
 if v_unresolved<>0 then raise exception 'Audit Trail tenantization stopped: % historical rows remain unresolved.',v_unresolved; end if;
end $$;

alter table public.audit_logs alter column tenant_id set not null;
create index if not exists idx_audit_logs_tenant_created_at on public.audit_logs(tenant_id,created_at desc);
create index if not exists idx_audit_logs_tenant_entity on public.audit_logs(tenant_id,entity_type,entity_id);
alter table public.audit_logs enable row level security;
drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
drop policy if exists "Authenticated users can read audit logs" on public.audit_logs;
drop policy if exists "audit_logs_tenant_select" on public.audit_logs;
create policy "audit_logs_tenant_select" on public.audit_logs for select to authenticated using(public.is_tenant_member(tenant_id));

create or replace function public.qualisphere_add_audit_log(p_entity_type text,p_entity_id uuid,p_action text,p_details text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_user_email text; v_tenant_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication is required to create an audit log.'; end if;
 select lower(trim(u.email)) into v_user_email from auth.users u where u.id=auth.uid();
 if coalesce(v_user_email,'')='' then raise exception 'Authenticated user email could not be determined.'; end if;
 if nullif(trim(p_entity_type),'') is null then raise exception 'Audit entity type is required.'; end if;
 if p_entity_id is null then raise exception 'Audit entity ID is required.'; end if;
 if nullif(trim(p_action),'') is null then raise exception 'Audit action is required.'; end if;
 v_tenant_id:=public.qualisphere_audit_entity_tenant(p_entity_type,p_entity_id);
 if v_tenant_id is null then raise exception 'Unable to resolve Company Account for audit entity % (%).',p_entity_type,p_entity_id; end if;
 if not public.is_tenant_member(v_tenant_id) then raise exception 'Audit event Company Account does not match an active Company Account membership.'; end if;
 insert into public.audit_logs(tenant_id,entity_type,entity_id,action,details,user_email)
 values(v_tenant_id,lower(trim(p_entity_type)),p_entity_id,trim(p_action),nullif(trim(p_details),''),v_user_email);
end $$;

revoke insert,update,delete on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;
grant execute on function public.qualisphere_add_audit_log(text,uuid,text,text) to authenticated;
