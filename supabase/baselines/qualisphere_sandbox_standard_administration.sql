-- Standard QualiSphere administration, only in the isolated preparation-stage sandbox.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.tenants)<>1 OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE tenant_code='QUALISPHERE-SANDBOX' AND status='provisioning' AND NOT is_internal)
 OR EXISTS(SELECT 1 FROM public.tenant_module_access WHERE is_enabled) THEN RAISE EXCEPTION 'Expected isolated sandbox preparation state'; END IF;
END $$;

-- Private lookup is required to avoid recursive membership RLS. Never exposed as a REST RPC.
CREATE SCHEMA qualisphere_sandbox_auth;
REVOKE ALL ON SCHEMA qualisphere_sandbox_auth FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA qualisphere_sandbox_auth TO authenticated;
CREATE FUNCTION qualisphere_sandbox_auth.company_admin(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id
 WHERE m.tenant_id=p_tenant AND lower(m.user_email)=lower(coalesce(auth.jwt()->>'email',''))
 AND m.membership_role='company_admin' AND m.membership_status='active'
 AND t.tenant_code='QUALISPHERE-SANDBOX' AND t.status='provisioning' AND NOT t.is_internal);
$$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.company_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.company_admin(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.qualisphere_sandbox_configuration_admin(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT qualisphere_sandbox_auth.company_admin(p_tenant); $$;
CREATE OR REPLACE FUNCTION public.qualisphere_is_company_admin(p_tenant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT public.qualisphere_sandbox_configuration_admin(p_tenant_id); $$;
GRANT EXECUTE ON FUNCTION public.qualisphere_is_company_admin(uuid) TO authenticated;

-- Disable inherited membership write policies before granting limited administration.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename='tenant_memberships' AND cmd IN ('INSERT','UPDATE','DELETE','ALL') LOOP
 IF p.cmd='INSERT' THEN EXECUTE format('ALTER POLICY %I ON public.tenant_memberships WITH CHECK(false)',p.policyname);
 ELSIF p.cmd IN ('ALL','UPDATE') THEN EXECUTE format('ALTER POLICY %I ON public.tenant_memberships USING(false) WITH CHECK(false)',p.policyname);
 ELSE EXECUTE format('ALTER POLICY %I ON public.tenant_memberships USING(false)',p.policyname); END IF;
 END LOOP;
END $$;
REVOKE UPDATE(company_name) ON public.tenants,public.company_settings FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.qualisphere_sandbox_save_profile(uuid,text,text),public.qualisphere_sandbox_save_department(uuid,uuid,text,text) FROM authenticated;

CREATE FUNCTION qualisphere_sandbox_auth.preparing_company(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant AND tenant_code='QUALISPHERE-SANDBOX' AND status='provisioning' AND NOT is_internal);
$$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.preparing_company(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.preparing_company(uuid) TO authenticated;

-- Platform authority is a separate, server-managed identity catalog; no client can edit it.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='platform_administrators' LOOP
 EXECUTE format('ALTER POLICY %I ON public.platform_administrators USING(false)',p.policyname); END LOOP;
END $$;
CREATE POLICY sandbox_platform_self ON public.platform_administrators FOR SELECT TO authenticated
 USING(auth.uid() IS NOT NULL AND lower(user_email)=lower(coalesce(auth.jwt()->>'email','')) AND is_active);
GRANT SELECT(user_email,is_active) ON public.platform_administrators TO authenticated;
CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.platform_administrators WHERE is_active AND lower(user_email)=lower(coalesce(auth.jwt()->>'email','')));
$$;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT SELECT ON public.tenants,public.tenant_memberships,public.tenant_module_access TO authenticated;
CREATE POLICY sandbox_platform_company_read ON public.tenants FOR SELECT TO authenticated USING(public.is_platform_admin());
CREATE POLICY sandbox_platform_members_read ON public.tenant_memberships FOR SELECT TO authenticated USING(public.is_platform_admin());
-- Disable inherited broad module-access read rules before exposing the registry.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename='tenant_module_access' LOOP
 IF p.cmd='INSERT' THEN EXECUTE format('ALTER POLICY %I ON public.tenant_module_access WITH CHECK(false)',p.policyname);
 ELSIF p.cmd IN ('ALL','UPDATE') THEN EXECUTE format('ALTER POLICY %I ON public.tenant_module_access USING(false) WITH CHECK(false)',p.policyname);
 ELSE EXECUTE format('ALTER POLICY %I ON public.tenant_module_access USING(false)',p.policyname); END IF;
 END LOOP;
END $$;
CREATE POLICY sandbox_platform_modules_read ON public.tenant_module_access FOR SELECT TO authenticated USING(public.is_platform_admin());

-- Replace rules on configuration tables only; operational writes remain unavailable.
DO $$ DECLARE t text;p record; BEGIN
 FOREACH t IN ARRAY ARRAY['company_settings','company_dashboard_kpi_configuration','custom_kpi_definitions','kpi_library','kpi_library_definitions','md_departments','md_product_part_numbers','md_dispositions','md_detection_sources','md_material_statuses','md_defect_categories','md_defect_subcategories','md_rooms','md_equipment','md_test_methods','md_oos_limits','md_document_impact_areas','customer_roles','tenant_user_profiles','tenant_user_role_assignments','training_groups','training_group_members','training_methods','document_impact_assessments','training_assignments','document_training_requirements'] LOOP
 FOR p IN SELECT policyname,cmd,permissive FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
 IF t='training_methods' AND p.permissive='RESTRICTIVE' THEN CONTINUE; END IF;
 IF p.cmd='INSERT' THEN EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK(false)',p.policyname,t);
 ELSIF p.cmd IN ('ALL','UPDATE') THEN EXECUTE format('ALTER POLICY %I ON public.%I USING(false) WITH CHECK(false)',p.policyname,t);
 ELSE EXECUTE format('ALTER POLICY %I ON public.%I USING(false)',p.policyname,t); END IF;
 END LOOP;
 IF t IN ('kpi_library','kpi_library_definitions') THEN
 EXECUTE format('CREATE POLICY sandbox_config_catalog ON public.%I FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.tenants WHERE public.qualisphere_sandbox_configuration_admin(id)))',t);
 ELSE
 EXECUTE format('CREATE POLICY sandbox_config_read ON public.%I FOR SELECT TO authenticated USING(public.qualisphere_sandbox_configuration_admin(tenant_id))',t);
 END IF;
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 IF t NOT IN ('kpi_library','kpi_library_definitions','company_settings','training_assignments','document_training_requirements','document_impact_assessments') THEN
 EXECUTE format('CREATE POLICY sandbox_config_write ON public.%I FOR ALL TO authenticated USING(public.qualisphere_sandbox_configuration_admin(tenant_id)) WITH CHECK(public.qualisphere_sandbox_configuration_admin(tenant_id))',t);
 EXECUTE format('GRANT INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 END IF;
 END LOOP;
END $$;
-- Enforce referenced role/group tenancy as well as the new row's tenant_id.
CREATE POLICY sandbox_role_same_company ON public.tenant_user_role_assignments AS RESTRICTIVE FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.customer_roles r WHERE r.id=role_id AND r.tenant_id=tenant_user_role_assignments.tenant_id))
 WITH CHECK(EXISTS(SELECT 1 FROM public.customer_roles r WHERE r.id=role_id AND r.tenant_id=tenant_user_role_assignments.tenant_id));
CREATE POLICY sandbox_group_same_company ON public.training_group_members AS RESTRICTIVE FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.training_groups g WHERE g.id=training_group_id AND g.tenant_id=training_group_members.tenant_id))
 WITH CHECK(EXISTS(SELECT 1 FROM public.training_groups g WHERE g.id=training_group_id AND g.tenant_id=training_group_members.tenant_id));

GRANT UPDATE(timezone,enable_notifications,enable_task_sla_dashboard,enable_escalation_dashboard,notification_default_frequency,overdue_bucket_1,overdue_bucket_2,overdue_bucket_3,allow_users_to_override_preferences,updated_at) ON public.company_settings TO authenticated;
CREATE POLICY sandbox_standard_settings_update ON public.company_settings FOR UPDATE TO authenticated
 USING(public.qualisphere_sandbox_configuration_admin(tenant_id)) WITH CHECK(public.qualisphere_sandbox_configuration_admin(tenant_id));
-- Sandbox jobs/email stay off regardless of UI or direct API requests.
ALTER TABLE public.company_settings ADD CONSTRAINT sandbox_no_outbound_jobs CHECK(NOT enable_email_notifications AND NOT enable_overdue_scan AND overdue_scan_mode IN ('manual','disabled'));
CREATE FUNCTION public.qualisphere_sandbox_save_settings(p_tenant uuid,p_settings jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.company_settings;
BEGIN
 IF NOT public.qualisphere_sandbox_configuration_admin(p_tenant) THEN RAISE EXCEPTION 'Company Administrator required'; END IF;
 SELECT * INTO STRICT v FROM public.company_settings WHERE tenant_id=p_tenant;
 SELECT * INTO v FROM jsonb_populate_record(v,p_settings);
 IF v.enable_email_notifications OR v.enable_overdue_scan OR v.overdue_scan_mode='scheduled' THEN RAISE EXCEPTION 'Sandbox email and overdue jobs are disabled during preparation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v.timezone) THEN RAISE EXCEPTION 'Choose a valid time zone'; END IF;
 IF v.overdue_bucket_1<1 OR v.overdue_bucket_2<=v.overdue_bucket_1 OR v.overdue_bucket_3<=v.overdue_bucket_2 THEN RAISE EXCEPTION 'SLA thresholds must be positive and increasing'; END IF;
 UPDATE public.company_settings SET timezone=v.timezone,enable_notifications=v.enable_notifications,enable_task_sla_dashboard=v.enable_task_sla_dashboard,
 enable_escalation_dashboard=v.enable_escalation_dashboard,notification_default_frequency=v.notification_default_frequency,
 overdue_bucket_1=v.overdue_bucket_1,overdue_bucket_2=v.overdue_bucket_2,overdue_bucket_3=v.overdue_bucket_3,
 allow_users_to_override_preferences=v.allow_users_to_override_preferences,updated_at=now() WHERE tenant_id=p_tenant;
 UPDATE public.tenants SET default_timezone=v.timezone WHERE id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.qualisphere_sandbox_save_settings(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_sandbox_save_settings(uuid,jsonb) TO authenticated;

CREATE FUNCTION public.qualisphere_sandbox_save_kpis(p_tenant uuid,p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.qualisphere_sandbox_configuration_admin(p_tenant) THEN RAISE EXCEPTION 'Company Administrator required'; END IF;
 IF jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'Expected KPI array'; END IF;
 DELETE FROM public.company_dashboard_kpi_configuration WHERE tenant_id=p_tenant;
 INSERT INTO public.company_dashboard_kpi_configuration(tenant_id,company_name,module_name,kpi_key,executive_dashboard,management_review,display_order)
 SELECT p_tenant,t.company_name,x.module_name,x.kpi_key,x.executive_dashboard,x.management_review,x.display_order
 FROM jsonb_to_recordset(p_rows) x(module_name text,kpi_key text,executive_dashboard boolean,management_review boolean,display_order integer)
 CROSS JOIN public.tenants t WHERE t.id=p_tenant;
END $$;
REVOKE ALL ON FUNCTION public.qualisphere_sandbox_save_kpis(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_sandbox_save_kpis(uuid,jsonb) TO authenticated;

-- Company administrators can manage ordinary company memberships, never elevate platform/company authority.
CREATE POLICY sandbox_admin_members_read ON public.tenant_memberships FOR SELECT TO authenticated USING(public.qualisphere_sandbox_configuration_admin(tenant_id));
CREATE POLICY sandbox_admin_members_insert ON public.tenant_memberships FOR INSERT TO authenticated WITH CHECK(public.qualisphere_sandbox_configuration_admin(tenant_id) AND membership_role='member');
CREATE POLICY sandbox_admin_members_update ON public.tenant_memberships FOR UPDATE TO authenticated USING(public.qualisphere_sandbox_configuration_admin(tenant_id) AND membership_role='member') WITH CHECK(public.qualisphere_sandbox_configuration_admin(tenant_id) AND membership_role='member');
CREATE POLICY sandbox_platform_members_insert ON public.tenant_memberships FOR INSERT TO authenticated WITH CHECK(public.is_platform_admin() AND qualisphere_sandbox_auth.preparing_company(tenant_id));
CREATE POLICY sandbox_platform_members_update ON public.tenant_memberships FOR UPDATE TO authenticated USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());
GRANT INSERT(tenant_id,user_email,membership_role,membership_status,invited_by,invited_at,joined_at),UPDATE(membership_role,membership_status,joined_at,updated_at) ON public.tenant_memberships TO authenticated;
CREATE FUNCTION public.qualisphere_sandbox_assign_company_admin(p_tenant uuid,p_email text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_email text:=lower(btrim(p_email));
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform Administrator required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant AND tenant_code='QUALISPHERE-SANDBOX' AND status='provisioning') THEN RAISE EXCEPTION 'Expected sandbox company'; END IF;
 IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid email required'; END IF;
 UPDATE public.tenant_memberships SET membership_role='company_admin',membership_status='active',updated_at=now() WHERE tenant_id=p_tenant AND lower(user_email)=v_email;
 IF NOT FOUND THEN INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status,invited_by,invited_at)
 VALUES(p_tenant,v_email,'company_admin','active',lower(auth.jwt()->>'email'),now()); END IF;
END $$;
REVOKE ALL ON FUNCTION public.qualisphere_sandbox_assign_company_admin(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_sandbox_assign_company_admin(uuid,text) TO authenticated;

-- Reviewed existing company-user function becomes invoker; RLS controls all its writes.
ALTER FUNCTION public.qualisphere_set_company_user(uuid,text,text,text,text) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.qualisphere_set_company_user(uuid,text,text,text,text),public.current_user_email(),public.qualisphere_training_is_coordinator(uuid),public.qualisphere_save_training_method(uuid,uuid,text,boolean,boolean,boolean) TO authenticated;
-- Preserve existing training-method version/history behavior. Private execution is needed for
-- SHARE locks over operational reference tables without granting clients operational write privileges.
CREATE FUNCTION qualisphere_sandbox_auth.save_training_method(p_tenant uuid, p_id uuid, p_label text, p_release_blocking boolean, p_acknowledgement_required boolean, p_evidence_required boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE old_method public.training_methods%ROWTYPE; new_id uuid; versioned boolean:=false; used boolean:=false;
BEGIN
 IF NOT qualisphere_sandbox_auth.company_admin(p_tenant) THEN RAISE EXCEPTION 'Sandbox Company Administrator required'; END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.qualisphere_training_is_coordinator(p_tenant),false) THEN RAISE EXCEPTION 'Training coordinator permission required'; END IF;
 IF nullif(btrim(p_label),'') IS NULL THEN RAISE EXCEPTION 'Training method name is required'; END IF;
 IF p_release_blocking IS NULL OR p_acknowledgement_required IS NULL OR p_evidence_required IS NULL OR NOT(p_acknowledgement_required OR p_evidence_required) THEN RAISE EXCEPTION 'Choose acknowledgement, completion evidence, or both'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':training_methods',0));
 IF EXISTS(SELECT 1 FROM public.training_methods WHERE tenant_id=p_tenant AND is_active=true AND lower(btrim(label))=lower(btrim(p_label)) AND (p_id IS NULL OR id<>p_id)) THEN RAISE EXCEPTION 'An active method already uses this name. Edit that method or use a different name.'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO old_method FROM public.training_methods WHERE tenant_id=p_tenant AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Training method not found in this company'; END IF;
  LOCK TABLE public.training_assignments,public.document_training_requirements IN SHARE MODE;
  used:=EXISTS(SELECT 1 FROM public.training_assignments WHERE training_method_id=p_id) OR EXISTS(SELECT 1 FROM public.document_training_requirements WHERE training_method_id=p_id);
  versioned:=used AND (p_release_blocking,p_acknowledgement_required,p_evidence_required) IS DISTINCT FROM (old_method.release_blocking,old_method.acknowledgement_required,old_method.evidence_required);
  IF NOT versioned THEN
   UPDATE public.training_methods SET label=btrim(p_label),release_blocking=p_release_blocking,acknowledgement_required=p_acknowledgement_required,evidence_required=p_evidence_required,updated_at=now() WHERE tenant_id=p_tenant AND id=p_id;
   RETURN jsonb_build_object('id',p_id,'versioned',false);
  END IF;
  UPDATE public.training_methods SET is_active=false,updated_at=now() WHERE tenant_id=p_tenant AND id=p_id;
 END IF;
 new_id:=gen_random_uuid();
 INSERT INTO public.training_methods(id,tenant_id,code,label,release_blocking,acknowledgement_required,evidence_required,is_active)
 VALUES(new_id,p_tenant,'METHOD_'||replace(new_id::text,'-',''),btrim(p_label),p_release_blocking,p_acknowledgement_required,p_evidence_required,true);
 RETURN jsonb_build_object('id',new_id,'versioned',versioned);
END;
$$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.save_training_method(uuid,uuid,text,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.save_training_method(uuid,uuid,text,boolean,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.qualisphere_save_training_method(p_tenant uuid,p_id uuid,p_label text,p_release_blocking boolean,p_acknowledgement_required boolean,p_evidence_required boolean) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT qualisphere_sandbox_auth.save_training_method(p_tenant,p_id,p_label,p_release_blocking,p_acknowledgement_required,p_evidence_required);
$$;
ALTER FUNCTION public.qualisphere_guard_training_method_history() SET SCHEMA qualisphere_sandbox_auth;
ALTER FUNCTION qualisphere_sandbox_auth.qualisphere_guard_training_method_history() SECURITY DEFINER SET search_path='';
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.qualisphere_guard_training_method_history() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
