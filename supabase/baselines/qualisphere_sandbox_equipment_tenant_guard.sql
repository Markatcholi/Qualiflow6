-- Sandbox-only preparation. This does not activate Equipment or grant table access.
-- Apply only after the session-company selection foundation has been reviewed.
DO $$ BEGIN
  IF to_regclass('public.sandbox_company_environments') IS NULL
     OR to_regprocedure('public.sandbox_current_session_company()') IS NULL THEN
    RAISE EXCEPTION 'Expected sandbox company registry and session selection';
  END IF;
END $$;

-- An explicit tenant id must never bypass current membership or redirect a
-- record to a different company. No legacy/internal fallback is permitted.
CREATE OR REPLACE FUNCTION public.qualisphere_resolve_equipment_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to register equipment.';
  END IF;
  selected_tenant := qualisphere_sandbox_auth.current_session_company();
  IF selected_tenant IS NULL THEN
    RAISE EXCEPTION 'Select an authorized sandbox company before registering equipment.';
  END IF;
  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id <> selected_tenant THEN
    RAISE EXCEPTION 'Equipment company does not match the selected sandbox company.';
  END IF;
  IF NOT public.qualisphere_tenant_module_enabled(selected_tenant, 'equipment') THEN
    RAISE EXCEPTION 'Equipment is not enabled for the selected sandbox company.';
  END IF;
  NEW.tenant_id := selected_tenant;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qualisphere_resolve_equipment_tenant() FROM PUBLIC, anon, authenticated;
