-- Beta only: enable membership verification; modules and privileged RPCs remain blocked.
DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.tenants) <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE tenant_code='QUALISPHERE-SANDBOX'
      AND status='provisioning' AND NOT is_internal
  ) OR has_schema_privilege('authenticated','public','USAGE') THEN
    RAISE EXCEPTION 'Expected locked sandbox company';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenant_module_access WHERE is_enabled) THEN
    RAISE EXCEPTION 'Sandbox modules must remain disabled';
  END IF;
END;
$guard$;

-- Remove inherited broad grants before permitting schema lookup.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Retain legacy policies but disable their SELECT rules, which depend on privileged RPCs.
DO $policies$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename,policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('tenants','tenant_memberships') AND cmd='SELECT'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (false)',p.policyname,p.tablename);
  END LOOP;
END;
$policies$;

CREATE POLICY sandbox_own_membership_read ON public.tenant_memberships
FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) IS NOT NULL
  AND lower(user_email)=lower(coalesce((SELECT auth.jwt())->>'email',''))
  AND membership_status='active'
);
CREATE POLICY sandbox_own_company_read ON public.tenants
FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) IS NOT NULL
  AND tenant_code='QUALISPHERE-SANDBOX'
  AND status IN ('provisioning','active')
  AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=tenants.id)
);

REVOKE USAGE ON SCHEMA public FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT(id,tenant_code,company_name,slug,status) ON public.tenants TO authenticated;
GRANT SELECT(id,tenant_id,user_email,membership_role,membership_status) ON public.tenant_memberships TO authenticated;
NOTIFY pgrst, 'reload schema';
