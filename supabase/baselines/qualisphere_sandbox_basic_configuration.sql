-- Apply only to the isolated Beta project after limited login verification.
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.tenants)<>1 OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE tenant_code='QUALISPHERE-SANDBOX' AND status='provisioning' AND NOT is_internal)
 OR EXISTS(SELECT 1 FROM public.tenant_module_access WHERE is_enabled) THEN
   RAISE EXCEPTION 'Expected sandbox preparation state';
 END IF;
END;
$guard$;

-- Retain existing policies, disabling their broad rules for the newly exposed tables.
DO $policies$
DECLARE p record;
BEGIN
 FOR p IN SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('company_settings','md_departments') LOOP
   IF p.cmd='INSERT' THEN
     EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (false)',p.policyname,p.tablename);
   ELSIF p.cmd IN ('UPDATE','ALL') THEN
     EXECUTE format('ALTER POLICY %I ON public.%I USING (false) WITH CHECK (false)',p.policyname,p.tablename);
   ELSE
     EXECUTE format('ALTER POLICY %I ON public.%I USING (false)',p.policyname,p.tablename);
   END IF;
 END LOOP;
 -- Preserve the login SELECT policy; only disable legacy tenant writes.
 FOR p IN SELECT policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename='tenants' AND cmd='UPDATE' LOOP
   EXECUTE format('ALTER POLICY %I ON public.tenants USING (false) WITH CHECK (false)',p.policyname);
 END LOOP;
END;
$policies$;

CREATE FUNCTION public.qualisphere_sandbox_configuration_admin(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id
   WHERE m.tenant_id=p_tenant AND lower(m.user_email)=lower(coalesce(auth.jwt()->>'email',''))
   AND m.membership_status='active' AND m.membership_role='company_admin'
   AND t.tenant_code='QUALISPHERE-SANDBOX' AND t.status='provisioning' AND NOT t.is_internal
 );
$$;
REVOKE ALL ON FUNCTION public.qualisphere_sandbox_configuration_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_sandbox_configuration_admin(uuid) TO authenticated;

CREATE POLICY sandbox_company_profile_update ON public.tenants FOR UPDATE TO authenticated
 USING(public.qualisphere_sandbox_configuration_admin(id))
 WITH CHECK(public.qualisphere_sandbox_configuration_admin(id));
CREATE POLICY sandbox_settings_read ON public.company_settings FOR SELECT TO authenticated
 USING(public.qualisphere_sandbox_configuration_admin(tenant_id));
CREATE POLICY sandbox_settings_update ON public.company_settings FOR UPDATE TO authenticated
 USING(public.qualisphere_sandbox_configuration_admin(tenant_id))
 WITH CHECK(public.qualisphere_sandbox_configuration_admin(tenant_id));
CREATE POLICY sandbox_departments_manage ON public.md_departments FOR ALL TO authenticated
 USING(public.qualisphere_sandbox_configuration_admin(tenant_id))
 WITH CHECK(public.qualisphere_sandbox_configuration_admin(tenant_id));

GRANT SELECT(default_timezone,is_internal) ON public.tenants TO authenticated;
GRANT UPDATE(company_name,default_timezone) ON public.tenants TO authenticated;
GRANT SELECT(tenant_id,company_name,timezone) ON public.company_settings TO authenticated;
GRANT UPDATE(company_name,timezone) ON public.company_settings TO authenticated;
GRANT SELECT,DELETE ON public.md_departments TO authenticated;
GRANT INSERT(tenant_id,code,label),UPDATE(code,label) ON public.md_departments TO authenticated;
CREATE UNIQUE INDEX sandbox_department_code_unique ON public.md_departments(tenant_id,lower(btrim(code)));

CREATE FUNCTION public.qualisphere_sandbox_save_profile(p_tenant uuid,p_company_name text,p_timezone text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.qualisphere_sandbox_configuration_admin(p_tenant) THEN RAISE EXCEPTION 'Sandbox company administrator required'; END IF;
 IF nullif(btrim(p_company_name),'') IS NULL OR length(btrim(p_company_name))>200 THEN RAISE EXCEPTION 'Company name must contain 1 to 200 characters'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Choose a valid time zone'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=p_tenant) THEN RAISE EXCEPTION 'Company settings are missing'; END IF;
 UPDATE public.tenants SET company_name=btrim(p_company_name),default_timezone=p_timezone WHERE id=p_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company profile could not be saved'; END IF;
 UPDATE public.company_settings SET company_name=btrim(p_company_name),timezone=p_timezone WHERE tenant_id=p_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company settings could not be saved'; END IF;
END;
$$;
CREATE FUNCTION public.qualisphere_sandbox_save_department(p_tenant uuid,p_id uuid,p_code text,p_label text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.qualisphere_sandbox_configuration_admin(p_tenant) THEN RAISE EXCEPTION 'Sandbox company administrator required'; END IF;
 IF nullif(btrim(p_code),'') IS NULL OR length(btrim(p_code))>50 OR nullif(btrim(p_label),'') IS NULL OR length(btrim(p_label))>200 THEN RAISE EXCEPTION 'Department code and name are required (maximum 50 and 200 characters)'; END IF;
 IF p_id IS NULL THEN
   INSERT INTO public.md_departments(tenant_id,code,label) VALUES(p_tenant,btrim(p_code),btrim(p_label));
 ELSE
   UPDATE public.md_departments SET code=btrim(p_code),label=btrim(p_label) WHERE id=p_id AND tenant_id=p_tenant;
   IF NOT FOUND THEN RAISE EXCEPTION 'Department was not found in your sandbox company'; END IF;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.qualisphere_sandbox_save_profile(uuid,text,text),public.qualisphere_sandbox_save_department(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_sandbox_save_profile(uuid,text,text),public.qualisphere_sandbox_save_department(uuid,uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
