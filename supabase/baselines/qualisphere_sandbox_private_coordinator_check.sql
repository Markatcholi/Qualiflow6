-- Keep the reviewed training-role lookup outside exposed API schemas.
CREATE FUNCTION qualisphere_sandbox_auth.training_is_coordinator(p_tenant uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
select auth.uid() is not null and p_tenant is not null and (
 exists(select 1 from public.tenant_memberships m
 join public.tenant_user_role_assignments a on a.tenant_id=m.tenant_id and lower(a.user_email)=lower(m.user_email) and a.is_active=true
 join public.customer_roles r on r.id=a.role_id and r.tenant_id=m.tenant_id and r.is_active=true
 where m.tenant_id=p_tenant and lower(m.user_email)=lower(auth.jwt()->>'email') and m.membership_status='active'
 and lower(r.role_name) in ('training coordinator','training administrator','document control coordinator','administrator','vp quality'))
 or (exists(select 1 from public.tenants t where t.id=p_tenant and t.is_internal=true)
 and exists(select 1 from public.user_roles ur where lower(ur.user_email)=lower(auth.jwt()->>'email')
 and lower(coalesce(ur.role,'')) in ('admin','training_admin','vp_quality')))
);
$$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.training_is_coordinator(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.training_is_coordinator(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.qualisphere_training_is_coordinator(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT qualisphere_sandbox_auth.training_is_coordinator(p_tenant); $$;
NOTIFY pgrst,'reload schema';
