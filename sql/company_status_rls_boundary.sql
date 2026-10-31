-- A company-wide status boundary supplements, never replaces, existing
-- tenant, role and module policies on current tenant-owned RLS tables.
create or replace function public.qualisphere_company_is_active(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tenants where id=p_tenant_id and status='active');
$$;
revoke all on function public.qualisphere_company_is_active(uuid) from public,anon;
grant execute on function public.qualisphere_company_is_active(uuid) to authenticated;
do $$
declare item record;
begin
 for item in
   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   join pg_attribute a on a.attrelid=c.oid
   where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
   and a.attname='tenant_id' and a.atttypid='uuid'::regtype and not a.attisdropped
 loop
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=item.relname and policyname='qualisphere_active_company_status') then
   execute format('create policy qualisphere_active_company_status on public.%I as restrictive for all to authenticated using (tenant_id is null or (select public.is_platform_admin()) or public.qualisphere_company_is_active(tenant_id)) with check (tenant_id is null or (select public.is_platform_admin()) or public.qualisphere_company_is_active(tenant_id))',item.relname);
   end if;
 end loop;
end $$;
notify pgrst,'reload schema';
