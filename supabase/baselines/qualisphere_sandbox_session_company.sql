-- Sandbox-only foundation. Do not apply to the working/production database.
-- A JWT session chooses one registered company; every read rechecks membership.
-- This does not enable modules or change existing tenant resolvers.
DO $$ BEGIN
  IF to_regclass('public.sandbox_company_environments') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.sandbox_company_environments)
     OR EXISTS (SELECT 1 FROM public.tenant_module_access WHERE is_enabled) THEN
    RAISE EXCEPTION 'Expected an isolated, preparation-stage sandbox';
  END IF;
END $$;
CREATE TABLE qualisphere_sandbox_auth.session_company_selection (
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.sandbox_company_environments(tenant_id),
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);
ALTER TABLE qualisphere_sandbox_auth.session_company_selection ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qualisphere_sandbox_auth.session_company_selection FROM PUBLIC, anon, authenticated;

CREATE FUNCTION qualisphere_sandbox_auth.session_identity()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_session uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_session := nullif(auth.jwt()->>'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
  RETURN v_session;
END $$;

CREATE FUNCTION qualisphere_sandbox_auth.choose_session_company(p_tenant uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_session uuid := qualisphere_sandbox_auth.session_identity();
BEGIN
  IF v_user IS NULL OR v_session IS NULL OR p_tenant IS NULL
     OR NOT qualisphere_sandbox_auth.company_member(p_tenant) THEN
    RAISE EXCEPTION 'Company selection is unavailable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO qualisphere_sandbox_auth.session_company_selection(user_id, session_id, tenant_id)
  VALUES (v_user, v_session, p_tenant)
  ON CONFLICT (user_id, session_id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id, selected_at = now();
  RETURN p_tenant;
END $$;

CREATE FUNCTION qualisphere_sandbox_auth.current_session_company()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL OR qualisphere_sandbox_auth.session_identity() IS NULL THEN RETURN NULL; END IF;
  SELECT s.tenant_id INTO v_tenant FROM qualisphere_sandbox_auth.session_company_selection s
    WHERE s.user_id = auth.uid() AND s.session_id = qualisphere_sandbox_auth.session_identity();
  IF v_tenant IS NULL OR NOT qualisphere_sandbox_auth.company_member(v_tenant) THEN RETURN NULL; END IF;
  RETURN v_tenant;
END $$;

CREATE FUNCTION public.sandbox_select_session_company(p_tenant uuid)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT qualisphere_sandbox_auth.choose_session_company(p_tenant);
$$;
CREATE FUNCTION public.sandbox_current_session_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT qualisphere_sandbox_auth.current_session_company();
$$;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.session_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.choose_session_company(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION qualisphere_sandbox_auth.current_session_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sandbox_select_session_company(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sandbox_current_session_company() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA qualisphere_sandbox_auth TO authenticated;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.choose_session_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION qualisphere_sandbox_auth.current_session_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_select_session_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_current_session_company() TO authenticated;
