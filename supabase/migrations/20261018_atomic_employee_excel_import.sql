-- Atomic, tenant-scoped employee onboarding. Apply only after reviewing and merging PR #191.
CREATE OR REPLACE FUNCTION public.qualisphere_import_employees(
  p_tenant_id uuid, p_employees jsonb, p_overwrite boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item jsonb; email_value text; manager_value text; imported integer := 0;
BEGIN
  IF NOT public.qualisphere_is_company_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'An active tenant company administrator is required';
  END IF;
  IF jsonb_typeof(p_employees) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_employees) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Provide between 1 and 1000 employee rows';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS qs_import_rows (
    email text PRIMARY KEY, manager text, full_name text, title text, department text
  ) ON COMMIT DROP;
  TRUNCATE qs_import_rows;
  FOR item IN SELECT value FROM jsonb_array_elements(p_employees) LOOP
    email_value := lower(btrim(coalesce(item->>'email','')));
    manager_value := lower(btrim(coalesce(item->>'manager','')));
    IF email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      OR btrim(coalesce(item->>'name','')) = ''
      OR btrim(coalesce(item->>'title','')) = ''
      OR btrim(coalesce(item->>'department','')) = ''
      OR (manager_value <> 'top-level' AND manager_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
      OR manager_value = email_value THEN
      RAISE EXCEPTION 'Invalid employee fields for %', email_value;
    END IF;
    INSERT INTO qs_import_rows VALUES (
      email_value, NULLIF(manager_value,'top-level'),
      btrim(item->>'name'),btrim(item->>'title'),btrim(item->>'department')
    );
  END LOOP;
  IF NOT p_overwrite AND EXISTS (
    SELECT 1 FROM qs_import_rows r JOIN public.employee_profiles ep
      ON ep.tenant_id=p_tenant_id AND lower(ep.user_email)=r.email
  ) THEN RAISE EXCEPTION 'Existing profiles found; enable overwrite'; END IF;
  IF EXISTS (
    SELECT 1 FROM qs_import_rows r WHERE r.manager IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM qs_import_rows x WHERE x.email=r.manager)
      AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id=p_tenant_id AND lower(tm.user_email)=r.manager
          AND tm.membership_status='active')
  ) THEN RAISE EXCEPTION 'Manager must be in the import or an active tenant member'; END IF;
  IF EXISTS (
    WITH RECURSIVE edges AS (
      SELECT email,manager FROM qs_import_rows
      UNION ALL
      SELECT lower(ep.user_email),lower(ep.manager_email)
      FROM public.employee_profiles ep WHERE ep.tenant_id=p_tenant_id
      AND NOT EXISTS(SELECT 1 FROM qs_import_rows r WHERE r.email=lower(ep.user_email))
    ), paths AS (
      SELECT email AS origin,email,manager,ARRAY[email] AS seen,false AS cycle FROM edges
      UNION ALL
      SELECT p.origin,e.email,e.manager,p.seen||e.email,e.email=ANY(p.seen)
      FROM paths p JOIN edges e ON e.email=p.manager
      WHERE NOT p.cycle AND cardinality(p.seen)<1001
    ) SELECT 1 FROM paths WHERE cycle
  ) THEN RAISE EXCEPTION 'Circular manager hierarchy'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_employees) LOOP
    email_value := lower(btrim(item->>'email'));
    manager_value := lower(btrim(item->>'manager'));
    INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status)
    SELECT p_tenant_id,email_value,'member','invited'
    WHERE NOT EXISTS(SELECT 1 FROM public.tenant_memberships
      WHERE tenant_id=p_tenant_id AND lower(user_email)=email_value);
    INSERT INTO public.employee_profiles(tenant_id,user_email,full_name,department,manager_email,active)
    VALUES(p_tenant_id,email_value,btrim(item->>'name'),btrim(item->>'department'),
      NULLIF(manager_value,'top-level'),false)
    ON CONFLICT(tenant_id,user_email) DO UPDATE
      SET full_name=EXCLUDED.full_name,department=EXCLUDED.department,
          manager_email=EXCLUDED.manager_email;
    INSERT INTO public.tenant_user_profiles(tenant_id,user_email,job_title,department,account_status)
    VALUES(p_tenant_id,email_value,btrim(item->>'title'),btrim(item->>'department'),'inactive')
    ON CONFLICT(tenant_id,user_email) DO UPDATE
      SET job_title=EXCLUDED.job_title,department=EXCLUDED.department;
    imported := imported+1;
  END LOOP;
  RETURN imported;
END $$;
REVOKE ALL ON FUNCTION public.qualisphere_import_employees(uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualisphere_import_employees(uuid,jsonb,boolean) TO authenticated;
