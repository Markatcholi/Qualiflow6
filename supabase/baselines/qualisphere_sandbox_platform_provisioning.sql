-- Beta-only platform provisioning. Apply after standard sandbox administration.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE tenant_code='QUALISPHERE-SANDBOX' AND status='provisioning' AND NOT is_internal)
 OR EXISTS(SELECT 1 FROM public.tenant_module_access WHERE is_enabled) THEN RAISE EXCEPTION 'Expected sandbox preparation deployment'; END IF;
END $$;
CREATE TABLE public.sandbox_company_environments(
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 environment_kind text NOT NULL DEFAULT 'sandbox' CHECK(environment_kind='sandbox'),
 baseline_version text NOT NULL DEFAULT 'initial-admin-v1',
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 provisioning_request_id uuid UNIQUE,
 provisioning_input jsonb
);
ALTER TABLE public.sandbox_company_environments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sandbox_company_environments FROM PUBLIC,anon,authenticated;
GRANT SELECT(tenant_id,environment_kind,baseline_version,created_by,created_at) ON public.sandbox_company_environments TO authenticated;
INSERT INTO public.sandbox_company_environments(tenant_id,created_by)
 SELECT id,'existing sandbox registration' FROM public.tenants WHERE tenant_code='QUALISPHERE-SANDBOX';

CREATE OR REPLACE FUNCTION qualisphere_sandbox_auth.preparing_company(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.tenants t JOIN public.sandbox_company_environments e ON e.tenant_id=t.id
 WHERE t.id=p_tenant AND t.status='provisioning' AND NOT t.is_internal AND e.environment_kind='sandbox');
$$;
CREATE OR REPLACE FUNCTION qualisphere_sandbox_auth.company_admin(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND qualisphere_sandbox_auth.preparing_company(p_tenant) AND EXISTS(
 SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=p_tenant
 AND lower(m.user_email)=lower(coalesce(auth.jwt()->>'email','')) AND m.membership_role='company_admin' AND m.membership_status='active');
$$;
CREATE FUNCTION qualisphere_sandbox_auth.company_member(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.sandbox_company_environments e JOIN public.tenants t ON t.id=e.tenant_id JOIN public.tenant_memberships m ON m.tenant_id=t.id
 WHERE t.id=p_tenant AND NOT t.is_internal AND t.status IN ('provisioning','active')
 AND lower(m.user_email)=lower(coalesce(auth.jwt()->>'email','')) AND m.membership_status='active');
$$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.company_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.company_member(uuid) TO authenticated;
CREATE POLICY sandbox_environment_read ON public.sandbox_company_environments FOR SELECT TO authenticated
 USING(public.is_platform_admin() OR qualisphere_sandbox_auth.company_member(tenant_id));
ALTER POLICY sandbox_own_company_read ON public.tenants USING(qualisphere_sandbox_auth.company_member(id));

CREATE OR REPLACE FUNCTION public.qualisphere_sandbox_assign_company_admin(p_tenant uuid,p_email text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_email text:=lower(btrim(p_email));
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform Administrator required'; END IF;
 IF NOT qualisphere_sandbox_auth.preparing_company(p_tenant) THEN RAISE EXCEPTION 'Expected registered sandbox company'; END IF;
 IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid email required'; END IF;
 UPDATE public.tenant_memberships SET membership_role='company_admin',membership_status='active',updated_at=now() WHERE tenant_id=p_tenant AND lower(user_email)=v_email;
 IF NOT FOUND THEN INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status,invited_by,invited_at)
 VALUES(p_tenant,v_email,'company_admin','active',lower(auth.jwt()->>'email'),now()); END IF;
END $$;

-- The private function is the single provisioning transaction. Clients receive no direct
-- INSERT privileges on tenants, environment registry, module access or platform authority.
CREATE FUNCTION qualisphere_sandbox_auth.create_company(p_request uuid,p_company_name text,p_legal_name text,p_tenant_code text,p_slug text,p_contact_email text,p_admin_email text,p_country text,p_timezone text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_previous jsonb; v_input jsonb; v_actor text:=lower(coalesce(auth.jwt()->>'email',''));
 v_name text:=btrim(p_company_name);v_code text:=upper(btrim(p_tenant_code));v_slug text:=lower(btrim(p_slug));v_admin text:=lower(btrim(p_admin_email));v_contact text:=lower(btrim(p_contact_email));
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform Administrator required'; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Provisioning request ID required'; END IF;
 IF nullif(v_name,'') IS NULL OR length(v_name)>200 THEN RAISE EXCEPTION 'Company name must contain 1 to 200 characters'; END IF;
 IF v_code IS NULL OR v_code !~ '^[A-Z0-9][A-Z0-9-]{0,39}$' THEN RAISE EXCEPTION 'Tenant code must use 1 to 40 letters, digits or hyphens'; END IF;
 IF v_slug IS NULL OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(v_slug)>80 THEN RAISE EXCEPTION 'Use a slug of lowercase letters, digits and single hyphens (maximum 80 characters)'; END IF;
 IF v_admin IS NULL OR v_admin !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR v_contact IS NULL OR v_contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid administrator and contact emails required'; END IF;
 IF p_country IS NULL OR upper(btrim(p_country)) !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Use a two-letter country code'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Choose a valid time zone'; END IF;
 v_input:=jsonb_build_array(v_name,nullif(btrim(p_legal_name),''),v_code,v_slug,v_contact,v_admin,upper(btrim(p_country)),p_timezone);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT tenant_id,provisioning_input INTO v_id,v_previous FROM public.sandbox_company_environments WHERE provisioning_request_id=p_request;
 IF FOUND THEN
  IF v_previous IS DISTINCT FROM v_input THEN RAISE EXCEPTION 'This request ID was already used for different company details'; END IF;
  RETURN v_id;
 END IF;
 INSERT INTO public.tenants(tenant_code,company_name,legal_name,slug,status,is_internal,primary_contact_email,country_code,default_timezone,created_by)
 VALUES(v_code,v_name,nullif(btrim(p_legal_name),''),v_slug,'provisioning',false,v_contact,upper(btrim(p_country)),p_timezone,v_actor) RETURNING id INTO v_id;
 INSERT INTO public.sandbox_company_environments(tenant_id,created_by,provisioning_request_id,provisioning_input) VALUES(v_id,v_actor,p_request,v_input);
 -- Existing tenant triggers seed the immutable global starter-role catalog and impact areas.
 -- No customer company is used as a source template.
 INSERT INTO public.company_settings(tenant_id,company_name,timezone,enable_notifications,enable_overdue_scan,enable_email_notifications,overdue_scan_mode)
 VALUES(v_id,v_name,p_timezone,false,false,false,'manual');
 INSERT INTO public.tenant_module_access(tenant_id,module_code,is_enabled,enabled_by)
 SELECT v_id,code,false,v_actor FROM unnest(ARRAY['ncmr','capa','scar','change_control','controlled_documents','training','equipment','audit','management_review','complaints','oos_oot']) code;
 INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status,invited_by,invited_at)
 VALUES(v_id,v_admin,'company_admin','active',v_actor,now());
 INSERT INTO public.training_methods(tenant_id,code,label,release_blocking,acknowledgement_required,evidence_required,is_active)
 VALUES(v_id,'READ_ACK','Read and Acknowledge',false,true,false,true),
 (v_id,'CLASSROOM','Classroom Training',false,false,true,true),
 (v_id,'CERTIFICATION','Certification',false,false,true,true);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.create_company(uuid,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.create_company(uuid,text,text,text,text,text,text,text,text) TO authenticated;
CREATE FUNCTION public.qualisphere_sandbox_create_company(p_request uuid,p_company_name text,p_legal_name text,p_tenant_code text,p_slug text,p_contact_email text,p_admin_email text,p_country text,p_timezone text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT qualisphere_sandbox_auth.create_company(p_request,p_company_name,p_legal_name,p_tenant_code,p_slug,p_contact_email,p_admin_email,p_country,p_timezone);
$$;
REVOKE ALL ON FUNCTION public.qualisphere_sandbox_create_company(uuid,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_sandbox_create_company(uuid,text,text,text,text,text,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
