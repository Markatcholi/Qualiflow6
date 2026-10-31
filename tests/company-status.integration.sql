-- psql -v tenant_id=... -v internal_id=... -v platform_email=... -v customer_email=... -f tests/company-status.integration.sql
\set ON_ERROR_STOP on
begin;
select set_config('test.tenant_id', :'tenant_id', true);
select set_config('test.internal_id', :'internal_id', true);
select set_config('test.platform_email', lower(:'platform_email'), true);
select set_config('test.customer_email', lower(:'customer_email'), true);
select set_config('test.customer_claims',(select jsonb_build_object('sub',id,'email',email,'role','authenticated')::text from auth.users where lower(email)=current_setting('test.customer_email')),true);
select set_config('test.platform_uid',(select id::text from auth.users where lower(email)=current_setting('test.platform_email')),true);
select set_config('test.memberships_before',(select md5(jsonb_agg(to_jsonb(m) order by m.id)::text) from public.tenant_memberships m where tenant_id=current_setting('test.tenant_id')::uuid),true);
select set_config('test.modules_before',(select md5(jsonb_agg(to_jsonb(m) order by m.id)::text) from public.tenant_module_access m where tenant_id=current_setting('test.tenant_id')::uuid),true);
select set_config('request.jwt.claims',current_setting('test.customer_claims'),true);
set local role authenticated;
do $$
declare t uuid:=current_setting('test.tenant_id')::uuid; platform_claims text:=jsonb_build_object('sub',current_setting('test.platform_uid'),'email',current_setting('test.platform_email'),'role','authenticated')::text;
begin
 if not public.qualisphere_is_active_tenant_member(t) then raise exception 'Active company access precondition failed'; end if;
 begin perform public.qualisphere_set_company_status(t,'inactive','active'); raise exception 'Customer changed status' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like '%Platform Administrator access required%' then raise; end if; end;
 begin update public.tenants set status='inactive' where id=t; raise exception 'Direct customer change accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like '%Only QualiSphere Platform Administration%' then raise; end if; end;
 perform set_config('request.jwt.claims',platform_claims,true);
 begin perform public.qualisphere_set_company_status(current_setting('test.internal_id')::uuid,'inactive','active'); raise exception 'Internal company changed' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like '%Internal environment%' then raise; end if; end;
 begin perform public.qualisphere_set_company_status(t,'invalid','active'); raise exception 'Invalid status accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like '%active or inactive%' then raise; end if; end;
 perform public.qualisphere_set_company_status(t,'inactive','active');
 if (select status from public.tenants where id=t)<>'inactive' then raise exception 'Platform cannot view inactive status'; end if;
 begin perform public.qualisphere_set_company_status(t,'active','active'); raise exception 'Stale update accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like '%status changed%' then raise; end if; end;
 perform set_config('request.jwt.claims',current_setting('test.customer_claims'),true);
 if public.qualisphere_is_active_tenant_member(t) or public.qualisphere_is_company_admin(t) or public.is_tenant_admin(t) or public.qualisphere_tenant_module_enabled(t,'ncmr') or public.qualisphere_training_is_coordinator(t) then raise exception 'Inactive company authorization remains'; end if;
 if exists(select 1 from public.employee_profiles where tenant_id=t) then raise exception 'Inactive company profile RLS remains'; end if;
 if exists(select 1 from public.tenant_user_profiles where tenant_id=t) then raise exception 'Inactive company user RLS remains'; end if;
 begin perform public.qualisphere_set_company_status(t,'active','inactive'); raise exception 'Customer reactivated company' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like '%Platform Administrator access required%' then raise; end if; end;
 perform set_config('request.jwt.claims',platform_claims,true);
 perform public.qualisphere_set_company_status(t,'active','inactive');
 perform set_config('request.jwt.claims',current_setting('test.customer_claims'),true);
 if not public.qualisphere_is_active_tenant_member(t) or not public.qualisphere_is_company_admin(t) then raise exception 'Reactivation did not restore authority'; end if;
 if not exists(select 1 from public.employee_profiles where tenant_id=t) then raise exception 'Reactivation did not restore data visibility'; end if;
end $$;
reset role;
do $$ begin
 if current_setting('test.memberships_before')<>(select md5(jsonb_agg(to_jsonb(m) order by m.id)::text) from public.tenant_memberships m where tenant_id=current_setting('test.tenant_id')::uuid) then raise exception 'Employee access changed'; end if;
 if current_setting('test.modules_before')<>(select md5(jsonb_agg(to_jsonb(m) order by m.id)::text) from public.tenant_module_access m where tenant_id=current_setting('test.tenant_id')::uuid) then raise exception 'Subscriptions changed'; end if;
 if (select count(*) from public.audit_logs where action='company_status_changed' and tenant_id=current_setting('test.tenant_id')::uuid and user_email=current_setting('test.platform_email') and created_at>=transaction_timestamp()::timestamp)<>2 then raise exception 'Status audit records missing'; end if;
end $$;
rollback;
