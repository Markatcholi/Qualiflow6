-- QualiSphere sandbox schema baseline; target Beta project only.
-- Source SHA256: 80e5c94c65c788adc25041c4194f27692bf234d1bc6df95b81cf6d462866c997
-- Structure only; no records, users, buckets, auth hooks or jobs copied.
DO $sandbox_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S'))
     OR EXISTS (SELECT 1 FROM auth.users)
     OR EXISTS (SELECT 1 FROM storage.buckets) THEN
    RAISE EXCEPTION 'Sandbox baseline requires an empty application, authentication and bucket inventory';
  END IF;
END;
$sandbox_guard$;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = on;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: activate_qms_configuration_version(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_config public.qms_configuration_versions%rowtype;
    v_user_email text;
    v_rule_count integer;
begin

    if not public.is_qms_governance_admin() then
        raise exception
            'Only an Administrator or VP Quality may activate controlled QMS configuration.';
    end if;

    if nullif(trim(coalesce(p_change_justification, '')), '') is null then
        raise exception
            'Activation justification is required.';
    end if;

    v_user_email :=
        lower(coalesce(auth.jwt() ->> 'email', 'unknown'));

    select *
    into v_config
    from public.qms_configuration_versions
    where id = p_configuration_version_id
    for update;

    if not found then
        raise exception
            'Configuration version was not found.';
    end if;

    if v_config.status <> 'draft' then
        raise exception
            'Only a Draft configuration may be activated.';
    end if;


    -- --------------------------------------------------------
    -- Validate Risk Matrix completeness
    -- --------------------------------------------------------

    if v_config.configuration_type = 'risk_assessment' then

        select count(*)
        into v_rule_count
        from public.qms_risk_matrix_rules
        where configuration_version_id = v_config.id;

        if v_rule_count <> 27 then
            raise exception
                'Risk configuration must contain exactly 27 matrix rules before activation. Current count: %.',
                v_rule_count;
        end if;

    end if;


    -- --------------------------------------------------------
    -- Validate CAPA Governance completeness
    -- 5 risk-level rules + 1 recurrence rule = 6
    -- --------------------------------------------------------

    if v_config.configuration_type = 'capa_governance' then

        select count(*)
        into v_rule_count
        from public.qms_capa_governance_rules
        where configuration_version_id = v_config.id;

        if v_rule_count <> 6 then
            raise exception
                'CAPA Governance configuration must contain 6 governance rules before activation. Current count: %.',
                v_rule_count;
        end if;

    end if;


    -- --------------------------------------------------------
    -- Retire existing Active version of the same type
    -- --------------------------------------------------------

    update public.qms_configuration_versions
    set
        status = 'retired',
        retired_at = now(),
        retired_by = v_user_email
    where module_code = v_config.module_code
      and configuration_type = v_config.configuration_type
      and status = 'active'
      and id <> v_config.id;


    -- --------------------------------------------------------
    -- Activate selected Draft
    -- --------------------------------------------------------

    update public.qms_configuration_versions
    set
        status = 'active',
        effective_at = coalesce(effective_at, now()),
        activated_at = now(),
        activated_by = v_user_email,
        change_justification = p_change_justification
    where id = v_config.id;


    -- --------------------------------------------------------
    -- Activation audit
    -- --------------------------------------------------------

    insert into public.qms_configuration_audit_log (
        module_code,
        configuration_type,
        configuration_version_id,
        action,
        previous_value,
        new_value,
        change_justification,
        changed_by
    )
    values (
        v_config.module_code,
        v_config.configuration_type,
        v_config.id,
        'configuration_activated',
        jsonb_build_object(
            'status',
            'draft'
        ),
        jsonb_build_object(
            'status',
            'active',
            'version_code',
            v_config.version_code
        ),
        p_change_justification,
        v_user_email
    );

end;
$$;


--
-- Name: assign_calibration_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_calibration_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if nullif(trim(new.calibration_number), '') is null then
    new.calibration_number := public.next_equipment_event_number(new.tenant_id, 'calibration');
  end if;
  return new;
end;
$$;


--
-- Name: assign_equipment_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_equipment_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_strategy text;
begin
  select numbering_strategy into v_strategy
  from public.equipment_numbering_configurations
  where tenant_id = new.tenant_id and is_active = true;

  if v_strategy is null then v_strategy := 'allow_both'; end if;

  if new.number_source = 'qualisphere_generated' then
    if v_strategy = 'customer_assigned' then
      raise exception 'This tenant is configured for customer-assigned equipment numbers only.';
    end if;
    if nullif(trim(new.equipment_number), '') is null then
      new.equipment_number := public.next_qualisphere_equipment_number(new.tenant_id);
    end if;
  elsif new.number_source = 'customer_assigned' then
    if v_strategy = 'qualisphere_generated' then
      raise exception 'This tenant is configured for QualiSphere-generated equipment numbers only.';
    end if;
    if nullif(trim(new.equipment_number), '') is null then
      raise exception 'Customer-assigned equipment number is required.';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: assign_maintenance_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_maintenance_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if nullif(trim(new.maintenance_number), '') is null then
    new.maintenance_number := public.next_equipment_event_number(new.tenant_id, 'maintenance');
  end if;
  return new;
end;
$$;


--
-- Name: assign_qualification_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_qualification_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if nullif(trim(new.qualification_number), '') is null then
    new.qualification_number := public.next_equipment_event_number(new.tenant_id, 'qualification');
  end if;
  return new;
end;
$$;


--
-- Name: block_related_ncmr_change_when_closed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_related_ncmr_change_when_closed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  parent_id uuid;
  parent_status text;
begin
  if tg_table_name = 'ncmr_affected_items' then
    parent_id := coalesce(new.ncmr_id, old.ncmr_id);
  elsif tg_table_name = 'ncmr_mrb_reviewers' then
    parent_id := coalesce(new.ncmr_id, old.ncmr_id);
  elsif tg_table_name = 'approval_tasks' then
    if lower(coalesce(new.entity_type, old.entity_type, '')) <> 'ncmr' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    parent_id := coalesce(new.entity_id, old.entity_id);
  else
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select status into parent_status
  from public.ncmrs
  where id = parent_id;

  if lower(coalesce(parent_status, '')) = 'closed' then
    raise exception 'Closed NCMR related data is immutable.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


--
-- Name: build_ncmr_frozen_display_values(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_ncmr_frozen_display_values(p_ncmr_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  n public.ncmrs%rowtype;
  supplier_part_recorded boolean := false;
  supplier_recurrence boolean := false;
  scar_decision text;
  scar_rationale text;
  scar_signal text;
  capa_decision text;
  capa_rationale text;
  capa_signal text;
begin
  select * into n
  from public.ncmrs
  where id = p_ncmr_id;

  if not found then
    raise exception 'NCMR record not found.';
  end if;

  select exists (
    select 1
    from public.ncmr_affected_items ai
    where ai.ncmr_id = p_ncmr_id
      and nullif(trim(coalesce(ai.product_part_number, '')), '') is not null
  )
  into supplier_part_recorded;

  supplier_part_recorded :=
    supplier_part_recorded
    or nullif(trim(coalesce(n.product_part_number, '')), '') is not null;

  -- Use JSON access for optional historical columns so this function remains
  -- backward-safe even when a column name was referenced by older UI code but
  -- does not physically exist in the current ncmrs table.
  supplier_recurrence :=
    coalesce(n.recurring_issue, false)
    or coalesce(n.supplier_capa_required, false)
    or lower(coalesce(n.recurrence_reason, '')) like '%recurr%'
    or lower(coalesce(n.supplier_capa_reason, '')) like '%recurr%'
    or lower(coalesce(to_jsonb(n) ->> 'supplier_scar_reason', '')) like '%recurr%'
    or lower(coalesce(to_jsonb(n) ->> 'scar_reason', '')) like '%recurr%'
    or lower(coalesce(to_jsonb(n) ->> 'supplier_scar_required', 'false')) in ('true','t','1','yes');

  if supplier_part_recorded and supplier_recurrence then
    scar_decision := 'SCAR Recommended';
    scar_rationale :=
      'SCAR is recommended because supplier part has been recorded and supplier recurrence has been detected.';
  else
    scar_decision := 'SCAR Not Required';
    scar_rationale :=
      'SCAR is not automatically required because both supplier governance criteria have not been met. Supplier Part Recorded and Supplier Recurrence Detected are required for an automatic SCAR recommendation.';
  end if;

  scar_signal :=
    case when supplier_part_recorded then '✓' else '✗' end
    || ' Supplier Part Recorded | '
    || case when supplier_recurrence then '✓' else '✗' end
    || ' Supplier Recurrence Detected';

  capa_decision :=
    case coalesce(n.capa_evaluation_outcome, '')
      when 'required' then 'CAPA Required'
      when 'recommended' then 'CAPA Recommended'
      when 'not_required' then 'CAPA Not Required'
      when 'capa_opened' then 'CAPA Opened'
      when 'not_opened_with_justification' then 'CAPA Not Opened - Justification Documented'
      else coalesce(nullif(n.capa_decision, ''), 'Not recorded')
    end;

  capa_rationale :=
    coalesce(
      nullif(n.capa_evaluation_rationale, ''),
      nullif(n.capa_decision_justification, ''),
      nullif(n.capa_justification, ''),
      'Not recorded'
    );

  capa_signal :=
    case
      when coalesce(n.risk_level, '') <> ''
        then 'Final Effective Risk: ' || initcap(replace(n.risk_level, '_', ' ')) || '. '
      else 'Final Effective Risk is not recorded. '
    end
    || case
      when coalesce(n.recurring_issue, false)
        or lower(coalesce(n.recurrence_reason, '')) like '%recurr%'
      then 'Recurring NCMR detected.'
      else 'No recurrence detected.'
    end;

  return jsonb_build_object(
    'capa_governance_decision', capa_decision,
    'capa_governance_rationale', capa_rationale,
    'capa_governance_signal', capa_signal,
    'scar_governance_decision', scar_decision,
    'scar_governance_rationale', scar_rationale,
    'scar_governance_signal', scar_signal
  );
end;
$$;


--
-- Name: clone_qms_configuration_version(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clone_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_source public.qms_configuration_versions%rowtype;
    v_new_id uuid;
    v_user_email text;
begin

    if not public.is_qms_governance_admin() then
        raise exception
            'Only an Administrator or VP Quality may create controlled configuration versions.';
    end if;

    if nullif(trim(coalesce(p_new_version_code, '')), '') is null then
        raise exception 'New version code is required.';
    end if;

    if nullif(trim(coalesce(p_change_justification, '')), '') is null then
        raise exception 'Change justification is required.';
    end if;

    v_user_email :=
        lower(coalesce(auth.jwt() ->> 'email', 'unknown'));

    select *
    into v_source
    from public.qms_configuration_versions
    where id = p_source_configuration_version_id;

    if not found then
        raise exception 'Source configuration was not found.';
    end if;


    insert into public.qms_configuration_versions (
        module_code,
        configuration_type,
        version_code,
        version_name,
        status,
        configuration,
        change_summary,
        change_justification,
        created_by
    )
    values (
        v_source.module_code,
        v_source.configuration_type,
        trim(p_new_version_code),
        nullif(trim(coalesce(p_new_version_name, '')), ''),
        'draft',
        v_source.configuration,
        nullif(trim(coalesce(p_change_summary, '')), ''),
        trim(p_change_justification),
        v_user_email
    )
    returning id into v_new_id;


    if v_source.configuration_type = 'risk_assessment' then

        insert into public.qms_risk_matrix_rules (
            configuration_version_id,
            severity,
            occurrence,
            detection,
            overall_risk,
            created_by,
            updated_by
        )
        select
            v_new_id,
            severity,
            occurrence,
            detection,
            overall_risk,
            v_user_email,
            v_user_email
        from public.qms_risk_matrix_rules
        where configuration_version_id =
              p_source_configuration_version_id;

    end if;


    if v_source.configuration_type = 'capa_governance' then

        insert into public.qms_capa_governance_rules (
            configuration_version_id,
            trigger_type,
            trigger_value,
            governance_action,
            is_enabled,
            created_by,
            updated_by
        )
        select
            v_new_id,
            trigger_type,
            trigger_value,
            governance_action,
            is_enabled,
            v_user_email,
            v_user_email
        from public.qms_capa_governance_rules
        where configuration_version_id =
              p_source_configuration_version_id;

    end if;


    insert into public.qms_configuration_audit_log (
        module_code,
        configuration_type,
        configuration_version_id,
        action,
        previous_value,
        new_value,
        change_justification,
        changed_by
    )
    values (
        v_source.module_code,
        v_source.configuration_type,
        v_new_id,
        'configuration_version_created',
        jsonb_build_object(
            'source_version',
            v_source.version_code
        ),
        jsonb_build_object(
            'new_version',
            trim(p_new_version_code),
            'status',
            'draft'
        ),
        trim(p_change_justification),
        v_user_email
    );

    return v_new_id;

end;
$$;


--
-- Name: close_ncmr_with_controlled_record(uuid, text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_ncmr_with_controlled_record(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text, p_record_structure jsonb, p_frozen_values jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
  v_template_id uuid;
begin
  if p_record_structure is null
     or jsonb_typeof(p_record_structure) <> 'object'
     or jsonb_typeof(p_record_structure -> 'sections') <> 'array' then
    raise exception 'Controlled record structure is missing or invalid.';
  end if;

  if jsonb_array_length(p_record_structure -> 'sections') = 0 then
    raise exception 'Controlled record structure must contain at least one section.';
  end if;

  select status
    into v_status
  from public.ncmrs
  where id = p_ncmr_id
  for update;

  if not found then
    raise exception 'NCMR record not found.';
  end if;

  if lower(coalesce(v_status, '')) = 'closed' then
    raise exception 'This NCMR is already closed.';
  end if;

  -- An open record should never already have a frozen structure.
  -- Fail rather than silently overwrite history.
  if exists (
    select 1
    from public.qms_record_structure_freezes f
    where f.module_code = 'NCMR'
      and f.record_id = p_ncmr_id
  ) then
    raise exception 'This NCMR already has a frozen record structure.';
  end if;

  select id
    into v_template_id
  from public.qms_record_structure_templates
  where module_code = 'NCMR'
    and is_active = true
  order by effective_at desc
  limit 1;

  -- Freeze the structure delivered by the current application release.
  -- If the subsequent closure fails, PostgreSQL rolls this insert back too.
  insert into public.qms_record_structure_freezes (
    module_code,
    record_id,
    structure_template_id,
    structure_json,
    frozen_values,
    frozen_at,
    frozen_by
  )
  values (
    'NCMR',
    p_ncmr_id,
    v_template_id,
    p_record_structure,
    coalesce(p_frozen_values, '{}'::jsonb),
    now(),
    lower(trim(p_signature_email))
  );

  -- Existing validated closure logic remains authoritative.
  perform public.close_ncmr_with_snapshot(
    p_ncmr_id,
    p_signature_meaning,
    p_signature_email
  );
end;
$$;


--
-- Name: close_ncmr_with_snapshot(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_ncmr_with_snapshot(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_record public.ncmrs%rowtype;
  v_user_email text;
  v_now timestamptz := now();
  v_snapshot_id uuid;
  v_affected_items jsonb := '[]'::jsonb;
  v_approval_tasks jsonb := '[]'::jsonb;
  v_audit_trail jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_user_email = '' then
    raise exception 'An authenticated user is required to close an NCMR.';
  end if;

  select *
    into v_record
  from public.ncmrs
  where id = p_ncmr_id
  for update;

  if not found then
    raise exception 'NCMR record not found.';
  end if;

  if lower(coalesce(v_record.status, '')) = 'closed' then
    raise exception 'This NCMR is already closed.';
  end if;

  if lower(coalesce(v_record.owner, '')) <> v_user_email then
    raise exception 'Only the current NCMR owner can close this NCMR.';
  end if;

  if lower(trim(coalesce(p_signature_email, ''))) <> v_user_email then
    raise exception 'Closure electronic signature email does not match the authenticated user.';
  end if;

  update public.ncmrs
  set
    status = 'closed',
    review_status = 'completed',
    closed_at = v_now,
    ncmr_closed_by = v_user_email,
    ncmr_signature_meaning = p_signature_meaning,
    ncmr_signature_email_entered = p_signature_email,
    investigation_completed_at = v_now,
    is_locked = true,
    locked_at = v_now,
    locked_by = v_user_email
  where id = p_ncmr_id
  returning * into v_record;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    details,
    user_email
  )
  values (
    'ncmr',
    p_ncmr_id,
    'ncmr_closed_signature',
    'NCMR closed with e-signature. Meaning: ' || coalesce(p_signature_meaning, ''),
    v_user_email
  );

  select coalesce(jsonb_agg(to_jsonb(ai) order by ai.created_at), '[]'::jsonb)
    into v_affected_items
  from public.ncmr_affected_items ai
  where ai.ncmr_id = p_ncmr_id;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb)
    into v_approval_tasks
  from public.approval_tasks t
  where lower(coalesce(t.entity_type, '')) = 'ncmr'
    and t.entity_id = p_ncmr_id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
    into v_audit_trail
  from public.audit_logs a
  where lower(coalesce(a.entity_type, '')) = 'ncmr'
    and a.entity_id = p_ncmr_id;

  v_payload := jsonb_build_object(
    'record',
      to_jsonb(v_record)
        - 'workflow_version_id'
        - 'workflow_version_code',
    'affected_items', v_affected_items,
    'approval_tasks', v_approval_tasks,
    'audit_trail', v_audit_trail,
    'snapshot_created_at', v_now
  );

  insert into public.qms_record_snapshots (
    module_code,
    record_id,
    record_number,
    snapshot_type,
    record_status,
    snapshot_payload,
    snapshot_origin,
    created_by,
    created_at
  )
  values (
    'NCMR',
    p_ncmr_id,
    v_record.ncmr_number,
    'closure',
    'closed',
    v_payload,
    'system_closure',
    v_user_email,
    v_now
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;


--
-- Name: create_qualisphere_module_access_role(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_qualisphere_module_access_role(p_category text, p_label text, p_permission_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_category text := trim(coalesce(p_category,''));
  v_label text := trim(coalesce(p_label,''));
  v_permission_key text := lower(trim(coalesce(p_permission_key,'')));
  v_code text;
begin
  if not public.is_qualisphere_role_administrator() then
    raise exception 'Only an Administrator or VP Quality may create Module Access roles.';
  end if;

  if v_category='' or v_label='' or v_permission_key='' then
    raise exception 'Module, role name, and capability template are required.';
  end if;

  v_code := lower(regexp_replace(v_category || '_' || v_label, '[^a-zA-Z0-9]+', '_', 'g'));
  v_code := trim(both '_' from v_code);
  v_code := left(v_code, 120);

  if exists (select 1 from public.security_roles where code=v_code) then
    raise exception 'A Module Access role with this module/name already exists.';
  end if;

  insert into public.security_roles
    (code,label,category,description,is_assignable,is_active,is_system_role,permission_key,updated_at)
  values
    (v_code,v_label,v_category,'Customer-defined Module Access role.',true,true,false,v_permission_key,now());

  return jsonb_build_object(
    'status','created',
    'role_code',v_code,
    'message',format('Module Access role "%s" was added to %s.',v_label,v_category)
  );
end;
$$;


--
-- Name: current_user_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_email() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'auth'
    AS $$
    select lower(
        trim(
            coalesce(
                auth.jwt() ->> 'email',
                ''
            )
        )
    );
$$;


--
-- Name: custom_access_token_hook(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  claims jsonb;
  user_role text;
begin
  select role
  into user_role
  from public.user_roles
  where lower(user_email) = lower(event->'claims'->>'email')
  limit 1;

  claims := event->'claims';

  if user_role is not null then
    claims := jsonb_set(claims, '{app_metadata,app_role}', to_jsonb(user_role));
  else
    claims := jsonb_set(claims, '{app_metadata,app_role}', to_jsonb('user'::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: equipment_release_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_release_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    submitted_by text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    approver_email text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    decision_by text,
    decision_at timestamp with time zone,
    decision_comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approver_department text,
    approver_job_title text,
    approve_by_date date,
    CONSTRAINT equipment_release_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: TABLE equipment_release_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_release_requests IS 'Controlled approval of Equipment Master readiness. This does not approve calibration, maintenance, qualification protocol, or qualification report documents.';


--
-- Name: decide_equipment_record_release(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decide_equipment_record_release(p_release_request_id uuid, p_decision text, p_comment text DEFAULT NULL::text) RETURNS public.equipment_release_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_decision text := lower(trim(coalesce(p_decision,'')));
  v_request public.equipment_release_requests;
  v_authority jsonb;
  v_is_admin boolean := false;
  v_is_equipment_approver boolean := false;
  v_now timestamptz := now();
begin
  if v_user_email='' then
    raise exception 'You must be signed in to process Equipment Record Release.';
  end if;

  if v_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if v_decision='rejected' and trim(coalesce(p_comment,''))='' then
    raise exception 'A comment is required when rejecting an Equipment Record Release.';
  end if;

  select * into v_request
  from public.equipment_release_requests
  where id=p_release_request_id;

  if not found then
    raise exception 'Equipment Record Release request not found.';
  end if;

  if v_request.status<>'pending' then
    raise exception 'This Equipment Record Release request is no longer pending.';
  end if;

  v_authority:=public.get_qualisphere_enterprise_authority(v_user_email);
  v_is_admin:=coalesce((v_authority->>'is_admin')::boolean,false);
  v_is_equipment_approver:=coalesce((v_authority->>'is_equipment_approver')::boolean,false);

  if not v_is_equipment_approver then
    raise exception 'Only an authorized Equipment Approver or Administrator may process Equipment Record Release.';
  end if;

  if not v_is_admin
     and lower(coalesce(v_request.approver_email,''))<>v_user_email then
    raise exception 'This Equipment Record Release request is assigned to another Equipment Approver.';
  end if;

  update public.equipment_release_requests
  set
    status=v_decision,
    decision_by=v_user_email,
    decision_at=v_now,
    decision_comment=nullif(trim(coalesce(p_comment,'')),'')
  where id=p_release_request_id
  returning * into v_request;

  if v_decision='approved' then
    update public.equipment
    set
      record_status='released',
      lifecycle_phase='operation_maintenance',
      equipment_status='active',
      lifecycle_status='released',
      use_status='available_for_use',
      use_status_reason='Equipment Master released through controlled Equipment Record Release.',
      released_by=v_user_email,
      released_at=v_now
    where id=v_request.equipment_id;
  else
    update public.equipment
    set
      record_status='draft',
      equipment_status='pending_production_release',
      use_status='restricted',
      use_status_reason=nullif(trim(coalesce(p_comment,'')),'')
    where id=v_request.equipment_id;
  end if;

  -- Close the corresponding central task so it no longer appears as pending.
  update public.approval_tasks
  set
    status=v_decision,
    comments=case
      when nullif(trim(coalesce(p_comment,'')),'') is not null
        then trim(p_comment)
      else comments
    end
  where entity_type='equipment'
    and entity_id=v_request.equipment_id
    and task_type='equipment_record_release'
    and lower(coalesce(assigned_to_email,''))=lower(coalesce(v_request.approver_email,''))
    and status='pending';



  return v_request;
end;
$$;


--
-- Name: delete_qualisphere_user_profile(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_qualisphere_user_profile(p_user_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_email text := lower(trim(coalesce(p_user_email,'')));
  v_current text := lower(coalesce(auth.jwt()->>'email',''));
  v_has_history boolean := false;
  r record;
  v_found boolean;
  v_sql text;
  v_identity_columns text[] := array[
    'user_email','owner_email','approver_email','assigned_to_email','assigned_by_email',
    'created_by','updated_by','approved_by','released_by','retired_by','submitted_by',
    'decision_by','completed_by','signed_by','initiated_by','closed_by','performed_by',
    'executed_by','reviewed_by','verified_by','linked_by'
  ];
begin
  if not public.is_qualisphere_role_administrator() then
    raise exception 'Only an Administrator or VP Quality may delete user profiles.';
  end if;

  if v_email='' then
    raise exception 'User email is required.';
  end if;

  if v_email=v_current then
    raise exception 'You cannot delete your own signed-in user profile.';
  end if;

  if not exists (select 1 from public.user_roles where lower(user_email)=v_email) then
    raise exception 'User profile not found.';
  end if;

  -- Search QMS tables for historical identity references without hard-coding
  -- every module. Central administration/access tables are excluded.
  for r in
    select c.table_schema,c.table_name,c.column_name
    from information_schema.columns c
    where c.table_schema='public'
      and c.column_name=any(v_identity_columns)
      and c.table_name not in ('user_roles','user_security_roles','security_roles')
      and c.data_type in ('text','character varying','character')
  loop
    v_sql := format(
      'select exists(select 1 from %I.%I where lower(coalesce(%I::text, ''''))=$1 limit 1)',
      r.table_schema,r.table_name,r.column_name
    );
    execute v_sql into v_found using v_email;
    if v_found then
      v_has_history := true;
      exit;
    end if;
  end loop;

  if v_has_history then
    update public.user_roles
    set account_status='inactive'
    where lower(user_email)=v_email;

    return jsonb_build_object(
      'status','deactivated',
      'message','This user has QMS history, so QualiSphere preserved the identity and changed the account to Inactive.'
    );
  end if;

  delete from public.user_security_roles where lower(user_email)=v_email;
  delete from public.user_roles where lower(user_email)=v_email;

  return jsonb_build_object(
    'status','deleted',
    'message','User profile deleted. No QMS history was found for this user.'
  );
end;
$_$;


--
-- Name: freeze_ncmr_structure_on_close(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freeze_ncmr_structure_on_close() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  t public.qms_record_structure_templates%rowtype;
begin
  if lower(coalesce(new.status, '')) = 'closed'
     and lower(coalesce(old.status, '')) <> 'closed' then

    select *
      into t
    from public.qms_record_structure_templates
    where module_code = 'NCMR'
      and is_active = true
    order by effective_at desc
    limit 1;

    if t.id is null then
      raise exception 'No active NCMR record structure template is configured.';
    end if;

    insert into public.qms_record_structure_freezes (
      module_code,
      record_id,
      structure_template_id,
      structure_json,
      frozen_values,
      frozen_at,
      frozen_by
    )
    values (
      'NCMR',
      new.id,
      t.id,
      t.structure_json,
      public.build_ncmr_frozen_display_values(new.id),
      coalesce(new.closed_at, now()),
      coalesce(new.ncmr_closed_by, new.owner, 'system')
    )
    on conflict (module_code, record_id) do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: generate_audit_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_audit_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  v_year int;
  v_next int;
begin
  v_year := extract(year from now())::int;

  insert into audit_number_counters (record_year, last_number)
  values (v_year, 0)
  on conflict (record_year) do nothing;

  update audit_number_counters
  set last_number = last_number + 1
  where record_year = v_year
  returning last_number into v_next;

  return 'AUD-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;


--
-- Name: generate_audit_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_audit_number(p_tenant_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  if p_tenant_id is null then
    raise exception 'Tenant is required to generate an audit number.';
  end if;

  insert into public.audit_tenant_number_counters (tenant_id, record_year, last_number)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, record_year)
  do update set last_number = public.audit_tenant_number_counters.last_number + 1
  returning last_number into v_next;

  return 'AUD-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;


--
-- Name: generate_capa_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_capa_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_next bigint;
begin
 if new.capa_number is not null and btrim(new.capa_number)<>'' then return new; end if;
 if new.tenant_id is null then raise exception 'Company Account is required before a CAPA number can be generated.'; end if;
 insert into public.capa_tenant_number_counters(tenant_id,last_number,updated_at)
 values(new.tenant_id,1,now())
 on conflict(tenant_id) do update set last_number=public.capa_tenant_number_counters.last_number+1,updated_at=now()
 returning last_number into v_next;
 new.capa_number:='CAPA'||lpad(v_next::text,7,'0');
 return new;
end;$$;


--
-- Name: generate_dci_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_dci_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_tenant_id uuid; v_next integer;
begin
 v_tenant_id:=public.qualisphere_current_controlled_documents_tenant();
 if v_tenant_id is null then raise exception 'No active Controlled Documents tenant context.'; end if;
 insert into public.document_change_number_counters(tenant_id,last_number) values(v_tenant_id,1)
 on conflict(tenant_id) do update set last_number=document_change_number_counters.last_number+1,updated_at=now()
 returning last_number into v_next;
 return 'DCI-'||lpad(v_next::text,6,'0');
end; $$;


--
-- Name: generate_document_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_document_number(p_document_type text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tenant_id uuid;
  v_prefix text;
  v_padding integer;
  v_next integer;
begin
  -- Resolve the Company Account through the common Controlled Documents
  -- compatibility resolver. Customer tenants resolve through active
  -- tenant_memberships.user_email; legacy Internal development users resolve
  -- through the preserved Internal user_roles source of truth.
  v_tenant_id := public.qualisphere_current_controlled_documents_tenant();

  select s.prefix, s.padding
    into v_prefix, v_padding
  from public.document_number_sequences s
  where s.tenant_id = v_tenant_id
    and lower(s.document_type) = lower(p_document_type)
  for update;

  if not found then
    -- Seed a new tenant's numbering format from Internal's controlled sequence
    -- without copying Internal's current counter value.
    select s.prefix, s.padding
      into v_prefix, v_padding
    from public.document_number_sequences s
    join public.tenants t on t.id = s.tenant_id
    where t.is_internal = true
      and lower(s.document_type) = lower(p_document_type)
    limit 1;

    v_prefix := coalesce(v_prefix, upper(regexp_replace(p_document_type,'[^A-Za-z0-9]','','g')));
    v_padding := coalesce(v_padding,4);

    insert into public.document_number_sequences(document_type,prefix,last_number,padding,tenant_id)
    values(p_document_type,v_prefix,0,v_padding,v_tenant_id)
    on conflict (tenant_id,lower(document_type)) do nothing;
  end if;

  update public.document_number_sequences
     set last_number = last_number + 1,
         updated_at = now()
   where tenant_id = v_tenant_id
     and lower(document_type) = lower(p_document_type)
  returning last_number,prefix,padding
       into v_next,v_prefix,v_padding;

  if v_next is null then
    raise exception 'Unable to allocate a Controlled Document number for this Company Account.';
  end if;

  return v_prefix || '-' || lpad(v_next::text,v_padding,'0');
end;
$$;


--
-- Name: generate_ncmr_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_ncmr_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_next bigint;
begin
  if new.ncmr_number is not null and btrim(new.ncmr_number)<>'' then return new; end if;
  if new.tenant_id is null then raise exception 'Company Account is required before an NCMR number can be generated.'; end if;
  insert into public.ncmr_tenant_number_counters(tenant_id,last_number,updated_at)
  values(new.tenant_id,1,now())
  on conflict(tenant_id) do update set last_number=public.ncmr_tenant_number_counters.last_number+1,updated_at=now()
  returning last_number into v_next;
  new.ncmr_number:='NCMR'||lpad(v_next::text,7,'0');
  return new;
end;$$;


--
-- Name: generate_oos_oot_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_oos_oot_number(p_prefix text) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  v_next int;
begin
  insert into oos_oot_number_counters (prefix, last_number)
  values (p_prefix, 0)
  on conflict (prefix) do nothing;

  update oos_oot_number_counters
  set last_number = last_number + 1
  where prefix = p_prefix
  returning last_number into v_next;

  return p_prefix || lpad(v_next::text, 7, '0');
end;
$$;


--
-- Name: generate_oos_oot_number(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_oos_oot_number(p_tenant_id uuid, p_prefix text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_next integer;
begin
  insert into public.oos_oot_tenant_number_counters (tenant_id, prefix, last_number)
  values (p_tenant_id, upper(p_prefix), 0)
  on conflict (tenant_id, prefix) do nothing;

  update public.oos_oot_tenant_number_counters
     set last_number = last_number + 1
   where tenant_id = p_tenant_id
     and prefix = upper(p_prefix)
  returning last_number into v_next;

  return upper(p_prefix) || lpad(v_next::text, 7, '0');
end;
$$;


--
-- Name: generate_record_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_record_number(p_record_type text) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  v_year int;
  v_next int;
  v_prefix text;
begin
  v_year := extract(year from now())::int;

  insert into record_number_counters (record_type, record_year, last_number)
  values (p_record_type, v_year, 0)
  on conflict (record_type, record_year) do nothing;

  update record_number_counters
  set last_number = last_number + 1
  where record_type = p_record_type
    and record_year = v_year
  returning last_number into v_next;

  if p_record_type = 'ncmr' then
    v_prefix := 'NCMR';
  elsif p_record_type = 'capa' then
    v_prefix := 'CAPA';
  else
    v_prefix := upper(p_record_type);
  end if;

  return v_prefix || '-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;


--
-- Name: generate_scar_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_scar_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_next bigint;
begin
  if new.scar_number is not null and btrim(new.scar_number) <> '' then
    return new;
  end if;

  if new.tenant_id is null then
    raise exception 'Company Account is required before a SCAR number can be generated.';
  end if;

  insert into public.scar_tenant_number_counters(tenant_id,last_number,updated_at)
  values(new.tenant_id,1,now())
  on conflict(tenant_id) do update
    set last_number = public.scar_tenant_number_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_next;

  new.scar_number := 'SCAR' || lpad(v_next::text,7,'0');
  return new;
end;
$$;


--
-- Name: equipment_document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_document_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    document_id uuid NOT NULL,
    relationship_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    linked_by text,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_document_links_relationship_type_check CHECK ((relationship_type = ANY (ARRAY['specification'::text, 'operating_procedure'::text, 'calibration_procedure'::text, 'preventive_maintenance_procedure'::text, 'qualification_protocol'::text, 'work_instruction'::text, 'other'::text])))
);


--
-- Name: get_equipment_controlled_document_links(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_equipment_controlled_document_links(p_equipment_id uuid) RETURNS SETOF public.equipment_document_links
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_email text;
  v_tenant_id uuid;
  v_authorized boolean := false;
begin
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_user_email = '' then
    raise exception 'You must be signed in to view Equipment controlled-document links.';
  end if;

  select e.tenant_id
    into v_tenant_id
  from public.equipment e
  where e.id = p_equipment_id;

  if v_tenant_id is null then
    raise exception 'Equipment record not found.';
  end if;

  select exists (
    select 1
    from public.equipment_governance_members gm
    where gm.tenant_id = v_tenant_id
      and lower(gm.user_email) = v_user_email
      and gm.is_active = true
      and gm.role in ('viewer','coordinator','quality_approver','admin')
  )
  or exists (
    select 1
    from public.equipment e
    where e.id = p_equipment_id
      and e.tenant_id = v_tenant_id
      and (
        lower(coalesce(e.owner_email,'')) = v_user_email
        or lower(coalesce(e.created_by,'')) = v_user_email
      )
  )
  into v_authorized;

  if not v_authorized then
    raise exception 'You are not authorized to view controlled-document links for this equipment.';
  end if;

  return query
  select l.*
  from public.equipment_document_links l
  where l.equipment_id = p_equipment_id
    and l.tenant_id = v_tenant_id
  order by l.linked_at desc;
end;
$$;


--
-- Name: FUNCTION get_equipment_controlled_document_links(p_equipment_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_equipment_controlled_document_links(p_equipment_id uuid) IS 'Governed readback of all active and inactive Equipment-to-Controlled-Document relationships.';


--
-- Name: get_qualisphere_enterprise_authority(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_qualisphere_enterprise_authority(p_user_email text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text := lower(trim(coalesce(p_user_email,'')));
  v_primary_role text := '';
  v_account_active boolean := false;
  v_is_admin boolean := false;
  v_is_quality_approver boolean := false;
  v_is_equipment_coordinator boolean := false;
  v_is_equipment_approver boolean := false;
begin
  if v_email = '' then
    return jsonb_build_object(
      'account_active',false,
      'is_admin',false,
      'is_quality_approver',false,
      'is_equipment_coordinator',false,
      'is_equipment_approver',false
    );
  end if;

  select
    lower(coalesce(ur.role,'')),
    lower(coalesce(ur.account_status,'active')) = 'active'
  into v_primary_role, v_account_active
  from public.user_roles ur
  where lower(ur.user_email)=v_email
  limit 1;

  if not found or not v_account_active then
    return jsonb_build_object(
      'account_active',false,
      'is_admin',false,
      'is_quality_approver',false,
      'is_equipment_coordinator',false,
      'is_equipment_approver',false
    );
  end if;

  v_is_admin :=
    v_primary_role in ('admin','administrator','vp_quality')
    or exists (
      select 1
      from public.user_security_roles usr
      where lower(usr.user_email)=v_email
        and usr.role_code in ('admin','administrator','vp_quality','equipment_administrator')
    );

  -- Legacy enterprise Quality Approver remains recognized so existing assignments
  -- do not suddenly lose authority.
  v_is_quality_approver := exists (
    select 1
    from public.user_security_roles usr
    where lower(usr.user_email)=v_email
      and usr.role_code='quality_approver'
  );

  v_is_equipment_coordinator :=
    v_is_admin
    or exists (
      select 1
      from public.user_security_roles usr
      where lower(usr.user_email)=v_email
        and usr.role_code in ('equipment_coordinator','equipment_administrator')
    );

  v_is_equipment_approver :=
    v_is_admin
    or v_is_quality_approver
    or exists (
      select 1
      from public.user_security_roles usr
      where lower(usr.user_email)=v_email
        and usr.role_code in ('equipment_approver','equipment_administrator')
    );

  return jsonb_build_object(
    'account_active',true,
    'is_admin',v_is_admin,
    'is_quality_approver',v_is_quality_approver,
    'is_equipment_coordinator',v_is_equipment_coordinator,
    'is_equipment_approver',v_is_equipment_approver
  );
end;
$$;


--
-- Name: has_equipment_role_for_tenant(uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_equipment_role_for_tenant(p_tenant_id uuid, p_user_email text, p_allowed_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.equipment_governance_members gm
    where gm.tenant_id = p_tenant_id
      and lower(gm.user_email) = lower(coalesce(p_user_email,''))
      and gm.is_active = true
      and gm.role = any(p_allowed_roles)
  );
$$;


--
-- Name: has_tenant_module_access(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_tenant_module_access(p_tenant_id uuid, p_module_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
    select
        public.is_tenant_member(p_tenant_id)
        and exists (
            select 1
            from public.tenant_module_access tma
            where tma.tenant_id = p_tenant_id
              and lower(tma.module_code) = lower(trim(p_module_code))
              and tma.is_enabled = true
        );
$$;


--
-- Name: is_approver(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approver() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '') = 'approver';
$$;


--
-- Name: is_equipment_admin_for_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_equipment_admin_for_tenant(p_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.equipment_governance_members gm
    where gm.tenant_id = p_tenant_id
      and lower(gm.user_email) = lower(coalesce(auth.jwt() ->> 'email',''))
      and gm.is_active = true
      and gm.role = 'admin'
  );
$$;


--
-- Name: FUNCTION is_equipment_admin_for_tenant(p_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_equipment_admin_for_tenant(p_tenant_id uuid) IS 'Non-recursive helper used by Equipment governance RLS to determine whether the signed-in user is an active Equipment Admin for a tenant.';


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
    select exists (
        select 1
        from public.platform_administrators pa
        where lower(pa.user_email) = public.current_user_email()
          and pa.is_active = true
    );
$$;


--
-- Name: is_qms_governance_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_qms_governance_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where lower(coalesce(ur.user_email, '')) =
          lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(coalesce(ur.role, '')) in (
        'admin',
        'administrator',
        'vp_quality'
      )
  );
$$;


--
-- Name: is_qualisphere_role_administrator(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_qualisphere_role_administrator() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where lower(ur.user_email)=lower(coalesce(auth.jwt()->>'email',''))
      and lower(coalesce(ur.account_status,'active'))='active'
      and lower(coalesce(ur.role,'')) in ('admin','administrator','vp_quality')
  )
  or exists (
    select 1
    from public.user_security_roles usr
    join public.security_roles sr on sr.code=usr.role_code
    join public.user_roles ur on lower(ur.user_email)=lower(usr.user_email)
    where lower(usr.user_email)=lower(coalesce(auth.jwt()->>'email',''))
      and lower(coalesce(ur.account_status,'active'))='active'
      and sr.is_active is not false
      and (sr.permission_key in ('administrator','vp_quality') or sr.code in ('administrator','vp_quality'))
  );
$$;


--
-- Name: is_tenant_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_admin(p_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
    select exists (
        select 1
        from public.tenant_memberships tm
        where tm.tenant_id = p_tenant_id
          and lower(tm.user_email) = public.current_user_email()
          and tm.membership_status = 'active'
          and tm.membership_role = 'company_admin'
    );
$$;


--
-- Name: is_tenant_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_member(p_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
    select exists (
        select 1
        from public.tenant_memberships tm
        where tm.tenant_id = p_tenant_id
          and lower(tm.user_email) = public.current_user_email()
          and tm.membership_status = 'active'
    );
$$;


--
-- Name: link_equipment_controlled_document(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text) RETURNS public.equipment_document_links
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_email text;
  v_tenant_id uuid;
  v_document_status text;
  v_link public.equipment_document_links;
  v_authorized boolean := false;
begin
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_user_email = '' then
    raise exception 'You must be signed in to link a controlled document.';
  end if;

  if p_relationship_type not in (
    'specification',
    'operating_procedure',
    'calibration_procedure',
    'preventive_maintenance_procedure',
    'qualification_protocol',
    'work_instruction',
    'other'
  ) then
    raise exception 'Invalid Equipment document relationship type.';
  end if;

  select e.tenant_id
    into v_tenant_id
  from public.equipment e
  where e.id = p_equipment_id;

  if v_tenant_id is null then
    raise exception 'Equipment record not found.';
  end if;

  select exists (
    select 1
    from public.equipment_governance_members gm
    where gm.tenant_id = v_tenant_id
      and lower(gm.user_email) = v_user_email
      and gm.is_active = true
      and gm.role in ('coordinator','quality_approver','admin')
  )
  or exists (
    select 1
    from public.equipment e
    where e.id = p_equipment_id
      and e.tenant_id = v_tenant_id
      and (
        lower(coalesce(e.owner_email,'')) = v_user_email
        or lower(coalesce(e.created_by,'')) = v_user_email
      )
  )
  into v_authorized;

  if not v_authorized then
    raise exception 'You are not authorized to maintain controlled-document links for this equipment.';
  end if;

  select lower(coalesce(cd.status,''))
    into v_document_status
  from public.controlled_documents cd
  where cd.id = p_document_id;

  if v_document_status is null then
    raise exception 'Controlled document not found.';
  end if;

  if v_document_status not in ('effective','released','release') then
    raise exception 'Only Released or Effective controlled documents can be linked to Equipment.';
  end if;

  insert into public.equipment_document_links (
    tenant_id,
    equipment_id,
    document_id,
    relationship_type,
    is_active,
    linked_by,
    linked_at
  )
  values (
    v_tenant_id,
    p_equipment_id,
    p_document_id,
    p_relationship_type,
    true,
    v_user_email,
    now()
  )
  on conflict (equipment_id, document_id, relationship_type)
  do update set
    is_active = true,
    linked_by = excluded.linked_by,
    linked_at = excluded.linked_at
  returning * into v_link;

  return v_link;
end;
$$;


--
-- Name: FUNCTION link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text) IS 'Governed Equipment-to-Controlled-Document link/reactivation. Validates authenticated Equipment authority and Released/Effective Document Control status.';


--
-- Name: list_equipment_release_approvers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_equipment_release_approvers() RETURNS TABLE(user_email text, access_label text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with authorized_users as (
    select
      lower(trim(ur.user_email)) as user_email,
      bool_or(usr.role_code = 'equipment_administrator') as is_equipment_administrator,
      bool_or(usr.role_code = 'equipment_approver') as is_equipment_approver
    from public.user_roles ur
    join public.user_security_roles usr
      on lower(trim(usr.user_email)) = lower(trim(ur.user_email))
    join public.security_roles sr
      on sr.code = usr.role_code
    where lower(coalesce(ur.account_status, 'active')) = 'active'
      and usr.role_code in (
        'equipment_approver',
        'equipment_administrator'
      )
    group by lower(trim(ur.user_email))
  )
  select
    au.user_email::text,
    case
      when au.is_equipment_administrator then 'Equipment Administrator'
      else 'Equipment Approver'
    end::text as access_label
  from authorized_users au
  order by au.user_email;
$$;


--
-- Name: ncmr_cancel_pending_tasks_governed(uuid, text, text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_cancel_pending_tasks_governed(p_ncmr_id uuid, p_reason text, p_task_types text[] DEFAULT NULL::text[], p_exclude_task_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_count integer := 0;
begin
    if not public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then
        raise exception 'Not authorized to cancel pending tasks for this NCMR.';
    end if;

    if nullif(trim(coalesce(p_reason,'')), '') is null then
        raise exception 'Cancellation reason is required.';
    end if;

    update public.approval_tasks t
    set
        status = 'cancelled',
        comments = trim(p_reason)
    where t.entity_type = 'ncmr'
      and t.entity_id = p_ncmr_id
      and lower(coalesce(t.status,'')) = 'pending'
      and (
          p_task_types is null
          or cardinality(p_task_types) = 0
          or t.task_type = any(p_task_types)
      )
      and (
          p_exclude_task_id is null
          or t.id <> p_exclude_task_id
      );

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;


--
-- Name: ncmr_cancel_task_ids_governed(uuid, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_cancel_task_ids_governed(p_ncmr_id uuid, p_task_ids uuid[], p_reason text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_count integer := 0;
begin
    if not public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then
        raise exception 'Not authorized to cancel tasks for this NCMR.';
    end if;

    if p_task_ids is null or cardinality(p_task_ids) = 0 then
        return 0;
    end if;

    if nullif(trim(coalesce(p_reason,'')), '') is null then
        raise exception 'Cancellation reason is required.';
    end if;

    update public.approval_tasks t
    set
        status = 'cancelled',
        comments = trim(p_reason)
    where t.entity_type = 'ncmr'
      and t.entity_id = p_ncmr_id
      and t.id = any(p_task_ids)
      and lower(coalesce(t.status,'')) = 'pending';

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;


--
-- Name: approval_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    task_type text NOT NULL,
    required_function text NOT NULL,
    assigned_to_email text,
    assigned_by_email text,
    status text DEFAULT 'pending'::text,
    due_date date,
    comments text,
    signature_meaning text,
    signed_by text,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    approver_comment text,
    task_title text,
    task_instructions text,
    completion_comment text,
    completed_by text,
    completed_at timestamp with time zone,
    capa_task_id uuid,
    required boolean DEFAULT true,
    approver_function text,
    approver_job_title text,
    reassigned_from_email text,
    reassigned_by_email text,
    reassigned_at timestamp with time zone,
    reassignment_reason text,
    record_number text,
    completed_by_email text,
    implementation_verification_status text DEFAULT 'pending'::text NOT NULL,
    implementation_verification_comment text,
    implementation_verified_by text,
    implementation_verified_at timestamp with time zone,
    task_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    assignment_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    returned_reason text,
    returned_by text,
    returned_at timestamp with time zone,
    approval_cycle_id uuid,
    approval_cycle_state text DEFAULT 'active'::text NOT NULL,
    audit_response_snapshot jsonb,
    audit_response_cycle integer,
    document_impact_assessment_id uuid,
    CONSTRAINT approval_tasks_impl_verification_status_chk CHECK ((implementation_verification_status = ANY (ARRAY['pending'::text, 'verified'::text]))),
    CONSTRAINT approval_tasks_unassigned_only_dci_admin_check CHECK (((assigned_to_email IS NOT NULL) OR ((entity_type = 'document_change_initiation'::text) AND (task_type = ANY (ARRAY['dci_administrative_review'::text, 'dci_post_approval_coordination'::text])) AND (status = 'pending'::text) AND (required_function = 'Document Control Coordinator'::text))))
);


--
-- Name: COLUMN approval_tasks.due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.due_date IS 'Due date for completion of the task or approval.';


--
-- Name: COLUMN approval_tasks.approver_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.approver_function IS 'Organizational function represented by the approval task assignee.';


--
-- Name: COLUMN approval_tasks.approver_job_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.approver_job_title IS 'Company-defined job title/function authority represented by the approval task assignee.';


--
-- Name: COLUMN approval_tasks.reassigned_from_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.reassigned_from_email IS 'Previous assignee email when a task is reassigned.';


--
-- Name: COLUMN approval_tasks.reassigned_by_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.reassigned_by_email IS 'User who performed the reassignment.';


--
-- Name: COLUMN approval_tasks.reassigned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.reassigned_at IS 'Timestamp when the task was reassigned.';


--
-- Name: COLUMN approval_tasks.reassignment_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.reassignment_reason IS 'Required reason entered when the task was reassigned.';


--
-- Name: COLUMN approval_tasks.record_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.record_number IS 'Business-facing record number shown in My Tasks, such as CAPA0000025.';


--
-- Name: COLUMN approval_tasks.implementation_verification_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.implementation_verification_status IS 'NCMR owner verification state for Correction / Corrective Action implementation tasks: pending or verified.';


--
-- Name: COLUMN approval_tasks.implementation_verification_comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.implementation_verification_comment IS 'Independent NCMR owner verification comment tied to the specific completed implementation task.';


--
-- Name: COLUMN approval_tasks.implementation_verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.implementation_verified_by IS 'Email of the NCMR owner who independently verified the completed implementation task.';


--
-- Name: COLUMN approval_tasks.implementation_verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.implementation_verified_at IS 'Timestamp when the NCMR owner independently verified the completed implementation task.';


--
-- Name: COLUMN approval_tasks.task_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.task_attachments IS 'Optional objective evidence uploaded by the assigned task owner when completing Correction, Corrective Action, or Rework work.';


--
-- Name: COLUMN approval_tasks.assignment_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.assignment_attachments IS 'Optional evidence or controlled work instruction supplied with a task assignment.';


--
-- Name: COLUMN approval_tasks.returned_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.returned_reason IS 'Reason an assignee returned a task for refinement or clarification.';


--
-- Name: COLUMN approval_tasks.returned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.returned_by IS 'Authenticated user who returned the task.';


--
-- Name: COLUMN approval_tasks.returned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_tasks.returned_at IS 'Timestamp when the task was returned.';


--
-- Name: ncmr_create_governed_task(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_create_governed_task(p_ncmr_id uuid, p_task jsonb) RETURNS public.approval_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := public.qualisphere_current_user_email();
    v_type text := lower(trim(coalesce(p_task ->> 'task_type','')));
    v_assignee text := lower(trim(coalesce(p_task ->> 'assigned_to_email','')));
    v_function text := trim(coalesce(p_task ->> 'required_function',''));
    v_due_date date;
    v_required boolean := coalesce((p_task ->> 'required')::boolean, true);
    v_task public.approval_tasks%rowtype;
begin
    if not public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then
        raise exception 'Not authorized to create tasks for this NCMR.';
    end if;

    if v_type not in (
        'ncmr_owner',
        'correction_task',
        'corrective_action_task',
        'rework_task',
        'investigation_collaboration'
    ) then
        raise exception 'Unsupported governed NCMR task type: %.', v_type;
    end if;

    if v_assignee = '' then
        raise exception 'Task assignee email is required.';
    end if;

    if not exists (
        select 1
        from public.user_roles u
        where lower(trim(u.user_email)) = v_assignee
          and lower(coalesce(u.account_status,'active')) = 'active'
    ) then
        raise exception 'Task assignee % is not an active registered QualiSphere user.', v_assignee;
    end if;

    begin
        v_due_date := nullif(p_task ->> 'due_date','')::date;
    exception
        when invalid_text_representation then
            raise exception 'Invalid task due date.';
    end;

    insert into public.approval_tasks (
        entity_type,
        entity_id,
        task_type,
        required_function,
        task_title,
        task_instructions,
        assigned_to_email,
        assigned_by_email,
        status,
        due_date,
        comments,
        required,
        assignment_attachments
    )
    values (
        'ncmr',
        p_ncmr_id,
        v_type,
        nullif(v_function,''),
        nullif(p_task ->> 'task_title',''),
        nullif(p_task ->> 'task_instructions',''),
        v_assignee,
        v_email,
        'pending',
        v_due_date,
        nullif(p_task ->> 'comments',''),
        v_required,
        case
            when p_task ? 'assignment_attachments'
                then p_task -> 'assignment_attachments'
            else null
        end
    )
    returning * into v_task;

    return v_task;
end;
$$;


--
-- Name: ncmr_create_mrb_approval_package(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_create_mrb_approval_package(p_ncmr_id uuid, p_tasks jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := public.qualisphere_current_user_email();
    v_item jsonb;
    v_assignee text;
    v_function text;
    v_comments text;
    v_task_title text;
    v_due_date date;
    v_required boolean;
    v_inserted jsonb := '[]'::jsonb;
    v_task public.approval_tasks%rowtype;
    v_new_cycle_id uuid := gen_random_uuid();
    v_existing_cycle_id uuid;
    v_existing_active_count integer := 0;
begin
    if not public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then
        raise exception 'Not authorized to create MRB approval tasks for this NCMR.';
    end if;

    if p_tasks is null
       or jsonb_typeof(p_tasks) <> 'array'
       or jsonb_array_length(p_tasks) = 0 then
        raise exception 'At least one MRB approval task is required.';
    end if;

    -- Lock the parent NCMR so two simultaneous submissions cannot create
    -- competing current cycles.
    select current_mrb_approval_cycle_id
      into v_existing_cycle_id
    from public.ncmrs
    where id = p_ncmr_id
    for update;

    if not found then
        raise exception 'NCMR not found.';
    end if;

    -- Only the explicit current ACTIVE cycle can block a duplicate submission.
    if v_existing_cycle_id is not null then
        select count(*)
          into v_existing_active_count
        from public.approval_tasks t
        where t.entity_type = 'ncmr'
          and t.entity_id::text = p_ncmr_id::text
          and t.task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
          and t.approval_cycle_id = v_existing_cycle_id
          and lower(coalesce(t.approval_cycle_state,'active')) = 'active'
          and lower(coalesce(t.status,'')) not in ('cancelled','obsolete');

        if v_existing_active_count > 0 then
            raise exception
                'This MRB package has already been submitted and has a current active approval cycle.';
        end if;

        -- A pointer with no active tasks is stale. Clear it before creating the
        -- new cycle rather than allowing historical data to become authority.
        update public.ncmrs
        set current_mrb_approval_cycle_id = null
        where id = p_ncmr_id;
    end if;

    -- Any legacy NULL-cycle MRB tasks are historical. Normalize them now so
    -- they can never interfere with the new approval cycle.
    update public.approval_tasks
    set approval_cycle_state = 'superseded'
    where entity_type = 'ncmr'
      and entity_id::text = p_ncmr_id::text
      and approval_cycle_id is null
      and task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
      and lower(coalesce(approval_cycle_state,'active')) <> 'superseded';

    -- Establish the new cycle before creating its reviewer tasks.
    update public.ncmrs
    set
        current_mrb_approval_cycle_id = v_new_cycle_id,
        review_status = 'pending_approval',
        mrb_approved_by = null,
        mrb_approved_at = null,
        mrb_signature_email_entered = null,
        mrb_signature_meaning = null
    where id = p_ncmr_id;

    for v_item in
        select value from jsonb_array_elements(p_tasks)
    loop
        v_assignee := lower(trim(coalesce(v_item ->> 'assigned_to_email','')));
        v_function := trim(coalesce(v_item ->> 'required_function',''));
        v_comments := nullif(trim(coalesce(v_item ->> 'comments','')), '');
        v_task_title := nullif(trim(coalesce(v_item ->> 'task_title','')), '');
        v_required := coalesce((v_item ->> 'required')::boolean, true);

        begin
            v_due_date := nullif(v_item ->> 'due_date','')::date;
        exception
            when invalid_text_representation then
                raise exception 'Invalid MRB approval due date for %.', v_assignee;
        end;

        if v_assignee = '' then
            raise exception 'MRB approver email is required.';
        end if;

        if v_function = '' then
            raise exception 'MRB approver function is required for %.', v_assignee;
        end if;

        if not exists (
            select 1
            from public.user_roles u
            where lower(trim(u.user_email)) = v_assignee
              and lower(coalesce(u.account_status,'active')) = 'active'
        ) then
            raise exception 'MRB approver % is not an active registered QualiSphere user.', v_assignee;
        end if;

        -- Prevent duplicate reviewer/function assignments inside this one
        -- newly-created current approval cycle.
        if exists (
            select 1
            from public.approval_tasks t
            where t.entity_type = 'ncmr'
              and t.entity_id::text = p_ncmr_id::text
              and t.approval_cycle_id = v_new_cycle_id
              and lower(coalesce(t.approval_cycle_state,'active')) = 'active'
              and t.task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
              and lower(trim(coalesce(t.assigned_to_email,''))) = v_assignee
              and coalesce(t.required_function,'') = v_function
        ) then
            raise exception
                'Duplicate MRB reviewer assignment in the current approval package: % / %.',
                v_function, v_assignee;
        end if;

        insert into public.approval_tasks (
            entity_type,
            entity_id,
            task_type,
            required_function,
            task_title,
            assigned_to_email,
            assigned_by_email,
            status,
            comments,
            due_date,
            required,
            approval_cycle_id,
            approval_cycle_state
        )
        values (
            'ncmr',
            p_ncmr_id,
            'mrb_approval',
            v_function,
            v_task_title,
            v_assignee,
            v_email,
            'pending',
            v_comments,
            v_due_date,
            v_required,
            v_new_cycle_id,
            'active'
        )
        returning * into v_task;

        v_inserted := v_inserted || to_jsonb(v_task);
    end loop;

    return v_inserted;
end;
$$;


--
-- Name: ncmr_decide_mrb_approval_task(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_decide_mrb_approval_task(p_task_id uuid, p_decision text, p_comment text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := public.qualisphere_current_user_email();
    v_decision text := lower(trim(coalesce(p_decision,'')));
    v_task public.approval_tasks%rowtype;
    v_current_cycle_id uuid;
    v_is_assignee boolean := false;
    v_governance boolean := false;
    v_now timestamptz := now();
    v_cancelled integer := 0;
    v_all_approved boolean := false;
    v_reviewer_emails text[] := array[]::text[];
begin
    if v_email = '' then
        raise exception 'Authentication required.';
    end if;

    if v_decision not in ('approved','rejected') then
        raise exception 'Decision must be approved or rejected.';
    end if;

    select *
      into v_task
    from public.approval_tasks
    where id = p_task_id
      and entity_type = 'ncmr'
      and task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
    for update;

    if not found then
        raise exception 'MRB approval task not found.';
    end if;

    select current_mrb_approval_cycle_id
      into v_current_cycle_id
    from public.ncmrs
    where id = v_task.entity_id;

    if v_current_cycle_id is null
       or v_task.approval_cycle_id is distinct from v_current_cycle_id
       or lower(coalesce(v_task.approval_cycle_state,'active')) <> 'active' then
        raise exception 'This MRB approval task belongs to a superseded approval cycle.';
    end if;

    if lower(coalesce(v_task.status,'')) <> 'pending' then
        raise exception 'This MRB approval task is no longer pending.';
    end if;

    v_is_assignee :=
        lower(trim(coalesce(v_task.assigned_to_email,''))) = v_email;

    v_governance :=
        public.qualisphere_can_govern_ncmr_tasks(v_task.entity_id);

    if not v_is_assignee and not v_governance then
        raise exception 'This MRB approval task is assigned to another reviewer.';
    end if;

    if v_decision = 'rejected'
       and nullif(trim(coalesce(p_comment,'')), '') is null then
        raise exception 'A rejection rationale is required.';
    end if;

    update public.approval_tasks
    set
        status = v_decision,
        approver_comment = nullif(trim(coalesce(p_comment,'')), ''),
        signature_meaning =
            case
                when v_decision = 'approved'
                    then 'MRB Approval: I approve the submitted MRB review package.'
                else 'MRB Approval: I reject the submitted MRB review package.'
            end,
        signed_by = v_email,
        signed_at = v_now
    where id = v_task.id;

    if v_decision = 'rejected' then
        update public.approval_tasks
        set
            status = 'cancelled',
            comments =
                'Cancelled because an MRB reviewer rejected the current MRB approval package.'
        where entity_type = 'ncmr'
          and entity_id = v_task.entity_id
          and approval_cycle_id = v_current_cycle_id
          and approval_cycle_state = 'active'
          and task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
          and status = 'pending'
          and id <> v_task.id;

        get diagnostics v_cancelled = row_count;
    end if;

    select
        coalesce(bool_and(lower(coalesce(t.status,'')) = 'approved'), false),
        coalesce(
            array_agg(lower(trim(t.assigned_to_email)))
                filter (where lower(coalesce(t.status,'')) = 'approved'),
            array[]::text[]
        )
      into v_all_approved, v_reviewer_emails
    from public.approval_tasks t
    where t.entity_type = 'ncmr'
      and t.entity_id = v_task.entity_id
      and t.approval_cycle_id = v_current_cycle_id
      and t.approval_cycle_state = 'active'
      and t.task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
      and coalesce(t.required,true) = true
      and lower(coalesce(t.status,'')) not in ('cancelled','obsolete');

    return jsonb_build_object(
        'task_id', v_task.id,
        'ncmr_id', v_task.entity_id,
        'approval_cycle_id', v_current_cycle_id,
        'decision', v_decision,
        'decided_by', v_email,
        'sibling_tasks_cancelled', v_cancelled,
        'all_required_approved', v_all_approved,
        'approved_reviewer_emails', to_jsonb(v_reviewer_emails)
    );
end;
$$;


--
-- Name: ncmr_get_mrb_approval_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_get_mrb_approval_tasks(p_ncmr_id uuid) RETURNS SETOF public.approval_tasks
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
    if not public.qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id) then
        raise exception 'Not authorized to read the MRB task set for this NCMR.';
    end if;

    return query
    select t.*
    from public.approval_tasks t
    where t.entity_type = 'ncmr'
      and t.entity_id = p_ncmr_id
      and t.task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
    order by t.created_at asc;
end;
$$;


--
-- Name: ncmr_resubmit_returned_rework_task(uuid, text, date, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_resubmit_returned_rework_task(p_task_id uuid, p_assigned_to_email text, p_due_date date, p_task_instructions text, p_assignment_attachments jsonb DEFAULT NULL::jsonb) RETURNS public.approval_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := public.qualisphere_current_user_email();
    v_assignee text := lower(trim(coalesce(p_assigned_to_email,'')));
    v_task public.approval_tasks%rowtype;
begin
    select *
      into v_task
    from public.approval_tasks
    where id = p_task_id
      and entity_type = 'ncmr'
      and task_type = 'rework_task'
    for update;

    if not found then
        raise exception 'Rework task not found.';
    end if;

    if not public.qualisphere_can_govern_ncmr_tasks(v_task.entity_id) then
        raise exception 'Not authorized to revise this Rework task.';
    end if;

    if lower(coalesce(v_task.status,'')) <> 'returned' then
        raise exception 'Only a returned Rework task can be revised and resubmitted.';
    end if;

    if v_assignee = '' then
        raise exception 'Rework task assignee email is required.';
    end if;

    if nullif(trim(coalesce(p_task_instructions,'')), '') is null then
        raise exception 'Rework task instructions are required.';
    end if;

    if not exists (
        select 1
        from public.user_roles u
        where lower(trim(u.user_email)) = v_assignee
          and lower(coalesce(u.account_status,'active')) = 'active'
    ) then
        raise exception 'Rework assignee % is not an active registered QualiSphere user.', v_assignee;
    end if;

    update public.approval_tasks
    set
        task_instructions = trim(p_task_instructions),
        assigned_to_email = v_assignee,
        assigned_by_email = v_email,
        due_date = p_due_date,
        comments = trim(p_task_instructions),
        assignment_attachments =
            coalesce(p_assignment_attachments, assignment_attachments),
        status = 'pending',
        returned_reason = null,
        returned_by = null,
        returned_at = null,
        implementation_verification_status = 'pending',
        implementation_verification_comment = null,
        implementation_verified_by = null,
        implementation_verified_at = null
    where id = p_task_id
    returning * into v_task;

    return v_task;
end;
$$;


--
-- Name: ncmr_supersede_current_mrb_approval_cycle(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_supersede_current_mrb_approval_cycle(p_ncmr_id uuid, p_reason text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_cycle_id uuid;
    v_count integer := 0;
    v_cycle_count integer := 0;
    v_legacy_count integer := 0;
begin
    if not public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then
        raise exception 'Not authorized to supersede the MRB approval cycle for this NCMR.';
    end if;

    if nullif(trim(coalesce(p_reason,'')), '') is null then
        raise exception 'Supersede reason is required.';
    end if;

    select current_mrb_approval_cycle_id
      into v_cycle_id
    from public.ncmrs
    where id = p_ncmr_id
    for update;

    if not found then
        raise exception 'NCMR not found.';
    end if;

    -- Supersede the explicit current cycle, when one exists.
    if v_cycle_id is not null then
        update public.approval_tasks
        set approval_cycle_state = 'superseded'
        where entity_type = 'ncmr'
          and entity_id::text = p_ncmr_id::text
          and approval_cycle_id = v_cycle_id
          and task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
          and lower(coalesce(approval_cycle_state,'active')) <> 'superseded';

        get diagnostics v_cycle_count = row_count;
    end if;

    -- Also normalize any pre-cycle-ID MRB history for the same NCMR.
    update public.approval_tasks
    set approval_cycle_state = 'superseded'
    where entity_type = 'ncmr'
      and entity_id::text = p_ncmr_id::text
      and approval_cycle_id is null
      and task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
      and lower(coalesce(approval_cycle_state,'active')) <> 'superseded';

    get diagnostics v_legacy_count = row_count;

    update public.ncmrs
    set current_mrb_approval_cycle_id = null
    where id = p_ncmr_id;

    v_count := v_cycle_count + v_legacy_count;
    return v_count;
end;
$$;


--
-- Name: ncmr_verify_completed_task(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ncmr_verify_completed_task(p_task_id uuid, p_verification_comment text) RETURNS public.approval_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := public.qualisphere_current_user_email();
    v_task public.approval_tasks%rowtype;
begin
    select *
      into v_task
    from public.approval_tasks
    where id = p_task_id
      and entity_type = 'ncmr'
      and task_type in ('correction_task','corrective_action_task','rework_task')
    for update;

    if not found then
        raise exception 'Implementation task not found.';
    end if;

    if not public.qualisphere_can_govern_ncmr_tasks(v_task.entity_id) then
        raise exception 'Not authorized to verify this implementation task.';
    end if;

    if lower(coalesce(v_task.status,'')) <> 'completed' then
        raise exception 'Only a completed task can be independently verified.';
    end if;

    if nullif(trim(coalesce(p_verification_comment,'')), '') is null then
        raise exception 'Verification comment is required.';
    end if;

    update public.approval_tasks
    set
        implementation_verification_status = 'verified',
        implementation_verification_comment = trim(p_verification_comment),
        implementation_verified_by = v_email,
        implementation_verified_at = now()
    where id = p_task_id
    returning * into v_task;

    return v_task;
end;
$$;


--
-- Name: next_equipment_event_number(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_equipment_event_number(p_tenant_id uuid, p_event_type text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_prefix text;
  v_padding integer;
  v_next bigint;
begin
  if p_event_type not in ('calibration','maintenance','qualification') then
    raise exception 'Unsupported equipment event type: %', p_event_type;
  end if;

  insert into public.equipment_event_number_counters (
    tenant_id, event_type, prefix, sequence_padding, next_sequence
  ) values (
    p_tenant_id,
    p_event_type,
    case p_event_type when 'calibration' then 'CAL' when 'maintenance' then 'PM' when 'qualification' then 'QUAL' end,
    6,
    1
  ) on conflict (tenant_id, event_type) do nothing;

  select prefix, sequence_padding, next_sequence
    into v_prefix, v_padding, v_next
  from public.equipment_event_number_counters
  where tenant_id = p_tenant_id and event_type = p_event_type
  for update;

  update public.equipment_event_number_counters
  set next_sequence = next_sequence + 1
  where tenant_id = p_tenant_id and event_type = p_event_type;

  return v_prefix || lpad(v_next::text, v_padding, '0');
end;
$$;


--
-- Name: next_equipment_import_batch_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_equipment_import_batch_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
declare n bigint;
begin
  n := nextval('public.equipment_import_batch_seq');
  return 'EQ-MIG-' || lpad(n::text, 6, '0');
end;
$$;


--
-- Name: next_qualisphere_equipment_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_qualisphere_equipment_number(p_tenant_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_prefix text;
  v_padding integer;
  v_next bigint;
begin
  insert into public.equipment_numbering_configurations (
    tenant_id, numbering_strategy, generated_prefix, sequence_padding, next_sequence
  ) values (p_tenant_id, 'allow_both', 'EQ', 6, 1)
  on conflict (tenant_id) do nothing;

  select generated_prefix, sequence_padding, next_sequence
    into v_prefix, v_padding, v_next
  from public.equipment_numbering_configurations
  where tenant_id = p_tenant_id and is_active = true
  for update;

  if not found then
    raise exception 'No active equipment numbering configuration exists for tenant %', p_tenant_id;
  end if;

  update public.equipment_numbering_configurations
  set next_sequence = next_sequence + 1
  where tenant_id = p_tenant_id;

  return coalesce(v_prefix, 'EQ') || lpad(v_next::text, v_padding, '0');
end;
$$;


--
-- Name: protect_closed_ncmr_record(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_closed_ncmr_record() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if lower(coalesce(old.status, '')) = 'closed' then
    raise exception
      'Closed NCMR records are immutable. Open the stored NCMR Record snapshot for review.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


--
-- Name: protect_controlled_capa_governance_rule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_controlled_capa_governance_rule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_configuration_id uuid;
    v_status text;
begin

    v_configuration_id :=
        case
            when tg_op = 'DELETE' then old.configuration_version_id
            else new.configuration_version_id
        end;

    select status
    into v_status
    from public.qms_configuration_versions
    where id = v_configuration_id;

    if v_status in ('active', 'retired') then
        raise exception
            'Active or retired CAPA governance rules are immutable. Create a new configuration version.';
    end if;

    return case when tg_op = 'DELETE' then old else new end;
end;
$$;


--
-- Name: protect_controlled_configuration_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_controlled_configuration_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin

    if old.status in ('active', 'retired') then

        if new.configuration is distinct from old.configuration then
            raise exception
                'Controlled configuration cannot be modified in place. Create a new configuration version.';
        end if;

        if new.module_code is distinct from old.module_code
           or new.configuration_type is distinct from old.configuration_type
           or new.version_code is distinct from old.version_code then

            raise exception
                'Controlled configuration identity cannot be modified after activation.';

        end if;

    end if;

    return new;
end;
$$;


--
-- Name: protect_controlled_risk_matrix_rule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_controlled_risk_matrix_rule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_configuration_id uuid;
    v_status text;
begin

    v_configuration_id :=
        case
            when tg_op = 'DELETE' then old.configuration_version_id
            else new.configuration_version_id
        end;

    select status
    into v_status
    from public.qms_configuration_versions
    where id = v_configuration_id;

    if v_status in ('active', 'retired') then
        raise exception
            'Active or retired risk configuration rules are immutable. Create a new configuration version.';
    end if;

    return case when tg_op = 'DELETE' then old else new end;
end;
$$;


--
-- Name: protect_controlled_workflow_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_controlled_workflow_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin

    if old.status in ('active', 'retired') then

        if new.module_code is distinct from old.module_code
           or new.version_code is distinct from old.version_code then

            raise exception
                'Controlled workflow version identity cannot be modified after activation.';

        end if;

    end if;

    return new;
end;
$$;


--
-- Name: protect_ncmr_audit_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_ncmr_audit_history() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if lower(coalesce(old.entity_type, '')) = 'ncmr' then
    raise exception 'NCMR audit history is immutable.';
  end if;
  return old;
end;
$$;


--
-- Name: protect_record_structure_freeze(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_record_structure_freeze() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  raise exception 'Frozen record structure cannot be modified or deleted.';
end;
$$;


--
-- Name: qualisphere_activate_tenant_qms_configuration_version(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_activate_tenant_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target public.qms_configuration_versions%rowtype;
  v_email text := coalesce(auth.jwt() ->> 'email', 'unknown');
begin
  select * into target
  from public.qms_configuration_versions
  where id = p_configuration_version_id;

  if target.id is null then raise exception 'Configuration version was not found.'; end if;
  if not public.qualisphere_is_company_admin(target.tenant_id) then
    raise exception 'Company Administrator authority is required.';
  end if;
  if target.status <> 'draft' then
    raise exception 'Only Draft configuration versions may be activated.';
  end if;
  if coalesce(trim(p_change_justification), '') = '' then
    raise exception 'Activation justification is required.';
  end if;

  update public.qms_configuration_versions
  set status = 'retired'
  where tenant_id = target.tenant_id
    and module_code = target.module_code
    and configuration_type = target.configuration_type
    and status = 'active'
    and id <> target.id;

  update public.qms_configuration_versions
  set status = 'active',
      change_justification = trim(p_change_justification),
      activated_by = v_email,
      activated_at = now()
  where id = target.id;

  insert into public.qms_configuration_audit_log (
    tenant_id, module_code, configuration_type, configuration_version_id,
    action, new_value, change_justification, changed_by
  )
  values (
    target.tenant_id, target.module_code, target.configuration_type, target.id,
    'configuration_version_activated',
    jsonb_build_object('version_code', target.version_code, 'status', 'active'),
    trim(p_change_justification),
    v_email
  );
end;
$$;


--
-- Name: qualisphere_add_audit_log(text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_add_audit_log(p_entity_type text, p_entity_id uuid, p_action text, p_details text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'pg_temp'
    AS $$
declare v_user_email text; v_tenant_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication is required to create an audit log.'; end if;
 select lower(trim(u.email)) into v_user_email from auth.users u where u.id=auth.uid();
 if coalesce(v_user_email,'')='' then raise exception 'Authenticated user email could not be determined.'; end if;
 if nullif(trim(p_entity_type),'') is null then raise exception 'Audit entity type is required.'; end if;
 if p_entity_id is null then raise exception 'Audit entity ID is required.'; end if;
 if nullif(trim(p_action),'') is null then raise exception 'Audit action is required.'; end if;
 v_tenant_id:=public.qualisphere_audit_entity_tenant(p_entity_type,p_entity_id);
 if v_tenant_id is null then raise exception 'Unable to resolve Company Account for audit entity % (%).',p_entity_type,p_entity_id; end if;
 if not public.is_tenant_member(v_tenant_id) then raise exception 'Audit event Company Account does not match an active Company Account membership.'; end if;
 insert into public.audit_logs(tenant_id,entity_type,entity_id,action,details,user_email)
 values(v_tenant_id,lower(trim(p_entity_type)),p_entity_id,trim(p_action),nullif(trim(p_details),''),v_user_email);
end $$;


--
-- Name: qualisphere_approval_task_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_approval_task_access(p_task_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
    v_task public.approval_tasks%rowtype;
    v_authority jsonb := '{}'::jsonb;

    v_is_admin boolean := false;
    v_is_assignee boolean := false;
    v_is_assigner boolean := false;
    v_is_parent_owner boolean := false;

    v_parent_owner_email text := null;
    v_parent_creator_email text := null;

    v_can_view boolean := false;
    v_can_act boolean := false;
begin
    if v_email = '' then
        return jsonb_build_object(
            'authenticated', false,
            'task_found', false,
            'can_view', false,
            'can_act', false,
            'reason', 'Authentication required'
        );
    end if;

    select *
      into v_task
    from public.approval_tasks
    where id = p_task_id;

    if not found then
        return jsonb_build_object(
            'authenticated', true,
            'task_found', false,
            'can_view', false,
            'can_act', false,
            'reason', 'Task not found'
        );
    end if;

    begin
        v_authority := coalesce(
            public.get_qualisphere_enterprise_authority(v_email),
            '{}'::jsonb
        );
    exception
        when others then
            v_authority := '{}'::jsonb;
    end;

    -- QMS Owner / VP Quality may intentionally resolve to broad authority.
    v_is_admin :=
        coalesce((v_authority ->> 'is_admin')::boolean, false)
        or public.is_qms_governance_admin()
        or public.is_qualisphere_role_administrator();

    v_is_assignee :=
        lower(trim(coalesce(v_task.assigned_to_email, ''))) = v_email;

    v_is_assigner :=
        lower(trim(coalesce(v_task.assigned_by_email, ''))) = v_email;

    -- Parent-record ownership mapping using only verified existing columns.
    case lower(coalesce(v_task.entity_type, ''))

        when 'capa' then
            select
                lower(trim(coalesce(owner_email, owner, ''))),
                lower(trim(coalesce(created_by, '')))
              into v_parent_owner_email, v_parent_creator_email
            from public.capas
            where id = v_task.entity_id;

        when 'ncmr' then
            select
                lower(trim(coalesce(owner, ''))),
                null::text
              into v_parent_owner_email, v_parent_creator_email
            from public.ncmrs
            where id = v_task.entity_id;

        when 'equipment' then
            select
                lower(trim(coalesce(owner_email, ''))),
                lower(trim(coalesce(created_by, '')))
              into v_parent_owner_email, v_parent_creator_email
            from public.equipment
            where id = v_task.entity_id;

        when 'change_control' then
            select
                lower(trim(coalesce(owner_email, initiator_email, ''))),
                lower(trim(coalesce(created_by, '')))
              into v_parent_owner_email, v_parent_creator_email
            from public.change_controls
            where id = v_task.entity_id;

        when 'controlled_document' then
            select
                lower(trim(coalesce(owner_email, ''))),
                lower(trim(coalesce(created_by, '')))
              into v_parent_owner_email, v_parent_creator_email
            from public.controlled_documents
            where id = v_task.entity_id;

        when 'scar' then
            select
                lower(trim(coalesce(initiated_by, effectiveness_owner, ''))),
                lower(trim(coalesce(created_by, '')))
              into v_parent_owner_email, v_parent_creator_email
            from public.scars
            where id = v_task.entity_id;

        when 'complaint' then
            select
                lower(trim(coalesce(created_by, ''))),
                lower(trim(coalesce(created_by, '')))
              into v_parent_owner_email, v_parent_creator_email
            from public.complaints
            where id = v_task.entity_id;

        else
            v_parent_owner_email := null;
            v_parent_creator_email := null;
    end case;

    v_is_parent_owner :=
        v_email = coalesce(v_parent_owner_email, '')
        or v_email = coalesce(v_parent_creator_email, '');

    v_can_view :=
        v_is_admin
        or v_is_assignee
        or v_is_assigner
        or v_is_parent_owner;

    v_can_act :=
        v_is_admin
        or v_is_assignee;

    return jsonb_build_object(
        'authenticated', true,
        'task_found', true,
        'task_id', v_task.id,
        'entity_type', v_task.entity_type,
        'task_type', v_task.task_type,
        'status', v_task.status,
        'current_user_email', v_email,
        'is_admin', v_is_admin,
        'is_assignee', v_is_assignee,
        'is_assigner', v_is_assigner,
        'is_parent_owner', v_is_parent_owner,
        'can_view', v_can_view,
        'can_act', v_can_act
    );
end;
$$;


--
-- Name: qualisphere_assign_training_matrix(jsonb, uuid, date, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_assign_training_matrix(p_targets jsonb, p_method uuid, p_due date, p_months integer DEFAULT NULL::integer, p_basis text DEFAULT 'completion'::text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE v_tenant uuid; target record; doc public.controlled_documents%ROWTYPE; employee public.employee_profiles%ROWTYPE; method public.training_methods%ROWTYPE; created integer:=0; mode text;
BEGIN
 v_tenant:=public.qualisphere_resolve_training_tenant();
 IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT public.qualisphere_training_is_coordinator(v_tenant) THEN RAISE EXCEPTION 'Training coordinator permission required'; END IF;
 IF p_due IS NULL OR p_targets IS NULL OR jsonb_typeof(p_targets)<>'array' OR jsonb_array_length(p_targets)>1000 THEN RAISE EXCEPTION 'Select a due date and at most 1000 assignments'; END IF;
 IF p_months IS NOT NULL AND (p_months<1 OR p_months>120 OR p_basis NOT IN ('completion','calendar') OR p_basis IS NULL) THEN RAISE EXCEPTION 'Invalid recurrence settings'; END IF;
 SELECT * INTO method FROM public.training_methods WHERE id=p_method AND tenant_id=v_tenant AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select an active training method in this company'; END IF;
 mode:=CASE WHEN method.evidence_required THEN CASE WHEN method.acknowledgement_required THEN 'both' ELSE 'attachment' END ELSE 'signature' END;
 -- Serialize matrix assignment requests within one tenant, including repeat clicks.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':matrix_assign',0));
 FOR target IN SELECT DISTINCT x.document_id,lower(btrim(x.user_email)) AS email FROM jsonb_to_recordset(p_targets) AS x(document_id uuid,user_email text) ORDER BY x.document_id,lower(btrim(x.user_email)) LOOP
  SELECT * INTO doc FROM public.controlled_documents WHERE id=target.document_id AND tenant_id=v_tenant AND lower(status) IN ('effective','release') FOR SHARE;
  IF NOT FOUND THEN CONTINUE; END IF;
  SELECT * INTO employee FROM public.employee_profiles WHERE tenant_id=v_tenant AND lower(btrim(user_email))=target.email AND active=true FOR SHARE;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.training_matrix m WHERE m.tenant_id=v_tenant AND m.required_training=true AND lower(btrim(m.document_number))=lower(btrim(doc.document_number)) AND (nullif(btrim(m.department),'') IS NULL OR lower(btrim(m.department))=lower(btrim(employee.department))) AND (nullif(btrim(m.role_name),'') IS NULL OR lower(btrim(m.role_name))=lower(btrim(employee.role_name)))) THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.training_assignments a WHERE a.tenant_id=v_tenant AND a.document_id=doc.id AND lower(btrim(a.assigned_to_email))=target.email AND (a.source_document_revision IS NULL OR a.source_document_revision=doc.revision) AND coalesce(a.status,'assigned') NOT IN ('cancelled','withdrawn')) THEN CONTINUE; END IF;
  INSERT INTO public.training_assignments(tenant_id,document_id,source_document_revision,assigned_to_email,assigned_by_email,assignment_source,role_name,department,training_title,training_description,due_date,status,training_method_id,training_category,recurrence_months,recurrence_basis,recurring_evidence_mode,acknowledgement_required,effectiveness_required,effectiveness_status,supervisor_verification_required,release_blocking)
  VALUES(v_tenant,doc.id,doc.revision,target.email,auth.jwt()->>'email','training_matrix_document_effective',employee.role_name,employee.department,method.label||' — '||doc.document_number||' Rev '||doc.revision,'Assigned from the procedure training matrix.',p_due,'assigned',method.id,CASE WHEN p_months IS NULL THEN 'standard' ELSE 'recurring' END,p_months,CASE WHEN p_months IS NOT NULL THEN p_basis END,mode,mode IN ('signature','both'),false,'not_required',false,false);
  created:=created+1;
 END LOOP;
 RETURN created;
END;
$$;


--
-- Name: qualisphere_audit_entity_tenant(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_type text := lower(trim(coalesce(p_entity_type,''))); v_tenant uuid;
BEGIN
 IF p_entity_id IS NULL THEN RETURN NULL; END IF;
 CASE v_type
  WHEN 'ncmr' THEN SELECT tenant_id INTO v_tenant FROM public.ncmrs WHERE id=p_entity_id;
  WHEN 'capa' THEN SELECT tenant_id INTO v_tenant FROM public.capas WHERE id=p_entity_id;
  WHEN 'audit' THEN SELECT tenant_id INTO v_tenant FROM public.audits WHERE id=p_entity_id;
  WHEN 'audit_finding' THEN SELECT tenant_id INTO v_tenant FROM public.audit_findings WHERE id=p_entity_id;
  WHEN 'management_review' THEN SELECT tenant_id INTO v_tenant FROM public.management_reviews WHERE id=p_entity_id;
  WHEN 'management_review_approver' THEN SELECT tenant_id INTO v_tenant FROM public.management_review_approvers WHERE id=p_entity_id;
  WHEN 'scar' THEN SELECT tenant_id INTO v_tenant FROM public.scars WHERE id=p_entity_id;
  WHEN 'oos_oot' THEN SELECT tenant_id INTO v_tenant FROM public.oos_oot_investigations WHERE id=p_entity_id;
  WHEN 'equipment' THEN SELECT tenant_id INTO v_tenant FROM public.equipment WHERE id=p_entity_id;
  WHEN 'receiving_inspection' THEN SELECT tenant_id INTO v_tenant FROM public.receiving_inspections WHERE id=p_entity_id;
  WHEN 'supplier' THEN SELECT tenant_id INTO v_tenant FROM public.suppliers WHERE id=p_entity_id;
  WHEN 'supplier_audit' THEN SELECT tenant_id INTO v_tenant FROM public.supplier_audits WHERE id=p_entity_id;
  WHEN 'supplier_document' THEN SELECT tenant_id INTO v_tenant FROM public.supplier_documents WHERE id=p_entity_id;
  WHEN 'controlled_document' THEN SELECT tenant_id INTO v_tenant FROM public.controlled_documents WHERE id=p_entity_id;
  WHEN 'document_change_initiation' THEN SELECT tenant_id INTO v_tenant FROM public.document_change_initiations WHERE id=p_entity_id;
  WHEN 'tenant_user' THEN SELECT id INTO v_tenant FROM public.tenants WHERE id=p_entity_id;
  ELSE v_tenant := NULL;
 END CASE;
 RETURN v_tenant;
END
$$;


--
-- Name: qualisphere_bridge_internal_legacy_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_bridge_internal_legacy_access() RETURNS TABLE(tenant_id uuid, company_name text, slug text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := public.current_user_email();
  v_tenant_id uuid;
  v_company_name text;
  v_slug text;
  v_rows integer := 0;
begin
  if nullif(trim(coalesce(v_email, '')), '') is null then
    return;
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where lower(ur.user_email) = lower(v_email)
      and lower(trim(coalesce(ur.account_status, 'active'))) = 'active'
  ) then
    return;
  end if;

  select t.id, t.company_name, t.slug
  into v_tenant_id, v_company_name, v_slug
  from public.tenants t
  where coalesce(t.is_internal, false) = true
    and t.status = 'active'
  order by t.created_at
  limit 1;

  if v_tenant_id is null then
    return;
  end if;

  update public.tenant_memberships tm
  set membership_status = 'active',
      joined_at = coalesce(tm.joined_at, now()),
      updated_at = now()
  where tm.tenant_id = v_tenant_id
    and lower(tm.user_email) = lower(v_email);

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.tenant_memberships (
      tenant_id,
      user_email,
      membership_role,
      membership_status,
      invited_by,
      invited_at,
      joined_at
    )
    values (
      v_tenant_id,
      lower(v_email),
      'member',
      'active',
      'qualisphere-legacy-login-bridge',
      now(),
      now()
    );
  end if;

  tenant_id := v_tenant_id;
  company_name := v_company_name;
  slug := v_slug;
  return next;
end;
$$;


--
-- Name: qualisphere_can_access_audit_evidence_object(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_access_audit_evidence_object(p_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_tenant uuid;
begin
  if auth.uid() is null or p_name is null or p_name not like 'tenant/%' then return false; end if;
  v_tenant := public.qualisphere_current_audit_tenant();
  if v_tenant is null then return false; end if;
  return split_part(p_name,'/',2)=v_tenant::text;
end;
$$;


--
-- Name: qualisphere_can_access_controlled_document_storage_object(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_access_controlled_document_storage_object(p_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tenant_text text;
  v_current_tenant uuid;
begin
  if auth.uid() is null or p_name is null then
    return false;
  end if;

  if p_name like 'tenant/%' then
    v_tenant_text := split_part(p_name, '/', 2);
    begin
      v_current_tenant := public.qualisphere_current_controlled_documents_tenant();
    exception when others then
      return false;
    end;
    return v_tenant_text = v_current_tenant::text;
  end if;

  -- Legacy paths predate tenant prefixes. Preserve them only for the Internal
  -- development/validation Company Account; customer accounts must never use them.
  begin
    v_current_tenant := public.qualisphere_current_controlled_documents_tenant();
  exception when others then
    return false;
  end;

  return exists (
    select 1 from public.tenants t
    where t.id = v_current_tenant
      and t.is_internal = true
      and lower(coalesce(t.status,'active')) = 'active'
  );
end;
$$;


--
-- Name: qualisphere_can_access_ncmr(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_access_ncmr(p_ncmr_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select exists (
    select 1
    from public.ncmrs n
    where n.id = p_ncmr_id
      and public.qualisphere_is_active_tenant_member(n.tenant_id)
      and public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr')
  );
$$;


--
-- Name: qualisphere_can_access_supplier_document_storage_object(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_access_supplier_document_storage_object(p_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_tenant uuid;
  v_prefix text;
begin
  v_tenant := public.qualisphere_resolve_supplier_quality_tenant();
  if v_tenant is null or p_name is null then return false; end if;
  v_prefix := 'tenant/' || v_tenant::text || '/';
  return p_name like v_prefix || '%';
end;
$$;


--
-- Name: qualisphere_can_access_training_evidence(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_access_training_evidence(p_path text, p_write boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
 select auth.uid() is not null
 and split_part(p_path,'/',1)=public.qualisphere_resolve_training_tenant()::text
 and exists(
  select 1 from public.training_assignments a
  where a.tenant_id=public.qualisphere_resolve_training_tenant()
   and a.id::text=split_part(p_path,'/',2)
   and (public.qualisphere_training_is_coordinator(a.tenant_id)
    or public.qualisphere_training_is_assignee(a.assigned_to_email))
 )
$$;


--
-- Name: qualisphere_can_act_on_approval_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_act_on_approval_task(p_task_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    select coalesce(
        (public.qualisphere_approval_task_access(p_task_id) ->> 'can_act')::boolean,
        false
    );
$$;


--
-- Name: qualisphere_can_govern_ncmr_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
    v_email text := public.qualisphere_current_user_email();
    v_owner text := '';
    v_authority jsonb := '{}'::jsonb;
begin
    if v_email = '' or p_ncmr_id is null then return false; end if;
    if not public.qualisphere_can_access_ncmr(p_ncmr_id) then return false; end if;
    select lower(trim(coalesce(owner, ''))) into v_owner from public.ncmrs where id = p_ncmr_id;
    if found and v_owner = v_email then return true; end if;
    begin
        v_authority := coalesce(public.get_qualisphere_enterprise_authority(v_email), '{}'::jsonb);
    exception when others then
        v_authority := '{}'::jsonb;
    end;
    return coalesce((v_authority ->> 'is_admin')::boolean, false)
        or public.is_qms_governance_admin()
        or public.is_qualisphere_role_administrator();
end;
$$;


--
-- Name: qualisphere_can_read_ncmr_mrb_task_set(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_email text := public.qualisphere_current_user_email();
begin
    if v_email = '' or p_ncmr_id is null then return false; end if;
    if not public.qualisphere_can_access_ncmr(p_ncmr_id) then return false; end if;
    if public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then return true; end if;
    return exists (
        select 1 from public.approval_tasks t
        where t.entity_type = 'ncmr'
          and t.entity_id = p_ncmr_id
          and t.task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review')
          and lower(trim(coalesce(t.assigned_to_email,''))) = v_email
    );
end;
$$;


--
-- Name: qualisphere_can_view_approval_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_can_view_approval_task(p_task_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    select coalesce(
        (public.qualisphere_approval_task_access(p_task_id) ->> 'can_view')::boolean,
        false
    );
$$;


--
-- Name: qualisphere_capa_authorized_users(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_capa_authorized_users(p_purpose text DEFAULT 'owner'::text) RETURNS TABLE(user_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_tenant_id uuid;
  v_caller text := lower(trim(coalesce(public.current_user_email(), '')));
  v_is_internal boolean := false;
  v_purpose text := lower(trim(coalesce(p_purpose, 'owner')));
begin
  v_tenant_id := public.qualisphere_current_capa_tenant();
  if v_tenant_id is null or v_caller = '' then return; end if;

  select coalesce(t.is_internal, false) into v_is_internal
  from public.tenants t where t.id = v_tenant_id;

  if v_is_internal then
    return query
    with legacy_access as (
      select lower(trim(usr.user_email)) as email
      from public.user_security_roles usr
      where lower(trim(usr.role_code)) in ('capa_user','capa_coordinator','capa_administrator','approver','administrator','vp_quality')
      union
      select lower(trim(ur.user_email))
      from public.user_roles ur
      where lower(coalesce(ur.account_status, 'active')) <> 'inactive'
        and lower(trim(ur.role)) in ('admin','administrator','approver','vp_quality')
    )
    select distinct la.email from legacy_access la where la.email <> '' order by 1;
    return;
  end if;

  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = v_tenant_id
      and lower(trim(tm.user_email)) = v_caller
      and lower(coalesce(tm.membership_status, 'active')) = 'active'
  ) then return; end if;

  return query
  select distinct lower(trim(tura.user_email)) as user_email
  from public.tenant_user_role_assignments tura
  join public.customer_roles cr on cr.id = tura.role_id and cr.tenant_id = tura.tenant_id
  join public.tenant_memberships tm on tm.tenant_id = tura.tenant_id and lower(trim(tm.user_email)) = lower(trim(tura.user_email))
  left join public.tenant_user_profiles tup on tup.tenant_id = tura.tenant_id and lower(trim(tup.user_email)) = lower(trim(tura.user_email))
  where tura.tenant_id = v_tenant_id
    and coalesce(tura.is_active, true)
    and coalesce(cr.is_active, true)
    and lower(coalesce(tm.membership_status, 'active')) = 'active'
    and lower(coalesce(tup.account_status, 'active')) <> 'inactive'
    and (case when v_purpose = 'approver'
      then lower(trim(cr.role_name)) in ('capa user','capa coordinator','capa administrator','capa approver','approver','administrator','vp quality')
      else lower(trim(cr.role_name)) in ('capa user','capa coordinator','capa administrator','administrator','vp quality') end)
  order by 1;
end;
$$;


--
-- Name: qualisphere_claim_dci_administrative_review(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_claim_dci_administrative_review(p_task_id uuid) RETURNS public.approval_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
 v_email text := lower(coalesce(auth.jwt()->>'email',''));
 v_task public.approval_tasks;
 v_tenant uuid;
 v_authorized boolean := false;
begin
 if v_email='' then raise exception 'Authentication required'; end if;
 select d.tenant_id into v_tenant from public.approval_tasks t
 join public.document_change_initiations d on d.id=t.entity_id
 where t.id=p_task_id and t.entity_type='document_change_initiation'
 and t.task_type='dci_administrative_review' and t.status='pending';
 if v_tenant is null then raise exception 'Administrative review task not found'; end if;
 select exists(
 select 1 from public.tenant_memberships m
 where m.tenant_id=v_tenant and lower(m.user_email)=v_email and m.membership_status='active'
 and (
 exists(select 1 from public.tenant_user_role_assignments a join public.customer_roles r on r.id=a.role_id
 where a.tenant_id=v_tenant and lower(a.user_email)=v_email and a.is_active=true and r.is_active=true
 and lower(trim(r.role_name))='document control coordinator')
 or exists(select 1 from public.user_security_roles u join public.security_roles s on s.code=u.role_code
 where lower(u.user_email)=v_email and u.role_code='document_control_coordinator' and s.is_active=true)
 )
 ) into v_authorized;
 if not v_authorized then raise exception 'Document Control Coordinator role required'; end if;
 update public.approval_tasks set assigned_to_email=v_email
 where id=p_task_id and status='pending' and assigned_to_email is null
 returning * into v_task;
 if v_task.id is null then raise exception 'This task has already been claimed'; end if;
 perform public.qualisphere_add_audit_log('document_change_initiation',v_task.entity_id,'administrative_review_claimed','Claimed by '||v_email);
 return v_task;
end; $$;


--
-- Name: qualisphere_claim_dci_post_approval(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_claim_dci_post_approval(p_task_id uuid) RETURNS public.approval_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_email text:=lower(coalesce(auth.jwt()->>'email','')); v_task public.approval_tasks; v_tenant uuid; v_authorized boolean;
BEGIN
 IF v_email='' THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT d.tenant_id INTO v_tenant FROM public.approval_tasks t JOIN public.document_change_initiations d ON d.id=t.entity_id WHERE t.id=p_task_id AND t.entity_type='document_change_initiation' AND t.task_type='dci_post_approval_coordination' AND t.status='pending';
 IF v_tenant IS NULL THEN RAISE EXCEPTION 'Post-approval task not found'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=v_tenant AND lower(m.user_email)=v_email AND m.membership_status='active' AND
 (EXISTS(SELECT 1 FROM public.tenant_user_role_assignments a JOIN public.customer_roles r ON r.id=a.role_id WHERE a.tenant_id=v_tenant AND lower(a.user_email)=v_email AND a.is_active AND r.is_active AND lower(trim(r.role_name))='document control coordinator')
 OR EXISTS(SELECT 1 FROM public.user_security_roles u JOIN public.security_roles s ON s.code=u.role_code WHERE lower(u.user_email)=v_email AND u.role_code='document_control_coordinator' AND s.is_active))) INTO v_authorized;
 IF NOT v_authorized THEN RAISE EXCEPTION 'Document Control Coordinator role required'; END IF;
 UPDATE public.approval_tasks SET assigned_to_email=v_email WHERE id=p_task_id AND status='pending' AND assigned_to_email IS NULL RETURNING * INTO v_task;
 IF v_task.id IS NULL THEN RAISE EXCEPTION 'This task has already been claimed'; END IF;
 PERFORM public.qualisphere_add_audit_log('document_change_initiation',v_task.entity_id,'post_approval_claimed','Claimed by '||v_email);
 RETURN v_task;
END $$;


--
-- Name: qualisphere_clone_company_settings_to_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_clone_company_settings_to_tenant(p_target_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_source_tenant_id constant uuid :=
    '87bdc084-e0c5-488f-a5a1-16dcd45be55c'::uuid;
begin
  if p_target_tenant_id is null then
    raise exception 'Target Company Account ID is required.';
  end if;

  if p_target_tenant_id = v_source_tenant_id then
    return;
  end if;

  if exists (
    select 1
    from public.company_settings cs
    where cs.tenant_id = p_target_tenant_id
  ) then
    return;
  end if;

  insert into public.company_settings (
    tenant_id,
    company_name,
    enable_notifications,
    enable_overdue_scan,
    enable_task_sla_dashboard,
    enable_escalation_dashboard,
    enable_email_notifications,
    overdue_scan_mode,
    notification_default_frequency,
    overdue_bucket_1,
    overdue_bucket_2,
    overdue_bucket_3,
    allow_users_to_override_preferences,
    updated_at
  )
  select
    p_target_tenant_id,
    t.company_name,
    cs.enable_notifications,
    cs.enable_overdue_scan,
    cs.enable_task_sla_dashboard,
    cs.enable_escalation_dashboard,
    cs.enable_email_notifications,
    cs.overdue_scan_mode,
    cs.notification_default_frequency,
    cs.overdue_bucket_1,
    cs.overdue_bucket_2,
    cs.overdue_bucket_3,
    cs.allow_users_to_override_preferences,
    now()
  from public.company_settings cs
  join public.tenants t on t.id = p_target_tenant_id
  where cs.tenant_id = v_source_tenant_id
  order by cs.created_at
  limit 1;
end;
$$;


--
-- Name: qualisphere_clone_master_data_to_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_clone_master_data_to_tenant(p_target_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_source_tenant_id constant uuid :=
    '87bdc084-e0c5-488f-a5a1-16dcd45be55c'::uuid;
begin
  if p_target_tenant_id is null then
    raise exception 'Target Company Account ID is required.';
  end if;

  if p_target_tenant_id = v_source_tenant_id then
    return;
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_target_tenant_id
  ) then
    raise exception 'Company Account % does not exist.', p_target_tenant_id;
  end if;

  insert into public.md_product_part_numbers
    (tenant_id, code, label, part_description, is_active)
  select
    p_target_tenant_id, code, label, part_description, is_active
  from public.md_product_part_numbers
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_dispositions
    (tenant_id, code, label)
  select
    p_target_tenant_id, code, label
  from public.md_dispositions
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_detection_sources
    (tenant_id, code, label)
  select
    p_target_tenant_id, code, label
  from public.md_detection_sources
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_departments
    (tenant_id, code, label)
  select
    p_target_tenant_id, code, label
  from public.md_departments
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_material_statuses
    (tenant_id, code, label)
  select
    p_target_tenant_id, code, label
  from public.md_material_statuses
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_defect_categories
    (tenant_id, code, label)
  select
    p_target_tenant_id, code, label
  from public.md_defect_categories
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_defect_subcategories
    (tenant_id, category_code, code, label)
  select
    p_target_tenant_id, category_code, code, label
  from public.md_defect_subcategories
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_rooms
    (tenant_id, code, label, room_type, is_active)
  select
    p_target_tenant_id, code, label, room_type, is_active
  from public.md_rooms
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_equipment
    (tenant_id, equipment_id, equipment_name, equipment_type, room_code, is_active)
  select
    p_target_tenant_id, equipment_id, equipment_name, equipment_type, room_code, is_active
  from public.md_equipment
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_test_methods
    (tenant_id, code, label, investigation_source, default_unit, is_active)
  select
    p_target_tenant_id, code, label, investigation_source, default_unit, is_active
  from public.md_test_methods
  where tenant_id = v_source_tenant_id
  on conflict do nothing;

  insert into public.md_oos_limits
    (
      tenant_id,
      investigation_source,
      test_method_code,
      room_code,
      equipment_id,
      alert_limit,
      action_limit,
      specification_limit,
      unit_of_measure,
      is_active
    )
  select
    p_target_tenant_id,
    investigation_source,
    test_method_code,
    room_code,
    equipment_id,
    alert_limit,
    action_limit,
    specification_limit,
    unit_of_measure,
    is_active
  from public.md_oos_limits
  where tenant_id = v_source_tenant_id
  on conflict do nothing;
end;
$$;


--
-- Name: qualisphere_clone_starter_roles_to_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_clone_starter_roles_to_tenant(p_target_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_target_tenant_id is null then
    raise exception 'Target Company Account ID is required.';
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_target_tenant_id
  ) then
    raise exception 'Company Account % does not exist.', p_target_tenant_id;
  end if;

  insert into public.customer_roles (
    tenant_id,
    role_name,
    description,
    is_active
  )
  select
    p_target_tenant_id,
    sr.label,
    sr.description,
    coalesce(sr.is_assignable, true)
  from public.security_roles sr
  where coalesce(sr.is_assignable, true) = true
  on conflict (tenant_id, role_name) do nothing;
end;
$$;


--
-- Name: qualisphere_clone_tenant_qms_configuration_version(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_clone_tenant_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  src public.qms_configuration_versions%rowtype;
  v_new_id uuid := gen_random_uuid();
  v_email text := coalesce(auth.jwt() ->> 'email', 'unknown');
  risk_row public.qms_risk_matrix_rules%rowtype;
  capa_row public.qms_capa_governance_rules%rowtype;
begin
  select * into src
  from public.qms_configuration_versions
  where id = p_source_configuration_version_id;

  if src.id is null then raise exception 'Source configuration version was not found.'; end if;
  if not public.qualisphere_is_company_admin(src.tenant_id) then
    raise exception 'Company Administrator authority is required.';
  end if;
  if coalesce(trim(p_new_version_code), '') = '' then raise exception 'New version code is required.'; end if;
  if coalesce(trim(p_change_justification), '') = '' then raise exception 'Change justification is required.'; end if;

  if exists (
    select 1 from public.qms_configuration_versions
    where tenant_id = src.tenant_id
      and module_code = src.module_code
      and configuration_type = src.configuration_type
      and version_code = trim(p_new_version_code)
  ) then
    raise exception 'Version code % already exists for this Company Account.', trim(p_new_version_code);
  end if;

  insert into public.qms_configuration_versions
  select (
    jsonb_populate_record(
      null::public.qms_configuration_versions,
      to_jsonb(src)
      || jsonb_build_object(
        'id', v_new_id,
        'version_code', trim(p_new_version_code),
        'version_name', coalesce(nullif(trim(p_new_version_name), ''), trim(p_new_version_code)),
        'status', 'draft',
        'change_summary', nullif(trim(coalesce(p_change_summary, '')), ''),
        'change_justification', trim(p_change_justification),
        'created_by', v_email,
        'created_at', now(),
        'activated_by', null,
        'activated_at', null
      )
    )
  ).*;

  if src.configuration_type = 'risk_assessment' then
    for risk_row in select * from public.qms_risk_matrix_rules where configuration_version_id = src.id
    loop
      insert into public.qms_risk_matrix_rules
      select (
        jsonb_populate_record(
          null::public.qms_risk_matrix_rules,
          to_jsonb(risk_row)
          || jsonb_build_object(
            'id', gen_random_uuid(),
            'configuration_version_id', v_new_id
          )
        )
      ).*;
    end loop;
  else
    for capa_row in select * from public.qms_capa_governance_rules where configuration_version_id = src.id
    loop
      insert into public.qms_capa_governance_rules
      select (
        jsonb_populate_record(
          null::public.qms_capa_governance_rules,
          to_jsonb(capa_row)
          || jsonb_build_object(
            'id', gen_random_uuid(),
            'configuration_version_id', v_new_id
          )
        )
      ).*;
    end loop;
  end if;

  insert into public.qms_configuration_audit_log (
    tenant_id, module_code, configuration_type, configuration_version_id,
    action, new_value, change_justification, changed_by
  )
  values (
    src.tenant_id, src.module_code, src.configuration_type, v_new_id,
    'configuration_version_created',
    jsonb_build_object(
      'source_version_id', src.id,
      'source_version_code', src.version_code,
      'new_version_code', trim(p_new_version_code)
    ),
    trim(p_change_justification),
    v_email
  );

  return v_new_id;
end;
$$;


--
-- Name: qualisphere_close_dci_post_approval(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_close_dci_post_approval(p_dci_id uuid, p_comment text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_email text:=lower(coalesce(auth.jwt()->>'email','')); v_dci public.document_change_initiations; v_task public.approval_tasks; v_authorized boolean;
BEGIN
 IF v_email='' THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF length(trim(coalesce(p_comment,'')))<3 THEN RAISE EXCEPTION 'Closure verification summary required'; END IF;
 SELECT * INTO v_dci FROM public.document_change_initiations WHERE id=p_dci_id FOR UPDATE;
 IF NOT FOUND OR v_dci.status NOT IN ('formal_review','post_approval') THEN RAISE EXCEPTION 'DCI is not awaiting post-approval closure'; END IF;
 SELECT * INTO v_task FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_post_approval_coordination' AND status='pending' AND lower(assigned_to_email)=v_email FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Claimed coordinator task required'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=v_dci.tenant_id AND lower(m.user_email)=v_email AND m.membership_status='active' AND
 (EXISTS(SELECT 1 FROM public.tenant_user_role_assignments a JOIN public.customer_roles r ON r.id=a.role_id WHERE a.tenant_id=v_dci.tenant_id AND lower(a.user_email)=v_email AND a.is_active AND r.is_active AND lower(trim(r.role_name))='document control coordinator')
 OR EXISTS(SELECT 1 FROM public.user_security_roles u JOIN public.security_roles s ON s.code=u.role_code WHERE lower(u.user_email)=v_email AND u.role_code='document_control_coordinator' AND s.is_active))) INTO v_authorized;
 IF NOT v_authorized THEN RAISE EXCEPTION 'Document Control Coordinator role required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_formal_approval' AND status='approved') OR EXISTS(SELECT 1 FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_formal_approval' AND status IN ('pending','queued','rejected')) THEN RAISE EXCEPTION 'Formal approvals incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_post_approval_action' AND status<>'cancelled' AND (status<>'completed' OR implementation_verification_status IS DISTINCT FROM 'verified')) THEN RAISE EXCEPTION 'Outstanding or unverified post-approval activities'; END IF;
 UPDATE public.approval_tasks SET status='completed',completion_comment=trim(p_comment),completed_by_email=v_email,completed_at=now() WHERE id=v_task.id;
 -- The DCI trigger resolves the active tenant from the authenticated coordinator context.
 UPDATE public.document_change_initiations SET status='release_ready',updated_at=now() WHERE id=p_dci_id;
 PERFORM public.qualisphere_add_audit_log('document_change_initiation',p_dci_id,'post_approval_closed','Post-approval verification completed by '||v_email||': '||trim(p_comment));
END $$;


--
-- Name: qualisphere_complete_dci_formal_approval(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_complete_dci_formal_approval(p_dci_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_dci public.document_change_initiations; v_email text := lower(coalesce(auth.jwt()->>'email',''));
BEGIN
 IF v_email='' THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_dci FROM public.document_change_initiations WHERE id=p_dci_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DCI not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=v_dci.tenant_id AND lower(user_email)=v_email AND membership_status='active') THEN RAISE EXCEPTION 'Tenant membership required'; END IF;
 IF EXISTS(SELECT 1 FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_formal_approval' AND status IN ('pending','queued','rejected')) THEN RAISE EXCEPTION 'Formal approvals are incomplete or rejected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_formal_approval' AND status='approved') THEN RAISE EXCEPTION 'No formal approvals found'; END IF;
 IF v_dci.status NOT IN ('formal_review','post_approval') THEN RAISE EXCEPTION 'DCI is not in formal review'; END IF;
 UPDATE public.document_change_initiations SET status='post_approval',updated_at=now() WHERE id=p_dci_id AND status='formal_review';
 IF NOT EXISTS(SELECT 1 FROM public.approval_tasks WHERE entity_type='document_change_initiation' AND entity_id=p_dci_id AND task_type='dci_post_approval_coordination' AND status IN ('pending','completed')) THEN
  INSERT INTO public.approval_tasks(entity_type,entity_id,task_type,task_title,required_function,assigned_to_email,status,record_number,comments)
  VALUES('document_change_initiation',p_dci_id,'dci_post_approval_coordination','Coordinate post-approval activities for '||v_dci.dci_number,'Document Control Coordinator',NULL,'pending',v_dci.dci_number,'Claim this task to coordinate required post-approval activities.');
 END IF;
 PERFORM public.qualisphere_add_audit_log('document_change_initiation',p_dci_id,'post_approval_handoff','All formal approvals complete; sent to Document Control');
END $$;


--
-- Name: qualisphere_create_tenant(text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_create_tenant(p_company_name text, p_legal_name text, p_tenant_code text, p_slug text, p_primary_contact_email text, p_company_admin_email text, p_country_code text DEFAULT 'US'::text, p_default_timezone text DEFAULT 'America/Chicago'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
    v_tenant_id uuid;
    v_platform_email text;
begin

    if not public.is_platform_admin() then
        raise exception 'Platform Administrator access required.';
    end if;

    v_platform_email := public.current_user_email();

    if nullif(trim(p_company_name), '') is null then
        raise exception 'Company name is required.';
    end if;

    if nullif(trim(p_tenant_code), '') is null then
        raise exception 'Tenant code is required.';
    end if;

    if nullif(trim(p_slug), '') is null then
        raise exception 'Tenant slug is required.';
    end if;

    if nullif(trim(p_company_admin_email), '') is null then
        raise exception 'Initial Company Administrator email is required.';
    end if;


    insert into public.tenants (
        tenant_code,
        company_name,
        legal_name,
        slug,
        status,
        is_internal,
        primary_contact_email,
        country_code,
        default_timezone,
        created_by
    )
    values (
        upper(trim(p_tenant_code)),
        trim(p_company_name),
        nullif(trim(p_legal_name), ''),
        lower(trim(p_slug)),
        'active',
        false,
        lower(nullif(trim(p_primary_contact_email), '')),
        upper(coalesce(nullif(trim(p_country_code), ''), 'US')),
        coalesce(
            nullif(trim(p_default_timezone), ''),
            'America/Chicago'
        ),
        v_platform_email
    )
    returning id into v_tenant_id;


    insert into public.tenant_memberships (
        tenant_id,
        user_email,
        membership_role,
        membership_status,
        invited_by,
        invited_at,
        joined_at
    )
    values (
        v_tenant_id,
        lower(trim(p_company_admin_email)),
        'company_admin',
        'active',
        v_platform_email,
        now(),
        now()
    );


    insert into public.tenant_module_access (
        tenant_id,
        module_code,
        is_enabled,
        enabled_by
    )
    values
        (v_tenant_id, 'ncmr', true, v_platform_email),
        (v_tenant_id, 'capa', true, v_platform_email),
        (v_tenant_id, 'scar', true, v_platform_email),
        (v_tenant_id, 'change_control', true, v_platform_email),
        (v_tenant_id, 'controlled_documents', true, v_platform_email),
        (v_tenant_id, 'training', true, v_platform_email),
        (v_tenant_id, 'equipment', true, v_platform_email),
        (v_tenant_id, 'audit', true, v_platform_email),
        (v_tenant_id, 'management_review', true, v_platform_email),
        (v_tenant_id, 'complaints', true, v_platform_email),
        (v_tenant_id, 'oos_oot', true, v_platform_email),
        (v_tenant_id, 'executive_dashboard', true, v_platform_email);

    return v_tenant_id;
end;
$$;


--
-- Name: qualisphere_current_audit_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_current_audit_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid;
  v_count integer;
begin
  if v_email = '' then return null; end if;

  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid
    into v_count, v_tenant
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id and t.status='active'
  where lower(trim(tm.user_email))=v_email
    and tm.membership_status='active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'audit_management');

  if v_count=1 then return v_tenant; end if;

  if v_count=0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email))=v_email
      and lower(coalesce(ur.account_status,'active')) <> 'inactive'
  ) then
    select t.id into v_tenant
    from public.tenants t
    where t.is_internal=true and t.status='active'
      and public.qualisphere_tenant_module_enabled(t.id,'audit_management')
    limit 1;
    return v_tenant;
  end if;

  return null;
end;
$$;


--
-- Name: qualisphere_current_capa_role_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_current_capa_role_codes() RETURNS TABLE(role_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_tenant_id uuid;
  v_email text := lower(trim(coalesce(public.current_user_email(), '')));
  v_is_internal boolean := false;
begin
  v_tenant_id := public.qualisphere_current_capa_tenant();
  if v_tenant_id is null or v_email = '' then return; end if;

  select coalesce(t.is_internal, false) into v_is_internal
  from public.tenants t where t.id = v_tenant_id;

  if v_is_internal then
    return query
    select distinct x.role_code
    from (
      select lower(trim(usr.role_code)) as role_code
      from public.user_security_roles usr
      where lower(trim(usr.user_email)) = v_email
      union all
      select case lower(trim(ur.role))
        when 'admin' then 'administrator'
        when 'administrator' then 'administrator'
        when 'coordinator' then 'capa_coordinator'
        when 'approver' then 'approver'
        when 'vp_quality' then 'vp_quality'
        else lower(trim(ur.role))
      end
      from public.user_roles ur
      where lower(trim(ur.user_email)) = v_email
        and lower(coalesce(ur.account_status, 'active')) <> 'inactive'
    ) x
    where coalesce(x.role_code, '') <> '';
    return;
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    left join public.tenant_user_profiles tup
      on tup.tenant_id = tm.tenant_id
     and lower(trim(tup.user_email)) = lower(trim(tm.user_email))
    where tm.tenant_id = v_tenant_id
      and lower(trim(tm.user_email)) = v_email
      and lower(coalesce(tm.membership_status, 'active')) = 'active'
      and lower(coalesce(tup.account_status, 'active')) <> 'inactive'
  ) then return; end if;

  return query
  select distinct mapped.role_code
  from public.tenant_user_role_assignments tura
  join public.customer_roles cr on cr.id = tura.role_id and cr.tenant_id = tura.tenant_id
  cross join lateral (
    select unnest(case lower(trim(cr.role_name))
      when 'administrator' then array['administrator','capa_administrator','capa_coordinator','capa_user']::text[]
      when 'capa administrator' then array['capa_administrator','capa_coordinator','capa_user']::text[]
      when 'capa coordinator' then array['capa_coordinator','capa_user']::text[]
      when 'capa user' then array['capa_user']::text[]
      when 'capa approver' then array['capa_approver','approver']::text[]
      when 'approver' then array['approver']::text[]
      when 'vp quality' then array['vp_quality','capa_approver','approver']::text[]
      else array[]::text[] end) as role_code
  ) mapped
  where tura.tenant_id = v_tenant_id
    and lower(trim(tura.user_email)) = v_email
    and coalesce(tura.is_active, true)
    and coalesce(cr.is_active, true);
end;
$$;


--
-- Name: qualisphere_current_capa_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_current_capa_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid;
  v_count integer;
begin
  if v_email = '' then return null; end if;

  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid
    into v_count, v_tenant
  from public.tenant_memberships tm
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'capa');

  if v_count = 1 then return v_tenant; end if;

  -- Preserve original Internal / Development users without reconstructing them.
  if v_count = 0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email)) = v_email
      and lower(coalesce(ur.account_status,'active')) <> 'inactive'
  ) then
    select t.id into v_tenant
    from public.tenants t
    where t.is_internal = true and t.status = 'active'
      and public.qualisphere_tenant_module_enabled(t.id,'capa')
    limit 1;
    return v_tenant;
  end if;

  return null;
end;
$$;


--
-- Name: qualisphere_current_controlled_documents_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_current_controlled_documents_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tenant_id uuid;
  v_count integer;
  v_email text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select count(distinct tm.tenant_id)
    into v_count
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  join public.tenant_module_access ma on ma.tenant_id = tm.tenant_id
  where lower(tm.user_email) = v_email
    and lower(coalesce(tm.membership_status,'active')) = 'active'
    and lower(coalesce(t.status,'active')) = 'active'
    and lower(ma.module_code) = 'controlled_documents'
    and ma.is_enabled = true;

  if v_count = 1 then
    select tm.tenant_id
      into v_tenant_id
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    join public.tenant_module_access ma on ma.tenant_id = tm.tenant_id
    where lower(tm.user_email) = v_email
      and lower(coalesce(tm.membership_status,'active')) = 'active'
      and lower(coalesce(t.status,'active')) = 'active'
      and lower(ma.module_code) = 'controlled_documents'
      and ma.is_enabled = true
    group by tm.tenant_id
    limit 1;

    return v_tenant_id;
  end if;

  -- Preserve legacy Internal development/validation access without reconstructing
  -- Internal membership. Internal remains sourced from legacy user_roles.
  if exists (
    select 1
    from public.user_roles ur
    where lower(ur.user_email) = v_email
      and lower(coalesce(ur.account_status,'active')) = 'active'
  ) then
    select t.id
      into v_tenant_id
    from public.tenants t
    join public.tenant_module_access ma on ma.tenant_id = t.id
    where t.is_internal = true
      and lower(coalesce(t.status,'active')) = 'active'
      and lower(ma.module_code) = 'controlled_documents'
      and ma.is_enabled = true
    limit 1;

    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  raise exception 'Unable to resolve a unique active Controlled Documents Company Account.';
end;
$$;


--
-- Name: qualisphere_current_management_review_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_current_management_review_tenant() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select tm.tenant_id
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id
  where lower(tm.user_email)=lower(coalesce(auth.jwt()->>'email',''))
    and tm.membership_status='active' and t.status='active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'management_review')
  order by t.is_internal desc, tm.created_at
  limit 1
$$;


--
-- Name: qualisphere_current_user_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_current_user_email() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;


--
-- Name: qualisphere_dci_collaboration_owner_handoff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_dci_collaboration_owner_handoff() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_thread public.collaboration_threads%rowtype;
  v_owner_email text;
  v_dci_number text;
begin
  if new.status is distinct from 'completed' or old.status is not distinct from 'completed' then
    return new;
  end if;

  select * into v_thread
  from public.collaboration_threads
  where id = new.thread_id;

  if not found or v_thread.module <> 'document_change_initiation' or v_thread.status <> 'open' then
    return new;
  end if;

  if exists (
    select 1 from public.collaboration_participants
    where thread_id = new.thread_id and status = 'active'
  ) then
    return new;
  end if;

  select lower(trim(owner_email)), dci_number
  into v_owner_email, v_dci_number
  from public.document_change_initiations
  where id = v_thread.record_id;

  if coalesce(v_owner_email, '') = '' then
    return new;
  end if;

  if not exists (
    select 1 from public.approval_tasks
    where entity_type = 'document_change_initiation'
      and entity_id = v_thread.record_id
      and task_type = 'collaboration_resolution'
      and lower(trim(assigned_to_email)) = v_owner_email
      and status = 'pending'
  ) then
    insert into public.approval_tasks (
      entity_type, entity_id, task_type, task_title, required_function,
      assigned_to_email, assigned_by_email, status, comments, record_number
    ) values (
      'document_change_initiation',
      v_thread.record_id,
      'collaboration_resolution',
      'Resolve Collaboration for ' || coalesce(v_dci_number, v_thread.record_number),
      'DCI Owner',
      v_owner_email,
      new.user_email,
      'pending',
      'All collaborator reviews are complete. Review the collaboration feedback, enter the resolution summary, and close or reopen the collaboration round.',
      coalesce(v_dci_number, v_thread.record_number)
    );
  end if;

  return new;
end;
$$;


--
-- Name: qualisphere_decide_management_review_approval(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_decide_management_review_approval(p_task_id uuid, p_decision text, p_comment text DEFAULT NULL::text, p_signature_email text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text;
  v_task public.approval_tasks%rowtype;
  v_approver public.management_review_approvers%rowtype;
  v_now timestamptz := now();
  v_all_approved boolean := false;
  v_decision text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_decision := lower(trim(coalesce(p_decision, '')));

  if v_email = '' then
    raise exception 'An authenticated user is required.';
  end if;

  if lower(trim(coalesce(p_signature_email, ''))) <> v_email then
    raise exception 'Electronic signature email does not match the authenticated user.';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if v_decision = 'rejected'
     and trim(coalesce(p_comment, '')) = '' then
    raise exception 'A rejection comment is required.';
  end if;

  select *
    into v_task
  from public.approval_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Approval task was not found.';
  end if;

  if lower(coalesce(v_task.entity_type, '')) <> 'management_review'
     or lower(coalesce(v_task.task_type, '')) <> 'management_review_approval' then
    raise exception 'This is not a Management Review approval task.';
  end if;

  if lower(coalesce(v_task.assigned_to_email, '')) <> v_email then
    raise exception 'Only the assigned approver may complete this task.';
  end if;

  if lower(coalesce(v_task.status, '')) <> 'pending' then
    raise exception 'This approval task is no longer pending.';
  end if;

  select *
    into v_approver
  from public.management_review_approvers
  where management_review_id = v_task.entity_id
    and lower(coalesce(approver_email, '')) = v_email
    and lower(coalesce(approval_status, 'pending')) = 'pending'
  limit 1
  for update;

  if not found then
    raise exception 'No pending configured Management Review approver record matches this authenticated user.';
  end if;

  if v_decision = 'approved' then

    update public.management_review_approvers
    set
      approval_status = 'approved',
      signed_by = v_email,
      signed_at = v_now,
      signature_meaning = coalesce(
        nullif(v_approver.signature_meaning, ''),
        'I approve this Management Review report.'
      )
    where id = v_approver.id;

    update public.approval_tasks
    set
      status = 'approved',
      approver_comment = nullif(trim(coalesce(p_comment, '')), ''),
      signature_meaning = coalesce(
        nullif(v_approver.signature_meaning, ''),
        'I approve this Management Review report.'
      ),
      completed_by = v_email,
      completed_at = v_now,
      signed_by = v_email,
      signed_at = v_now
    where id = v_task.id;

    select not exists (
      select 1
      from public.management_review_approvers mra
      where mra.management_review_id = v_task.entity_id
        and lower(coalesce(mra.approval_status, 'pending')) <> 'approved'
    )
    into v_all_approved;

    if v_all_approved then
      update public.management_reviews
      set
        approval_status = 'approved',
        status = 'approved',
        is_locked = true,
        locked_at = v_now,
        locked_by = v_email,
        fully_approved_at = v_now
      where id = v_task.entity_id;

      perform public.qualisphere_add_audit_log(
        'management_review',
        v_task.entity_id,
        'management_review_fully_approved_locked',
        'All required approvers approved the submitted read-only Management Review report snapshot. Record locked.'
      );
    else
      update public.management_reviews
      set
        approval_status = 'pending_approval',
        status = 'pending_approval'
      where id = v_task.entity_id;
    end if;

    perform public.qualisphere_add_audit_log(
      'management_review',
      v_task.entity_id,
      'management_review_report_approved',
      format(
        'Management Review report approval task %s approved by %s.',
        v_task.id,
        v_email
      )
    );

    return jsonb_build_object(
      'decision', 'approved',
      'all_approved', v_all_approved,
      'management_review_id', v_task.entity_id,
      'task_id', v_task.id
    );
  end if;

  update public.management_review_approvers
  set
    approval_status = 'rejected',
    signed_by = v_email,
    signed_at = v_now,
    signature_meaning =
      'I reject this Management Review report and require revision.'
  where id = v_approver.id;

  update public.approval_tasks
  set
    status = 'rejected',
    approver_comment = trim(p_comment),
    signature_meaning =
      'I reject this Management Review report and require revision.',
    completed_by = v_email,
    completed_at = v_now,
    signed_by = v_email,
    signed_at = v_now
  where id = v_task.id;

  update public.approval_tasks
  set status = 'cancelled'
  where entity_type = 'management_review'
    and entity_id = v_task.entity_id
    and task_type = 'management_review_approval'
    and status = 'pending'
    and id <> v_task.id;

  update public.management_reviews
  set
    approval_status = 'rejected',
    status = 'rejected'
  where id = v_task.entity_id;

  perform public.qualisphere_add_audit_log(
    'management_review',
    v_task.entity_id,
    'management_review_report_rejected',
    format(
      'Management Review report rejected by %s. Reason: %s',
      v_email,
      trim(p_comment)
    )
  );

  return jsonb_build_object(
    'decision', 'rejected',
    'all_approved', false,
    'management_review_id', v_task.entity_id,
    'task_id', v_task.id
  );
end;
$$;


--
-- Name: qualisphere_email_belongs_to_tenant(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_email_belongs_to_tenant(p_email text, p_tenant_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_internal boolean := false;
begin
  if nullif(lower(trim(coalesce(p_email,''))),'') is null or p_tenant_id is null then return false; end if;
  select coalesce(t.is_internal,false) into v_internal from public.tenants t where t.id=p_tenant_id;
  if v_internal then
    return exists (
      select 1 from public.user_roles ur
      where lower(trim(ur.user_email))=lower(trim(p_email))
        and lower(coalesce(ur.account_status,'active'))='active'
    );
  end if;
  return exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=p_tenant_id
      and lower(trim(tm.user_email))=lower(trim(p_email))
      and lower(coalesce(tm.membership_status,'active'))='active'
  );
end $$;


--
-- Name: qualisphere_enforce_audit_log_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_audit_log_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'pg_temp'
    AS $$
declare
    v_user_email text;
begin
    -- Normal signed-in application path.
    if auth.uid() is not null then
        select lower(trim(u.email))
          into v_user_email
          from auth.users u
         where u.id = auth.uid();

        if v_user_email is null or v_user_email = '' then
            raise exception 'Authenticated user email could not be determined for audit logging.';
        end if;

        -- Never trust a client-supplied audit identity or timestamp.
        new.user_email := v_user_email;
        new.created_at := now();
    else
        -- Preserve trusted backend / service-role compatibility.
        -- If created_at is omitted, still stamp it server-side.
        if new.created_at is null then
            new.created_at := now();
        end if;
    end if;

    return new;
end;
$$;


--
-- Name: qualisphere_enforce_audit_row_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_audit_row_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Audit Company Account cannot be changed.';
  end if;
  if auth.uid() is not null and not (
    public.qualisphere_is_active_tenant_member(new.tenant_id)
    and public.qualisphere_tenant_module_enabled(new.tenant_id,'audit_management')
  ) then
    raise exception 'Audit Company Account access denied.';
  end if;
  return new;
end;
$$;


--
-- Name: qualisphere_enforce_capa_row_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_capa_row_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'CAPA Company Account cannot be changed.';
  end if;
  if auth.uid() is not null and not (
    public.qualisphere_is_active_tenant_member(new.tenant_id)
    and public.qualisphere_tenant_module_enabled(new.tenant_id,'capa')
  ) then
    raise exception 'CAPA Company Account access denied.';
  end if;
  return new;
end;$$;


--
-- Name: qualisphere_enforce_controlled_document_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_controlled_document_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
 if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'Controlled Document Company Account cannot be reassigned.'; end if;
 if not public.qualisphere_is_active_tenant_member(new.tenant_id) or not public.qualisphere_tenant_module_enabled(new.tenant_id,'controlled_documents') then raise exception 'Current user does not have active Controlled Documents access for this Company Account.'; end if;
 return new;
end $$;


--
-- Name: qualisphere_enforce_management_review_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_management_review_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Management Review tenant cannot be changed.';
  end if;
  if new.tenant_id is null then new.tenant_id:=public.qualisphere_current_management_review_tenant(); end if;
  if new.tenant_id is null
     or not public.qualisphere_is_active_tenant_member(new.tenant_id)
     or not public.qualisphere_tenant_module_enabled(new.tenant_id,'management_review') then
    raise exception 'Management Review tenant access denied.';
  end if;
  return new;
end $$;


--
-- Name: qualisphere_enforce_ncmr_approval_task_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_ncmr_approval_task_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare v_type text; v_id uuid;
begin
  if tg_op = 'DELETE' then v_type := lower(old.entity_type); v_id := old.entity_id;
  else v_type := lower(new.entity_type); v_id := new.entity_id; end if;
  if v_type = 'ncmr' and not public.qualisphere_can_access_ncmr(v_id) then
    raise exception 'NCMR task access denied for this Company Account.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: qualisphere_enforce_ncmr_child_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_ncmr_child_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_ncmr_id uuid;
begin
  if tg_op = 'DELETE' then
    v_ncmr_id := old.ncmr_id::text::uuid;
  else
    v_ncmr_id := new.ncmr_id::text::uuid;
  end if;
  if not public.qualisphere_can_access_ncmr(v_ncmr_id) then
    raise exception 'NCMR child-record access denied for this Company Account.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: qualisphere_enforce_ncmr_row_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_ncmr_row_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  if not public.qualisphere_can_access_ncmr(old.id) then
    raise exception 'NCMR access denied for this Company Account.';
  end if;
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'NCMR Company Account ownership cannot be changed.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: qualisphere_enforce_ncmr_snapshot_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_ncmr_snapshot_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare v_module text; v_id uuid;
begin
  if tg_op = 'DELETE' then v_module := upper(old.module_code); v_id := old.record_id;
  else v_module := upper(new.module_code); v_id := new.record_id; end if;
  if v_module = 'NCMR' and not public.qualisphere_can_access_ncmr(v_id) then
    raise exception 'NCMR decision-snapshot access denied for this Company Account.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: qualisphere_enforce_oos_oot_row_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_oos_oot_row_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'OOS/OOT investigation Company Account cannot be reassigned.';
  end if;

  if not public.qualisphere_is_active_tenant_member(new.tenant_id)
     or not public.qualisphere_tenant_module_enabled(new.tenant_id, 'oos_oot') then
    raise exception 'Active Company Account membership with OOS/OOT access is required.';
  end if;

  return new;
end;
$$;


--
-- Name: qualisphere_enforce_signature_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_signature_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_email = '' then
    raise exception 'Electronic signature requires an authenticated user.';
  end if;

  if tg_table_name = 'electronic_signatures' then

    if lower(coalesce(new.signed_by, '')) <> v_email then
      raise exception
        'Electronic signature identity does not match the authenticated user.';
    end if;

    -- Prevent client-supplied/backdated timestamps.
    new.signed_at := now();
    new.created_at := now();

  elsif tg_table_name = 'printable_management_review_signatures' then

    if lower(coalesce(new.signer_email, '')) <> v_email then
      raise exception
        'Management Review signature identity does not match the authenticated user.';
    end if;

    if new.signature_email_entered is not null
       and lower(new.signature_email_entered) <> v_email then
      raise exception
        'Entered signature email does not match the authenticated user.';
    end if;

    -- Prevent client-supplied/backdated timestamps.
    new.signed_at := now();
    new.created_at := now();

  end if;

  return new;
end;
$$;


--
-- Name: qualisphere_enforce_training_completion_evidence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_enforce_training_completion_evidence() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'storage'
    AS $$
DECLARE v_required boolean;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
  v_required:=NEW.training_category='certification' OR coalesce(NEW.recurring_evidence_mode,CASE WHEN NEW.training_category='recurring' THEN 'attachment' ELSE 'signature' END) IN ('attachment','both') OR coalesce(NEW.approved_evaluation_attachment_required,false);
  IF NEW.training_completed_on IS NULL THEN RAISE EXCEPTION 'Training completion date is required'; END IF;
  IF v_required THEN
   IF nullif(NEW.training_evidence_storage_path,'') IS NULL OR nullif(NEW.training_evidence_file_name,'') IS NULL THEN RAISE EXCEPTION 'Signed training evidence is required for this training type'; END IF;
   IF split_part(NEW.training_evidence_storage_path,'/',1)<>NEW.tenant_id::text OR split_part(NEW.training_evidence_storage_path,'/',2)<>NEW.id::text THEN RAISE EXCEPTION 'Training evidence must belong to this tenant and assignment'; END IF;
   IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='training-completion-evidence' AND o.name=NEW.training_evidence_storage_path) THEN RAISE EXCEPTION 'Training evidence file has not been uploaded'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;


--
-- Name: qualisphere_generate_recurring_training_cycles(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_generate_recurring_training_cycles(p_as_of date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  r record;
  v_due date;
  v_base date;
  v_count integer := 0;
  v_tenant uuid;
begin
  v_tenant := public.qualisphere_resolve_training_tenant();
  if auth.uid() is null or v_tenant is null
     or not public.qualisphere_training_is_coordinator(v_tenant) then
    raise exception 'Training coordinator permission required';
  end if;
  if p_as_of > current_date then
    raise exception 'Future cycle generation is not permitted';
  end if;
  for r in
    select a.* from public.training_assignments a
    where a.tenant_id=v_tenant
      and a.training_category='recurring'
      and a.status='completed'
      and a.recurrence_months between 1 and 120
      and not exists(select 1 from public.training_assignments child
                     where child.recurring_parent_assignment_id=a.id)
    order by a.created_at,a.id
    for update of a skip locked
  loop
    if r.recurrence_basis='calendar' then
      v_base := coalesce(r.due_date::date,r.training_completed_on,r.completed_at::date);
    else
      v_base := coalesce(r.training_completed_on,r.completed_at::date);
    end if;
    if v_base is null then continue; end if;
    v_due := (v_base + make_interval(months => r.recurrence_months))::date;
    -- Calendar schedule does not drift when a cycle is completed late.
    -- Never generate an additional cycle ahead of its scheduled due date.
    if v_due > p_as_of then continue; end if;
    insert into public.training_assignments(
      tenant_id,document_id,assigned_to_email,assigned_by_email,assignment_source,
      role_name,department,training_title,training_description,due_date,status,
      effectiveness_required,effectiveness_status,supervisor_verification_required,
      acknowledgement_required,originating_change_control_id,retraining_assignment,
      source_document_revision,previous_training_assignment_id,training_requirement_id,
      training_group_id,training_method_id,release_blocking,training_category,
      recurrence_months,recurrence_basis,recurring_evidence_mode,
      recurring_next_due_date,recurring_parent_assignment_id)
    values(
      r.tenant_id,r.document_id,r.assigned_to_email,auth.jwt()->>'email','recurring',
      r.role_name,r.department,r.training_title,r.training_description,v_due,'assigned',
      r.effectiveness_required,case when r.effectiveness_required then 'effectiveness_pending' else null end,
      r.supervisor_verification_required,r.acknowledgement_required,
      r.originating_change_control_id,true,r.source_document_revision,r.id,
      r.training_requirement_id,r.training_group_id,r.training_method_id,
      r.release_blocking,'recurring',r.recurrence_months,r.recurrence_basis,
      r.recurring_evidence_mode,null,r.id)
    on conflict (recurring_parent_assignment_id) where recurring_parent_assignment_id is not null
      do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;


--
-- Name: qualisphere_guard_employee_training_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_guard_employee_training_history() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE old_email text:=lower(btrim(OLD.user_email));
BEGIN
 IF TG_OP='UPDATE' AND lower(btrim(NEW.user_email)) IS NOT DISTINCT FROM old_email THEN RETURN NEW; END IF;
 -- A short table lock prevents a training/group record being inserted between the
 -- usage check and deletion/email correction. Assignment history is never deleted.
 LOCK TABLE public.training_assignments,public.training_certifications,public.document_training_assignments,public.training_group_members IN SHARE MODE;
 IF EXISTS(SELECT 1 FROM public.training_assignments WHERE tenant_id=OLD.tenant_id AND lower(btrim(assigned_to_email))=old_email)
 OR EXISTS(SELECT 1 FROM public.training_certifications WHERE tenant_id=OLD.tenant_id AND lower(btrim(employee_email))=old_email)
 OR EXISTS(SELECT 1 FROM public.training_group_members WHERE tenant_id=OLD.tenant_id AND lower(btrim(user_email))=old_email)
 OR EXISTS(SELECT 1 FROM public.document_training_assignments a JOIN public.controlled_documents d ON d.id=a.document_id WHERE d.tenant_id=OLD.tenant_id AND lower(btrim(a.user_email))=old_email)
 THEN RAISE EXCEPTION 'This employee has linked training or group records. Keep the email unchanged and deactivate the profile instead of deleting it.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;


--
-- Name: qualisphere_guard_training_assignment_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_guard_training_assignment_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_is_assignee boolean;
  v_is_coordinator boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_assignee := public.qualisphere_training_is_assignee(OLD.assigned_to_email);
  v_is_coordinator := public.qualisphere_training_is_coordinator(OLD.tenant_id);

  -- Completion and acknowledgment are personal acts, even when the actor
  -- also holds a coordinator or manager role.
  IF NOT v_is_assignee AND (
       (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed')
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.completed_by IS DISTINCT FROM OLD.completed_by
       OR NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at
       OR NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by
       OR NEW.signature_id IS DISTINCT FROM OLD.signature_id
  ) THEN
    RAISE EXCEPTION 'Only the assigned employee may complete or acknowledge training';
  END IF;

  IF v_is_coordinator THEN
    RETURN NEW;
  END IF;

  IF NOT v_is_assignee THEN
    RAISE EXCEPTION 'Only the assigned employee or an authorized training coordinator may update training';
  END IF;

  IF (to_jsonb(NEW) - ARRAY[
    'status','completed_at','completed_by','acknowledged_at','acknowledged_by',
    'signature_id','training_comments','training_evidence_storage_path',
    'training_evidence_file_name','training_valid_until','retraining_due_date',
    'training_completed_on'
  ]::text[]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
    'status','completed_at','completed_by','acknowledged_at','acknowledged_by',
    'signature_id','training_comments','training_evidence_storage_path',
    'training_evidence_file_name','training_valid_until','retraining_due_date',
    'training_completed_on'
  ]::text[]) THEN
    RAISE EXCEPTION 'Training assignment requirements and ownership are coordinator-controlled';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('completed','in_progress') THEN
    RAISE EXCEPTION 'Employee may only start or complete assigned training';
  END IF;

  IF NEW.completed_by IS DISTINCT FROM OLD.completed_by
     AND lower(coalesce(NEW.completed_by,'')) <> lower(coalesce(auth.jwt()->>'email','')) THEN
    RAISE EXCEPTION 'Training completion must identify the assigned employee';
  END IF;

  IF NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by
     AND lower(coalesce(NEW.acknowledged_by,'')) <> lower(coalesce(auth.jwt()->>'email','')) THEN
    RAISE EXCEPTION 'Training acknowledgement must identify the assigned employee';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: qualisphere_guard_training_method_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_guard_training_method_history() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.release_blocking,NEW.acknowledgement_required,NEW.evidence_required) IS NOT DISTINCT FROM (OLD.release_blocking,OLD.acknowledgement_required,OLD.evidence_required) THEN RETURN NEW; END IF;
 LOCK TABLE public.training_assignments,public.document_training_requirements IN SHARE MODE;
 IF EXISTS(SELECT 1 FROM public.training_assignments WHERE training_method_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.document_training_requirements WHERE training_method_id=OLD.id)
 THEN RAISE EXCEPTION 'This method is linked to training records. Deactivate it instead of deleting it; save requirement changes through Manage Training Methods to preserve the original settings.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;


--
-- Name: qualisphere_import_employees(uuid, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_import_employees(p_tenant_id uuid, p_employees jsonb, p_overwrite boolean DEFAULT false) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
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
      SELECT email AS origin,email,manager,ARRAY[email] AS seen,false AS cycle FROM qs_import_rows
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
END $_$;


--
-- Name: qualisphere_invalidate_dci_pdf_verification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_invalidate_dci_pdf_verification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
 IF OLD.release_pdf_file_path IS DISTINCT FROM NEW.release_pdf_file_path OR OLD.release_pdf_file_url IS DISTINCT FROM NEW.release_pdf_file_url THEN
  DELETE FROM public.dci_pdf_verifications WHERE document_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: qualisphere_is_active_tenant_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_is_active_tenant_member(p_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and lower(trim(tm.user_email)) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and tm.membership_status = 'active'
  );
$$;


--
-- Name: qualisphere_is_company_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_is_company_admin(p_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and lower(trim(tm.user_email)) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and tm.membership_role = 'company_admin'
      and tm.membership_status = 'active'
  );
$$;


--
-- Name: qualisphere_is_customer_contact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_is_customer_contact(p_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.tenant_customer_contacts contact
    where contact.tenant_id = p_tenant_id
      and lower(contact.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and contact.status = 'active'
  );
$$;


--
-- Name: qualisphere_provision_company_settings_on_tenant_create(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_provision_company_settings_on_tenant_create() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if coalesce(new.is_internal, false) = false then
    perform public.qualisphere_clone_company_settings_to_tenant(new.id);
  end if;

  return new;
end;
$$;


--
-- Name: qualisphere_provision_master_data_on_tenant_create(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_provision_master_data_on_tenant_create() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if coalesce(new.is_internal, false) = false then
    perform public.qualisphere_clone_master_data_to_tenant(new.id);
  end if;

  return new;
end;
$$;


--
-- Name: qualisphere_provision_ncmr_governance_baseline(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_provision_ncmr_governance_baseline(p_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_internal_tenant constant uuid := '87bdc084-e0c5-488f-a5a1-16dcd45be55c'::uuid;
  src public.qms_configuration_versions%rowtype;
  new_version_id uuid;
  risk_row public.qms_risk_matrix_rules%rowtype;
  capa_row public.qms_capa_governance_rules%rowtype;
begin
  if p_tenant_id is null or p_tenant_id = v_internal_tenant then
    return;
  end if;

  for src in
    select distinct on (configuration_type) *
    from public.qms_configuration_versions
    where tenant_id = v_internal_tenant
      and upper(module_code) = 'NCMR'
      and configuration_type in ('risk_assessment', 'capa_governance')
      and status = 'active'
    order by configuration_type, created_at desc
  loop
    if exists (
      select 1
      from public.qms_configuration_versions
      where tenant_id = p_tenant_id
        and upper(module_code) = 'NCMR'
        and configuration_type = src.configuration_type
        and status = 'active'
    ) then
      continue;
    end if;

    new_version_id := gen_random_uuid();

    insert into public.qms_configuration_versions
    select (
      jsonb_populate_record(
        null::public.qms_configuration_versions,
        to_jsonb(src)
        || jsonb_build_object(
          'id', new_version_id,
          'tenant_id', p_tenant_id,
          'status', 'draft',
          'created_by', 'qualisphere_baseline',
          'created_at', now(),
          'activated_by', null,
          'activated_at', null
        )
      )
    ).*;

    if src.configuration_type = 'risk_assessment' then
      for risk_row in
        select *
        from public.qms_risk_matrix_rules
        where configuration_version_id = src.id
      loop
        insert into public.qms_risk_matrix_rules
        select (
          jsonb_populate_record(
            null::public.qms_risk_matrix_rules,
            to_jsonb(risk_row)
            || jsonb_build_object(
              'id', gen_random_uuid(),
              'tenant_id', p_tenant_id,
              'configuration_version_id', new_version_id
            )
          )
        ).*;
      end loop;
    else
      for capa_row in
        select *
        from public.qms_capa_governance_rules
        where configuration_version_id = src.id
      loop
        insert into public.qms_capa_governance_rules
        select (
          jsonb_populate_record(
            null::public.qms_capa_governance_rules,
            to_jsonb(capa_row)
            || jsonb_build_object(
              'id', gen_random_uuid(),
              'tenant_id', p_tenant_id,
              'configuration_version_id', new_version_id
            )
          )
        ).*;
      end loop;
    end if;

    update public.qms_configuration_versions
    set status = 'active',
        activated_by = 'qualisphere_baseline',
        activated_at = now()
    where id = new_version_id
      and tenant_id = p_tenant_id;

    insert into public.qms_configuration_audit_log (
      tenant_id, module_code, configuration_type, configuration_version_id,
      action, new_value, change_justification, changed_by
    )
    values (
      p_tenant_id,
      'NCMR',
      src.configuration_type,
      new_version_id,
      'baseline_provisioned',
      jsonb_build_object('source_version_code', src.version_code),
      'Initial QualiSphere controlled NCMR governance baseline.',
      'qualisphere_baseline'
    );
  end loop;
end;
$$;


--
-- Name: qualisphere_provision_ncmr_governance_on_tenant_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_provision_ncmr_governance_on_tenant_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.qualisphere_provision_ncmr_governance_baseline(new.id);
  return new;
end;
$$;


--
-- Name: qualisphere_provision_starter_roles_on_tenant_create(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_provision_starter_roles_on_tenant_create() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if coalesce(new.is_internal, false) = false then
    perform public.qualisphere_clone_starter_roles_to_tenant(new.id);
  end if;

  return new;
end;
$$;


--
-- Name: qualisphere_release_dci_coordinated(uuid, date, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_release_dci_coordinated(p_dci_id uuid, p_effective_date date, p_manifest jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_dci record; v_doc record; v_item jsonb; v_count integer; v_email text;
begin
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 if auth.uid() is null or v_email='' then raise exception 'Authentication required'; end if;
 if p_effective_date is null or p_effective_date<current_date then raise exception 'Choose a current or future effective date'; end if;
 select * into v_dci from public.document_change_initiations where id=p_dci_id for update;
 if not found or v_dci.status<>'release_ready' or v_dci.release_strategy<>'coordinated' then raise exception 'DCI not eligible for coordinated release'; end if;
 if not public.qualisphere_is_active_tenant_member(v_dci.tenant_id) or not public.qualisphere_tenant_module_enabled(v_dci.tenant_id,'controlled_documents') then raise exception 'Company Account access denied'; end if;
 if not exists(select 1 from public.tenant_user_role_assignments a join public.customer_roles r on r.id=a.role_id where a.tenant_id=v_dci.tenant_id and lower(a.user_email)=v_email and a.is_active and r.is_active and lower(r.role_name)='document control coordinator')
 and not exists(select 1 from public.user_security_roles where lower(user_email)=v_email and role_code='document_control_coordinator') then raise exception 'Document Control Coordinator role required'; end if;
 if jsonb_typeof(p_manifest) is distinct from 'array' then raise exception 'Controlled-copy manifest required'; end if;
 if not exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_formal_approval' and status='approved')
 or exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_formal_approval' and status not in ('approved','cancelled')) then raise exception 'Formal approvals incomplete'; end if;
 if not exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_post_approval_coordination' and status='completed')
 or exists(select 1 from public.approval_tasks where entity_type='document_change_initiation' and entity_id=p_dci_id and task_type='dci_post_approval_action' and status not in ('cancelled') and (status<>'completed' or implementation_verification_status is distinct from 'verified')) then raise exception 'Post-approval tasks incomplete'; end if;
 select count(*) into v_count from public.document_change_initiation_documents where dci_id=p_dci_id and tenant_id=v_dci.tenant_id;
 if v_count=0 or jsonb_array_length(p_manifest)<>v_count then raise exception 'Manifest must include every linked document exactly once'; end if;
 perform 1 from public.controlled_documents cd join public.document_change_initiation_documents l on l.document_id=cd.id where l.dci_id=p_dci_id order by cd.id for update of cd;
 for v_doc in select cd.* from public.controlled_documents cd join public.document_change_initiation_documents l on l.document_id=cd.id where l.dci_id=p_dci_id and l.tenant_id=v_dci.tenant_id order by cd.id loop
  if v_doc.tenant_id is distinct from v_dci.tenant_id or coalesce(v_doc.file_path,v_doc.file_url) is null or v_doc.release_pdf_file_path is null then raise exception 'Document master or final PDF missing: %',v_doc.document_number; end if;
  if not exists(select 1 from public.dci_pdf_verifications where dci_id=p_dci_id and document_id=v_doc.id and tenant_id=v_dci.tenant_id and pdf_storage_path=v_doc.release_pdf_file_path) then raise exception 'PDF verification missing: %',v_doc.document_number; end if;
  if exists(select 1 from public.document_training_requirements r join public.training_methods m on m.id=r.training_method_id where r.document_id=v_doc.id and m.release_blocking and not exists(select 1 from public.training_assignments a where a.training_requirement_id=r.id and a.document_id=v_doc.id and a.tenant_id=v_dci.tenant_id and a.release_blocking))
  or exists(select 1 from public.training_assignments a where a.document_id=v_doc.id and a.tenant_id=v_dci.tenant_id and a.release_blocking and a.status not in ('completed','waived')) then raise exception 'Blocking training incomplete: %',v_doc.document_number; end if;
  select value into v_item from jsonb_array_elements(p_manifest) where value->>'document_id'=v_doc.id::text;
  if v_item is null or (select count(*) from jsonb_array_elements(p_manifest) where value->>'document_id'=v_doc.id::text)<>1 then raise exception 'Controlled-copy manifest mismatch: %',v_doc.document_number; end if;
  if v_item->>'source_path' is distinct from v_doc.release_pdf_file_path or v_item->>'document_number' is distinct from v_doc.document_number or v_item->>'revision' is distinct from v_doc.revision then raise exception 'Controlled-copy identity mismatch: %',v_doc.document_number; end if;
  if coalesce(v_item->>'path','') not like 'tenant/'||v_dci.tenant_id::text||'/%/controlled-copies/%' then raise exception 'Invalid controlled-copy path: %',v_doc.document_number; end if;
  if not exists(select 1 from storage.objects where bucket_id='controlled-documents' and name=v_item->>'path') then raise exception 'Controlled-copy object missing: %',v_doc.document_number; end if;
  if v_doc.superseded_document_id is not null and not exists(select 1 from public.controlled_documents where id=v_doc.superseded_document_id and tenant_id=v_dci.tenant_id and document_number=v_doc.document_number) then raise exception 'Previous revision mismatch: %',v_doc.document_number; end if;
 end loop;
 for v_doc in select cd.* from public.controlled_documents cd join public.document_change_initiation_documents l on l.document_id=cd.id where l.dci_id=p_dci_id and l.tenant_id=v_dci.tenant_id order by cd.id loop
  select value into v_item from jsonb_array_elements(p_manifest) where value->>'document_id'=v_doc.id::text;
  update public.controlled_documents set status='release',effective_date=p_effective_date,controlled_copy_file_name=v_item->>'file_name',controlled_copy_file_path=v_item->>'path',controlled_copy_file_url=null,controlled_copy_generated_at=now(),controlled_copy_generated_by=v_email,release_approved_by=v_email,release_approved_at=now(),updated_at=now() where id=v_doc.id and tenant_id=v_dci.tenant_id;
  if v_doc.superseded_document_id is not null then update public.controlled_documents set status='superseded',superseded_by_document_id=v_doc.id,updated_at=now() where id=v_doc.superseded_document_id and tenant_id=v_dci.tenant_id; end if;
  perform public.qualisphere_add_audit_log('controlled_document',v_doc.id,'dci_coordinated_release','Released by '||v_email||' effective '||p_effective_date::text);
 end loop;
 update public.document_change_initiations set status='released',updated_at=now() where id=p_dci_id and tenant_id=v_dci.tenant_id;
 perform public.qualisphere_add_audit_log('document_change_initiation',p_dci_id,'dci_coordinated_release','Coordinated release of '||v_count||' documents by '||v_email);
end $$;


--
-- Name: qualisphere_resolve_audit_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_audit_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required to create an audit.'; end if;
  v_tenant := public.qualisphere_current_audit_tenant();
  if v_tenant is null then raise exception 'Select one active Company Account with Audit Management access before creating an audit.'; end if;
  if new.tenant_id is not null and new.tenant_id <> v_tenant then raise exception 'Audit Company Account access denied.'; end if;
  new.tenant_id := v_tenant;
  return new;
end;
$$;


--
-- Name: qualisphere_resolve_capa_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_capa_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email = '' then
    raise exception 'Authenticated user email is required to create a CAPA.';
  end if;

  if new.tenant_id is not null
     and public.qualisphere_is_active_tenant_member(new.tenant_id)
     and public.qualisphere_tenant_module_enabled(new.tenant_id, 'capa') then
    return new;
  end if;

  select count(*), min(tm.tenant_id::text)::uuid
    into v_membership_count, v_resolved_tenant_id
  from public.tenant_memberships tm
  join public.tenant_module_access tma
    on tma.tenant_id = tm.tenant_id
   and lower(tma.module_code) = 'capa'
   and tma.is_enabled = true
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active';

  if v_membership_count = 1 then
    new.tenant_id := v_resolved_tenant_id;
    return new;
  end if;
  if v_membership_count = 0 then
    raise exception 'No active Company Account with CAPA access could be resolved for this user.';
  end if;
  raise exception 'Multiple active Company Accounts were found. Select the Company Account before creating a CAPA.';
end;
$$;


--
-- Name: qualisphere_resolve_change_control_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_change_control_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare v_email text:=lower(trim(coalesce(auth.jwt()->>'email',''))); v_tenant uuid; v_count int;
begin
 if v_email='' then return null; end if;
 select count(distinct tm.tenant_id),min(tm.tenant_id::text)::uuid into v_count,v_tenant
 from public.tenant_memberships tm join public.tenants t on t.id=tm.tenant_id and t.status='active'
 where lower(trim(tm.user_email))=v_email and tm.membership_status='active'
 and public.qualisphere_tenant_module_enabled(tm.tenant_id,'change_control');
 if v_count=1 then return v_tenant; end if;
 if v_count=0 and exists(select 1 from public.user_roles ur where lower(trim(ur.user_email))=v_email) then
   select id into v_tenant from public.tenants where is_internal=true and status='active' limit 1;
   return v_tenant;
 end if;
 return null;
end $$;


--
-- Name: qualisphere_resolve_complaint_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_complaint_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid;
  v_count integer;
begin
  if v_email = '' then return null; end if;

  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid
    into v_count, v_tenant
  from public.tenant_memberships tm
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'complaints');

  if v_count = 1 then return v_tenant; end if;

  if v_count = 0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email)) = v_email
  ) then
    select t.id into v_tenant
    from public.tenants t
    where t.is_internal = true and t.status = 'active'
    limit 1;
    return v_tenant;
  end if;

  return null;
end;
$$;


--
-- Name: qualisphere_resolve_controlled_document_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_controlled_document_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tenant_id uuid;
begin
  -- Keep an explicitly supplied tenant only when the authenticated user is
  -- actually an active member with Controlled Documents enabled.
  if new.tenant_id is not null
     and public.qualisphere_is_active_tenant_member(new.tenant_id)
     and public.qualisphere_tenant_module_enabled(new.tenant_id,'controlled_documents') then
    return new;
  end if;

  -- Use the same compatibility resolver used by Controlled Document storage.
  -- It resolves customer tenants from tenant_memberships.user_email and
  -- preserves legacy Internal development/validation users through user_roles.
  v_tenant_id := public.qualisphere_current_controlled_documents_tenant();
  new.tenant_id := v_tenant_id;
  return new;
end;
$$;


--
-- Name: qualisphere_resolve_equipment_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_equipment_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email = '' then
    raise exception 'Authenticated user email is required to register equipment.';
  end if;
  if new.tenant_id is not null and public.qualisphere_tenant_module_enabled(new.tenant_id, 'equipment') then
    return new;
  end if;
  select count(*), min(tm.tenant_id::text)::uuid
    into v_membership_count, v_resolved_tenant_id
  from public.tenant_memberships tm
  join public.tenant_module_access tma on tma.tenant_id = tm.tenant_id and lower(tma.module_code) = 'equipment' and tma.is_enabled = true
  join public.tenants t on t.id = tm.tenant_id and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email and tm.membership_status = 'active';
  if v_membership_count = 1 then
    new.tenant_id := v_resolved_tenant_id;
    return new;
  end if;
  if v_membership_count = 0 then
    raise exception 'No active Company Account with Equipment access could be resolved for this user.';
  end if;
  raise exception 'Multiple active Company Accounts were found. Select the Company Account before registering equipment.';
end;
$$;


--
-- Name: qualisphere_resolve_ncmr_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_ncmr_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email = '' then
    raise exception 'Authenticated user email is required to create an NCMR.';
  end if;

  if new.tenant_id is not null
     and public.qualisphere_is_active_tenant_member(new.tenant_id)
     and public.qualisphere_tenant_module_enabled(new.tenant_id, 'ncmr') then
    return new;
  end if;

  select count(*), min(tm.tenant_id::text)::uuid
    into v_membership_count, v_resolved_tenant_id
  from public.tenant_memberships tm
  join public.tenant_module_access tma
    on tma.tenant_id = tm.tenant_id
   and lower(tma.module_code) = 'ncmr'
   and tma.is_enabled = true
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active';

  if v_membership_count = 1 then
    new.tenant_id := v_resolved_tenant_id;
    return new;
  end if;

  if v_membership_count = 0 then
    raise exception 'No active Company Account with NCMR access could be resolved for this user.';
  end if;

  raise exception 'Multiple active Company Accounts were found. Select the Company Account before creating an NCMR.';
end;
$$;


--
-- Name: qualisphere_resolve_oos_oot_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_oos_oot_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email = '' then
    raise exception 'Authenticated user email is required to create an OOS/OOT investigation.';
  end if;

  if new.tenant_id is not null
     and public.qualisphere_is_active_tenant_member(new.tenant_id)
     and public.qualisphere_tenant_module_enabled(new.tenant_id, 'oos_oot') then
    return new;
  end if;

  select count(distinct tm.tenant_id)
    into v_membership_count
  from public.tenant_memberships tm
  join public.tenant_module_access tma
    on tma.tenant_id = tm.tenant_id
   and lower(tma.module_code) = 'oos_oot'
   and tma.is_enabled = true
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active';

  if v_membership_count = 1 then
    select tm.tenant_id
      into v_resolved_tenant_id
    from public.tenant_memberships tm
    join public.tenant_module_access tma
      on tma.tenant_id = tm.tenant_id
     and lower(tma.module_code) = 'oos_oot'
     and tma.is_enabled = true
    join public.tenants t
      on t.id = tm.tenant_id
     and t.status = 'active'
    where lower(trim(tm.user_email)) = v_email
      and tm.membership_status = 'active'
    group by tm.tenant_id
    limit 1;

    new.tenant_id := v_resolved_tenant_id;
    return new;
  end if;

  if v_membership_count = 0 then
    raise exception 'No active Company Account with OOS/OOT access could be resolved for this user.';
  end if;

  raise exception 'Multiple active Company Accounts were found. Select the Company Account before creating an OOS/OOT investigation.';
end;
$$;


--
-- Name: qualisphere_resolve_supplier_quality_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_supplier_quality_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid;
  v_count integer;
begin
  if v_email = '' then return null; end if;

  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid
    into v_count, v_tenant
  from public.tenant_memberships tm
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active'
    and (
      public.qualisphere_tenant_module_enabled(tm.tenant_id,'suppliers')
      or public.qualisphere_tenant_module_enabled(tm.tenant_id,'scar')
    );

  if v_count = 1 then return v_tenant; end if;

  if v_count = 0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email)) = v_email
  ) then
    select t.id into v_tenant
    from public.tenants t
    where t.is_internal = true and t.status = 'active'
    limit 1;
    return v_tenant;
  end if;

  return null;
end;
$$;


--
-- Name: qualisphere_resolve_training_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_resolve_training_tenant() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text:=lower(coalesce(auth.jwt()->>'email',''));
  v_tenant uuid;
  v_count int;
begin
  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid
    into v_count,v_tenant
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id
  join public.tenant_module_access tma on tma.tenant_id=tm.tenant_id
  where lower(tm.user_email)=v_email
    and tm.membership_status='active'
    and t.status='active'
    and tma.is_enabled=true
    and lower(tma.module_code) in ('training','training_management');

  if v_count=1 then return v_tenant; end if;

  if exists(select 1 from public.user_roles ur where lower(ur.user_email)=v_email) then
    select id into v_tenant
    from public.tenants
    where is_internal=true and status='active'
    limit 1;
    return v_tenant;
  end if;

  return null;
end $$;


--
-- Name: qualisphere_save_training_matrix_audience(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_save_training_matrix_audience(p_document_number text, p_targets jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE v_tenant uuid; target record;
BEGIN
 v_tenant:=public.qualisphere_resolve_training_tenant();
 IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT public.qualisphere_training_is_coordinator(v_tenant) THEN RAISE EXCEPTION 'Training coordinator permission required'; END IF;
 IF nullif(btrim(p_document_number),'') IS NULL OR jsonb_typeof(p_targets)<>'array' OR p_targets IS NULL OR jsonb_array_length(p_targets)>1000 THEN RAISE EXCEPTION 'A procedure and valid audience are required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.controlled_documents WHERE tenant_id=v_tenant AND lower(btrim(document_number))=lower(btrim(p_document_number))) THEN RAISE EXCEPTION 'Procedure is not in this company'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':matrix:'||lower(btrim(p_document_number)),0));
 -- Disable old mappings instead of deleting them; only active requirements drive assignment.
 UPDATE public.training_matrix SET required_training=false WHERE tenant_id=v_tenant AND lower(btrim(document_number))=lower(btrim(p_document_number));
 FOR target IN SELECT DISTINCT nullif(btrim(x.department),'') AS department,nullif(btrim(x.role_name),'') AS role_name FROM jsonb_to_recordset(p_targets) AS x(department text,role_name text) LOOP
  UPDATE public.training_matrix SET required_training=true,effectiveness_required=false WHERE tenant_id=v_tenant AND lower(btrim(document_number))=lower(btrim(p_document_number)) AND lower(coalesce(btrim(department),''))=lower(coalesce(target.department,'')) AND lower(coalesce(btrim(role_name),''))=lower(coalesce(target.role_name,''));
  IF NOT FOUND THEN INSERT INTO public.training_matrix(tenant_id,document_number,department,role_name,required_training,effectiveness_required) VALUES(v_tenant,btrim(p_document_number),target.department,target.role_name,true,false); END IF;
 END LOOP;
END;
$$;


--
-- Name: qualisphere_save_training_method(uuid, uuid, text, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_save_training_method(p_tenant uuid, p_id uuid, p_label text, p_release_blocking boolean, p_acknowledgement_required boolean, p_evidence_required boolean) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE old_method public.training_methods%ROWTYPE; new_id uuid; versioned boolean:=false; used boolean:=false;
BEGIN
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


--
-- Name: qualisphere_seed_document_impact_areas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_seed_document_impact_areas() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.md_document_impact_areas
    (tenant_id, code, label, sort_order, behavior_type, is_active, is_system_seed)
  values
    (new.id,'product_design','Product / Design',10,'generic',true,true),
    (new.id,'manufacturing_process','Manufacturing / Process',20,'generic',true,true),
    (new.id,'tooling_equipment','Tooling / Equipment',30,'generic',true,true),
    (new.id,'inspection_test_methods','Inspection / Test Methods',40,'generic',true,true),
    (new.id,'specifications','Specifications',50,'generic',true,true),
    (new.id,'supplier','Supplier',60,'generic',true,true),
    (new.id,'inventory_wip','Inventory / WIP',70,'inventory_wip',true,true),
    (new.id,'regulatory_risk','Regulatory / Risk',80,'generic',true,true),
    (new.id,'validation','Validation',90,'validation',true,true),
    (new.id,'training','Training',100,'training',true,true)
  on conflict (tenant_id, code) do nothing;
  return new;
end;
$$;


--
-- Name: qualisphere_send_training_due_notices(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_send_training_due_notices(p_as_of date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare r record; v_count integer:=0; v_key text; v_kind text;
begin
 if auth.uid() is null or not public.qualisphere_training_is_coordinator(public.qualisphere_resolve_training_tenant()) then
   raise exception 'Training coordinator permission required';
 end if;
 if p_as_of<>current_date then raise exception 'Notices must use the current date'; end if;
 for r in select id,assigned_to_email,training_title,due_date,tenant_id
          from public.training_assignments
          where tenant_id=public.qualisphere_resolve_training_tenant()
            and status not in ('completed','waived','effectiveness_complete')
            and due_date is not null and due_date::date <= p_as_of + 7
 loop
   v_kind:=case when r.due_date::date < p_as_of then 'overdue' else 'due_soon' end;
   -- A due-soon notice is once per due date; overdue reminder at most once per 7-day window.
   v_key:='training:'||r.id::text||':'||v_kind||':'||
     case when v_kind='overdue' then (date_trunc('week',p_as_of::timestamp))::date::text
          else r.due_date::date::text end;
   insert into public.notifications(
     user_email,title,message,notification_type,severity,related_record_id,
     related_module,related_url,is_read,read_status,created_by,deduplication_key)
   values(lower(r.assigned_to_email),
     case when v_kind='overdue' then 'Training overdue' else 'Training due soon' end,
     coalesce(r.training_title,'Training')||' is '||
       case when v_kind='overdue' then 'overdue.' else 'due on '||r.due_date::date::text||'.' end,
     'training_'||v_kind,case when v_kind='overdue' then 'warning' else 'info' end,
     r.id,'training','/training/'||r.id::text,false,false,'training_system',v_key)
   on conflict do nothing;
   if found then v_count:=v_count+1; end if;
 end loop;
 return v_count;
end;
$$;


--
-- Name: qualisphere_set_approval_matrix_reviewer_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_approval_matrix_reviewer_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_template_tenant uuid;
begin
  select tenant_id into v_template_tenant
  from public.approval_matrix_templates
  where id = new.template_id;

  if v_template_tenant is null then
    raise exception 'Approval matrix template % was not found.', new.template_id;
  end if;

  if new.tenant_id is not null and new.tenant_id <> v_template_tenant then
    raise exception 'Reviewer tenant must match the approval matrix template tenant.';
  end if;

  new.tenant_id := v_template_tenant;
  return new;
end;
$$;


--
-- Name: qualisphere_set_audit_finding_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_audit_finding_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_parent_tenant uuid;
begin
  select tenant_id into v_parent_tenant from public.audits where id=new.audit_id;
  if v_parent_tenant is null then raise exception 'Parent audit not found.'; end if;
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'Audit finding Company Account cannot be changed.'; end if;
  if new.tenant_id is not null and new.tenant_id <> v_parent_tenant then raise exception 'Audit finding Company Account must match parent audit.'; end if;
  new.tenant_id := v_parent_tenant;
  return new;
end;
$$;


--
-- Name: qualisphere_set_change_control_child_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_change_control_child_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare v_parent uuid; v_active uuid;
begin
 select tenant_id into v_parent from public.change_controls where id=new.change_control_id;
 if v_parent is null then raise exception 'Parent Change Control was not found.'; end if;
 v_active:=public.qualisphere_resolve_change_control_tenant();
 if v_active is null or v_active<>v_parent then raise exception 'Parent Change Control is outside the active Company Account.'; end if;
 new.tenant_id:=v_parent; return new;
end $$;


--
-- Name: qualisphere_set_change_control_tenant_and_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_change_control_tenant_and_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare v_tenant uuid; v_year int; v_next int;
begin
 v_tenant:=public.qualisphere_resolve_change_control_tenant();
 if v_tenant is null then raise exception 'No unique active Company Account with Change Control access could be resolved.'; end if;
 if new.tenant_id is not null and new.tenant_id<>v_tenant then raise exception 'Change Control tenant does not match the active Company Account.'; end if;
 new.tenant_id:=v_tenant;
 if tg_op='INSERT' then
   v_year:=extract(year from coalesce(new.created_at,now()))::int;
   insert into public.change_control_tenant_number_counters(tenant_id,calendar_year,last_number)
   values(v_tenant,v_year,1)
   on conflict(tenant_id,calendar_year) do update set last_number=public.change_control_tenant_number_counters.last_number+1
   returning last_number into v_next;
   new.change_number:=format('CC-%s-%s',v_year,lpad(v_next::text,6,'0'));
 end if;
 return new;
end $$;


--
-- Name: qualisphere_set_company_user(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_company_user(p_tenant_id uuid, p_user_email text, p_job_title text DEFAULT NULL::text, p_department text DEFAULT NULL::text, p_account_status text DEFAULT 'active'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(p_user_email, '')));
  v_status text := lower(trim(coalesce(p_account_status, 'active')));
  v_actor text := public.current_user_email();
  v_rows integer := 0;
begin
  if p_tenant_id is null then
    raise exception 'Company Account ID is required.';
  end if;
  if v_email = '' then
    raise exception 'User email is required.';
  end if;
  if v_status not in ('active', 'inactive') then
    raise exception 'Account status must be active or inactive.';
  end if;
  if not public.qualisphere_is_company_admin(p_tenant_id) then
    raise exception 'Company Administrator access required.';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant_id and coalesce(t.is_internal, false) = true) then
    raise exception 'QualiSphere Development / Validation users are administered through the original QualiSphere 1.0 user administration.';
  end if;

  insert into public.tenant_user_profiles (
    tenant_id, user_email, job_title, department, account_status, created_by, updated_by, updated_at
  ) values (
    p_tenant_id, v_email,
    nullif(trim(coalesce(p_job_title, '')), ''),
    nullif(trim(coalesce(p_department, '')), ''),
    v_status, v_actor, v_actor, now()
  )
  on conflict (tenant_id, user_email)
  do update set
    job_title = excluded.job_title,
    department = excluded.department,
    account_status = excluded.account_status,
    updated_by = v_actor,
    updated_at = now();

  update public.tenant_memberships
  set membership_status = v_status,
      joined_at = case when v_status = 'active' then coalesce(joined_at, now()) else joined_at end,
      updated_at = now()
  where tenant_id = p_tenant_id and lower(user_email) = v_email;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.tenant_memberships (
      tenant_id, user_email, membership_role, membership_status, invited_by, invited_at, joined_at
    ) values (
      p_tenant_id, v_email, 'member', v_status, v_actor, now(),
      case when v_status = 'active' then now() else null end
    );
  end if;
end;
$$;


--
-- Name: qualisphere_set_complaint_child_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_complaint_child_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_parent_tenant uuid;
  v_active_tenant uuid;
begin
  select c.tenant_id into v_parent_tenant
  from public.complaints c
  where c.id = new.complaint_id;

  if v_parent_tenant is null then
    raise exception 'Complaint parent record was not found.';
  end if;

  v_active_tenant := public.qualisphere_resolve_complaint_tenant();
  if v_active_tenant is null or v_parent_tenant <> v_active_tenant then
    raise exception 'Complaint child record Company Account does not match the active Company Account.';
  end if;

  new.tenant_id := v_parent_tenant;
  return new;
end;
$$;


--
-- Name: qualisphere_set_complaint_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_complaint_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_tenant uuid;
begin
  v_tenant := public.qualisphere_resolve_complaint_tenant();
  if v_tenant is null then
    raise exception 'No active Company Account with Complaints access could be resolved for this user.';
  end if;
  if new.tenant_id is null then new.tenant_id := v_tenant; end if;
  if new.tenant_id <> v_tenant then
    raise exception 'Complaint Company Account does not match the active Company Account.';
  end if;
  return new;
end;
$$;


--
-- Name: qualisphere_set_dci_document_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_dci_document_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_dci_tenant uuid; v_document_tenant uuid;
begin
 select tenant_id into v_dci_tenant from public.document_change_initiations where id=new.dci_id;
 select tenant_id into v_document_tenant from public.controlled_documents where id=new.document_id;
 if v_dci_tenant is null or v_document_tenant is null or v_dci_tenant<>v_document_tenant then raise exception 'DCI and controlled document must belong to the same tenant.'; end if;
 new.tenant_id:=v_dci_tenant; return new;
end; $$;


--
-- Name: qualisphere_set_dci_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_dci_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_tenant_id uuid;
begin
 v_tenant_id:=public.qualisphere_current_controlled_documents_tenant();
 if v_tenant_id is null then raise exception 'No active Controlled Documents tenant context.'; end if;
 if new.tenant_id is null then new.tenant_id:=v_tenant_id; end if;
 if new.tenant_id<>v_tenant_id then raise exception 'DCI tenant does not match active tenant.'; end if;
 return new;
end; $$;


--
-- Name: qualisphere_set_management_review_child_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_management_review_child_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.management_reviews where id=new.management_review_id;
  if v_tenant is null then raise exception 'Parent Management Review not found.'; end if;
  if tg_op='UPDATE' and new.management_review_id is distinct from old.management_review_id then
    raise exception 'Management Review child parent cannot be changed.';
  end if;
  new.tenant_id:=v_tenant;
  if not public.qualisphere_is_active_tenant_member(v_tenant)
     or not public.qualisphere_tenant_module_enabled(v_tenant,'management_review') then
    raise exception 'Management Review tenant access denied.';
  end if;
  return new;
end $$;


--
-- Name: qualisphere_set_qms_child_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_qms_child_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.qms_configuration_versions
  where id = new.configuration_version_id;

  if v_tenant_id is null then
    raise exception 'Configuration version % was not found.', new.configuration_version_id;
  end if;

  if new.tenant_id is not null and new.tenant_id <> v_tenant_id then
    raise exception 'Child configuration row tenant must match its configuration version tenant.';
  end if;

  new.tenant_id := v_tenant_id;
  return new;
end;
$$;


--
-- Name: qualisphere_set_supplier_quality_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_supplier_quality_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid;
begin
  if tg_table_name='scars' then
    select tenant_id into v from suppliers where id=coalesce(new.supplier_id,new.linked_supplier_id);
    if v is null then select tenant_id into v from ncmrs where id=coalesce(new.source_ncmr_id,new.linked_ncmr_id); end if;
  elsif tg_table_name='supplier_audits' then
    select tenant_id into v from suppliers where id=new.supplier_id;
    if v is null then select tenant_id into v from scars where id=new.scar_id; end if;
  elsif tg_table_name='supplier_audit_findings' then
    select tenant_id into v from supplier_audits where id=new.audit_id;
    if v is null then select tenant_id into v from scars where id=new.scar_id; end if;
  elsif tg_table_name='supplier_documents' then
    select tenant_id into v from suppliers where id=new.supplier_id;
  elsif tg_table_name='receiving_inspections' then
    select tenant_id into v from suppliers where id=new.supplier_id;
    if v is null then select tenant_id into v from ncmrs where id=new.linked_ncmr_id; end if;
  end if;

  v := coalesce(v,new.tenant_id,public.qualisphere_resolve_supplier_quality_tenant());
  if v is null then raise exception 'Unable to resolve Company Account for %',tg_table_name; end if;
  if new.tenant_id is not null and new.tenant_id<>v then raise exception 'Cross-company Supplier Quality relationship is not allowed'; end if;
  new.tenant_id:=v;
  return new;
end;
$$;


--
-- Name: qualisphere_set_training_assignment_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_training_assignment_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_parent uuid;
begin
 if new.document_id is not null then select tenant_id into v_parent from controlled_documents where id=new.document_id; end if;
 if v_parent is not null then new.tenant_id:=v_parent;
 elsif new.tenant_id is null then new.tenant_id:=qualisphere_resolve_training_tenant(); end if;
 if new.tenant_id is null then raise exception 'Unable to resolve Training Company Account'; end if;
 return new;
end $$;


--
-- Name: qualisphere_set_training_config_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_set_training_config_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
 if new.tenant_id is null then new.tenant_id:=public.qualisphere_resolve_training_tenant(); end if;
 if new.tenant_id is null then raise exception 'Unable to resolve Training Company Account'; end if;
 return new;
end $$;


--
-- Name: qualisphere_tenant_module_enabled(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_tenant_module_enabled(p_tenant_id uuid, p_module_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.tenant_module_access module_access
    where module_access.tenant_id = p_tenant_id
      and lower(module_access.module_code) = lower(p_module_code)
      and module_access.is_enabled = true
  )
  and public.qualisphere_is_active_tenant_member(p_tenant_id);
$$;


--
-- Name: qualisphere_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    new.updated_at := now();
    return new;
end;
$$;


--
-- Name: qualisphere_training_assignment_notice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_training_assignment_notice() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
 if nullif(new.assigned_to_email,'') is not null then
   insert into public.notifications(
     user_email,title,message,notification_type,severity,related_record_id,
     related_module,related_url,is_read,read_status,created_by,deduplication_key)
   values (
     lower(new.assigned_to_email),'Training assigned',
     coalesce(new.training_title,'Training') || ' has been assigned to you.',
     'training_assigned','info',new.id,'training','/training/'||new.id::text,
     false,false,'training_system','training:'||new.id::text||':assigned')
   on conflict do nothing;
 end if;
 return new;
end;
$$;


--
-- Name: qualisphere_training_daily_automation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_training_daily_automation() RETURNS TABLE(cycles_created integer, notices_created integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  r record;
  v_base date;
  v_due date;
  v_cycles integer := 0;
  v_notices integer := 0;
  v_kind text;
  v_key text;
begin
  -- Only the privileged postgres session may execute this invoker function.
  -- Never grant EXECUTE to API roles or ordinary authenticated users.
  if session_user <> 'postgres' then
    raise exception 'Database scheduler only';
  end if;
  for r in
    select a.* from public.training_assignments a
    where a.training_category = 'recurring'
      and a.status = 'completed'
      and a.recurrence_months between 1 and 120
      and not exists (
        select 1 from public.training_assignments child
        where child.recurring_parent_assignment_id = a.id
      )
    order by a.created_at, a.id
    for update of a skip locked
  loop
    if r.recurrence_basis = 'calendar' then
      v_base := coalesce(r.due_date, r.training_completed_on, r.completed_at::date);
    else
      v_base := coalesce(r.training_completed_on, r.completed_at::date);
    end if;
    if v_base is null then continue; end if;
    v_due := (v_base + make_interval(months => r.recurrence_months))::date;
    if v_due > current_date then continue; end if;
    insert into public.training_assignments (
      tenant_id,document_id,assigned_to_email,assigned_by_email,assignment_source,
      role_name,department,training_title,training_description,due_date,status,
      effectiveness_required,effectiveness_status,supervisor_verification_required,
      acknowledgement_required,originating_change_control_id,retraining_assignment,
      source_document_revision,previous_training_assignment_id,training_requirement_id,
      training_group_id,training_method_id,release_blocking,training_category,
      recurrence_months,recurrence_basis,recurring_evidence_mode,
      recurring_next_due_date,recurring_parent_assignment_id
    ) values (
      r.tenant_id,r.document_id,r.assigned_to_email,'training_system','recurring',
      r.role_name,r.department,r.training_title,r.training_description,v_due,'assigned',
      r.effectiveness_required,
      case when r.effectiveness_required then 'effectiveness_pending' else null end,
      r.supervisor_verification_required,r.acknowledgement_required,
      r.originating_change_control_id,true,r.source_document_revision,r.id,
      r.training_requirement_id,r.training_group_id,r.training_method_id,
      r.release_blocking,'recurring',r.recurrence_months,r.recurrence_basis,
      r.recurring_evidence_mode,null,r.id
    )
    on conflict (recurring_parent_assignment_id)
      where recurring_parent_assignment_id is not null do nothing;
    if found then v_cycles := v_cycles + 1; end if;
  end loop;

  for r in
    select a.id,a.assigned_to_email,a.training_title,a.due_date,a.tenant_id
    from public.training_assignments a
    where a.status not in ('completed','waived','effectiveness_complete')
      and a.due_date is not null and a.due_date <= current_date + 7
  loop
    v_kind := case when r.due_date < current_date then 'overdue' else 'due_soon' end;
    v_key := 'training:' || r.id::text || ':' || v_kind || ':' ||
      case when v_kind='overdue'
        then date_trunc('week',current_date::timestamp)::date::text
        else r.due_date::text end;
    insert into public.notifications (
      user_email,title,message,notification_type,severity,related_record_id,
      related_module,related_url,is_read,read_status,created_by,deduplication_key
    ) values (
      lower(r.assigned_to_email),
      case when v_kind='overdue' then 'Training overdue' else 'Training due soon' end,
      coalesce(r.training_title,'Training') || ' is ' ||
        case when v_kind='overdue' then 'overdue.'
             else 'due on ' || r.due_date::text || '.' end,
      'training_' || v_kind,
      case when v_kind='overdue' then 'warning' else 'info' end,
      r.id,'training','/training/' || r.id::text,false,false,'training_system',v_key
    ) on conflict do nothing;
    if found then v_notices := v_notices + 1; end if;
  end loop;
  return query select v_cycles,v_notices;
end;
$$;


--
-- Name: qualisphere_training_is_assignee(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_training_is_assignee(p_email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
 select auth.uid() is not null and lower(coalesce(p_email,''))=lower(coalesce(auth.jwt()->>'email',''));
$$;


--
-- Name: qualisphere_training_is_coordinator(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_training_is_coordinator(p_tenant uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
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


--
-- Name: qualisphere_training_is_direct_manager(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_training_is_direct_manager(p_tenant uuid, p_assignee text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
select auth.uid() is not null and p_tenant=public.qualisphere_resolve_training_tenant()
 and exists(select 1 from public.employee_profiles e
 where e.tenant_id=p_tenant and lower(e.user_email)=lower(p_assignee)
 and lower(e.manager_email)=lower(auth.jwt()->>'email'));
$$;


--
-- Name: qualisphere_training_without_effectiveness(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_training_without_effectiveness() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.effectiveness_required:=false; NEW.effectiveness_status:='not_required'; RETURN NEW; END;
$$;


--
-- Name: qualisphere_validate_capa_user(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_validate_capa_user(p_user_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_email text := lower(trim(coalesce(p_user_email,'')));
  v_actor_email text := lower(trim(coalesce(auth.jwt() ->> 'email','')));
  v_tenant uuid;
  v_is_internal boolean;
  v_count integer;
begin
  if v_actor_email='' or v_email='' then return false; end if;

  select count(*), min(tm.tenant_id::text)::uuid
    into v_count,v_tenant
  from public.tenant_memberships tm
  join public.tenant_module_access tma
    on tma.tenant_id=tm.tenant_id
   and lower(tma.module_code)='capa'
   and tma.is_enabled=true
  join public.tenants t
    on t.id=tm.tenant_id
   and t.status='active'
  where lower(trim(tm.user_email))=v_actor_email
    and tm.membership_status='active';

  if v_count<>1 or v_tenant is null then return false; end if;

  select coalesce(t.is_internal,false) into v_is_internal
  from public.tenants t where t.id=v_tenant;

  if v_is_internal then
    return exists(
      select 1 from public.user_roles ur
      where lower(trim(ur.user_email))=v_email
        and lower(coalesce(ur.account_status,'active'))='active'
    );
  end if;

  return exists(
    select 1 from public.tenant_user_profiles tup
    where tup.tenant_id=v_tenant
      and lower(trim(tup.user_email))=v_email
      and lower(coalesce(tup.account_status,''))='active'
      and exists(
        select 1 from public.tenant_memberships tm
        where tm.tenant_id=v_tenant
          and lower(trim(tm.user_email))=v_email
          and tm.membership_status='active'
      )
      and exists(
        select 1 from public.tenant_user_role_assignments ura
        where ura.tenant_id=v_tenant
          and lower(trim(ura.user_email))=v_email
          and ura.is_active=true
      )
  );
end;
$$;


--
-- Name: qualisphere_validate_document_reviewer_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_validate_document_reviewer_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.controlled_documents where id=new.document_id;
  if v_tenant_id is null then raise exception 'Unable to resolve the document Company Account.'; end if;
  if not public.qualisphere_email_belongs_to_tenant(new.reviewer_email,v_tenant_id) then
    raise exception 'Reviewer must be an active user of the same Company Account as this controlled document.';
  end if;
  return new;
end $$;


--
-- Name: qualisphere_verify_dci_pdf(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qualisphere_verify_dci_pdf(p_dci_id uuid, p_document_id uuid, p_pdf_path text, p_comment text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_email text:=lower(coalesce(auth.jwt()->>'email','')); v_dci public.document_change_initiations; v_doc public.controlled_documents; v_allowed boolean;
BEGIN
 IF v_email='' THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF length(trim(coalesce(p_comment,'')))<8 THEN RAISE EXCEPTION 'Describe the PDF review (minimum 8 characters)'; END IF;
 SELECT * INTO v_dci FROM public.document_change_initiations WHERE id=p_dci_id FOR UPDATE;
 IF NOT FOUND OR v_dci.status<>'release_ready' THEN RAISE EXCEPTION 'DCI must be release ready'; END IF;
 SELECT * INTO v_doc FROM public.controlled_documents WHERE id=p_document_id AND tenant_id=v_dci.tenant_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.document_change_initiation_documents l WHERE l.dci_id=p_dci_id AND l.document_id=p_document_id AND l.tenant_id=v_dci.tenant_id) THEN RAISE EXCEPTION 'Document does not belong to this DCI'; END IF;
 IF v_doc.release_pdf_file_path IS NULL OR v_doc.release_pdf_file_path<>p_pdf_path THEN RAISE EXCEPTION 'PDF has changed. Refresh and review the current PDF'; END IF;
 IF v_doc.file_path IS NULL AND v_doc.file_url IS NULL THEN RAISE EXCEPTION 'Approved working master missing'; END IF;
 SELECT EXISTS(
 SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=v_dci.tenant_id AND lower(m.user_email)=v_email AND m.membership_status='active'
 AND (EXISTS(SELECT 1 FROM public.tenant_user_role_assignments a JOIN public.customer_roles r ON r.id=a.role_id WHERE a.tenant_id=v_dci.tenant_id AND lower(a.user_email)=v_email AND a.is_active AND r.is_active AND lower(trim(r.role_name))='document control coordinator')
 OR EXISTS(SELECT 1 FROM public.user_security_roles u JOIN public.security_roles s ON s.code=u.role_code WHERE lower(u.user_email)=v_email AND u.role_code='document_control_coordinator' AND s.is_active))
 ) INTO v_allowed;
 IF NOT v_allowed THEN RAISE EXCEPTION 'Document Control Coordinator role required'; END IF;
 INSERT INTO public.dci_pdf_verifications(tenant_id,dci_id,document_id,pdf_storage_path,verified_by_email,verification_comment)
 VALUES(v_dci.tenant_id,p_dci_id,p_document_id,p_pdf_path,v_email,trim(p_comment))
 ON CONFLICT(document_id,pdf_storage_path) DO NOTHING;
 PERFORM public.qualisphere_add_audit_log('controlled_document',p_document_id,'dci_final_pdf_verified','DCI '||v_dci.dci_number||' PDF path '||p_pdf_path||' reviewed by '||v_email||': '||trim(p_comment));
END $$;


--
-- Name: recalculate_all_supplier_risks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_all_supplier_risks() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; v_tenant uuid;
begin
 v_tenant:=public.qualisphere_resolve_supplier_quality_tenant();
 if v_tenant is null then raise exception 'Unable to resolve Company Account'; end if;
 for r in select id from suppliers where tenant_id=v_tenant loop perform public.recalculate_supplier_risk(r.id); end loop;
end; $$;


--
-- Name: recalculate_supplier_risk(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_supplier_risk(p_supplier_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
 v_tenant uuid; v_score integer:=0; v_open_scars integer:=0; v_overdue_scars integer:=0;
 v_not_effective_scars integer:=0; v_supplier_ncmrs integer:=0; v_recurring_ncmrs integer:=0;
 v_supplier_capas integer:=0; v_risk_level text:='Low'; v_escalation_level integer:=1; v_governance_status text:='routine';
begin
 select tenant_id into v_tenant from suppliers where id=p_supplier_id;
 if v_tenant is null then raise exception 'Supplier not found'; end if;
 if auth.uid() is not null and v_tenant is distinct from public.qualisphere_resolve_supplier_quality_tenant() then
   raise exception 'Cross-company supplier risk recalculation is not allowed';
 end if;
 select count(*) into v_open_scars from scars where tenant_id=v_tenant and (supplier_id=p_supplier_id or linked_supplier_id=p_supplier_id) and coalesce(status,scar_status,'open')<>'closed';
 select count(*) into v_overdue_scars from scars where tenant_id=v_tenant and (supplier_id=p_supplier_id or linked_supplier_id=p_supplier_id) and coalesce(status,scar_status,'open')<>'closed' and supplier_response_due_date is not null and supplier_response_due_date<current_date and supplier_response_received_at is null;
 select count(*) into v_not_effective_scars from scars where tenant_id=v_tenant and (supplier_id=p_supplier_id or linked_supplier_id=p_supplier_id) and effectiveness_result='not_effective';
 select count(*) into v_supplier_ncmrs from ncmrs where tenant_id=v_tenant and (supplier_id=p_supplier_id or linked_supplier_id=p_supplier_id);
 select count(*) into v_recurring_ncmrs from ncmrs where tenant_id=v_tenant and (supplier_id=p_supplier_id or linked_supplier_id=p_supplier_id) and recurring_issue=true;
 -- CAPA currently has no supplier_id link. Do not use a tenant-wide/global CAPA count as a supplier-specific signal.
 v_supplier_capas:=0;
 v_score:=(v_open_scars*10)+(v_overdue_scars*15)+(v_not_effective_scars*20)+(v_supplier_ncmrs*8)+(v_recurring_ncmrs*12)+(v_supplier_capas*10);
 if v_score>=70 then v_risk_level:='Critical';v_escalation_level:=4;v_governance_status:='disqualification_risk';
 elsif v_score>=40 then v_risk_level:='High';v_escalation_level:=3;v_governance_status:='executive_review';
 elsif v_score>=20 then v_risk_level:='Medium';v_escalation_level:=2;v_governance_status:='increased_monitoring';
 end if;
 update suppliers set supplier_risk_score=v_score,supplier_risk_level=v_risk_level,supplier_escalation_level=v_escalation_level,
 supplier_governance_status=v_governance_status,last_risk_reviewed_at=now(),
 risk_rationale='Open SCARs: '||v_open_scars||'; Overdue SCARs: '||v_overdue_scars||'; Not Effective SCARs: '||v_not_effective_scars||
 '; Supplier NCMRs: '||v_supplier_ncmrs||'; Recurring NCMRs: '||v_recurring_ncmrs||'; Supplier CAPAs: '||v_supplier_capas
 where id=p_supplier_id and tenant_id=v_tenant;
end; $$;


--
-- Name: seed_default_equipment_schedule_notifications(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_equipment_schedule_notifications(p_schedule_configuration_id uuid, p_tenant_id uuid, p_created_by text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_day integer;
begin
  foreach v_day in array array[30,14,7,3,1,0]
  loop
    insert into public.equipment_schedule_notifications (
      tenant_id, schedule_configuration_id, days_before_due,
      is_enabled, recipient_type, notification_type, created_by
    ) values (
      p_tenant_id, p_schedule_configuration_id, v_day,
      true, 'owner', 'both', p_created_by
    )
    on conflict (schedule_configuration_id, days_before_due, recipient_type, recipient_email)
    do nothing;
  end loop;
end;
$$;


--
-- Name: set_audit_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_audit_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.audit_number is null then
    new.audit_number := public.generate_audit_number(new.tenant_id);
  end if;
  return new;
end;
$$;


--
-- Name: set_capa_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_capa_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.capa_number is null then
    new.capa_number := generate_record_number('capa');
  end if;

  return new;
end;
$$;


--
-- Name: set_ncmr_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_ncmr_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.ncmr_number is null then
    new.ncmr_number := generate_record_number('ncmr');
  end if;

  return new;
end;
$$;


--
-- Name: set_oos_oot_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_oos_oot_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_prefix text;
begin
  if new.investigation_number is null then
    if new.tenant_id is null then
      raise exception 'Company Account must be resolved before OOS/OOT numbering.';
    end if;

    if new.event_type = 'OOS - Out of Specification' then
      v_prefix := 'OOS';
    elsif new.event_type = 'OOT - Out of Trend' then
      v_prefix := 'OOT';
    elsif new.event_type = 'Calibration Out of Tolerance' then
      v_prefix := 'CAL';
    else
      v_prefix := 'EM';
    end if;

    new.investigation_number := public.generate_oos_oot_number(new.tenant_id, v_prefix);
  end if;

  return new;
end;
$$;


--
-- Name: set_qualisphere_module_access_role_active(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_qualisphere_module_access_role_active(p_role_code text, p_is_active boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code text := lower(trim(coalesce(p_role_code,'')));
begin
  if not public.is_qualisphere_role_administrator() then
    raise exception 'Only an Administrator or VP Quality may change Module Access roles.';
  end if;

  if v_code in ('administrator','vp_quality') and p_is_active=false then
    raise exception 'Administrator and VP Quality are protected central roles and cannot be deactivated here.';
  end if;

  update public.security_roles
  set is_active=p_is_active,
      updated_at=now()
  where code=v_code;

  if not found then
    raise exception 'Module Access role not found.';
  end if;

  return jsonb_build_object(
    'status',case when p_is_active then 'active' else 'inactive' end,
    'role_code',v_code
  );
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: snapshot_ncmr_qms_decision(uuid, text, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.snapshot_ncmr_qms_decision(p_ncmr_id uuid, p_decision_type text, p_configuration_version_id uuid, p_input_snapshot jsonb, p_decision_snapshot jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_email text;
  v_workflow_version_id uuid;
  v_configuration_type text;
  v_configuration_snapshot jsonb;
  v_snapshot_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_decision_type not in ('risk_assessment', 'capa_governance') then
    raise exception 'Unsupported NCMR controlled decision type: %', p_decision_type;
  end if;

  if p_configuration_version_id is null then
    raise exception 'Controlled configuration version is required.';
  end if;

  select workflow_version_id
    into v_workflow_version_id
  from public.ncmrs
  where id = p_ncmr_id;

  if not found then
    raise exception 'NCMR record was not found.';
  end if;

  select configuration_type
    into v_configuration_type
  from public.qms_configuration_versions
  where id = p_configuration_version_id
    and module_code = 'NCMR';

  if not found then
    raise exception 'NCMR configuration version was not found.';
  end if;

  if v_configuration_type <> p_decision_type then
    raise exception
      'Configuration type % does not match decision type %.',
      v_configuration_type,
      p_decision_type;
  end if;

  v_user_email := lower(coalesce(auth.jwt() ->> 'email', 'unknown'));

  if p_decision_type = 'risk_assessment' then
    select jsonb_build_object(
      'configuration_version', jsonb_build_object(
        'id', cv.id,
        'version_code', cv.version_code,
        'version_name', cv.version_name,
        'status', cv.status,
        'effective_at', cv.effective_at,
        'activated_at', cv.activated_at
      ),
      'automatic_matrix',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'severity', r.severity,
              'occurrence', r.occurrence,
              'detection', r.detection,
              'overall_risk', r.overall_risk
            )
            order by
              case r.severity when 'high' then 1 when 'medium' then 2 else 3 end,
              case r.occurrence when 'high' then 1 when 'medium' then 2 else 3 end,
              case r.detection when 'low' then 1 when 'medium' then 2 else 3 end
          )
          from public.qms_risk_matrix_rules r
          where r.configuration_version_id = cv.id
        ),
        '[]'::jsonb
      )
    )
    into v_configuration_snapshot
    from public.qms_configuration_versions cv
    where cv.id = p_configuration_version_id;
  else
    select jsonb_build_object(
      'configuration_version', jsonb_build_object(
        'id', cv.id,
        'version_code', cv.version_code,
        'version_name', cv.version_name,
        'status', cv.status,
        'effective_at', cv.effective_at,
        'activated_at', cv.activated_at
      ),
      'governance_rules',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'trigger_type', r.trigger_type,
              'trigger_value', r.trigger_value,
              'governance_action', r.governance_action,
              'is_enabled', r.is_enabled
            )
            order by r.trigger_type, r.trigger_value
          )
          from public.qms_capa_governance_rules r
          where r.configuration_version_id = cv.id
        ),
        '[]'::jsonb
      )
    )
    into v_configuration_snapshot
    from public.qms_configuration_versions cv
    where cv.id = p_configuration_version_id;
  end if;

  insert into public.qms_decision_snapshots (
    module_code,
    record_id,
    decision_type,
    workflow_version_id,
    configuration_version_id,
    input_snapshot,
    decision_snapshot,
    configuration_snapshot,
    decision_by,
    decision_at
  )
  values (
    'NCMR',
    p_ncmr_id,
    p_decision_type,
    v_workflow_version_id,
    p_configuration_version_id,
    coalesce(p_input_snapshot, '{}'::jsonb),
    coalesce(p_decision_snapshot, '{}'::jsonb),
    coalesce(v_configuration_snapshot, '{}'::jsonb),
    v_user_email,
    now()
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;


--
-- Name: submit_equipment_record_for_release(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text) RETURNS public.equipment_release_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_approver_email text := lower(trim(coalesce(p_approver_email,'')));
  v_equipment public.equipment;
  v_submitter_authority jsonb;
  v_approver_authority jsonb;
  v_can_submit boolean := false;
  v_request public.equipment_release_requests;
  v_task_id uuid;
begin
  if v_user_email='' then
    raise exception 'You must be signed in to submit Equipment Record Release.';
  end if;

  if v_approver_email='' then
    raise exception 'Equipment Approver is required.';
  end if;

  select * into v_equipment
  from public.equipment
  where id=p_equipment_id;

  if not found then
    raise exception 'Equipment record not found.';
  end if;

  v_submitter_authority := public.get_qualisphere_enterprise_authority(v_user_email);

  -- Preserve current behavior: owner and creator remain allowed. Central Equipment
  -- Coordinator / Equipment Administrator authority is added as the enterprise path.
  v_can_submit :=
       lower(coalesce(v_equipment.owner_email,''))=v_user_email
    or lower(coalesce(v_equipment.created_by,''))=v_user_email
    or coalesce((v_submitter_authority->>'is_equipment_coordinator')::boolean,false)
    or exists (
      select 1
      from public.equipment_governance_members gm
      where gm.tenant_id=v_equipment.tenant_id
        and lower(gm.user_email)=v_user_email
        and gm.is_active=true
        and gm.role='coordinator'
    );

  if not v_can_submit then
    raise exception 'Only the Equipment Owner, record creator, Equipment Coordinator, or Equipment Administrator may submit this Equipment record for release.';
  end if;

  v_approver_authority := public.get_qualisphere_enterprise_authority(v_approver_email);

  if not coalesce((v_approver_authority->>'is_equipment_approver')::boolean,false) then
    raise exception 'The selected user is not an authorized Equipment Approver or Administrator in User Administration.';
  end if;

  if exists (
    select 1
    from public.equipment_release_requests r
    where r.equipment_id=p_equipment_id
      and r.status='pending'
  ) then
    raise exception 'A pending Equipment Record Release request already exists for this equipment.';
  end if;

  insert into public.equipment_release_requests
    (tenant_id,equipment_id,submitted_by,approver_email,status)
  values
    (v_equipment.tenant_id,p_equipment_id,v_user_email,v_approver_email,'pending')
  returning * into v_request;

  update public.equipment
  set
    record_status='pending_release',
    equipment_status='pending_production_release',
    use_status='restricted',
    use_status_reason='Equipment is not authorized for operational use while Equipment Record Release is pending.'
  where id=p_equipment_id;

  -- Create one central My Workspace approval task for this release request.
  insert into public.approval_tasks (
    entity_type,
    entity_id,
    task_type,
    required_function,
    task_title,
    task_instructions,
    assigned_to_email,
    assigned_by_email,
    status,
    required,
    comments
  )
  values (
    'equipment',
    p_equipment_id,
    'equipment_record_release',
    'Equipment Approver',
    'Equipment Record Release: ' || coalesce(v_equipment.equipment_number,'Equipment'),
    'Review Equipment Master readiness and approve or reject the controlled Equipment Record Release.',
    v_approver_email,
    v_user_email,
    'pending',
    true,
    'Controlled Equipment Record Release approval.'
  )
  returning id into v_task_id;

  insert into public.notification_queue (
    recipient_email,
    subject,
    body,
    entity_type,
    entity_id,
    task_id,
    status
  )
  values (
    v_approver_email,
    'Equipment Record Release assigned: ' || coalesce(v_equipment.equipment_number,'Equipment'),
    'You have been assigned an Equipment Record Release approval. Please open My Workspace.',
    'equipment',
    p_equipment_id,
    v_task_id,
    'pending'
  );

  return v_request;
end;
$$;


--
-- Name: FUNCTION submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text) IS 'Submit: Equipment Owner or Coordinator/authorized maintainer. Approver: Quality Approver or Admin.';


--
-- Name: submit_equipment_record_for_release(uuid, text, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text, p_approver_department text, p_approver_job_title text, p_approve_by_date date) RETURNS public.equipment_release_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_request public.equipment_release_requests;
begin
  if trim(coalesce(p_approver_department,''))='' then
    raise exception 'Approving Department is required.';
  end if;

  if trim(coalesce(p_approver_job_title,''))='' then
    raise exception 'Approving Job Title is required.';
  end if;

  if p_approve_by_date is null then
    raise exception 'Approve By Date is required.';
  end if;

  if p_approve_by_date < current_date then
    raise exception 'Approve By Date cannot be earlier than today.';
  end if;

  -- Reuse the already-deployed controlled release function. This preserves
  -- authorization, readiness workflow, Equipment status changes, My Workspace
  -- task creation, and notification behavior.
  select *
  into v_request
  from public.submit_equipment_record_for_release(
    p_equipment_id,
    p_approver_email
  );

  update public.equipment_release_requests
  set
    approver_department = trim(p_approver_department),
    approver_job_title = trim(p_approver_job_title),
    approve_by_date = p_approve_by_date
  where id = v_request.id
  returning * into v_request;

  -- The existing release submission creates the My Workspace task.
  -- Carry the owner-selected Approve By Date into that task as its due date.
  update public.approval_tasks
  set
    due_date = p_approve_by_date,
    required_function = trim(p_approver_department) || ' / ' || trim(p_approver_job_title)
  where entity_type = 'equipment'
    and entity_id = p_equipment_id
    and task_type = 'equipment_record_release'
    and lower(assigned_to_email) = lower(trim(p_approver_email))
    and status = 'pending';

  return v_request;
end;
$$;


--
-- Name: sync_capa_from_approval_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_capa_from_approval_tasks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_gate text;
  v_pending_required_count integer;
  v_now timestamptz := now();
begin
  if new.entity_type <> 'capa' then
    return new;
  end if;

  -- Sync CAPA implementation task completion back to capa_tasks.
  if new.task_type = 'capa_implementation_task' and new.capa_task_id is not null then
    if new.status in ('approved', 'complete', 'completed') then
      update public.capa_tasks
      set
        status = 'complete',
        completion_evidence = coalesce(new.approver_comment, new.comments, completion_evidence),
        completed_by = coalesce(new.signed_by, new.assigned_to_email, completed_by),
        completed_at = coalesce(new.signed_at, v_now),
        signature_meaning = coalesce(signature_meaning, 'CAPA implementation task completed from My Approval Tasks.')
      where id = new.capa_task_id;
    elsif new.status = 'rejected' then
      update public.capa_tasks
      set status = 'blocked'
      where id = new.capa_task_id;
    end if;

    return new;
  end if;

  if new.task_type = 'capa_initiation_approval' then
    v_gate := 'initiation';
  elsif new.task_type = 'capa_investigation_approval' then
    v_gate := 'investigation';
  elsif new.task_type = 'capa_action_plan_approval' then
    v_gate := 'action_plan';
  elsif new.task_type = 'capa_closure_approval' then
    v_gate := 'closure';
  else
    return new;
  end if;

  if new.status = 'rejected' then
    if v_gate = 'initiation' then
      update public.capas
      set initiation_approval_status = 'rejected',
          initiation_rejected_by = coalesce(new.signed_by, new.assigned_to_email),
          initiation_rejected_at = coalesce(new.signed_at, v_now),
          initiation_rejection_comments = coalesce(new.approver_comment, new.comments),
          status = 'initiation'
      where id = new.entity_id::uuid;
    elsif v_gate = 'investigation' then
      update public.capas
      set investigation_approval_status = 'rejected',
          investigation_rejected_by = coalesce(new.signed_by, new.assigned_to_email),
          investigation_rejected_at = coalesce(new.signed_at, v_now),
          investigation_rejection_comments = coalesce(new.approver_comment, new.comments),
          status = 'investigation'
      where id = new.entity_id::uuid;
    elsif v_gate = 'action_plan' then
      update public.capas
      set action_plan_approval_status = 'rejected',
          action_plan_rejected_by = coalesce(new.signed_by, new.assigned_to_email),
          action_plan_rejected_at = coalesce(new.signed_at, v_now),
          action_plan_rejection_comments = coalesce(new.approver_comment, new.comments),
          status = 'action_plan'
      where id = new.entity_id::uuid;
    elsif v_gate = 'closure' then
      update public.capas
      set closure_approval_status = 'rejected',
          closure_rejected_by = coalesce(new.signed_by, new.assigned_to_email),
          closure_rejected_at = coalesce(new.signed_at, v_now),
          closure_rejection_comments = coalesce(new.approver_comment, new.comments),
          status = 'effectiveness_review'
      where id = new.entity_id::uuid;
    end if;

    return new;
  end if;

  if new.status not in ('approved', 'complete', 'completed') then
    return new;
  end if;

  select count(*)
  into v_pending_required_count
  from public.approval_tasks
  where entity_type = 'capa'
    and entity_id = new.entity_id
    and task_type = new.task_type
    and coalesce(required, true) = true
    and status = 'pending';

  if v_pending_required_count > 0 then
    return new;
  end if;

  if v_gate = 'initiation' then
    update public.capas
    set initiation_approval_status = 'approved',
        initiation_approved_by = coalesce(new.signed_by, new.assigned_to_email),
        initiation_approved_at = coalesce(new.signed_at, v_now),
        initiation_approval_comments = coalesce(new.approver_comment, new.comments),
        status = 'evaluation'
    where id = new.entity_id::uuid;
  elsif v_gate = 'investigation' then
    update public.capas
    set investigation_approval_status = 'approved',
        investigation_approved_by = coalesce(new.signed_by, new.assigned_to_email),
        investigation_approved_at = coalesce(new.signed_at, v_now),
        investigation_approval_comments = coalesce(new.approver_comment, new.comments),
        status = 'action_plan'
    where id = new.entity_id::uuid;
  elsif v_gate = 'action_plan' then
    update public.capas
    set action_plan_approval_status = 'approved',
        action_plan_approved_by = coalesce(new.signed_by, new.assigned_to_email),
        action_plan_approved_at = coalesce(new.signed_at, v_now),
        action_plan_approval_comments = coalesce(new.approver_comment, new.comments),
        status = 'implementation'
    where id = new.entity_id::uuid;
  elsif v_gate = 'closure' then
    update public.capas
    set closure_approval_status = 'approved',
        closure_approved_by = coalesce(new.signed_by, new.assigned_to_email),
        closure_approved_at = coalesce(new.signed_at, v_now),
        closure_approval_comments = coalesce(new.approver_comment, new.comments),
        approved_by = coalesce(new.signed_by, new.assigned_to_email),
        approved_at = coalesce(new.signed_at, v_now),
        signed_by = coalesce(new.signed_by, new.assigned_to_email),
        signed_at = coalesce(new.signed_at, v_now),
        signature_meaning = 'I approve final CAPA closure and confirm the CAPA record is complete.',
        capa_signature_meaning = 'I approve final CAPA closure and confirm the CAPA record is complete.',
        capa_closed_by = coalesce(new.signed_by, new.assigned_to_email),
        closed_at = coalesce(new.signed_at, v_now),
        status = 'closed',
        is_locked = true,
        locked_by = coalesce(new.signed_by, new.assigned_to_email),
        locked_at = coalesce(new.signed_at, v_now)
    where id = new.entity_id::uuid;
  end if;

  return new;
end;
$$;


--
-- Name: user_has_qualisphere_permission(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_qualisphere_permission(p_user_email text, p_permission_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where lower(ur.user_email)=lower(trim(coalesce(p_user_email,'')))
      and lower(coalesce(ur.account_status,'active'))='active'
      and lower(coalesce(ur.role,'')) in ('admin','administrator')
  )
  or exists (
    select 1
    from public.user_security_roles usr
    join public.security_roles sr on sr.code=usr.role_code
    join public.user_roles ur on lower(ur.user_email)=lower(usr.user_email)
    where lower(usr.user_email)=lower(trim(coalesce(p_user_email,'')))
      and lower(coalesce(ur.account_status,'active'))='active'
      and sr.is_active is not false
      and sr.is_assignable is not false
      and (
        lower(coalesce(sr.permission_key,''))=lower(trim(coalesce(p_permission_key,'')))
        or lower(sr.code)=lower(trim(coalesce(p_permission_key,'')))
      )
  );
$$;


--
-- Name: approval_matrix_reviewers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_matrix_reviewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    reviewer_type text NOT NULL,
    reviewer_role text,
    reviewer_email text,
    required_reviewer boolean DEFAULT true,
    sequence_order integer DEFAULT 1,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    sla_days integer DEFAULT 5,
    escalation_role text,
    escalation_email text,
    approver_function text,
    tenant_id uuid NOT NULL
);


--
-- Name: COLUMN approval_matrix_reviewers.approver_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_matrix_reviewers.approver_function IS 'Organizational function represented by the reviewer, such as Quality, Engineering, Regulatory, or Operations.';


--
-- Name: approval_matrix_template_reviewers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_matrix_template_reviewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    reviewer_type text NOT NULL,
    reviewer_role text,
    reviewer_email text,
    required_reviewer boolean DEFAULT true,
    sequence_order integer DEFAULT 1,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_matrix_template_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_matrix_template_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    approver_email text,
    approver_role text,
    approval_order integer DEFAULT 1,
    is_required boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_email text,
    email text,
    reviewer_email text,
    role text,
    approval_role text,
    required_function text,
    display_order integer,
    sort_order integer,
    sequence integer,
    required boolean DEFAULT true
);


--
-- Name: approval_matrix_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_matrix_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name text NOT NULL,
    document_type text,
    department text,
    process_area text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    workflow_type text DEFAULT 'document_control'::text,
    auto_apply boolean DEFAULT false,
    description text,
    module_name text DEFAULT 'documents'::text,
    updated_at timestamp with time zone DEFAULT now(),
    name text,
    module text,
    is_active boolean DEFAULT true,
    tenant_id uuid NOT NULL
);


--
-- Name: audit_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid,
    finding_title text,
    finding_description text,
    finding_severity text,
    clause_reference text,
    evidence text,
    capa_required boolean DEFAULT false,
    capa_id uuid,
    finding_status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone,
    linked_scar_id uuid,
    linked_capa_id uuid,
    scar_evaluation_outcome text,
    capa_evaluation_outcome text,
    escalation_justification text,
    tenant_id uuid NOT NULL,
    finding_owner text,
    response_due_date date,
    auditee_response text,
    correction text,
    corrective_action text,
    verification_notes text,
    verified_by text,
    verified_at timestamp with time zone,
    finding_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    response_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    verification_draft_notes text,
    verification_draft_updated_at timestamp with time zone,
    response_draft_updated_at timestamp with time zone,
    response_cycle integer DEFAULT 1 NOT NULL,
    CONSTRAINT audit_findings_finding_severity_check CHECK (((finding_severity IS NULL) OR (finding_severity = ANY (ARRAY['observation'::text, 'minor'::text, 'major'::text]))))
);


--
-- Name: COLUMN audit_findings.finding_severity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_findings.finding_severity IS 'Audit finding classification. Controlled values: observation, minor, major.';


--
-- Name: COLUMN audit_findings.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_findings.tenant_id IS 'Company Account inherited from the parent audit.';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    entity_type text,
    entity_id uuid,
    action text,
    details text,
    created_at timestamp without time zone DEFAULT now(),
    user_email text,
    tenant_id uuid NOT NULL
);


--
-- Name: audit_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_number_counters (
    record_year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: audit_tenant_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_tenant_number_counters (
    tenant_id uuid NOT NULL,
    record_year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_number text,
    audit_title text NOT NULL,
    audit_type text,
    audit_scope text,
    auditor text,
    audit_date date,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone,
    closed_by text,
    signed_by text,
    signed_at timestamp without time zone,
    signature_meaning text,
    signature_email_entered text,
    is_locked boolean DEFAULT false,
    locked_at timestamp without time zone,
    locked_by text,
    tenant_id uuid NOT NULL,
    audit_objectives text,
    audit_criteria text,
    lead_auditor text,
    audit_team text,
    scheduled_start_date date,
    scheduled_end_date date,
    actual_start_date date,
    actual_end_date date,
    execution_notes text,
    closure_approval_status text DEFAULT 'not_submitted'::text,
    closure_approver_email text,
    closure_submitted_by text,
    closure_submitted_at timestamp with time zone,
    closure_decision_comment text,
    lead_auditor_email text,
    owner_email text,
    execution_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT audits_closure_approval_status_check CHECK ((closure_approval_status = ANY (ARRAY['not_submitted'::text, 'pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: COLUMN audits.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audits.tenant_id IS 'Company Account that owns this Audit Management record.';


--
-- Name: COLUMN audits.lead_auditor_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audits.lead_auditor_email IS 'QualiSphere user email designated to receive audit finding verification tasks.';


--
-- Name: COLUMN audits.owner_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audits.owner_email IS 'Authenticated QualiSphere user responsible for progressing the Audit workflow.';


--
-- Name: capa_approval_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capa_approval_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capa_id uuid NOT NULL,
    approval_gate text NOT NULL,
    approver_email text NOT NULL,
    approver_role text DEFAULT 'CAPA Approver'::text,
    task_status text DEFAULT 'pending'::text,
    is_required boolean DEFAULT true,
    approval_order integer DEFAULT 1,
    signature_meaning text,
    comments text,
    assigned_at timestamp with time zone DEFAULT now(),
    completed_by text,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: capa_gate_approvers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capa_gate_approvers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capa_id uuid NOT NULL,
    approval_gate text NOT NULL,
    approver_email text NOT NULL,
    approver_role text DEFAULT 'CAPA Approver'::text,
    approval_order integer DEFAULT 1,
    is_required boolean DEFAULT true,
    approval_status text DEFAULT 'configured'::text,
    source_template_id uuid,
    signature_meaning text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approver_function text,
    approver_job_title text,
    approver_due_date date
);


--
-- Name: COLUMN capa_gate_approvers.approver_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capa_gate_approvers.approver_function IS 'Organizational function represented by the approver, such as Quality, Operations, or Regulatory Affairs.';


--
-- Name: COLUMN capa_gate_approvers.approver_job_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capa_gate_approvers.approver_job_title IS 'Company-defined job title/function authority used for the approval, such as Quality Manager or Regulatory Affairs Manager.';


--
-- Name: COLUMN capa_gate_approvers.approver_due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capa_gate_approvers.approver_due_date IS 'Due date assigned by CAPA owner for completion of the approval assignment.';


--
-- Name: capa_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capa_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capa_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capa_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capa_id uuid NOT NULL,
    task_type text,
    task_title text NOT NULL,
    task_description text,
    owner text,
    due_date date,
    status text DEFAULT 'open'::text,
    completion_evidence text,
    completed_by text,
    completed_at timestamp with time zone,
    signature_meaning text,
    sequence_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    owner_email text
);


--
-- Name: capa_tenant_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capa_tenant_number_counters (
    tenant_id uuid NOT NULL,
    last_number bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT capa_tenant_number_counters_last_number_check CHECK ((last_number >= 0))
);


--
-- Name: capa_workflow_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capa_workflow_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capa_id uuid NOT NULL,
    capa_number text,
    from_status text,
    target_phase text NOT NULL,
    rationale text NOT NULL,
    returned_by text NOT NULL,
    returned_at timestamp with time zone DEFAULT now() NOT NULL,
    signature_meaning text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: capas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capas (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    ncmr_id uuid,
    title text,
    status text DEFAULT 'open'::text,
    action_plan text,
    effectiveness_check text,
    created_at timestamp without time zone DEFAULT now(),
    due_date date,
    owner text,
    linked_ncmr_title text,
    approved_by text,
    approved_at timestamp without time zone,
    closed_at timestamp without time zone,
    evidence_url text,
    evidence_notes text,
    signature_meaning text,
    signed_by text,
    signed_at timestamp without time zone,
    problem_description text,
    investigation_summary text,
    root_cause text,
    corrective_action_plan text,
    implementation_details text,
    implemented_by text,
    implemented_at timestamp without time zone,
    capa_closed_by text,
    capa_signature_meaning text,
    source_type text DEFAULT 'direct'::text,
    capa_source text,
    effectiveness_due_date date,
    effectiveness_rating text,
    effectiveness_followup_action text,
    followup_capa_id uuid,
    capa_type text DEFAULT 'internal_capa'::text,
    supplier_name text,
    scar_required boolean DEFAULT false,
    scar_reason text,
    capa_number text,
    root_cause_category text,
    is_locked boolean DEFAULT false,
    locked_at timestamp without time zone,
    locked_by text,
    source_audit_finding_id uuid,
    linked_audit_id uuid,
    investigation_approval_status text DEFAULT 'not_submitted'::text,
    investigation_submitted_at timestamp with time zone,
    investigation_submitted_by text,
    investigation_approved_by text,
    investigation_approved_at timestamp with time zone,
    investigation_approval_comments text,
    investigation_rejected_by text,
    investigation_rejected_at timestamp with time zone,
    investigation_rejection_comments text,
    closure_approval_status text DEFAULT 'not_submitted'::text,
    closure_submitted_at timestamp with time zone,
    closure_submitted_by text,
    closure_approved_by text,
    closure_approved_at timestamp with time zone,
    closure_approval_comments text,
    closure_rejected_by text,
    closure_rejected_at timestamp with time zone,
    closure_rejection_comments text,
    closure_signature_meaning text,
    detection_source text,
    investigation_objective text,
    evidence_reviewed text,
    investigation_findings text,
    root_cause_method text,
    containment_correction text,
    verification_method text,
    procedure_updated text,
    supplier_risk text,
    effectiveness_plan text,
    severity text,
    risk_assessment text,
    risk_level text,
    patient_safety_impact text,
    product_quality_impact text,
    regulatory_impact text,
    risk_rationale text,
    scope_summary text,
    affected_product text,
    affected_lot text,
    affected_process text,
    affected_supplier text,
    potential_impact text,
    containment_action text,
    containment_owner text,
    containment_complete text,
    containment_residual_risk text,
    investigation_conclusion text,
    contributing_factors text,
    root_cause_verification text,
    systemic_impact text,
    occurrence_rating text,
    detection_rating text,
    capa_classification text,
    action_owner text,
    action_due_date date,
    training_required text,
    validation_required text,
    implementation_evidence text,
    monitoring_method text,
    monitoring_period text,
    recurrence_detected text,
    followup_capa_required text,
    cancel_reason text,
    cancellation_justification text,
    cancelled_by text,
    cancelled_at timestamp with time zone,
    corrective_action text,
    owner_email text,
    investigation_approver_email text,
    closure_approver_email text,
    effectiveness_result text,
    created_by text,
    capa_justification text,
    product_impact text,
    process_impact text,
    interim_controls_required text,
    no_interim_controls_justification text,
    risk_assessment_method text DEFAULT 'automatic'::text,
    risk_override_enabled boolean DEFAULT false,
    risk_override_level text,
    risk_override_justification text,
    initiation_approval_status text DEFAULT 'not_submitted'::text,
    initiation_submitted_by text,
    initiation_submitted_at timestamp with time zone,
    initiation_approved_by text,
    initiation_approved_at timestamp with time zone,
    initiation_approval_comments text,
    initiation_rejected_by text,
    initiation_rejected_at timestamp with time zone,
    initiation_rejection_comments text,
    action_plan_approval_status text DEFAULT 'not_submitted'::text,
    action_plan_submitted_by text,
    action_plan_submitted_at timestamp with time zone,
    action_plan_approved_by text,
    action_plan_approved_at timestamp with time zone,
    action_plan_approval_comments text,
    action_plan_rejected_by text,
    action_plan_rejected_at timestamp with time zone,
    action_plan_rejection_comments text,
    required_resources text,
    required_evidence text,
    effectiveness_success_criteria text,
    effectiveness_data_to_collect text,
    effectiveness_sample_size text,
    verification_owner text,
    verification_due_date date,
    required_objective_evidence text,
    initiation_approval_matrix_id uuid,
    investigation_approval_matrix_id uuid,
    action_plan_approval_matrix_id uuid,
    closure_approval_matrix_id uuid,
    problem_statement text,
    implementation text,
    investigation text,
    effectiveness_plan_approval_status text DEFAULT 'not_submitted'::text,
    effectiveness_plan_submitted_by text,
    effectiveness_plan_submitted_at timestamp with time zone,
    effectiveness_plan_approved_by text,
    effectiveness_plan_approved_at timestamp with time zone,
    effectiveness_plan_approval_comments text,
    effectiveness_plan_rejected_by text,
    effectiveness_plan_rejected_at timestamp with time zone,
    effectiveness_plan_rejection_comments text,
    effectiveness_plan_approval_matrix_id uuid,
    workflow_returned_by text,
    workflow_returned_at timestamp with time zone,
    workflow_return_target text,
    workflow_return_reason text,
    implementation_evidence_file_name text,
    implementation_evidence_file_path text,
    implementation_evidence_file_url text,
    initiation_supporting_evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    root_cause_supporting_evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    implementation_approval_status text DEFAULT 'not_submitted'::text,
    implementation_submitted_by text,
    implementation_submitted_at timestamp with time zone,
    implementation_approved_by text,
    implementation_approved_at timestamp with time zone,
    implementation_approval_comments text,
    implementation_rejected_by text,
    implementation_rejected_at timestamp with time zone,
    implementation_rejection_comments text,
    implementation_approval_matrix_id uuid,
    tenant_id uuid NOT NULL
);


--
-- Name: COLUMN capas.risk_assessment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.risk_assessment_method IS 'CAPA risk method: automatic or manual.';


--
-- Name: COLUMN capas.initiation_approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.initiation_approval_status IS 'CAPA v2 initiation approval gate status.';


--
-- Name: COLUMN capas.action_plan_approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.action_plan_approval_status IS 'CAPA v2 action plan approval gate status.';


--
-- Name: COLUMN capas.effectiveness_plan_approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.effectiveness_plan_approval_status IS 'Approval status for CAPA effectiveness plan approval gate.';


--
-- Name: COLUMN capas.effectiveness_plan_approval_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.effectiveness_plan_approval_comments IS 'Approver comments for the CAPA effectiveness plan approval gate.';


--
-- Name: COLUMN capas.initiation_supporting_evidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.initiation_supporting_evidence IS 'Optional multiple-file supporting evidence attached during CAPA Initiation.';


--
-- Name: COLUMN capas.root_cause_supporting_evidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capas.root_cause_supporting_evidence IS 'Optional multiple-file supporting evidence attached during Root Cause Determination.';


--
-- Name: change_control_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_control_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_control_id uuid,
    document_number text,
    document_title text,
    current_revision text,
    proposed_revision text,
    change_description text,
    created_at timestamp with time zone DEFAULT now(),
    controlled_document_id uuid,
    document_status text DEFAULT 'draft'::text,
    training_required boolean DEFAULT false,
    training_completed boolean DEFAULT false,
    effective_date date,
    released_by text,
    released_at timestamp with time zone,
    cancelled boolean DEFAULT false,
    cancelled_by text,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    tenant_id uuid NOT NULL
);


--
-- Name: change_control_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_control_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_control_id uuid,
    product_part_number text,
    product_name text,
    lot_or_serial_scope text,
    impact_description text,
    created_at timestamp with time zone DEFAULT now(),
    product_disposition text,
    product_disposition_rationale text,
    product_disposition_owner_email text,
    product_disposition_date date,
    product_disposition_status text DEFAULT 'pending_disposition'::text,
    product_dispositioned_by text,
    product_dispositioned_at timestamp with time zone,
    tenant_id uuid NOT NULL
);


--
-- Name: change_control_reviewers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_control_reviewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_control_id uuid,
    reviewer_type text DEFAULT 'approver'::text NOT NULL,
    reviewer_role text,
    reviewer_email text,
    required_reviewer boolean DEFAULT true,
    sequence_order integer DEFAULT 1,
    review_status text DEFAULT 'pending'::text,
    review_comments text,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    assigned_by text,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: change_control_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_control_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_control_id uuid,
    task_title text NOT NULL,
    task_description text,
    owner_email text,
    due_date date,
    status text DEFAULT 'open'::text,
    completed_at timestamp with time zone,
    completed_by text,
    completion_evidence text,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    completion_summary text,
    cancelled boolean DEFAULT false,
    cancelled_by text,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    tenant_id uuid NOT NULL
);


--
-- Name: change_control_tenant_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_control_tenant_number_counters (
    tenant_id uuid NOT NULL,
    calendar_year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: change_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_number text,
    change_title text NOT NULL,
    change_description text NOT NULL,
    change_justification text NOT NULL,
    change_type text DEFAULT 'ECO'::text,
    change_category text DEFAULT 'Process'::text,
    priority text DEFAULT 'Medium'::text,
    status text DEFAULT 'draft'::text,
    initiator_email text,
    owner_email text,
    approver_email text,
    affected_process text,
    affected_equipment text,
    affected_supplier text,
    affected_software text,
    impact_assessment text,
    product_impact boolean DEFAULT false,
    document_impact boolean DEFAULT false,
    process_impact boolean DEFAULT false,
    equipment_impact boolean DEFAULT false,
    supplier_impact boolean DEFAULT false,
    software_impact boolean DEFAULT false,
    regulatory_impact boolean DEFAULT false,
    validation_impact boolean DEFAULT false,
    training_impact boolean DEFAULT false,
    risk_level text DEFAULT 'Medium'::text,
    risk_review_summary text,
    risk_acceptability text,
    residual_risk text,
    implementation_plan text,
    implementation_owner_email text,
    target_implementation_date date,
    actual_implementation_date date,
    verification_plan text,
    verification_result text,
    effectiveness_required boolean DEFAULT false,
    effectiveness_plan text,
    effectiveness_result text,
    submitted_at timestamp with time zone,
    submitted_by text,
    approved_at timestamp with time zone,
    approved_by text,
    approval_comments text,
    closure_summary text,
    closed_at timestamp with time zone,
    closed_by text,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone DEFAULT now(),
    documents_effective boolean DEFAULT false,
    training_complete boolean DEFAULT false,
    implementation_complete boolean DEFAULT false,
    closure_block_reason text,
    product_impact_summary text,
    document_impact_summary text,
    process_impact_summary text,
    equipment_impact_summary text,
    supplier_impact_summary text,
    software_impact_summary text,
    regulatory_impact_summary text,
    validation_impact_summary text,
    training_impact_summary text,
    verification_summary text,
    verified_by text,
    verified_at timestamp with time zone,
    closure_approved_by text,
    closure_approved_at timestamp with time zone,
    closure_approval_comments text,
    closure_signature_id uuid,
    change_origin text DEFAULT 'N/A'::text,
    originating_record_number text,
    closure_decision text,
    closure_decision_reason text,
    cancelled_at timestamp with time zone,
    cancelled_by text,
    tenant_id uuid NOT NULL
);


--
-- Name: collaboration_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboration_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    comment_text text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tagged_users jsonb,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT collaboration_comments_attachments_array CHECK ((jsonb_typeof(attachments) = 'array'::text)),
    CONSTRAINT collaboration_comments_tagged_users_array CHECK (((tagged_users IS NULL) OR (jsonb_typeof(tagged_users) = 'array'::text)))
);


--
-- Name: collaboration_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboration_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_email text NOT NULL,
    assigned_role text,
    status text DEFAULT 'active'::text NOT NULL,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT collaboration_participants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'removed'::text])))
);


--
-- Name: collaboration_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboration_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    record_id uuid NOT NULL,
    record_number text,
    subject text,
    status text DEFAULT 'open'::text NOT NULL,
    due_date date,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by text,
    resolved_at timestamp with time zone,
    resolution_summary text,
    CONSTRAINT collaboration_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'cancelled'::text])))
);


--
-- Name: company_dashboard_kpi_configuration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_dashboard_kpi_configuration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    module_name text NOT NULL,
    kpi_key text NOT NULL,
    executive_dashboard boolean DEFAULT false,
    management_review boolean DEFAULT false,
    display_order integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text DEFAULT 'Default Company'::text,
    enable_notifications boolean DEFAULT true,
    enable_overdue_scan boolean DEFAULT true,
    enable_task_sla_dashboard boolean DEFAULT true,
    enable_escalation_dashboard boolean DEFAULT true,
    enable_email_notifications boolean DEFAULT false,
    overdue_scan_mode text DEFAULT 'manual'::text,
    notification_default_frequency text DEFAULT 'immediate'::text,
    overdue_bucket_1 integer DEFAULT 7,
    overdue_bucket_2 integer DEFAULT 14,
    overdue_bucket_3 integer DEFAULT 30,
    allow_users_to_override_preferences boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    timezone text DEFAULT 'America/Chicago'::text NOT NULL
);


--
-- Name: COLUMN company_settings.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_settings.timezone IS 'IANA timezone used to render user-facing workflow, approval, task, audit, and report timestamps for the tenant. Canonical database timestamps remain UTC.';


--
-- Name: complaint_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaint_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_id uuid,
    action text NOT NULL,
    details text,
    user_email text,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: complaint_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaint_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_id uuid,
    file_name text,
    file_url text,
    uploaded_by text,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: complaint_quality_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaint_quality_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_id uuid,
    linked_module text NOT NULL,
    linked_record_id uuid NOT NULL,
    linked_record_number text,
    link_reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_number text,
    complaint_title text NOT NULL,
    complaint_description text,
    date_received date DEFAULT CURRENT_DATE,
    received_by text,
    source text,
    customer_name text,
    customer_organization text,
    customer_email text,
    customer_phone text,
    country text,
    product_family text,
    product_name text,
    part_number text,
    lot_number text,
    serial_number text,
    manufacturing_date date,
    expiration_date date,
    returned_product_available boolean DEFAULT false,
    severity text DEFAULT 'minor'::text,
    potential_patient_impact boolean DEFAULT false,
    potential_safety_issue boolean DEFAULT false,
    status text DEFAULT 'intake'::text,
    investigator text,
    investigation_summary text,
    complaint_confirmed boolean,
    root_cause_category text,
    root_cause_summary text,
    mdr_assessment_required boolean DEFAULT false,
    regulatory_assessment text DEFAULT 'pending'::text,
    regulatory_assessment_rationale text,
    complaint_valid boolean,
    ncmr_required boolean DEFAULT false,
    capa_required boolean DEFAULT false,
    scar_required boolean DEFAULT false,
    change_control_required boolean DEFAULT false,
    linked_ncmr_id uuid,
    linked_capa_id uuid,
    linked_scar_id uuid,
    linked_change_control_id uuid,
    customer_response_required boolean DEFAULT false,
    customer_response_sent boolean DEFAULT false,
    customer_response_date date,
    closure_summary text,
    closed_by text,
    closed_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: controlled_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.controlled_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_number text NOT NULL,
    title text NOT NULL,
    document_type text DEFAULT 'SOP'::text,
    revision text DEFAULT 'A'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    department text,
    process_area text,
    file_name text,
    file_path text,
    file_url text,
    change_summary text,
    approval_comments text,
    owner_email text,
    approver_email text,
    submitted_for_approval_at timestamp with time zone,
    submitted_for_approval_by text,
    approved_at timestamp with time zone,
    approved_by text,
    effective_date date,
    obsolete_at timestamp with time zone,
    obsolete_by text,
    obsolete_reason text,
    read_ack_required boolean DEFAULT true,
    training_required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone DEFAULT now(),
    originating_change_control_id uuid,
    change_required boolean DEFAULT false,
    superseded_by_document_id uuid,
    superseded_document_id uuid,
    collaboration_required boolean DEFAULT true,
    formal_review_required boolean DEFAULT true,
    collaboration_completed boolean DEFAULT false,
    formal_review_completed boolean DEFAULT false,
    release_comments text,
    release_approved_by text,
    release_approved_at timestamp with time zone,
    approval_matrix_template_id uuid,
    working_file_name text,
    working_file_url text,
    collaboration_cycle integer DEFAULT 1,
    last_reviewer_feedback text,
    change_rationale text,
    controlled_copy_file_name text,
    controlled_copy_file_path text,
    controlled_copy_file_url text,
    controlled_copy_generated_at timestamp with time zone,
    controlled_copy_generated_by text,
    release_pdf_file_name text,
    release_pdf_file_path text,
    release_pdf_file_url text,
    training_impact text,
    revision_change_description text,
    revision_change_justification text,
    tenant_id uuid NOT NULL,
    is_initial_release boolean,
    dci_id uuid
);


--
-- Name: custom_kpi_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_kpi_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    module_name text NOT NULL,
    kpi_key text NOT NULL,
    kpi_name text NOT NULL,
    kpi_description text,
    kpi_category text,
    data_source text NOT NULL,
    calculation_type text NOT NULL,
    filter_field text,
    filter_operator text,
    filter_value text,
    display_type text DEFAULT 'card'::text,
    executive_dashboard boolean DEFAULT false,
    management_review boolean DEFAULT false,
    display_order integer DEFAULT 100,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    validation_status text DEFAULT 'valid'::text,
    validation_message text,
    last_calculated_at timestamp with time zone,
    last_calculation_status text,
    last_calculation_message text,
    age_date_field text DEFAULT 'created_at'::text,
    close_date_field text DEFAULT 'closed_at'::text,
    target_days integer,
    start_date_field text,
    end_date_field text,
    tenant_id uuid NOT NULL
);


--
-- Name: customer_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    role_id uuid NOT NULL,
    permission_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text
);


--
-- Name: customer_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    role_name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: dashboard_kpi_configuration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_kpi_configuration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_name text NOT NULL,
    kpi_key text NOT NULL,
    executive_dashboard boolean DEFAULT false,
    management_review boolean DEFAULT false,
    display_order integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dci_pdf_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dci_pdf_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    dci_id uuid NOT NULL,
    document_id uuid NOT NULL,
    pdf_storage_path text NOT NULL,
    verified_by_email text NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    verification_comment text NOT NULL
);


--
-- Name: document_acknowledgements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_acknowledgements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    user_email text NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now(),
    acknowledgement_meaning text DEFAULT 'I have read and understood this controlled document.'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_assigned_reviewers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_assigned_reviewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    reviewer_type text NOT NULL,
    reviewer_email text NOT NULL,
    reviewer_role text,
    required_reviewer boolean DEFAULT true,
    decision text DEFAULT 'pending'::text,
    decision_comments text,
    decision_date timestamp with time zone,
    review_sequence integer DEFAULT 1,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now(),
    review_status text DEFAULT 'pending'::text,
    review_comments text,
    reviewed_at timestamp with time zone,
    reviewer_name text,
    reviewer_department text,
    reviewed_file_name text,
    reviewed_file_path text,
    reviewed_file_url text
);


--
-- Name: document_change_document_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_change_document_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    dci_id uuid NOT NULL,
    document_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    uploaded_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_change_initiation_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_change_initiation_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    dci_id uuid NOT NULL,
    document_id uuid NOT NULL,
    change_type text NOT NULL,
    source_document_id uuid,
    sequence_no integer DEFAULT 1 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_change_initiation_documents_change_type_check CHECK ((change_type = ANY (ARRAY['new'::text, 'revision'::text, 'reinstatement'::text])))
);


--
-- Name: TABLE document_change_initiation_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_change_initiation_documents IS 'Affected controlled documents within a DCI. Each document retains its own impact assessment and downstream requirements.';


--
-- Name: document_change_initiations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_change_initiations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    dci_number text NOT NULL,
    title text,
    change_description text NOT NULL,
    change_justification text NOT NULL,
    owner_email text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    release_strategy text DEFAULT 'coordinated'::text NOT NULL,
    originating_change_control_id uuid,
    withdrawn_reason text,
    withdrawn_by text,
    withdrawn_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_change_initiations_release_strategy_check CHECK ((release_strategy = ANY (ARRAY['coordinated'::text, 'independent'::text]))),
    CONSTRAINT document_change_initiations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'collaboration'::text, 'document_control_review'::text, 'administrative_review'::text, 'formal_review'::text, 'approved'::text, 'implementation'::text, 'post_approval'::text, 'release_ready'::text, 'released'::text, 'withdrawn'::text])))
);


--
-- Name: TABLE document_change_initiations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_change_initiations IS 'Parent Document Change Initiation (DCI) package. Collaboration and formal approval occur at this package level.';


--
-- Name: document_change_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_change_number_counters (
    tenant_id uuid NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_collaboration_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_collaboration_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    reviewer_email text NOT NULL,
    review_status text DEFAULT 'pending'::text,
    review_comments text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    uploaded_review_file_name text,
    uploaded_review_file_url text,
    uploaded_redline_file_name text,
    uploaded_redline_file_url text,
    review_cycle integer DEFAULT 1,
    reviewed_file_name text,
    reviewed_file_path text,
    reviewed_file_url text
);


--
-- Name: document_formal_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_formal_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    reviewer_email text NOT NULL,
    review_role text,
    review_status text DEFAULT 'pending'::text,
    review_comments text,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    decision text DEFAULT 'pending'::text,
    uploaded_review_file_name text,
    uploaded_review_file_url text,
    reviewed_file_name text,
    reviewed_file_path text,
    reviewed_file_url text
);


--
-- Name: document_impact_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_impact_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    impact_area text NOT NULL,
    is_impacted boolean,
    assessment text,
    disposition_required boolean DEFAULT false NOT NULL,
    disposition_summary text,
    assessed_by text,
    assessed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_number_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_number_sequences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type text NOT NULL,
    prefix text NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    padding integer DEFAULT 4 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: document_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_document_id uuid NOT NULL,
    related_document_id uuid NOT NULL,
    relationship_type text DEFAULT 'related'::text NOT NULL,
    relationship_reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_training_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_training_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    user_email text NOT NULL,
    status text DEFAULT 'assigned'::text,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by text,
    completed_at timestamp with time zone,
    completed_by text,
    training_meaning text DEFAULT 'Training completed for the assigned controlled document.'::text,
    created_at timestamp with time zone DEFAULT now(),
    document_file_name text,
    document_file_url text
);


--
-- Name: document_training_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_training_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    impact_assessment_id uuid,
    training_method_id uuid NOT NULL,
    rationale text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_workflow_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_workflow_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    event_type text NOT NULL,
    performed_by text,
    performed_at timestamp with time zone DEFAULT now(),
    from_status text,
    to_status text,
    comments text,
    metadata jsonb
);


--
-- Name: electronic_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.electronic_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_name text NOT NULL,
    record_id uuid NOT NULL,
    action_type text NOT NULL,
    signed_by text NOT NULL,
    signer_role text,
    signature_meaning text NOT NULL,
    signature_reason text,
    signed_at timestamp with time zone DEFAULT now(),
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    full_name text,
    department text,
    role_name text,
    manager_email text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_number text NOT NULL,
    number_source text NOT NULL,
    equipment_name text NOT NULL,
    equipment_type text,
    manufacturer text,
    model_number text,
    serial_number text,
    asset_number text,
    department text,
    site_location text,
    owner_email text,
    description text,
    specification_document_number text,
    specification_document_id uuid,
    specification_revision text,
    calibration_required boolean DEFAULT false NOT NULL,
    preventive_maintenance_required boolean DEFAULT false NOT NULL,
    qualification_required boolean DEFAULT false NOT NULL,
    post_unplanned_maintenance_assessment text DEFAULT 'optional'::text NOT NULL,
    lifecycle_status text DEFAULT 'draft'::text NOT NULL,
    use_status text DEFAULT 'out_of_service'::text NOT NULL,
    use_status_reason text,
    released_at timestamp with time zone,
    released_by text,
    retired_at timestamp with time zone,
    retired_by text,
    retirement_reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lifecycle_phase text DEFAULT 'acquisition'::text NOT NULL,
    equipment_status text DEFAULT 'pending_installation'::text NOT NULL,
    record_status text DEFAULT 'draft'::text NOT NULL,
    CONSTRAINT equipment_equipment_status_check CHECK ((equipment_status = ANY (ARRAY['pending_installation'::text, 'pending_calibration'::text, 'pending_qualification'::text, 'pending_maintenance'::text, 'pending_production_release'::text, 'active'::text, 'retired'::text]))),
    CONSTRAINT equipment_lifecycle_phase_check CHECK ((lifecycle_phase = ANY (ARRAY['planning'::text, 'acquisition'::text, 'operation_maintenance'::text, 'retirement'::text]))),
    CONSTRAINT equipment_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['draft'::text, 'specification_reference'::text, 'initial_calibration'::text, 'qualification'::text, 'pending_production_release'::text, 'released'::text, 'retired'::text]))),
    CONSTRAINT equipment_number_source_check CHECK ((number_source = ANY (ARRAY['customer_assigned'::text, 'qualisphere_generated'::text]))),
    CONSTRAINT equipment_post_unplanned_maintenance_assessment_check CHECK ((post_unplanned_maintenance_assessment = ANY (ARRAY['required'::text, 'optional'::text, 'disabled'::text]))),
    CONSTRAINT equipment_record_status_check CHECK ((record_status = ANY (ARRAY['draft'::text, 'pending_release'::text, 'released'::text, 'returned'::text, 'retired'::text]))),
    CONSTRAINT equipment_use_status_check CHECK ((use_status = ANY (ARRAY['available_for_use'::text, 'restricted'::text, 'out_of_service'::text, 'retired'::text])))
);


--
-- Name: TABLE equipment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment IS 'QualiSphere Equipment Master. tenant_id is included for tenant-scoped RLS.';


--
-- Name: COLUMN equipment.lifecycle_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment.lifecycle_status IS 'Legacy Equipment v1 field retained temporarily for backward compatibility. New UI uses lifecycle_phase and equipment_status.';


--
-- Name: COLUMN equipment.lifecycle_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment.lifecycle_phase IS 'Overall asset lifecycle: Planning, Acquisition, Operation & Maintenance, Retirement.';


--
-- Name: COLUMN equipment.equipment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment.equipment_status IS 'Current equipment workflow/readiness status, separate from lifecycle phase and use status.';


--
-- Name: COLUMN equipment.record_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment.record_status IS 'Governance status of the Equipment Master; separate from lifecycle phase, equipment status, and use status.';


--
-- Name: equipment_calibration_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_calibration_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    calibration_number text NOT NULL,
    equipment_id uuid NOT NULL,
    schedule_configuration_id uuid,
    event_source text DEFAULT 'scheduled'::text NOT NULL,
    nominal_due_date date,
    scheduled_date date,
    hard_due_date date,
    procedure_document_id uuid,
    procedure_document_number text,
    procedure_title text,
    procedure_revision text,
    performed_date date,
    provider_type text,
    provider_name text,
    performed_by text,
    certificate_number text,
    certificate_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    comments text,
    result text,
    oos_oot_id uuid,
    review_requirement text DEFAULT 'optional'::text NOT NULL,
    review_status text DEFAULT 'not_required'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    review_comment text,
    next_nominal_due_date date,
    next_scheduled_date date,
    next_hard_due_date date,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_calibration_events_event_source_check CHECK ((event_source = ANY (ARRAY['scheduled'::text, 'manual'::text, 'post_maintenance'::text, 'other'::text]))),
    CONSTRAINT equipment_calibration_events_provider_type_check CHECK (((provider_type IS NULL) OR (provider_type = ANY (ARRAY['internal'::text, 'external'::text])))),
    CONSTRAINT equipment_calibration_events_result_check CHECK (((result IS NULL) OR (result = ANY (ARRAY['pass'::text, 'oot'::text, 'oos'::text])))),
    CONSTRAINT equipment_calibration_events_review_requirement_check CHECK ((review_requirement = ANY (ARRAY['required'::text, 'optional'::text, 'disabled'::text]))),
    CONSTRAINT equipment_calibration_events_review_status_check CHECK ((review_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT equipment_calibration_events_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'review'::text, 'completed'::text, 'overdue'::text, 'cancelled'::text])))
);


--
-- Name: TABLE equipment_calibration_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_calibration_events IS 'Permanent calibration event history; results include Pass/OOT/OOS.';


--
-- Name: equipment_change_control_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_change_control_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    change_control_id uuid NOT NULL,
    relationship_note text,
    linked_by text,
    linked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: equipment_schedule_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_schedule_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    activity_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    frequency_value integer NOT NULL,
    frequency_unit text NOT NULL,
    schedule_mode text DEFAULT 'fixed'::text NOT NULL,
    nominal_due_date date,
    scheduled_service_date date,
    hard_due_date date,
    early_window_days integer DEFAULT 0 NOT NULL,
    late_window_days integer DEFAULT 0 NOT NULL,
    equipment_family text,
    max_events_per_day integer,
    max_events_per_week integer,
    provider_type text,
    provider_name text,
    procedure_document_id uuid,
    procedure_document_number text,
    procedure_revision text,
    overdue_use_action text DEFAULT 'notification_only'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_schedule_configurations_activity_type_check CHECK ((activity_type = ANY (ARRAY['calibration'::text, 'preventive_maintenance'::text]))),
    CONSTRAINT equipment_schedule_configurations_check CHECK (((schedule_mode = 'fixed'::text) OR (hard_due_date IS NOT NULL))),
    CONSTRAINT equipment_schedule_configurations_early_window_days_check CHECK ((early_window_days >= 0)),
    CONSTRAINT equipment_schedule_configurations_frequency_unit_check CHECK ((frequency_unit = ANY (ARRAY['days'::text, 'weeks'::text, 'months'::text, 'years'::text]))),
    CONSTRAINT equipment_schedule_configurations_frequency_value_check CHECK ((frequency_value > 0)),
    CONSTRAINT equipment_schedule_configurations_late_window_days_check CHECK ((late_window_days >= 0)),
    CONSTRAINT equipment_schedule_configurations_max_events_per_day_check CHECK (((max_events_per_day IS NULL) OR (max_events_per_day > 0))),
    CONSTRAINT equipment_schedule_configurations_max_events_per_week_check CHECK (((max_events_per_week IS NULL) OR (max_events_per_week > 0))),
    CONSTRAINT equipment_schedule_configurations_overdue_use_action_check CHECK ((overdue_use_action = ANY (ARRAY['notification_only'::text, 'restricted'::text, 'out_of_service'::text]))),
    CONSTRAINT equipment_schedule_configurations_provider_type_check CHECK (((provider_type IS NULL) OR (provider_type = ANY (ARRAY['internal'::text, 'external'::text])))),
    CONSTRAINT equipment_schedule_configurations_schedule_mode_check CHECK ((schedule_mode = ANY (ARRAY['fixed'::text, 'flexible'::text])))
);


--
-- Name: TABLE equipment_schedule_configurations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_schedule_configurations IS 'Recurring calibration/PM requirements and Fixed/Flexible scheduling configuration.';


--
-- Name: equipment_current_schedule_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.equipment_current_schedule_status WITH (security_invoker='true') AS
 SELECT e.tenant_id,
    e.id AS equipment_id,
    e.equipment_number,
    e.equipment_name,
    e.lifecycle_status,
    e.use_status,
    sc.id AS schedule_configuration_id,
    sc.activity_type,
    sc.schedule_mode,
    sc.nominal_due_date,
    sc.scheduled_service_date,
    sc.hard_due_date,
        CASE
            WHEN (sc.is_active IS NOT TRUE) THEN 'inactive'::text
            WHEN ((sc.hard_due_date IS NOT NULL) AND (CURRENT_DATE > sc.hard_due_date)) THEN 'overdue'::text
            WHEN (sc.scheduled_service_date = CURRENT_DATE) THEN 'due_today'::text
            WHEN ((sc.scheduled_service_date IS NOT NULL) AND (sc.scheduled_service_date <= (CURRENT_DATE + 7))) THEN 'due_soon'::text
            ELSE 'upcoming'::text
        END AS schedule_status
   FROM (public.equipment e
     JOIN public.equipment_schedule_configurations sc ON ((sc.equipment_id = e.id)));


--
-- Name: equipment_event_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_event_number_counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    prefix text NOT NULL,
    sequence_padding integer DEFAULT 6 NOT NULL,
    next_sequence bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_event_number_counters_event_type_check CHECK ((event_type = ANY (ARRAY['calibration'::text, 'maintenance'::text, 'qualification'::text]))),
    CONSTRAINT equipment_event_number_counters_next_sequence_check CHECK ((next_sequence >= 1)),
    CONSTRAINT equipment_event_number_counters_sequence_padding_check CHECK (((sequence_padding >= 1) AND (sequence_padding <= 12)))
);


--
-- Name: equipment_governance_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_governance_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_email text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_governance_members_role_check CHECK ((role = ANY (ARRAY['viewer'::text, 'coordinator'::text, 'quality_approver'::text, 'admin'::text])))
);


--
-- Name: TABLE equipment_governance_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_governance_members IS 'Tenant-level Equipment permissions. Viewer is read-only; Coordinator maintains records; Quality Approver controls Equipment Record Release; Admin has full Equipment governance access.';


--
-- Name: equipment_import_batch_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_import_batch_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    batch_number text NOT NULL,
    source_file_name text NOT NULL,
    source_file_path text,
    status text DEFAULT 'draft'::text NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    ready_rows integer DEFAULT 0 NOT NULL,
    warning_rows integer DEFAULT 0 NOT NULL,
    error_rows integer DEFAULT 0 NOT NULL,
    submitted_by text,
    submitted_at timestamp with time zone,
    approver_email text,
    approved_by text,
    approved_at timestamp with time zone,
    approval_comment text,
    committed_by text,
    committed_at timestamp with time zone,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_import_batches_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'validated'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text, 'committed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE equipment_import_batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_import_batches IS 'Governed Equipment migration batches. Batch approval accepts migration accuracy; it does not release rows whose imported state is Not Yet Released.';


--
-- Name: equipment_import_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_import_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    row_number integer NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    normalized_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    validation_messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    equipment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_import_rows_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'ready'::text, 'warning'::text, 'error'::text, 'committed'::text])))
);


--
-- Name: TABLE equipment_import_rows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_import_rows IS 'Staged and validated Equipment spreadsheet rows prior to controlled commit into Equipment Master.';


--
-- Name: equipment_maintenance_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_maintenance_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    maintenance_event_id uuid NOT NULL,
    component_description text NOT NULL,
    part_number text,
    serial_or_lot_number text,
    quantity numeric,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: equipment_maintenance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_maintenance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    maintenance_number text NOT NULL,
    equipment_id uuid NOT NULL,
    schedule_configuration_id uuid,
    maintenance_type text NOT NULL,
    nominal_due_date date,
    scheduled_date date,
    hard_due_date date,
    procedure_document_id uuid,
    procedure_document_number text,
    procedure_title text,
    procedure_revision text,
    performed_date date,
    performed_by text,
    provider_type text,
    provider_name text,
    issue_description text,
    maintenance_activities text,
    result text,
    service_report_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    comments text,
    review_requirement text DEFAULT 'optional'::text NOT NULL,
    review_status text DEFAULT 'not_required'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    review_comment text,
    next_nominal_due_date date,
    next_scheduled_date date,
    next_hard_due_date date,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_impact text,
    CONSTRAINT equipment_maintenance_events_maintenance_type_check CHECK ((maintenance_type = ANY (ARRAY['preventive'::text, 'unplanned'::text]))),
    CONSTRAINT equipment_maintenance_events_provider_type_check CHECK (((provider_type IS NULL) OR (provider_type = ANY (ARRAY['internal'::text, 'external'::text])))),
    CONSTRAINT equipment_maintenance_events_result_check CHECK (((result IS NULL) OR (result = ANY (ARRAY['acceptable'::text, 'issue_identified'::text, 'unable_to_complete'::text])))),
    CONSTRAINT equipment_maintenance_events_review_requirement_check CHECK ((review_requirement = ANY (ARRAY['required'::text, 'optional'::text, 'disabled'::text]))),
    CONSTRAINT equipment_maintenance_events_review_status_check CHECK ((review_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT equipment_maintenance_events_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'assessment'::text, 'review'::text, 'completed'::text, 'overdue'::text, 'cancelled'::text])))
);


--
-- Name: TABLE equipment_maintenance_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_maintenance_events IS 'Preventive and unplanned equipment maintenance event history.';


--
-- Name: COLUMN equipment_maintenance_events.product_impact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_maintenance_events.product_impact IS 'Optional documented known or potential product impact associated with an unplanned equipment maintenance/repair event.';


--
-- Name: equipment_numbering_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_numbering_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    numbering_strategy text DEFAULT 'allow_both'::text NOT NULL,
    generated_prefix text DEFAULT 'EQ'::text NOT NULL,
    sequence_padding integer DEFAULT 6 NOT NULL,
    next_sequence bigint DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_numbering_configurations_next_sequence_check CHECK ((next_sequence >= 1)),
    CONSTRAINT equipment_numbering_configurations_numbering_strategy_check CHECK ((numbering_strategy = ANY (ARRAY['customer_assigned'::text, 'qualisphere_generated'::text, 'allow_both'::text]))),
    CONSTRAINT equipment_numbering_configurations_sequence_padding_check CHECK (((sequence_padding >= 1) AND (sequence_padding <= 12)))
);


--
-- Name: equipment_oos_oot_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_oos_oot_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    oos_oot_id uuid NOT NULL,
    source_type text NOT NULL,
    source_record_id uuid,
    linked_by text,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_oos_oot_links_source_type_check CHECK ((source_type = ANY (ARRAY['calibration'::text, 'preventive_maintenance'::text, 'unplanned_maintenance'::text, 'qualification'::text, 'general_equipment_issue'::text])))
);


--
-- Name: TABLE equipment_oos_oot_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_oos_oot_links IS 'Direct Equipment integration to the existing OOS/OOT module. No direct NCMR/CAPA link is intentionally created.';


--
-- Name: equipment_post_maintenance_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_post_maintenance_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    maintenance_event_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    calibration_required boolean,
    calibration_rationale text,
    requalification_required boolean,
    requalification_rationale text,
    completed_by text,
    completed_at timestamp with time zone,
    supporting_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    linked_calibration_event_id uuid,
    linked_qualification_event_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_post_maintenance_assessments_check CHECK (((calibration_required IS DISTINCT FROM true) OR (NULLIF(TRIM(BOTH FROM calibration_rationale), ''::text) IS NOT NULL))),
    CONSTRAINT equipment_post_maintenance_assessments_check1 CHECK (((requalification_required IS DISTINCT FROM true) OR (NULLIF(TRIM(BOTH FROM requalification_rationale), ''::text) IS NOT NULL)))
);


--
-- Name: TABLE equipment_post_maintenance_assessments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_post_maintenance_assessments IS 'Lean post-unplanned-maintenance calibration/requalification assessment.';


--
-- Name: equipment_qualification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_qualification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    qualification_number text NOT NULL,
    equipment_id uuid NOT NULL,
    qualification_type text NOT NULL,
    reason text,
    owner_email text,
    target_completion_date date,
    protocol_document_id uuid,
    protocol_number text,
    protocol_title text,
    protocol_revision text,
    protocol_released_at timestamp with time zone,
    execution_started_at timestamp with time zone,
    execution_completed_at timestamp with time zone,
    executed_by text,
    execution_notes text,
    execution_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    report_document_id uuid,
    report_number text,
    report_revision text,
    draft_report_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    qualification_result text,
    result_summary text,
    approval_requirement text DEFAULT 'required'::text NOT NULL,
    approval_status text DEFAULT 'not_required'::text NOT NULL,
    approved_by text,
    approved_at timestamp with time zone,
    approval_comment text,
    status text DEFAULT 'initiated'::text NOT NULL,
    released_for_use_by text,
    released_for_use_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    qualification_basis text DEFAULT 'new_activity'::text NOT NULL,
    iq_applicable boolean DEFAULT false NOT NULL,
    oq_applicable boolean DEFAULT false NOT NULL,
    pq_applicable boolean DEFAULT false NOT NULL,
    qualification_date date,
    next_requalification_date date,
    protocol_document_url text,
    report_document_url text,
    next_requalification_requirement text DEFAULT 'na'::text NOT NULL,
    qualification_element_documents jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT equipment_qualification_events_approval_requirement_check CHECK ((approval_requirement = ANY (ARRAY['required'::text, 'optional'::text, 'disabled'::text]))),
    CONSTRAINT equipment_qualification_events_approval_status_check CHECK ((approval_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT equipment_qualification_events_next_requalification_requirement CHECK ((next_requalification_requirement = ANY (ARRAY['na'::text, 'date'::text]))),
    CONSTRAINT equipment_qualification_events_qualification_basis_check CHECK ((qualification_basis = ANY (ARRAY['new_activity'::text, 'existing_qualified'::text]))),
    CONSTRAINT equipment_qualification_events_qualification_result_check CHECK (((qualification_result IS NULL) OR (qualification_result = ANY (ARRAY['acceptable'::text, 'not_acceptable'::text])))),
    CONSTRAINT equipment_qualification_events_qualification_type_check CHECK ((qualification_type = ANY (ARRAY['initial'::text, 'requalification'::text]))),
    CONSTRAINT equipment_qualification_events_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'protocol_released'::text, 'execution'::text, 'draft_report'::text, 'approval'::text, 'released'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: TABLE equipment_qualification_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_qualification_events IS 'Qualification/Requalification workflow: Initiated → Released Protocol → Execution → Draft Report → Approval → Release.';


--
-- Name: COLUMN equipment_qualification_events.qualification_basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.qualification_basis IS 'new_activity = qualification/requalification activity tracked in QualiSphere; existing_qualified = historical qualification entered when adopting/migrating to QualiSphere.';


--
-- Name: COLUMN equipment_qualification_events.iq_applicable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.iq_applicable IS 'Installation Qualification applicability.';


--
-- Name: COLUMN equipment_qualification_events.oq_applicable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.oq_applicable IS 'Operational Qualification applicability.';


--
-- Name: COLUMN equipment_qualification_events.pq_applicable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.pq_applicable IS 'Performance Qualification applicability.';


--
-- Name: COLUMN equipment_qualification_events.protocol_document_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.protocol_document_url IS 'Optional customer-selected link to the released qualification protocol in Document Control or another approved controlled-document location.';


--
-- Name: COLUMN equipment_qualification_events.report_document_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.report_document_url IS 'Optional customer-selected link to the released qualification report/document in Document Control or another approved controlled-document location.';


--
-- Name: COLUMN equipment_qualification_events.next_requalification_requirement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.next_requalification_requirement IS 'Future requalification planning control. na = no next requalification date applies; date = next_requalification_date is required by the application workflow.';


--
-- Name: COLUMN equipment_qualification_events.qualification_element_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_qualification_events.qualification_element_documents IS 'Independent qualification evidence keyed by iq, oq, and pq. Each element may contain protocol_number, protocol_revision, protocol_document_url, report_number, report_revision, report_document_url, and result.';


--
-- Name: equipment_related_event_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.equipment_related_event_counts WITH (security_invoker='true') AS
 SELECT tenant_id,
    id AS equipment_id,
    equipment_number,
    ( SELECT count(*) AS count
           FROM public.equipment_calibration_events c
          WHERE (c.equipment_id = e.id)) AS calibration_event_count,
    ( SELECT count(*) AS count
           FROM public.equipment_maintenance_events m
          WHERE (m.equipment_id = e.id)) AS maintenance_event_count,
    ( SELECT count(*) AS count
           FROM public.equipment_qualification_events q
          WHERE (q.equipment_id = e.id)) AS qualification_event_count,
    ( SELECT count(*) AS count
           FROM public.equipment_oos_oot_links o
          WHERE (o.equipment_id = e.id)) AS oos_oot_link_count,
    ( SELECT count(*) AS count
           FROM public.equipment_change_control_links cc
          WHERE (cc.equipment_id = e.id)) AS change_control_link_count,
    ( SELECT count(*) AS count
           FROM public.equipment_document_links d
          WHERE ((d.equipment_id = e.id) AND (d.is_active = true))) AS active_document_link_count
   FROM public.equipment e;


--
-- Name: equipment_schedule_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_schedule_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    schedule_configuration_id uuid NOT NULL,
    days_before_due integer NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    recipient_type text DEFAULT 'owner'::text NOT NULL,
    recipient_email text,
    notification_type text DEFAULT 'both'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_schedule_notifications_days_before_due_check CHECK ((days_before_due >= 0)),
    CONSTRAINT equipment_schedule_notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['in_app'::text, 'email'::text, 'both'::text]))),
    CONSTRAINT equipment_schedule_notifications_recipient_type_check CHECK ((recipient_type = ANY (ARRAY['owner'::text, 'department'::text, 'specific_user'::text, 'quality'::text])))
);


--
-- Name: TABLE equipment_schedule_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_schedule_notifications IS 'Customer-configurable progressive reminder rules for equipment schedules.';


--
-- Name: governance_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name text NOT NULL,
    source_module text NOT NULL,
    target_module text NOT NULL,
    rule_type text NOT NULL,
    severity_levels text[],
    recurrence_threshold integer,
    risk_levels text[],
    supplier_related boolean,
    customer_impact boolean,
    action_type text NOT NULL,
    active boolean DEFAULT true,
    justification_required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kpi_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    module_name text,
    kpi_key text NOT NULL,
    kpi_name text NOT NULL,
    kpi_source text DEFAULT 'default'::text,
    kpi_value numeric,
    kpi_value_text text,
    captured_at timestamp with time zone DEFAULT now(),
    captured_period text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kpi_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_name text NOT NULL,
    kpi_key text NOT NULL,
    kpi_name text NOT NULL,
    kpi_description text,
    kpi_category text,
    enabled_by_default boolean DEFAULT true,
    calculation_type text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kpi_library_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_library_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_name text NOT NULL,
    category text NOT NULL,
    kpi_key text NOT NULL,
    kpi_name text NOT NULL,
    kpi_description text,
    calculation_type text DEFAULT 'count'::text,
    filter_field text,
    filter_operator text,
    filter_value text,
    default_executive_dashboard boolean DEFAULT false,
    default_management_review boolean DEFAULT false,
    default_display_order integer DEFAULT 100,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    target_days integer,
    start_date_field text,
    end_date_field text
);


--
-- Name: management_review_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.management_review_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    management_review_id uuid,
    action_title text NOT NULL,
    action_description text,
    action_owner text,
    action_owner_email text,
    due_date date,
    priority text DEFAULT 'Medium'::text,
    action_status text DEFAULT 'open'::text,
    closure_notes text,
    closed_at timestamp with time zone,
    closed_by text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: management_review_approvers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.management_review_approvers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    management_review_id uuid NOT NULL,
    approver_name text,
    approver_email text,
    approver_role text,
    approval_status text DEFAULT 'pending'::text,
    signature_meaning text,
    signed_by text,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    approver_due_date date,
    tenant_id uuid NOT NULL
);


--
-- Name: management_review_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.management_review_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_title text,
    report_period text,
    report_date date DEFAULT CURRENT_DATE,
    report_data jsonb,
    created_by text,
    created_at timestamp without time zone DEFAULT now(),
    signed_by text,
    signed_at timestamp without time zone,
    signature_email_entered text,
    signature_meaning text,
    signature_method text,
    auth_reverified boolean DEFAULT false
);


--
-- Name: management_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.management_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_number text,
    review_title text NOT NULL,
    review_period_start date,
    review_period_end date,
    review_date date,
    site text,
    business_unit text,
    status text DEFAULT 'draft'::text,
    prepared_by text,
    approved_by text,
    approval_date timestamp with time zone,
    report_config_json jsonb,
    report_snapshot_json jsonb,
    executive_summary text,
    risk_score integer,
    quality_health text,
    is_locked boolean DEFAULT false,
    locked_at timestamp with time zone,
    locked_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approval_status text DEFAULT 'draft'::text,
    fully_approved_at timestamp with time zone,
    tenant_id uuid NOT NULL
);


--
-- Name: md_defect_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_defect_categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text,
    label text,
    tenant_id uuid NOT NULL
);


--
-- Name: md_defect_subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_defect_subcategories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    category_code text,
    code text,
    label text,
    tenant_id uuid NOT NULL
);


--
-- Name: md_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text,
    label text,
    tenant_id uuid NOT NULL
);


--
-- Name: md_detection_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_detection_sources (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text,
    label text,
    tenant_id uuid NOT NULL
);


--
-- Name: md_dispositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_dispositions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text,
    label text,
    tenant_id uuid NOT NULL
);


--
-- Name: md_document_impact_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_document_impact_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    behavior_type text DEFAULT 'generic'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system_seed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT md_document_impact_areas_behavior_type_check CHECK ((behavior_type = ANY (ARRAY['generic'::text, 'inventory_wip'::text, 'validation'::text, 'training'::text])))
);


--
-- Name: md_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipment_id text NOT NULL,
    equipment_name text NOT NULL,
    equipment_type text,
    room_code text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: md_material_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_material_statuses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text,
    label text,
    tenant_id uuid NOT NULL
);


--
-- Name: md_oos_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_oos_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_source text NOT NULL,
    test_method_code text NOT NULL,
    room_code text,
    equipment_id text,
    alert_limit text,
    action_limit text,
    specification_limit text,
    unit_of_measure text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: md_product_part_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_product_part_numbers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text,
    label text,
    part_description text,
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: md_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    room_type text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: md_root_cause_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_root_cause_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: md_test_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.md_test_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    investigation_source text,
    default_unit text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: ncmr_affected_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncmr_affected_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ncmr_id uuid NOT NULL,
    product_part_number text,
    lot_number text,
    workorder_number text,
    quantity_affected integer,
    quarantined_quantity integer,
    product_disposition text,
    disposition_justification text,
    created_at timestamp without time zone DEFAULT now(),
    mrb_approved_by text,
    mrb_approved_at timestamp without time zone,
    mrb_signature_meaning text,
    quantity_accepted integer,
    quantity_rejected integer,
    final_disposition_after_rework text,
    final_rework_quantity_accepted integer,
    final_rework_quantity_rejected integer,
    part_description text,
    part_revision text,
    disposition_implementation_status text DEFAULT 'not_started'::text NOT NULL,
    disposition_implementation_notes text,
    disposition_implemented_by text,
    disposition_implemented_at timestamp with time zone,
    quantity_discrepancy boolean DEFAULT false NOT NULL,
    discrepancy_quantity numeric,
    discrepancy_type text,
    discrepancy_rationale text,
    final_quantity_accepted numeric,
    final_quantity_rejected numeric,
    defect_category text,
    defect_subcategory text,
    CONSTRAINT ncmr_affected_items_discrepancy_type_chk CHECK (((discrepancy_type IS NULL) OR (discrepancy_type = ANY (ARRAY['accepted_quantity'::text, 'rejected_quantity'::text])))),
    CONSTRAINT ncmr_affected_items_disposition_impl_status_chk CHECK ((disposition_implementation_status = ANY (ARRAY['not_started'::text, 'completed'::text, 'superseded'::text]))),
    CONSTRAINT ncmr_affected_items_nonnegative_impl_qty_chk CHECK ((((discrepancy_quantity IS NULL) OR (discrepancy_quantity >= (0)::numeric)) AND ((final_quantity_accepted IS NULL) OR (final_quantity_accepted >= (0)::numeric)) AND ((final_quantity_rejected IS NULL) OR (final_quantity_rejected >= (0)::numeric))))
);


--
-- Name: COLUMN ncmr_affected_items.part_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.part_description IS 'Part description captured for the affected item at NCMR initiation/workflow.';


--
-- Name: COLUMN ncmr_affected_items.part_revision; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.part_revision IS 'Part revision captured for the affected item at NCMR initiation/workflow.';


--
-- Name: COLUMN ncmr_affected_items.disposition_implementation_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.disposition_implementation_status IS 'Post-MRB implementation state for the approved affected-item disposition: not_started, completed, or superseded.';


--
-- Name: COLUMN ncmr_affected_items.disposition_implementation_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.disposition_implementation_notes IS 'Documentation confirming how the approved non-Rework disposition was physically implemented.';


--
-- Name: COLUMN ncmr_affected_items.quantity_discrepancy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.quantity_discrepancy IS 'True when actual final quantities differ from MRB-approved accepted/rejected quantities for Use As Is or Accept Per Specification.';


--
-- Name: COLUMN ncmr_affected_items.discrepancy_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.discrepancy_quantity IS 'Absolute quantity difference attributed to the selected accepted or rejected quantity during implementation.';


--
-- Name: COLUMN ncmr_affected_items.discrepancy_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.discrepancy_type IS 'MRB quantity affected by the implementation discrepancy: accepted_quantity or rejected_quantity.';


--
-- Name: COLUMN ncmr_affected_items.discrepancy_rationale; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.discrepancy_rationale IS 'Required rationale explaining an implementation-stage quantity discrepancy.';


--
-- Name: COLUMN ncmr_affected_items.final_quantity_accepted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.final_quantity_accepted IS 'Actual final accepted quantity after implementing the approved non-Rework disposition.';


--
-- Name: COLUMN ncmr_affected_items.final_quantity_rejected; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.final_quantity_rejected IS 'Actual final rejected quantity after implementing the approved non-Rework disposition.';


--
-- Name: COLUMN ncmr_affected_items.defect_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.defect_category IS 'Part-specific NCMR defect category. Authoritative defect classification for the affected item.';


--
-- Name: COLUMN ncmr_affected_items.defect_subcategory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_affected_items.defect_subcategory IS 'Part-specific NCMR defect subcategory. Authoritative defect classification for the affected item.';


--
-- Name: ncmr_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncmr_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ncmr_id uuid NOT NULL,
    parent_comment_id uuid,
    comment_text text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tagged_users text[],
    attachment_url text,
    edited_at timestamp with time zone
);


--
-- Name: ncmr_mrb_approvers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncmr_mrb_approvers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    ncmr_id uuid,
    approver_email text,
    approver_role text,
    approval_status text DEFAULT 'pending'::text,
    approved_at timestamp without time zone,
    signature_meaning text,
    created_at timestamp without time zone DEFAULT now(),
    approval_order integer DEFAULT 1,
    is_required boolean DEFAULT true,
    source_template_id uuid,
    approver_function text,
    approver_job_title text,
    approver_due_date date,
    created_by text
);


--
-- Name: COLUMN ncmr_mrb_approvers.approver_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_mrb_approvers.approver_function IS 'Business function represented by the MRB reviewer, such as Quality, Operations, Regulatory, or Engineering.';


--
-- Name: COLUMN ncmr_mrb_approvers.approver_job_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_mrb_approvers.approver_job_title IS 'Reviewer job title displayed in the Enterprise Approval interface.';


--
-- Name: COLUMN ncmr_mrb_approvers.approver_due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmr_mrb_approvers.approver_due_date IS 'Approve By date for the individual MRB reviewer.';


--
-- Name: ncmr_mrb_reviewers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncmr_mrb_reviewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ncmr_id text NOT NULL,
    approver_email text NOT NULL,
    approver_function text,
    approver_job_title text,
    approver_due_date date,
    approver_role text,
    approval_status text DEFAULT 'configured'::text NOT NULL,
    approval_order integer,
    is_required boolean DEFAULT true NOT NULL,
    source_template_id text,
    signature_meaning text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ncmr_mrb_reviewers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ncmr_mrb_reviewers IS 'Editable MRB reviewer configuration. Approval decisions, signatures, comments, and immutable history remain in approval_tasks and audit_logs.';


--
-- Name: ncmr_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ncmr_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ncmr_tenant_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncmr_tenant_number_counters (
    tenant_id uuid NOT NULL,
    last_number bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ncmr_tenant_number_counters_last_number_check CHECK ((last_number >= 0))
);


--
-- Name: ncmrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncmrs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text,
    description text,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT now(),
    severity text,
    owner text,
    capa_required boolean DEFAULT false,
    problem_description text,
    containment_action text,
    investigation_summary text,
    root_cause text,
    risk_assessment text,
    corrective_action text,
    investigator text,
    investigation_opened_at timestamp without time zone,
    investigation_completed_at timestamp without time zone,
    review_status text DEFAULT 'draft'::text,
    closed_at timestamp without time zone,
    evidence_url text,
    evidence_notes text,
    issue_description text,
    scope text,
    product_part_number text,
    lot_number text,
    workorder_number text,
    disposition text,
    source_of_detection text,
    department text,
    date_detected date,
    quantity_affected integer,
    containment_owner text,
    mrb_decision_date date,
    defect_category text,
    defect_subcategory text,
    material_status text,
    affected_quantity integer,
    quarantined_quantity integer,
    supplier_name text,
    supplier_lot text,
    site_location text,
    immediate_correction text,
    long_term_corrective_action text,
    mrb_approved_by text,
    mrb_approved_at timestamp without time zone,
    mrb_signature_meaning text,
    correction_action_proposal text,
    correction_implementation text,
    correction_implemented_by text,
    correction_implemented_at timestamp without time zone,
    product_disposition text,
    disposition_justification text,
    ncmr_closed_by text,
    ncmr_signature_meaning text,
    capa_id uuid,
    recurring_issue boolean DEFAULT false,
    recurrence_reason text,
    recurrence_checked_at timestamp without time zone,
    capa_justification text,
    mrb_signature_email_entered text,
    mrb_additional_approvers text,
    supplier_capa_required boolean DEFAULT false,
    supplier_capa_reason text,
    ncmr_number text,
    root_cause_category text,
    is_locked boolean DEFAULT false,
    locked_at timestamp without time zone,
    locked_by text,
    require_quality_approval boolean DEFAULT true,
    require_operations_approval boolean DEFAULT false,
    require_regulatory_approval boolean DEFAULT false,
    require_supply_chain_approval boolean DEFAULT false,
    require_engineering_approval boolean DEFAULT false,
    quality_approved_by text,
    quality_approved_at timestamp with time zone,
    operations_approved_by text,
    operations_approved_at timestamp with time zone,
    regulatory_approved_by text,
    regulatory_approved_at timestamp with time zone,
    quality_signature_meaning text,
    operations_signature_meaning text,
    regulatory_signature_meaning text,
    supply_chain_approved_by text,
    supply_chain_approved_at timestamp with time zone,
    supply_chain_signature_meaning text,
    engineering_approved_by text,
    engineering_approved_at timestamp with time zone,
    engineering_signature_meaning text,
    quality_approver_email text,
    operations_approver_email text,
    regulatory_approver_email text,
    supply_chain_approver_email text,
    engineering_approver_email text,
    investigation_collaboration_notes text,
    investigation_collaborators text,
    supplier_id uuid,
    supplier_scar_recommended boolean DEFAULT false,
    supplier_scar_decision text,
    supplier_scar_decision_justification text,
    capa_recommended boolean DEFAULT false,
    capa_decision text,
    capa_decision_justification text,
    ncmr_signature_email_entered text,
    source_module text,
    source_record_id uuid,
    linked_supplier_id uuid,
    linked_receiving_inspection_id uuid,
    linked_scar_id uuid,
    scar_required boolean DEFAULT false,
    scar_justification text,
    capa_evaluation_outcome text,
    capa_evaluation_rationale text,
    capa_not_required_justification text,
    linked_capa_id uuid,
    containment_completed_by text,
    containment_completed_at timestamp with time zone,
    purchase_order_number text,
    initiation_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    investigation_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    occurrence_rating text,
    detection_rating text,
    risk_assessment_method text DEFAULT 'automatic'::text NOT NULL,
    risk_level text,
    risk_override_enabled boolean DEFAULT false NOT NULL,
    risk_override_level text,
    risk_override_justification text,
    workflow_version_id uuid,
    workflow_version_code text,
    risk_configuration_version_id uuid,
    risk_configuration_version_code text,
    capa_governance_version_id uuid,
    capa_governance_version_code text,
    risk_determination text,
    no_risk_justification text,
    current_mrb_approval_cycle_id uuid,
    tenant_id uuid NOT NULL,
    CONSTRAINT ncmrs_initiation_attachments_is_array CHECK ((jsonb_typeof(initiation_attachments) = 'array'::text)),
    CONSTRAINT ncmrs_risk_determination_check CHECK (((risk_determination IS NULL) OR (risk_determination = ANY (ARRAY['no_risk'::text, 'overall_residual_risk'::text]))))
);


--
-- Name: COLUMN ncmrs.purchase_order_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.purchase_order_number IS 'Optional supplier purchase order number captured for supplier-related NCMRs.';


--
-- Name: COLUMN ncmrs.initiation_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.initiation_attachments IS 'Optional supporting files captured during NCMR initiation. Stored as a JSON array of file metadata and evidence-bucket URLs.';


--
-- Name: COLUMN ncmrs.investigation_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.investigation_attachments IS 'Optional supporting attachments for the Investigation / Root Cause section. Locked with the approved MRB package.';


--
-- Name: COLUMN ncmrs.occurrence_rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.occurrence_rating IS 'NCMR occurrence rating aligned with CAPA risk assessment: low, medium, high.';


--
-- Name: COLUMN ncmrs.detection_rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.detection_rating IS 'NCMR detection rating aligned with CAPA risk assessment: high_detection, medium_detection, low_detection.';


--
-- Name: COLUMN ncmrs.risk_assessment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_assessment_method IS 'Risk assessment method: automatic or manual.';


--
-- Name: COLUMN ncmrs.risk_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_level IS 'Stored NCMR risk result. Overall/Residual Risk values: low, medium, high, critical. No Risk pathway stores no_risk.';


--
-- Name: COLUMN ncmrs.risk_override_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_override_enabled IS 'True when the automatically calculated NCMR risk level is intentionally overridden.';


--
-- Name: COLUMN ncmrs.risk_override_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_override_level IS 'Controlled override risk level when automatic calculation is overridden.';


--
-- Name: COLUMN ncmrs.risk_override_justification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_override_justification IS 'Required justification for overriding the automatically calculated NCMR risk level.';


--
-- Name: COLUMN ncmrs.workflow_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.workflow_version_id IS 'QualiSphere NCMR module release identifier stamped at NCMR creation. The record remains associated with this module release for its lifecycle.';


--
-- Name: COLUMN ncmrs.workflow_version_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.workflow_version_code IS 'Customer-facing QualiSphere NCMR module release code stamped at creation, for example NCMR-2.0. Customer master-data or risk/governance configuration changes do not increment this code.';


--
-- Name: COLUMN ncmrs.risk_configuration_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_configuration_version_id IS 'Internal controlled customer risk-configuration history identifier used to reproduce the NCMR risk decision. Does not represent the QualiSphere NCMR module version.';


--
-- Name: COLUMN ncmrs.risk_configuration_version_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_configuration_version_code IS 'Internal customer risk-configuration history code. Does not increment or replace the QualiSphere NCMR module release.';


--
-- Name: COLUMN ncmrs.capa_governance_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.capa_governance_version_id IS 'Internal controlled customer CAPA-governance configuration history identifier used to reproduce the governance decision. Does not represent the QualiSphere NCMR module version.';


--
-- Name: COLUMN ncmrs.capa_governance_version_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.capa_governance_version_code IS 'Internal customer CAPA-governance configuration history code. Does not increment or replace the QualiSphere NCMR module release.';


--
-- Name: COLUMN ncmrs.risk_determination; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.risk_determination IS 'Controlled NCMR risk pathway: no_risk or overall_residual_risk.';


--
-- Name: COLUMN ncmrs.no_risk_justification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ncmrs.no_risk_justification IS 'Required justification when Risk Determination is No Risk.';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    module text NOT NULL,
    notification_type text NOT NULL,
    frequency text DEFAULT 'immediate'::text,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    entity_type text,
    entity_id uuid,
    task_id uuid,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    error_message text
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    assigned_role text,
    title text NOT NULL,
    message text,
    notification_type text,
    severity text DEFAULT 'info'::text,
    related_record_id uuid,
    related_module text,
    related_url text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    deduplication_key text,
    delivery_frequency text DEFAULT 'immediate'::text,
    delivery_status text DEFAULT 'in_app'::text,
    scheduled_for timestamp with time zone,
    read_status boolean DEFAULT false,
    read_at timestamp with time zone
);


--
-- Name: oos_oot_investigations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oos_oot_investigations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_number text,
    investigation_source text,
    event_type text,
    test_name text,
    test_method text,
    area_room_equipment text,
    product_part_number text,
    lot_batch_number text,
    sample_id text,
    date_detected date,
    detected_by text,
    observed_result text,
    specification_limit text,
    unit_of_measure text,
    immediate_action text,
    product_affected boolean DEFAULT false,
    material_on_hold boolean DEFAULT false,
    room_equipment_impacted boolean DEFAULT false,
    containment_owner text,
    quarantined_quantity numeric,
    sample_handling_issue boolean DEFAULT false,
    calculation_error boolean DEFAULT false,
    method_deviation boolean DEFAULT false,
    instrument_equipment_issue boolean DEFAULT false,
    operator_issue boolean DEFAULT false,
    environmental_condition_issue boolean DEFAULT false,
    retest_justified boolean DEFAULT false,
    phase1_conclusion text,
    expanded_scope text,
    historical_trend_review text,
    other_lots_rooms_equipment_affected text,
    root_cause_category text,
    root_cause_description text,
    impact_assessment text,
    risk_assessment text,
    disposition_decision text,
    disposition_justification text,
    product_impact boolean DEFAULT false,
    ncmr_required boolean DEFAULT false,
    linked_ncmr_number text,
    affected_product_lot_quantity text,
    no_product_impact_justification text,
    systemic_issue boolean DEFAULT false,
    escalation_required boolean DEFAULT false,
    escalation_notes text,
    closure_summary text,
    status text DEFAULT 'open'::text,
    signed_by text,
    signed_at timestamp without time zone,
    signature_meaning text,
    signature_method text DEFAULT 'session_confirm'::text,
    created_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone,
    is_locked boolean DEFAULT false,
    locked_at timestamp without time zone,
    locked_by text,
    tenant_id uuid NOT NULL
);


--
-- Name: oos_oot_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oos_oot_number_counters (
    prefix text NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: oos_oot_tenant_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oos_oot_tenant_number_counters (
    tenant_id uuid NOT NULL,
    prefix text NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: platform_administrators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_administrators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE platform_administrators; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.platform_administrators IS 'QualiSphere platform-level administrators. Separate from customer/company administrators.';


--
-- Name: printable_management_review_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.printable_management_review_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    signer_role text NOT NULL,
    signer_email text NOT NULL,
    signature_email_entered text,
    signed_at timestamp without time zone DEFAULT now(),
    signature_meaning text,
    signature_method text DEFAULT 'active_login_session_confirmation'::text,
    user_role_at_signature text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: printable_management_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.printable_management_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_title text,
    report_period text,
    report_data jsonb,
    is_locked boolean DEFAULT false,
    signed_by text,
    signed_at timestamp without time zone,
    signature_meaning text,
    signature_method text DEFAULT 'session_confirm'::text,
    created_at timestamp without time zone DEFAULT now(),
    created_by text,
    company_name text,
    qms_reference text,
    locked_at timestamp without time zone,
    locked_by text
);


--
-- Name: qms_capa_governance_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_capa_governance_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    configuration_version_id uuid NOT NULL,
    trigger_type text NOT NULL,
    trigger_value text NOT NULL,
    governance_action text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT qms_capa_governance_rules_check CHECK ((((trigger_type = 'risk_level'::text) AND (trigger_value = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text, 'no_risk'::text]))) OR ((trigger_type = 'recurrence'::text) AND (trigger_value = 'recurring_issue'::text)))),
    CONSTRAINT qms_capa_governance_rules_governance_action_check CHECK ((governance_action = ANY (ARRAY['no_automatic_recommendation'::text, 'capa_recommended'::text, 'capa_required'::text]))),
    CONSTRAINT qms_capa_governance_rules_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['risk_level'::text, 'recurrence'::text])))
);


--
-- Name: qms_configuration_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_configuration_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    configuration_type text NOT NULL,
    configuration_version_id uuid,
    action text NOT NULL,
    previous_value jsonb,
    new_value jsonb,
    change_justification text,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: qms_configuration_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_configuration_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    configuration_type text NOT NULL,
    version_code text NOT NULL,
    version_name text,
    status text DEFAULT 'draft'::text NOT NULL,
    effective_at timestamp with time zone,
    retired_at timestamp with time zone,
    configuration jsonb DEFAULT '{}'::jsonb NOT NULL,
    change_summary text,
    change_justification text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_by text,
    activated_at timestamp with time zone,
    retired_by text,
    tenant_id uuid NOT NULL,
    CONSTRAINT qms_configuration_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))
);


--
-- Name: qms_decision_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_decision_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    record_id uuid NOT NULL,
    decision_type text NOT NULL,
    workflow_version_id uuid,
    configuration_version_id uuid,
    input_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    decision_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    configuration_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    decision_by text,
    decision_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qms_module_record_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_module_record_migrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    record_id uuid NOT NULL,
    record_number text,
    from_workflow_version_id uuid,
    from_version_code text,
    to_workflow_version_id uuid NOT NULL,
    to_version_code text NOT NULL,
    migration_status text DEFAULT 'planned'::text NOT NULL,
    migration_reason text,
    migration_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    migrated_by text,
    migrated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE qms_module_record_migrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qms_module_record_migrations IS 'Record-level audit ledger for controlled migration of open quality records between QualiSphere module releases. Closed legacy records are not migrated.';


--
-- Name: qms_module_release_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_module_release_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    workflow_version_id uuid,
    version_code text NOT NULL,
    event_type text NOT NULL,
    event_status text DEFAULT 'completed'::text NOT NULL,
    previous_version_code text,
    change_description text,
    change_justification text,
    open_record_count integer DEFAULT 0 NOT NULL,
    migrated_record_count integer DEFAULT 0 NOT NULL,
    legacy_record_count integer DEFAULT 0 NOT NULL,
    blocked_record_count integer DEFAULT 0 NOT NULL,
    event_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    performed_by text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_module_release_events_counts_nonnegative CHECK (((open_record_count >= 0) AND (migrated_record_count >= 0) AND (legacy_record_count >= 0) AND (blocked_record_count >= 0)))
);


--
-- Name: TABLE qms_module_release_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qms_module_release_events IS 'Immutable audit history for QualiSphere module release validation, activation, migration and retirement events.';


--
-- Name: qms_record_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_record_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    record_id uuid NOT NULL,
    record_number text,
    snapshot_type text DEFAULT 'closure'::text NOT NULL,
    record_status text NOT NULL,
    snapshot_payload jsonb NOT NULL,
    snapshot_origin text DEFAULT 'system_closure'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE qms_record_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qms_record_snapshots IS 'Immutable point-in-time QMS record snapshots. Closed/completed records are presented from this snapshot instead of being re-rendered by later live workflow code.';


--
-- Name: qms_record_structure_freezes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_record_structure_freezes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    record_id uuid NOT NULL,
    structure_template_id uuid,
    structure_json jsonb NOT NULL,
    frozen_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    frozen_at timestamp with time zone DEFAULT now() NOT NULL,
    frozen_by text
);


--
-- Name: TABLE qms_record_structure_freezes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qms_record_structure_freezes IS 'Frozen presentation definition for a closed QMS record. The original regulated record remains in its normal module tables.';


--
-- Name: qms_record_structure_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_record_structure_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    structure_json jsonb NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    effective_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qms_risk_matrix_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_risk_matrix_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    configuration_version_id uuid NOT NULL,
    severity text NOT NULL,
    occurrence text NOT NULL,
    detection text NOT NULL,
    overall_risk text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT qms_risk_matrix_rules_detection_check CHECK ((detection = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT qms_risk_matrix_rules_occurrence_check CHECK ((occurrence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT qms_risk_matrix_rules_overall_risk_check CHECK ((overall_risk = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT qms_risk_matrix_rules_severity_check CHECK ((severity = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: qms_workflow_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qms_workflow_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    version_code text NOT NULL,
    version_name text,
    status text DEFAULT 'draft'::text NOT NULL,
    effective_at timestamp with time zone,
    retired_at timestamp with time zone,
    change_summary text,
    change_justification text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_by text,
    activated_at timestamp with time zone,
    retired_by text,
    change_description text,
    planned_release_date date,
    released_by text,
    released_at timestamp with time zone,
    release_notes text,
    migration_required boolean DEFAULT false NOT NULL,
    legacy_protection_required boolean DEFAULT true NOT NULL,
    CONSTRAINT qms_workflow_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))
);


--
-- Name: TABLE qms_workflow_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qms_workflow_versions IS 'Enterprise QualiSphere module release registry. Module releases control product workflow architecture; customer master data, KPI settings, and Risk/CAPA governance configuration remain separate.';


--
-- Name: receiving_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    inspection_number text,
    part_number text,
    lot_number text,
    work_order text,
    receipt_date date,
    inspection_date date,
    quantity_received numeric,
    quantity_inspected numeric,
    quantity_accepted numeric,
    quantity_rejected numeric,
    inspection_result text,
    defect_category text,
    defect_description text,
    coa_verified boolean DEFAULT false,
    documents_verified boolean DEFAULT false,
    inspector text,
    automatic_ncmr_required boolean DEFAULT false,
    linked_ncmr_id uuid,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    ncmr_created boolean DEFAULT false,
    approval_status text DEFAULT 'draft'::text,
    approved_by text,
    approved_at timestamp with time zone,
    approval_signature_meaning text,
    approval_notes text,
    is_locked boolean DEFAULT false,
    locked_at timestamp with time zone,
    locked_by text,
    part_revision text,
    part_description text,
    receiving_inspection_procedure text,
    receiving_inspection_procedure_revision text,
    tenant_id uuid NOT NULL
);


--
-- Name: record_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.record_number_counters (
    record_type text NOT NULL,
    record_year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: scar_tenant_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scar_tenant_number_counters (
    tenant_id uuid NOT NULL,
    last_number bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scar_tenant_number_counters_last_number_check CHECK ((last_number >= 0))
);


--
-- Name: scars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scar_number text NOT NULL,
    supplier_id uuid,
    supplier_name text,
    linked_ncmr_id uuid,
    linked_ncmr_number text,
    title text,
    description text,
    severity text,
    risk_level text,
    issue_summary text,
    root_cause text,
    corrective_action text,
    effectiveness_verification text,
    assigned_supplier_contact text,
    due_date date,
    response_due_date date,
    status text DEFAULT 'open'::text,
    initiated_by text,
    initiated_at timestamp with time zone DEFAULT now(),
    supplier_response text,
    supplier_response_date timestamp with time zone,
    closed_by text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_ncmr_id uuid,
    linked_supplier_id uuid,
    created_by text,
    created_from_module text,
    issue_description text,
    problem_description text,
    scar_title text,
    scar_status text,
    source_type text,
    supplier_lot text,
    part_number text,
    lot_number text,
    source_audit_finding_id uuid,
    linked_audit_id uuid,
    supplier_risk_score_at_creation integer,
    supplier_risk_level_at_creation text,
    recurrence_flag boolean DEFAULT false,
    recurrence_count integer DEFAULT 0,
    scar_escalation_level integer DEFAULT 1,
    effectiveness_owner text,
    effectiveness_due_date date,
    effectiveness_completed_at timestamp with time zone,
    effectiveness_result text,
    effectiveness_evidence text,
    effectiveness_notes text,
    supplier_response_due_date date,
    supplier_response_received_at timestamp with time zone,
    supplier_response_status text DEFAULT 'pending'::text,
    tenant_id uuid NOT NULL
);


--
-- Name: security_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_roles (
    code text NOT NULL,
    label text NOT NULL,
    category text DEFAULT 'enterprise'::text NOT NULL,
    description text,
    is_assignable boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system_role boolean DEFAULT false NOT NULL,
    permission_key text
);


--
-- Name: supplier_audit_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_audit_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid,
    finding_title text,
    finding_description text,
    finding_type text,
    requirement_reference text,
    supplier_response text,
    corrective_action text,
    due_date date,
    effectiveness_verified boolean DEFAULT false,
    effectiveness_verified_by text,
    effectiveness_verified_at timestamp with time zone,
    escalation_to_scar boolean DEFAULT false,
    scar_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: supplier_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    audit_number text,
    audit_title text,
    audit_type text,
    audit_scope text,
    audit_method text,
    lead_auditor text,
    audit_team text,
    planned_audit_date date,
    actual_audit_date date,
    audit_status text DEFAULT 'planned'::text,
    audit_result text,
    compliance_score numeric,
    audit_summary text,
    escalation_to_scar boolean DEFAULT false,
    scar_required boolean DEFAULT false,
    scar_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    closed_by text,
    closed_at timestamp with time zone,
    tenant_id uuid NOT NULL
);


--
-- Name: supplier_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    document_title text NOT NULL,
    document_type text,
    document_status text DEFAULT 'active'::text,
    effective_date date,
    expiration_date date,
    document_url text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    retired_by text,
    retired_at timestamp with time zone,
    external_url text,
    uploaded_file_url text,
    tenant_id uuid NOT NULL,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_number text,
    supplier_name text NOT NULL,
    supplier_category text,
    supplier_status text DEFAULT 'approved'::text,
    supplier_risk_level text,
    primary_contact_name text,
    primary_contact_email text,
    primary_contact_phone text,
    supplier_address text,
    supplier_country text,
    approved_products_services text,
    iso_certification text,
    iso_expiration_date date,
    quality_agreement_signed boolean DEFAULT false,
    last_supplier_audit_date date,
    next_supplier_audit_date date,
    supplier_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qualification_status text DEFAULT 'qualified'::text,
    qualification_expiration_date date,
    requalification_due_date date,
    qualification_rationale text,
    qualification_updated_by text,
    qualification_updated_at timestamp with time zone,
    receiving_inspection_enabled boolean DEFAULT false,
    asl_status text DEFAULT 'approved'::text,
    approved_commodities text,
    approved_services text,
    qualification_date date,
    critical_supplier boolean DEFAULT false,
    quality_agreement_approved boolean DEFAULT false,
    asl_approved_by text,
    asl_approved_at timestamp with time zone,
    probation_reason text,
    disqualification_reason text,
    supplier_risk_score integer DEFAULT 0,
    supplier_escalation_level integer DEFAULT 1,
    supplier_governance_status text DEFAULT 'routine'::text,
    last_risk_reviewed_at timestamp with time zone,
    last_risk_reviewed_by text,
    risk_rationale text,
    tenant_id uuid NOT NULL,
    qualification_decision text,
    qualification_decision_justification text,
    asl_approval_scope text,
    asl_qualification_basis text,
    supplier_criticality text
);


--
-- Name: supplier_risk_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.supplier_risk_dashboard WITH (security_invoker='true') AS
 SELECT id,
    supplier_number,
    supplier_name,
    supplier_status,
    supplier_category,
    supplier_risk_score,
    supplier_risk_level,
    supplier_escalation_level,
    supplier_governance_status,
    last_risk_reviewed_at,
    risk_rationale,
    ( SELECT count(*) AS count
           FROM public.scars sc
          WHERE ((sc.tenant_id = s.tenant_id) AND ((sc.supplier_id = s.id) OR (sc.linked_supplier_id = s.id)) AND (COALESCE(sc.status, sc.scar_status, 'open'::text) <> 'closed'::text))) AS open_scars,
    ( SELECT count(*) AS count
           FROM public.scars sc
          WHERE ((sc.tenant_id = s.tenant_id) AND ((sc.supplier_id = s.id) OR (sc.linked_supplier_id = s.id)) AND (sc.supplier_response_due_date IS NOT NULL) AND (sc.supplier_response_due_date < CURRENT_DATE) AND (sc.supplier_response_received_at IS NULL))) AS overdue_scars,
    ( SELECT count(*) AS count
           FROM public.scars sc
          WHERE ((sc.tenant_id = s.tenant_id) AND ((sc.supplier_id = s.id) OR (sc.linked_supplier_id = s.id)) AND (sc.effectiveness_result = 'not_effective'::text))) AS not_effective_scars,
    ( SELECT count(*) AS count
           FROM public.ncmrs n
          WHERE ((n.tenant_id = s.tenant_id) AND ((n.supplier_id = s.id) OR (n.linked_supplier_id = s.id)))) AS supplier_ncmrs,
    ( SELECT count(*) AS count
           FROM public.ncmrs n
          WHERE ((n.tenant_id = s.tenant_id) AND ((n.supplier_id = s.id) OR (n.linked_supplier_id = s.id)) AND (n.recurring_issue = true))) AS recurring_ncmrs
   FROM public.suppliers s
  ORDER BY supplier_risk_score DESC NULLS LAST;


--
-- Name: tenant_customer_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_customer_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_email text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_customer_contacts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: tenant_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_email text NOT NULL,
    membership_role text DEFAULT 'member'::text NOT NULL,
    membership_status text DEFAULT 'active'::text NOT NULL,
    invited_by text,
    invited_at timestamp with time zone,
    joined_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_memberships_membership_role_check CHECK ((membership_role = ANY (ARRAY['member'::text, 'company_admin'::text]))),
    CONSTRAINT tenant_memberships_membership_status_check CHECK ((membership_status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'inactive'::text])))
);


--
-- Name: TABLE tenant_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_memberships IS 'Platform-level relationship between an authenticated QualiSphere user and a tenant/company.';


--
-- Name: tenant_module_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_module_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    module_code text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    enabled_by text,
    enabled_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tenant_module_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_module_access IS 'Tenant-level QualiSphere module enablement. Company entitlement/configuration rather than individual user authorization.';


--
-- Name: tenant_user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_email text NOT NULL,
    job_title text,
    department text,
    account_status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT tenant_user_profiles_account_status_check CHECK ((account_status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: tenant_user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_user_role_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_email text NOT NULL,
    role_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by text
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_code text NOT NULL,
    company_name text NOT NULL,
    legal_name text,
    slug text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    primary_contact_email text,
    country_code text,
    default_timezone text DEFAULT 'America/Chicago'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenants_status_check CHECK ((status = ANY (ARRAY['provisioning'::text, 'active'::text, 'suspended'::text, 'inactive'::text])))
);


--
-- Name: TABLE tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenants IS 'QualiSphere platform-level company and tenant registry. One row represents one customer organization or internal QualiSphere tenant.';


--
-- Name: training_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    assigned_to_email text NOT NULL,
    assigned_by_email text,
    assignment_source text DEFAULT 'document_release'::text,
    role_name text,
    department text,
    training_title text,
    training_description text,
    due_date date,
    status text DEFAULT 'assigned'::text,
    completed_at timestamp with time zone,
    completed_by text,
    effectiveness_required boolean DEFAULT false,
    effectiveness_status text DEFAULT 'not_required'::text,
    supervisor_verification_required boolean DEFAULT false,
    supervisor_verified_by text,
    supervisor_verified_at timestamp with time zone,
    acknowledgement_required boolean DEFAULT true,
    acknowledged_at timestamp with time zone,
    training_comments text,
    created_at timestamp with time zone DEFAULT now(),
    originating_change_control_id uuid,
    signature_id uuid,
    acknowledged_by text,
    retraining_assignment boolean DEFAULT false,
    source_document_revision text,
    previous_training_assignment_id uuid,
    tenant_id uuid NOT NULL,
    training_requirement_id uuid,
    training_group_id uuid,
    training_method_id uuid,
    release_blocking boolean DEFAULT false NOT NULL,
    training_category text DEFAULT 'standard'::text NOT NULL,
    recurrence_months integer,
    recurrence_basis text,
    recurring_evidence_mode text,
    recurring_next_due_date date,
    recurring_parent_assignment_id uuid,
    training_evidence_storage_path text,
    training_evidence_file_name text,
    training_valid_until date,
    retraining_due_date date,
    training_completed_on date,
    approved_evaluation_attachment_required boolean DEFAULT false NOT NULL,
    supervisor_designee_evidence_approval_required boolean DEFAULT false NOT NULL,
    CONSTRAINT training_assignments_recurrence_basis_check CHECK ((recurrence_basis = ANY (ARRAY['completion'::text, 'calendar'::text]))),
    CONSTRAINT training_assignments_recurrence_months_check CHECK (((recurrence_months >= 1) AND (recurrence_months <= 120))),
    CONSTRAINT training_assignments_recurring_evidence_mode_check CHECK ((recurring_evidence_mode = ANY (ARRAY['signature'::text, 'attachment'::text, 'both'::text]))),
    CONSTRAINT training_assignments_training_category_check CHECK ((training_category = ANY (ARRAY['standard'::text, 'certification'::text, 'recurring'::text])))
);


--
-- Name: COLUMN training_assignments.training_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_assignments.training_category IS 'Certification training is a requirement/assignment, NOT proof of QA-approved certification.';


--
-- Name: COLUMN training_assignments.recurring_next_due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_assignments.recurring_next_due_date IS 'Planning field only; no automatic assignment or notification generation until scheduler is enabled.';


--
-- Name: COLUMN training_assignments.training_evidence_storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_assignments.training_evidence_storage_path IS 'Private tenant-scoped storage object path for signed training evidence; not a public URL.';


--
-- Name: COLUMN training_assignments.training_valid_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_assignments.training_valid_until IS 'Optional date through which the documented qualification is valid.';


--
-- Name: COLUMN training_assignments.retraining_due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_assignments.retraining_due_date IS 'Optional date on which retraining becomes due.';


--
-- Name: training_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.qualisphere_resolve_training_tenant() NOT NULL,
    employee_email text NOT NULL,
    certification_title text NOT NULL,
    training_assignment_id uuid,
    certified_on date NOT NULL,
    expires_on date,
    reminder_days integer DEFAULT 30 NOT NULL,
    assessor_email text,
    evidence_reference text,
    notes text,
    renewal_of_id uuid,
    created_by_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    evidence_storage_path text,
    evidence_file_name text,
    qa_approved_by text,
    qa_approved_on date,
    training_requirements_reference text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_certification_valid_dates CHECK ((expires_on >= certified_on)),
    CONSTRAINT training_certifications_certification_title_check CHECK ((length(btrim(certification_title)) > 0)),
    CONSTRAINT training_certifications_employee_email_check CHECK ((length(btrim(employee_email)) > 0)),
    CONSTRAINT training_certifications_reminder_days_check CHECK (((reminder_days >= 0) AND (reminder_days <= 365)))
);


--
-- Name: TABLE training_certifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.training_certifications IS 'Evidence registry for externally QA-approved employee certifications; QualiSphere does not issue or approve certifications. Renewals are separate historical records.';


--
-- Name: COLUMN training_certifications.expires_on; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_certifications.expires_on IS 'Nullable for certifications without a defined expiration; no expiry must be supported in UI.';


--
-- Name: COLUMN training_certifications.evidence_storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.training_certifications.evidence_storage_path IS 'Private storage object path of the actual QA-approved certification form; never a public URL.';


--
-- Name: training_compliance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_compliance_settings (
    tenant_id uuid NOT NULL,
    warning_overdue_days integer DEFAULT 7 NOT NULL,
    critical_overdue_days integer DEFAULT 30 NOT NULL,
    manager_escalation_enabled boolean DEFAULT false NOT NULL,
    manager_escalation_after_days integer DEFAULT 14 NOT NULL,
    audit_snapshot_enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_compliance_settings_critical_overdue_days_check CHECK (((critical_overdue_days >= 1) AND (critical_overdue_days <= 730))),
    CONSTRAINT training_compliance_settings_manager_escalation_after_day_check CHECK (((manager_escalation_after_days >= 1) AND (manager_escalation_after_days <= 365))),
    CONSTRAINT training_compliance_settings_warning_overdue_days_check CHECK (((warning_overdue_days >= 0) AND (warning_overdue_days <= 365))),
    CONSTRAINT training_threshold_order CHECK ((critical_overdue_days > warning_overdue_days))
);


--
-- Name: TABLE training_compliance_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.training_compliance_settings IS 'Tenant-scoped training governance policy. Manager escalation and audit snapshots remain disabled until separate reviewed implementations are deployed.';


--
-- Name: training_effectiveness_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_effectiveness_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_assignment_id uuid,
    effectiveness_method text,
    effectiveness_result text,
    verified_by text,
    verified_at timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: training_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    training_group_id uuid NOT NULL,
    user_email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: training_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    group_name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: training_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_matrix (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name text,
    department text,
    document_number text,
    required_training boolean DEFAULT true,
    effectiveness_required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: training_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    release_blocking boolean DEFAULT false NOT NULL,
    acknowledgement_required boolean DEFAULT true NOT NULL,
    evidence_required boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: training_retraining_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_retraining_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type text,
    department text,
    retraining_required boolean DEFAULT true,
    retraining_reason text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_email text,
    role text,
    job_title text,
    department text,
    account_status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: user_security_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_security_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    role_code text NOT NULL,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    task_type text NOT NULL,
    task_title text,
    task_instructions text,
    assigned_to_email text NOT NULL,
    assigned_by_email text,
    status text DEFAULT 'pending'::text,
    due_date date,
    completion_comment text,
    signature_meaning text,
    signed_by text,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_matrix_reviewers approval_matrix_reviewers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_reviewers
    ADD CONSTRAINT approval_matrix_reviewers_pkey PRIMARY KEY (id);


--
-- Name: approval_matrix_template_reviewers approval_matrix_template_reviewers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_template_reviewers
    ADD CONSTRAINT approval_matrix_template_reviewers_pkey PRIMARY KEY (id);


--
-- Name: approval_matrix_template_rows approval_matrix_template_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_template_rows
    ADD CONSTRAINT approval_matrix_template_rows_pkey PRIMARY KEY (id);


--
-- Name: approval_matrix_templates approval_matrix_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_templates
    ADD CONSTRAINT approval_matrix_templates_pkey PRIMARY KEY (id);


--
-- Name: approval_tasks approval_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_tasks
    ADD CONSTRAINT approval_tasks_pkey PRIMARY KEY (id);


--
-- Name: audit_findings audit_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_findings
    ADD CONSTRAINT audit_findings_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_number_counters audit_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_number_counters
    ADD CONSTRAINT audit_number_counters_pkey PRIMARY KEY (record_year);


--
-- Name: audit_tenant_number_counters audit_tenant_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_tenant_number_counters
    ADD CONSTRAINT audit_tenant_number_counters_pkey PRIMARY KEY (tenant_id, record_year);


--
-- Name: audits audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
    ADD CONSTRAINT audits_pkey PRIMARY KEY (id);


--
-- Name: capa_approval_tasks capa_approval_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_approval_tasks
    ADD CONSTRAINT capa_approval_tasks_pkey PRIMARY KEY (id);


--
-- Name: capa_gate_approvers capa_gate_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_gate_approvers
    ADD CONSTRAINT capa_gate_approvers_pkey PRIMARY KEY (id);


--
-- Name: capa_tasks capa_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_tasks
    ADD CONSTRAINT capa_tasks_pkey PRIMARY KEY (id);


--
-- Name: capa_tenant_number_counters capa_tenant_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_tenant_number_counters
    ADD CONSTRAINT capa_tenant_number_counters_pkey PRIMARY KEY (tenant_id);


--
-- Name: capa_workflow_returns capa_workflow_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_workflow_returns
    ADD CONSTRAINT capa_workflow_returns_pkey PRIMARY KEY (id);


--
-- Name: capas capas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas
    ADD CONSTRAINT capas_pkey PRIMARY KEY (id);


--
-- Name: training_certifications certification_expiry_after_approval; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.training_certifications
    ADD CONSTRAINT certification_expiry_after_approval CHECK (((qa_approved_on IS NULL) OR (expires_on IS NULL) OR (expires_on >= qa_approved_on))) NOT VALID;


--
-- Name: training_certifications certification_requires_approved_evidence; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.training_certifications
    ADD CONSTRAINT certification_requires_approved_evidence CHECK (((evidence_storage_path IS NOT NULL) AND (length(btrim(evidence_storage_path)) > 0) AND (evidence_file_name IS NOT NULL) AND (length(btrim(evidence_file_name)) > 0) AND (qa_approved_by IS NOT NULL) AND (length(btrim(qa_approved_by)) > 0) AND (qa_approved_on IS NOT NULL))) NOT VALID;


--
-- Name: change_control_documents change_control_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_documents
    ADD CONSTRAINT change_control_documents_pkey PRIMARY KEY (id);


--
-- Name: change_control_products change_control_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_products
    ADD CONSTRAINT change_control_products_pkey PRIMARY KEY (id);


--
-- Name: change_control_reviewers change_control_reviewers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_reviewers
    ADD CONSTRAINT change_control_reviewers_pkey PRIMARY KEY (id);


--
-- Name: change_control_tasks change_control_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_tasks
    ADD CONSTRAINT change_control_tasks_pkey PRIMARY KEY (id);


--
-- Name: change_control_tenant_number_counters change_control_tenant_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_tenant_number_counters
    ADD CONSTRAINT change_control_tenant_number_counters_pkey PRIMARY KEY (tenant_id, calendar_year);


--
-- Name: change_controls change_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_controls
    ADD CONSTRAINT change_controls_pkey PRIMARY KEY (id);


--
-- Name: collaboration_comments collaboration_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_comments
    ADD CONSTRAINT collaboration_comments_pkey PRIMARY KEY (id);


--
-- Name: collaboration_participants collaboration_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_participants
    ADD CONSTRAINT collaboration_participants_pkey PRIMARY KEY (id);


--
-- Name: collaboration_participants collaboration_participants_thread_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_participants
    ADD CONSTRAINT collaboration_participants_thread_id_user_email_key UNIQUE (thread_id, user_email);


--
-- Name: collaboration_threads collaboration_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_threads
    ADD CONSTRAINT collaboration_threads_pkey PRIMARY KEY (id);


--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configu_company_name_module_name_kpi__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_dashboard_kpi_configuration
    ADD CONSTRAINT company_dashboard_kpi_configu_company_name_module_name_kpi__key UNIQUE (company_name, module_name, kpi_key);


--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_dashboard_kpi_configuration
    ADD CONSTRAINT company_dashboard_kpi_configuration_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: complaint_activity_log complaint_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_activity_log
    ADD CONSTRAINT complaint_activity_log_pkey PRIMARY KEY (id);


--
-- Name: complaint_attachments complaint_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_attachments
    ADD CONSTRAINT complaint_attachments_pkey PRIMARY KEY (id);


--
-- Name: complaint_quality_links complaint_quality_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_quality_links
    ADD CONSTRAINT complaint_quality_links_pkey PRIMARY KEY (id);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: controlled_documents controlled_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_documents
    ADD CONSTRAINT controlled_documents_pkey PRIMARY KEY (id);


--
-- Name: custom_kpi_definitions custom_kpi_definitions_company_name_module_name_kpi_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_kpi_definitions
    ADD CONSTRAINT custom_kpi_definitions_company_name_module_name_kpi_key_key UNIQUE (company_name, module_name, kpi_key);


--
-- Name: custom_kpi_definitions custom_kpi_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_kpi_definitions
    ADD CONSTRAINT custom_kpi_definitions_pkey PRIMARY KEY (id);


--
-- Name: customer_role_permissions customer_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: customer_role_permissions customer_role_permissions_role_id_permission_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_role_id_permission_code_key UNIQUE (role_id, permission_code);


--
-- Name: customer_roles customer_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_roles
    ADD CONSTRAINT customer_roles_pkey PRIMARY KEY (id);


--
-- Name: customer_roles customer_roles_tenant_id_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_roles
    ADD CONSTRAINT customer_roles_tenant_id_role_name_key UNIQUE (tenant_id, role_name);


--
-- Name: dashboard_kpi_configuration dashboard_kpi_configuration_module_name_kpi_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_kpi_configuration
    ADD CONSTRAINT dashboard_kpi_configuration_module_name_kpi_key_key UNIQUE (module_name, kpi_key);


--
-- Name: dashboard_kpi_configuration dashboard_kpi_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_kpi_configuration
    ADD CONSTRAINT dashboard_kpi_configuration_pkey PRIMARY KEY (id);


--
-- Name: dci_pdf_verifications dci_pdf_verifications_document_id_pdf_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dci_pdf_verifications
    ADD CONSTRAINT dci_pdf_verifications_document_id_pdf_storage_path_key UNIQUE (document_id, pdf_storage_path);


--
-- Name: dci_pdf_verifications dci_pdf_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dci_pdf_verifications
    ADD CONSTRAINT dci_pdf_verifications_pkey PRIMARY KEY (id);


--
-- Name: document_acknowledgements document_acknowledgements_document_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_document_id_user_email_key UNIQUE (document_id, user_email);


--
-- Name: document_acknowledgements document_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_pkey PRIMARY KEY (id);


--
-- Name: document_assigned_reviewers document_assigned_reviewers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assigned_reviewers
    ADD CONSTRAINT document_assigned_reviewers_pkey PRIMARY KEY (id);


--
-- Name: document_change_document_files document_change_document_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_document_files
    ADD CONSTRAINT document_change_document_files_pkey PRIMARY KEY (id);


--
-- Name: document_change_initiation_documents document_change_initiation_documents_dic_id_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiation_documents
    ADD CONSTRAINT document_change_initiation_documents_dic_id_document_id_key UNIQUE (dci_id, document_id);


--
-- Name: document_change_initiation_documents document_change_initiation_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiation_documents
    ADD CONSTRAINT document_change_initiation_documents_pkey PRIMARY KEY (id);


--
-- Name: document_change_initiations document_change_initiations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiations
    ADD CONSTRAINT document_change_initiations_pkey PRIMARY KEY (id);


--
-- Name: document_change_initiations document_change_initiations_tenant_id_dic_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiations
    ADD CONSTRAINT document_change_initiations_tenant_id_dic_number_key UNIQUE (tenant_id, dci_number);


--
-- Name: document_change_number_counters document_change_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_number_counters
    ADD CONSTRAINT document_change_number_counters_pkey PRIMARY KEY (tenant_id);


--
-- Name: document_collaboration_reviews document_collaboration_reviews_document_id_reviewer_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_collaboration_reviews
    ADD CONSTRAINT document_collaboration_reviews_document_id_reviewer_email_key UNIQUE (document_id, reviewer_email);


--
-- Name: document_collaboration_reviews document_collaboration_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_collaboration_reviews
    ADD CONSTRAINT document_collaboration_reviews_pkey PRIMARY KEY (id);


--
-- Name: document_formal_reviews document_formal_reviews_document_id_reviewer_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_formal_reviews
    ADD CONSTRAINT document_formal_reviews_document_id_reviewer_email_key UNIQUE (document_id, reviewer_email);


--
-- Name: document_formal_reviews document_formal_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_formal_reviews
    ADD CONSTRAINT document_formal_reviews_pkey PRIMARY KEY (id);


--
-- Name: document_impact_assessments document_impact_assessments_document_id_impact_area_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_impact_assessments
    ADD CONSTRAINT document_impact_assessments_document_id_impact_area_key UNIQUE (document_id, impact_area);


--
-- Name: document_impact_assessments document_impact_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_impact_assessments
    ADD CONSTRAINT document_impact_assessments_pkey PRIMARY KEY (id);


--
-- Name: document_number_sequences document_number_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_sequences
    ADD CONSTRAINT document_number_sequences_pkey PRIMARY KEY (id);


--
-- Name: document_relationships document_relationships_parent_document_id_related_document__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relationships
    ADD CONSTRAINT document_relationships_parent_document_id_related_document__key UNIQUE (parent_document_id, related_document_id, relationship_type);


--
-- Name: document_relationships document_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relationships
    ADD CONSTRAINT document_relationships_pkey PRIMARY KEY (id);


--
-- Name: document_training_assignments document_training_assignments_document_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_assignments
    ADD CONSTRAINT document_training_assignments_document_id_user_email_key UNIQUE (document_id, user_email);


--
-- Name: document_training_assignments document_training_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_assignments
    ADD CONSTRAINT document_training_assignments_pkey PRIMARY KEY (id);


--
-- Name: document_training_requirements document_training_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_requirements
    ADD CONSTRAINT document_training_requirements_pkey PRIMARY KEY (id);


--
-- Name: document_workflow_events document_workflow_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_workflow_events
    ADD CONSTRAINT document_workflow_events_pkey PRIMARY KEY (id);


--
-- Name: electronic_signatures electronic_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_signatures
    ADD CONSTRAINT electronic_signatures_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_tenant_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_tenant_user_email_key UNIQUE (tenant_id, user_email);


--
-- Name: equipment_calibration_events equipment_calibration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_calibration_events
    ADD CONSTRAINT equipment_calibration_events_pkey PRIMARY KEY (id);


--
-- Name: equipment_calibration_events equipment_calibration_events_tenant_id_calibration_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_calibration_events
    ADD CONSTRAINT equipment_calibration_events_tenant_id_calibration_number_key UNIQUE (tenant_id, calibration_number);


--
-- Name: equipment_change_control_links equipment_change_control_link_equipment_id_change_control_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_change_control_links
    ADD CONSTRAINT equipment_change_control_link_equipment_id_change_control_i_key UNIQUE (equipment_id, change_control_id);


--
-- Name: equipment_change_control_links equipment_change_control_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_change_control_links
    ADD CONSTRAINT equipment_change_control_links_pkey PRIMARY KEY (id);


--
-- Name: equipment_document_links equipment_document_links_equipment_id_document_id_relations_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_document_links
    ADD CONSTRAINT equipment_document_links_equipment_id_document_id_relations_key UNIQUE (equipment_id, document_id, relationship_type);


--
-- Name: equipment_document_links equipment_document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_document_links
    ADD CONSTRAINT equipment_document_links_pkey PRIMARY KEY (id);


--
-- Name: equipment_event_number_counters equipment_event_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_event_number_counters
    ADD CONSTRAINT equipment_event_number_counters_pkey PRIMARY KEY (id);


--
-- Name: equipment_event_number_counters equipment_event_number_counters_tenant_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_event_number_counters
    ADD CONSTRAINT equipment_event_number_counters_tenant_id_event_type_key UNIQUE (tenant_id, event_type);


--
-- Name: equipment_governance_members equipment_governance_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_governance_members
    ADD CONSTRAINT equipment_governance_members_pkey PRIMARY KEY (id);


--
-- Name: equipment_governance_members equipment_governance_members_tenant_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_governance_members
    ADD CONSTRAINT equipment_governance_members_tenant_id_user_email_key UNIQUE (tenant_id, user_email);


--
-- Name: equipment_import_batches equipment_import_batches_batch_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_import_batches
    ADD CONSTRAINT equipment_import_batches_batch_number_key UNIQUE (batch_number);


--
-- Name: equipment_import_batches equipment_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_import_batches
    ADD CONSTRAINT equipment_import_batches_pkey PRIMARY KEY (id);


--
-- Name: equipment_import_rows equipment_import_rows_batch_id_row_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_import_rows
    ADD CONSTRAINT equipment_import_rows_batch_id_row_number_key UNIQUE (batch_id, row_number);


--
-- Name: equipment_import_rows equipment_import_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_import_rows
    ADD CONSTRAINT equipment_import_rows_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_components equipment_maintenance_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_components
    ADD CONSTRAINT equipment_maintenance_components_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_events equipment_maintenance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_events
    ADD CONSTRAINT equipment_maintenance_events_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_events equipment_maintenance_events_tenant_id_maintenance_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_events
    ADD CONSTRAINT equipment_maintenance_events_tenant_id_maintenance_number_key UNIQUE (tenant_id, maintenance_number);


--
-- Name: equipment_numbering_configurations equipment_numbering_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_numbering_configurations
    ADD CONSTRAINT equipment_numbering_configurations_pkey PRIMARY KEY (id);


--
-- Name: equipment_numbering_configurations equipment_numbering_configurations_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_numbering_configurations
    ADD CONSTRAINT equipment_numbering_configurations_tenant_id_key UNIQUE (tenant_id);


--
-- Name: equipment_oos_oot_links equipment_oos_oot_links_equipment_id_oos_oot_id_source_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_oos_oot_links
    ADD CONSTRAINT equipment_oos_oot_links_equipment_id_oos_oot_id_source_type_key UNIQUE (equipment_id, oos_oot_id, source_type, source_record_id);


--
-- Name: equipment_oos_oot_links equipment_oos_oot_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_oos_oot_links
    ADD CONSTRAINT equipment_oos_oot_links_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: equipment_post_maintenance_assessments equipment_post_maintenance_assessments_maintenance_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_post_maintenance_assessments
    ADD CONSTRAINT equipment_post_maintenance_assessments_maintenance_event_id_key UNIQUE (maintenance_event_id);


--
-- Name: equipment_post_maintenance_assessments equipment_post_maintenance_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_post_maintenance_assessments
    ADD CONSTRAINT equipment_post_maintenance_assessments_pkey PRIMARY KEY (id);


--
-- Name: equipment_qualification_events equipment_qualification_event_tenant_id_qualification_numbe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_qualification_events
    ADD CONSTRAINT equipment_qualification_event_tenant_id_qualification_numbe_key UNIQUE (tenant_id, qualification_number);


--
-- Name: equipment_qualification_events equipment_qualification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_qualification_events
    ADD CONSTRAINT equipment_qualification_events_pkey PRIMARY KEY (id);


--
-- Name: equipment_release_requests equipment_release_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_release_requests
    ADD CONSTRAINT equipment_release_requests_pkey PRIMARY KEY (id);


--
-- Name: equipment_schedule_configurations equipment_schedule_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_schedule_configurations
    ADD CONSTRAINT equipment_schedule_configurations_pkey PRIMARY KEY (id);


--
-- Name: equipment_schedule_notifications equipment_schedule_notificati_schedule_configuration_id_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_schedule_notifications
    ADD CONSTRAINT equipment_schedule_notificati_schedule_configuration_id_day_key UNIQUE (schedule_configuration_id, days_before_due, recipient_type, recipient_email);


--
-- Name: equipment_schedule_notifications equipment_schedule_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_schedule_notifications
    ADD CONSTRAINT equipment_schedule_notifications_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_tenant_id_equipment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_tenant_id_equipment_number_key UNIQUE (tenant_id, equipment_number);


--
-- Name: governance_rules governance_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_rules
    ADD CONSTRAINT governance_rules_pkey PRIMARY KEY (id);


--
-- Name: kpi_history kpi_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_history
    ADD CONSTRAINT kpi_history_pkey PRIMARY KEY (id);


--
-- Name: kpi_library_definitions kpi_library_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_library_definitions
    ADD CONSTRAINT kpi_library_definitions_pkey PRIMARY KEY (id);


--
-- Name: kpi_library kpi_library_module_name_kpi_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_library
    ADD CONSTRAINT kpi_library_module_name_kpi_key_key UNIQUE (module_name, kpi_key);


--
-- Name: kpi_library kpi_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_library
    ADD CONSTRAINT kpi_library_pkey PRIMARY KEY (id);


--
-- Name: management_review_actions management_review_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_actions
    ADD CONSTRAINT management_review_actions_pkey PRIMARY KEY (id);


--
-- Name: management_review_approvers management_review_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_approvers
    ADD CONSTRAINT management_review_approvers_pkey PRIMARY KEY (id);


--
-- Name: management_review_reports management_review_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_reports
    ADD CONSTRAINT management_review_reports_pkey PRIMARY KEY (id);


--
-- Name: management_reviews management_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_reviews
    ADD CONSTRAINT management_reviews_pkey PRIMARY KEY (id);


--
-- Name: management_reviews management_reviews_review_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_reviews
    ADD CONSTRAINT management_reviews_review_number_key UNIQUE (review_number);


--
-- Name: md_defect_categories md_defect_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_defect_categories
    ADD CONSTRAINT md_defect_categories_pkey PRIMARY KEY (id);


--
-- Name: md_defect_subcategories md_defect_subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_defect_subcategories
    ADD CONSTRAINT md_defect_subcategories_pkey PRIMARY KEY (id);


--
-- Name: md_departments md_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_departments
    ADD CONSTRAINT md_departments_pkey PRIMARY KEY (id);


--
-- Name: md_detection_sources md_detection_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_detection_sources
    ADD CONSTRAINT md_detection_sources_pkey PRIMARY KEY (id);


--
-- Name: md_dispositions md_dispositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_dispositions
    ADD CONSTRAINT md_dispositions_pkey PRIMARY KEY (id);


--
-- Name: md_document_impact_areas md_document_impact_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_document_impact_areas
    ADD CONSTRAINT md_document_impact_areas_pkey PRIMARY KEY (id);


--
-- Name: md_document_impact_areas md_document_impact_areas_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_document_impact_areas
    ADD CONSTRAINT md_document_impact_areas_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: md_equipment md_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_equipment
    ADD CONSTRAINT md_equipment_pkey PRIMARY KEY (id);


--
-- Name: md_material_statuses md_material_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_material_statuses
    ADD CONSTRAINT md_material_statuses_pkey PRIMARY KEY (id);


--
-- Name: md_oos_limits md_oos_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_oos_limits
    ADD CONSTRAINT md_oos_limits_pkey PRIMARY KEY (id);


--
-- Name: md_product_part_numbers md_product_part_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_product_part_numbers
    ADD CONSTRAINT md_product_part_numbers_pkey PRIMARY KEY (id);


--
-- Name: md_rooms md_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_rooms
    ADD CONSTRAINT md_rooms_pkey PRIMARY KEY (id);


--
-- Name: md_root_cause_categories md_root_cause_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_root_cause_categories
    ADD CONSTRAINT md_root_cause_categories_code_key UNIQUE (code);


--
-- Name: md_root_cause_categories md_root_cause_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_root_cause_categories
    ADD CONSTRAINT md_root_cause_categories_pkey PRIMARY KEY (id);


--
-- Name: md_test_methods md_test_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_test_methods
    ADD CONSTRAINT md_test_methods_pkey PRIMARY KEY (id);


--
-- Name: ncmr_affected_items ncmr_affected_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_affected_items
    ADD CONSTRAINT ncmr_affected_items_pkey PRIMARY KEY (id);


--
-- Name: ncmr_comments ncmr_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_comments
    ADD CONSTRAINT ncmr_comments_pkey PRIMARY KEY (id);


--
-- Name: ncmr_mrb_approvers ncmr_mrb_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_mrb_approvers
    ADD CONSTRAINT ncmr_mrb_approvers_pkey PRIMARY KEY (id);


--
-- Name: ncmr_mrb_reviewers ncmr_mrb_reviewers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_mrb_reviewers
    ADD CONSTRAINT ncmr_mrb_reviewers_pkey PRIMARY KEY (id);


--
-- Name: ncmr_tenant_number_counters ncmr_tenant_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_tenant_number_counters
    ADD CONSTRAINT ncmr_tenant_number_counters_pkey PRIMARY KEY (tenant_id);


--
-- Name: ncmrs ncmrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmrs
    ADD CONSTRAINT ncmrs_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_email_module_notification_typ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_email_module_notification_typ_key UNIQUE (user_email, module, notification_type);


--
-- Name: notification_queue notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: oos_oot_investigations oos_oot_investigations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oos_oot_investigations
    ADD CONSTRAINT oos_oot_investigations_pkey PRIMARY KEY (id);


--
-- Name: oos_oot_number_counters oos_oot_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oos_oot_number_counters
    ADD CONSTRAINT oos_oot_number_counters_pkey PRIMARY KEY (prefix);


--
-- Name: oos_oot_tenant_number_counters oos_oot_tenant_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oos_oot_tenant_number_counters
    ADD CONSTRAINT oos_oot_tenant_number_counters_pkey PRIMARY KEY (tenant_id, prefix);


--
-- Name: platform_administrators platform_administrators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_administrators
    ADD CONSTRAINT platform_administrators_pkey PRIMARY KEY (id);


--
-- Name: printable_management_review_signatures printable_management_review_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printable_management_review_signatures
    ADD CONSTRAINT printable_management_review_signatures_pkey PRIMARY KEY (id);


--
-- Name: printable_management_reviews printable_management_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printable_management_reviews
    ADD CONSTRAINT printable_management_reviews_pkey PRIMARY KEY (id);


--
-- Name: qms_capa_governance_rules qms_capa_governance_rules_configuration_version_id_trigger__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_capa_governance_rules
    ADD CONSTRAINT qms_capa_governance_rules_configuration_version_id_trigger__key UNIQUE (configuration_version_id, trigger_type, trigger_value);


--
-- Name: qms_capa_governance_rules qms_capa_governance_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_capa_governance_rules
    ADD CONSTRAINT qms_capa_governance_rules_pkey PRIMARY KEY (id);


--
-- Name: qms_configuration_audit_log qms_configuration_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_configuration_audit_log
    ADD CONSTRAINT qms_configuration_audit_log_pkey PRIMARY KEY (id);


--
-- Name: qms_configuration_versions qms_configuration_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_configuration_versions
    ADD CONSTRAINT qms_configuration_versions_pkey PRIMARY KEY (id);


--
-- Name: qms_decision_snapshots qms_decision_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_decision_snapshots
    ADD CONSTRAINT qms_decision_snapshots_pkey PRIMARY KEY (id);


--
-- Name: qms_module_record_migrations qms_module_record_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_module_record_migrations
    ADD CONSTRAINT qms_module_record_migrations_pkey PRIMARY KEY (id);


--
-- Name: qms_module_release_events qms_module_release_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_module_release_events
    ADD CONSTRAINT qms_module_release_events_pkey PRIMARY KEY (id);


--
-- Name: qms_record_snapshots qms_record_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_record_snapshots
    ADD CONSTRAINT qms_record_snapshots_pkey PRIMARY KEY (id);


--
-- Name: qms_record_snapshots qms_record_snapshots_unique_record_snapshot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_record_snapshots
    ADD CONSTRAINT qms_record_snapshots_unique_record_snapshot UNIQUE (module_code, record_id, snapshot_type);


--
-- Name: qms_record_structure_freezes qms_record_structure_freezes_module_code_record_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_record_structure_freezes
    ADD CONSTRAINT qms_record_structure_freezes_module_code_record_id_key UNIQUE (module_code, record_id);


--
-- Name: qms_record_structure_freezes qms_record_structure_freezes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_record_structure_freezes
    ADD CONSTRAINT qms_record_structure_freezes_pkey PRIMARY KEY (id);


--
-- Name: qms_record_structure_templates qms_record_structure_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_record_structure_templates
    ADD CONSTRAINT qms_record_structure_templates_pkey PRIMARY KEY (id);


--
-- Name: qms_risk_matrix_rules qms_risk_matrix_rules_configuration_version_id_severity_occ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_risk_matrix_rules
    ADD CONSTRAINT qms_risk_matrix_rules_configuration_version_id_severity_occ_key UNIQUE (configuration_version_id, severity, occurrence, detection);


--
-- Name: qms_risk_matrix_rules qms_risk_matrix_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_risk_matrix_rules
    ADD CONSTRAINT qms_risk_matrix_rules_pkey PRIMARY KEY (id);


--
-- Name: qms_workflow_versions qms_workflow_versions_module_code_version_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_workflow_versions
    ADD CONSTRAINT qms_workflow_versions_module_code_version_code_key UNIQUE (module_code, version_code);


--
-- Name: qms_workflow_versions qms_workflow_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_workflow_versions
    ADD CONSTRAINT qms_workflow_versions_pkey PRIMARY KEY (id);


--
-- Name: receiving_inspections receiving_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_inspections
    ADD CONSTRAINT receiving_inspections_pkey PRIMARY KEY (id);


--
-- Name: record_number_counters record_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_number_counters
    ADD CONSTRAINT record_number_counters_pkey PRIMARY KEY (record_type, record_year);


--
-- Name: scar_tenant_number_counters scar_tenant_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scar_tenant_number_counters
    ADD CONSTRAINT scar_tenant_number_counters_pkey PRIMARY KEY (tenant_id);


--
-- Name: scars scars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scars
    ADD CONSTRAINT scars_pkey PRIMARY KEY (id);


--
-- Name: security_roles security_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_roles
    ADD CONSTRAINT security_roles_pkey PRIMARY KEY (code);


--
-- Name: supplier_audit_findings supplier_audit_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audit_findings
    ADD CONSTRAINT supplier_audit_findings_pkey PRIMARY KEY (id);


--
-- Name: supplier_audits supplier_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audits
    ADD CONSTRAINT supplier_audits_pkey PRIMARY KEY (id);


--
-- Name: supplier_documents supplier_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_documents
    ADD CONSTRAINT supplier_documents_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tenant_customer_contacts tenant_customer_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_customer_contacts
    ADD CONSTRAINT tenant_customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: tenant_customer_contacts tenant_customer_contacts_tenant_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_customer_contacts
    ADD CONSTRAINT tenant_customer_contacts_tenant_id_user_email_key UNIQUE (tenant_id, user_email);


--
-- Name: tenant_memberships tenant_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_pkey PRIMARY KEY (id);


--
-- Name: tenant_module_access tenant_module_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_access
    ADD CONSTRAINT tenant_module_access_pkey PRIMARY KEY (id);


--
-- Name: tenant_module_access tenant_module_access_tenant_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_access
    ADD CONSTRAINT tenant_module_access_tenant_module_key UNIQUE (tenant_id, module_code);


--
-- Name: tenant_user_profiles tenant_user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_profiles
    ADD CONSTRAINT tenant_user_profiles_pkey PRIMARY KEY (id);


--
-- Name: tenant_user_profiles tenant_user_profiles_tenant_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_profiles
    ADD CONSTRAINT tenant_user_profiles_tenant_id_user_email_key UNIQUE (tenant_id, user_email);


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_role_assignments
    ADD CONSTRAINT tenant_user_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_tenant_id_user_email_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_role_assignments
    ADD CONSTRAINT tenant_user_role_assignments_tenant_id_user_email_role_id_key UNIQUE (tenant_id, user_email, role_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: tenants tenants_tenant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_tenant_code_key UNIQUE (tenant_code);


--
-- Name: training_assignments training_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_pkey PRIMARY KEY (id);


--
-- Name: training_certifications training_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_certifications
    ADD CONSTRAINT training_certifications_pkey PRIMARY KEY (id);


--
-- Name: training_compliance_settings training_compliance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_compliance_settings
    ADD CONSTRAINT training_compliance_settings_pkey PRIMARY KEY (tenant_id);


--
-- Name: training_effectiveness_checks training_effectiveness_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_effectiveness_checks
    ADD CONSTRAINT training_effectiveness_checks_pkey PRIMARY KEY (id);


--
-- Name: training_group_members training_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_group_members
    ADD CONSTRAINT training_group_members_pkey PRIMARY KEY (id);


--
-- Name: training_group_members training_group_members_training_group_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_group_members
    ADD CONSTRAINT training_group_members_training_group_id_user_email_key UNIQUE (training_group_id, user_email);


--
-- Name: training_groups training_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_pkey PRIMARY KEY (id);


--
-- Name: training_groups training_groups_tenant_id_group_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_tenant_id_group_name_key UNIQUE (tenant_id, group_name);


--
-- Name: training_matrix training_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_matrix
    ADD CONSTRAINT training_matrix_pkey PRIMARY KEY (id);


--
-- Name: training_methods training_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_methods
    ADD CONSTRAINT training_methods_pkey PRIMARY KEY (id);


--
-- Name: training_methods training_methods_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_methods
    ADD CONSTRAINT training_methods_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: training_retraining_rules training_retraining_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_retraining_rules
    ADD CONSTRAINT training_retraining_rules_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_email_key UNIQUE (user_email);


--
-- Name: user_security_roles user_security_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_security_roles
    ADD CONSTRAINT user_security_roles_pkey PRIMARY KEY (id);


--
-- Name: user_security_roles user_security_roles_user_role_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_security_roles
    ADD CONSTRAINT user_security_roles_user_role_unique UNIQUE (user_email, role_code);


--
-- Name: workflow_tasks workflow_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_pkey PRIMARY KEY (id);


--
-- Name: approval_tasks_document_impact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_tasks_document_impact_idx ON public.approval_tasks USING btree (document_impact_assessment_id);


--
-- Name: audit_findings_tenant_audit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_findings_tenant_audit_idx ON public.audit_findings USING btree (tenant_id, audit_id);


--
-- Name: audit_findings_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_findings_tenant_id_idx ON public.audit_findings USING btree (tenant_id);


--
-- Name: audits_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audits_tenant_id_idx ON public.audits USING btree (tenant_id);


--
-- Name: change_controls_tenant_change_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX change_controls_tenant_change_number_uidx ON public.change_controls USING btree (tenant_id, change_number);


--
-- Name: complaints_tenant_complaint_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX complaints_tenant_complaint_number_uidx ON public.complaints USING btree (tenant_id, complaint_number) WHERE (complaint_number IS NOT NULL);


--
-- Name: customer_role_permissions_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_role_permissions_role_idx ON public.customer_role_permissions USING btree (role_id);


--
-- Name: customer_role_permissions_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_role_permissions_tenant_idx ON public.customer_role_permissions USING btree (tenant_id);


--
-- Name: customer_roles_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_roles_tenant_idx ON public.customer_roles USING btree (tenant_id);


--
-- Name: dci_pdf_verifications_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dci_pdf_verifications_lookup ON public.dci_pdf_verifications USING btree (tenant_id, dci_id, document_id);


--
-- Name: document_impact_assessments_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_impact_assessments_document_idx ON public.document_impact_assessments USING btree (document_id);


--
-- Name: document_impact_assessments_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_impact_assessments_tenant_idx ON public.document_impact_assessments USING btree (tenant_id);


--
-- Name: document_training_requirements_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_training_requirements_document_idx ON public.document_training_requirements USING btree (document_id);


--
-- Name: employee_profiles_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_profiles_tenant_id_idx ON public.employee_profiles USING btree (tenant_id);


--
-- Name: idx_approval_matrix_template_rows_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_matrix_template_rows_template ON public.approval_matrix_template_rows USING btree (template_id);


--
-- Name: idx_approval_matrix_templates_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_matrix_templates_module ON public.approval_matrix_templates USING btree (module);


--
-- Name: idx_approval_tasks_ncmr_mrb_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_tasks_ncmr_mrb_cycle ON public.approval_tasks USING btree (entity_id, approval_cycle_id, task_type) WHERE (entity_type = 'ncmr'::text);


--
-- Name: idx_audit_findings_linked_capa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_findings_linked_capa_id ON public.audit_findings USING btree (linked_capa_id);


--
-- Name: idx_audit_findings_linked_scar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_findings_linked_scar_id ON public.audit_findings USING btree (linked_scar_id);


--
-- Name: idx_audit_logs_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_created_at ON public.audit_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_audit_logs_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_entity ON public.audit_logs USING btree (tenant_id, entity_type, entity_id);


--
-- Name: idx_audits_tenant_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audits_tenant_owner_status ON public.audits USING btree (tenant_id, owner_email, status);


--
-- Name: idx_capa_approval_tasks_capa_gate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capa_approval_tasks_capa_gate ON public.capa_approval_tasks USING btree (capa_id, approval_gate);


--
-- Name: idx_capa_gate_approvers_capa_gate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capa_gate_approvers_capa_gate ON public.capa_gate_approvers USING btree (capa_id, approval_gate);


--
-- Name: idx_capa_tasks_capa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capa_tasks_capa_id ON public.capa_tasks USING btree (capa_id);


--
-- Name: idx_capa_tasks_owner_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capa_tasks_owner_email ON public.capa_tasks USING btree (owner_email);


--
-- Name: idx_capa_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capa_tasks_status ON public.capa_tasks USING btree (status);


--
-- Name: idx_capa_workflow_returns_capa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capa_workflow_returns_capa ON public.capa_workflow_returns USING btree (capa_id, returned_at DESC);


--
-- Name: idx_capas_closure_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_closure_approval_status ON public.capas USING btree (closure_approval_status);


--
-- Name: idx_capas_implementation_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_implementation_approval_status ON public.capas USING btree (implementation_approval_status);


--
-- Name: idx_capas_investigation_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_investigation_approval_status ON public.capas USING btree (investigation_approval_status);


--
-- Name: idx_capas_owner_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_owner_email ON public.capas USING btree (owner_email);


--
-- Name: idx_capas_source_audit_finding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_source_audit_finding_id ON public.capas USING btree (source_audit_finding_id);


--
-- Name: idx_capas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_status ON public.capas USING btree (status);


--
-- Name: idx_capas_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capas_tenant_id ON public.capas USING btree (tenant_id);


--
-- Name: idx_change_control_documents_change_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_control_documents_change_id ON public.change_control_documents USING btree (change_control_id);


--
-- Name: idx_change_control_documents_unique_link; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_change_control_documents_unique_link ON public.change_control_documents USING btree (change_control_id, document_number);


--
-- Name: idx_change_control_products_change_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_control_products_change_id ON public.change_control_products USING btree (change_control_id);


--
-- Name: idx_change_control_tasks_change_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_control_tasks_change_id ON public.change_control_tasks USING btree (change_control_id);


--
-- Name: idx_change_control_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_control_tasks_status ON public.change_control_tasks USING btree (status);


--
-- Name: idx_change_controls_owner_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_controls_owner_email ON public.change_controls USING btree (owner_email);


--
-- Name: idx_change_controls_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_controls_risk ON public.change_controls USING btree (risk_level);


--
-- Name: idx_change_controls_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_controls_status ON public.change_controls USING btree (status);


--
-- Name: idx_change_controls_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_controls_type ON public.change_controls USING btree (change_type);


--
-- Name: idx_collaboration_comments_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaboration_comments_thread ON public.collaboration_comments USING btree (thread_id, created_at);


--
-- Name: idx_collaboration_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaboration_participants_user ON public.collaboration_participants USING btree (user_email, status);


--
-- Name: idx_collaboration_threads_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaboration_threads_record ON public.collaboration_threads USING btree (module, record_id);


--
-- Name: idx_company_settings_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_settings_company_name ON public.company_settings USING btree (company_name);


--
-- Name: idx_controlled_documents_dci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_controlled_documents_dci ON public.controlled_documents USING btree (dci_id);


--
-- Name: idx_controlled_documents_document_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_controlled_documents_document_number ON public.controlled_documents USING btree (document_number);


--
-- Name: idx_controlled_documents_effective_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_controlled_documents_effective_date ON public.controlled_documents USING btree (effective_date);


--
-- Name: idx_controlled_documents_owner_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_controlled_documents_owner_email ON public.controlled_documents USING btree (owner_email);


--
-- Name: idx_controlled_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_controlled_documents_status ON public.controlled_documents USING btree (status);


--
-- Name: idx_controlled_documents_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_controlled_documents_tenant_id ON public.controlled_documents USING btree (tenant_id);


--
-- Name: idx_dci_document_files_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dci_document_files_document ON public.document_change_document_files USING btree (dci_id, document_id, created_at);


--
-- Name: idx_dci_documents_dci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dci_documents_dci ON public.document_change_initiation_documents USING btree (dci_id, sequence_no);


--
-- Name: idx_dci_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dci_tenant_status ON public.document_change_initiations USING btree (tenant_id, status);


--
-- Name: idx_document_acknowledgements_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_acknowledgements_document_id ON public.document_acknowledgements USING btree (document_id);


--
-- Name: idx_document_acknowledgements_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_acknowledgements_user_email ON public.document_acknowledgements USING btree (user_email);


--
-- Name: idx_document_collaboration_reviews_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_collaboration_reviews_document_id ON public.document_collaboration_reviews USING btree (document_id);


--
-- Name: idx_document_formal_reviews_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_formal_reviews_document_id ON public.document_formal_reviews USING btree (document_id);


--
-- Name: idx_document_number_sequences_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_number_sequences_tenant ON public.document_number_sequences USING btree (tenant_id);


--
-- Name: idx_document_training_assignments_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_training_assignments_document_id ON public.document_training_assignments USING btree (document_id);


--
-- Name: idx_document_training_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_training_assignments_status ON public.document_training_assignments USING btree (status);


--
-- Name: idx_document_training_assignments_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_training_assignments_user_email ON public.document_training_assignments USING btree (user_email);


--
-- Name: idx_equipment_calibration_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_calibration_due ON public.equipment_calibration_events USING btree (tenant_id, status, scheduled_date, hard_due_date);


--
-- Name: idx_equipment_calibration_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_calibration_equipment ON public.equipment_calibration_events USING btree (tenant_id, equipment_id, performed_date DESC);


--
-- Name: idx_equipment_calibration_oos_oot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_calibration_oos_oot ON public.equipment_calibration_events USING btree (tenant_id, oos_oot_id) WHERE (oos_oot_id IS NOT NULL);


--
-- Name: idx_equipment_calibration_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_calibration_result ON public.equipment_calibration_events USING btree (tenant_id, result);


--
-- Name: idx_equipment_change_control_links_change; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_change_control_links_change ON public.equipment_change_control_links USING btree (tenant_id, change_control_id);


--
-- Name: idx_equipment_change_control_links_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_change_control_links_equipment ON public.equipment_change_control_links USING btree (tenant_id, equipment_id);


--
-- Name: idx_equipment_document_links_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_document_links_document ON public.equipment_document_links USING btree (tenant_id, document_id);


--
-- Name: idx_equipment_document_links_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_document_links_equipment ON public.equipment_document_links USING btree (tenant_id, equipment_id, is_active);


--
-- Name: idx_equipment_equipment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_equipment_status ON public.equipment USING btree (tenant_id, equipment_status);


--
-- Name: idx_equipment_governance_members_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_governance_members_lookup ON public.equipment_governance_members USING btree (tenant_id, lower(user_email), is_active);


--
-- Name: idx_equipment_import_batches_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_import_batches_tenant_status ON public.equipment_import_batches USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_equipment_import_rows_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_import_rows_batch_status ON public.equipment_import_rows USING btree (batch_id, validation_status, row_number);


--
-- Name: idx_equipment_lifecycle_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_lifecycle_phase ON public.equipment USING btree (tenant_id, lifecycle_phase);


--
-- Name: idx_equipment_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_location ON public.equipment USING btree (tenant_id, site_location);


--
-- Name: idx_equipment_maintenance_components_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_maintenance_components_event ON public.equipment_maintenance_components USING btree (tenant_id, maintenance_event_id);


--
-- Name: idx_equipment_maintenance_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_maintenance_due ON public.equipment_maintenance_events USING btree (tenant_id, status, scheduled_date, hard_due_date);


--
-- Name: idx_equipment_maintenance_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_maintenance_equipment ON public.equipment_maintenance_events USING btree (tenant_id, equipment_id, performed_date DESC);


--
-- Name: idx_equipment_maintenance_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_maintenance_type ON public.equipment_maintenance_events USING btree (tenant_id, maintenance_type, status);


--
-- Name: idx_equipment_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_number ON public.equipment USING btree (tenant_id, equipment_number);


--
-- Name: idx_equipment_oos_oot_links_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_oos_oot_links_equipment ON public.equipment_oos_oot_links USING btree (tenant_id, equipment_id);


--
-- Name: idx_equipment_oos_oot_links_oos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_oos_oot_links_oos ON public.equipment_oos_oot_links USING btree (tenant_id, oos_oot_id);


--
-- Name: idx_equipment_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_owner ON public.equipment USING btree (tenant_id, owner_email);


--
-- Name: idx_equipment_post_maintenance_assessment_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_post_maintenance_assessment_equipment ON public.equipment_post_maintenance_assessments USING btree (tenant_id, equipment_id);


--
-- Name: idx_equipment_qualification_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_qualification_equipment ON public.equipment_qualification_events USING btree (tenant_id, equipment_id, created_at DESC);


--
-- Name: idx_equipment_qualification_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_qualification_status ON public.equipment_qualification_events USING btree (tenant_id, status, approval_status);


--
-- Name: idx_equipment_qualification_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_qualification_target ON public.equipment_qualification_events USING btree (tenant_id, target_completion_date);


--
-- Name: idx_equipment_release_requests_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_release_requests_approver ON public.equipment_release_requests USING btree (lower(approver_email), status);


--
-- Name: idx_equipment_release_requests_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_release_requests_equipment ON public.equipment_release_requests USING btree (equipment_id, submitted_at DESC);


--
-- Name: idx_equipment_schedule_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_schedule_activity ON public.equipment_schedule_configurations USING btree (tenant_id, activity_type, is_active);


--
-- Name: idx_equipment_schedule_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_schedule_due ON public.equipment_schedule_configurations USING btree (tenant_id, activity_type, scheduled_service_date, hard_due_date);


--
-- Name: idx_equipment_schedule_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_schedule_equipment ON public.equipment_schedule_configurations USING btree (tenant_id, equipment_id);


--
-- Name: idx_equipment_schedule_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_schedule_family ON public.equipment_schedule_configurations USING btree (tenant_id, equipment_family);


--
-- Name: idx_equipment_schedule_notifications_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_schedule_notifications_schedule ON public.equipment_schedule_notifications USING btree (tenant_id, schedule_configuration_id);


--
-- Name: idx_equipment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_status ON public.equipment USING btree (tenant_id, lifecycle_status, use_status);


--
-- Name: idx_equipment_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_tenant ON public.equipment USING btree (tenant_id);


--
-- Name: idx_equipment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_type ON public.equipment USING btree (tenant_id, equipment_type);


--
-- Name: idx_esign_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_esign_module ON public.electronic_signatures USING btree (module_name);


--
-- Name: idx_esign_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_esign_record ON public.electronic_signatures USING btree (record_id);


--
-- Name: idx_kpi_history_company_kpi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpi_history_company_kpi ON public.kpi_history USING btree (company_name, kpi_key, captured_at);


--
-- Name: idx_management_review_actions_review_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_management_review_actions_review_id ON public.management_review_actions USING btree (management_review_id);


--
-- Name: idx_management_review_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_management_review_actions_status ON public.management_review_actions USING btree (action_status);


--
-- Name: idx_management_review_approvers_review_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_management_review_approvers_review_id ON public.management_review_approvers USING btree (management_review_id);


--
-- Name: idx_management_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_management_reviews_created_at ON public.management_reviews USING btree (created_at);


--
-- Name: idx_management_reviews_review_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_management_reviews_review_date ON public.management_reviews USING btree (review_date);


--
-- Name: idx_management_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_management_reviews_status ON public.management_reviews USING btree (status);


--
-- Name: idx_md_defect_categories_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_defect_categories_tenant ON public.md_defect_categories USING btree (tenant_id);


--
-- Name: idx_md_defect_subcategories_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_defect_subcategories_tenant ON public.md_defect_subcategories USING btree (tenant_id);


--
-- Name: idx_md_departments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_departments_tenant ON public.md_departments USING btree (tenant_id);


--
-- Name: idx_md_detection_sources_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_detection_sources_tenant ON public.md_detection_sources USING btree (tenant_id);


--
-- Name: idx_md_dispositions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_dispositions_tenant ON public.md_dispositions USING btree (tenant_id);


--
-- Name: idx_md_equipment_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_equipment_tenant ON public.md_equipment USING btree (tenant_id);


--
-- Name: idx_md_material_statuses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_material_statuses_tenant ON public.md_material_statuses USING btree (tenant_id);


--
-- Name: idx_md_oos_limits_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_oos_limits_tenant ON public.md_oos_limits USING btree (tenant_id);


--
-- Name: idx_md_product_part_numbers_active_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_product_part_numbers_active_code ON public.md_product_part_numbers USING btree (is_active, code);


--
-- Name: idx_md_product_part_numbers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_product_part_numbers_tenant ON public.md_product_part_numbers USING btree (tenant_id);


--
-- Name: idx_md_rooms_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_rooms_tenant ON public.md_rooms USING btree (tenant_id);


--
-- Name: idx_md_test_methods_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_md_test_methods_tenant ON public.md_test_methods USING btree (tenant_id);


--
-- Name: idx_ncmr_affected_items_part_defect_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmr_affected_items_part_defect_created ON public.ncmr_affected_items USING btree (product_part_number, defect_category, created_at);


--
-- Name: idx_ncmr_mrb_approvers_ncmr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmr_mrb_approvers_ncmr ON public.ncmr_mrb_approvers USING btree (ncmr_id);


--
-- Name: idx_ncmr_mrb_approvers_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmr_mrb_approvers_order ON public.ncmr_mrb_approvers USING btree (ncmr_id, approval_order);


--
-- Name: idx_ncmr_mrb_reviewers_ncmr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmr_mrb_reviewers_ncmr_id ON public.ncmr_mrb_reviewers USING btree (ncmr_id);


--
-- Name: idx_ncmr_mrb_reviewers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmr_mrb_reviewers_status ON public.ncmr_mrb_reviewers USING btree (approval_status);


--
-- Name: idx_ncmrs_capa_required; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmrs_capa_required ON public.ncmrs USING btree (capa_required);


--
-- Name: idx_ncmrs_linked_capa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmrs_linked_capa_id ON public.ncmrs USING btree (linked_capa_id);


--
-- Name: idx_ncmrs_linked_receiving_inspection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmrs_linked_receiving_inspection_id ON public.ncmrs USING btree (linked_receiving_inspection_id);


--
-- Name: idx_ncmrs_linked_scar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmrs_linked_scar_id ON public.ncmrs USING btree (linked_scar_id);


--
-- Name: idx_ncmrs_linked_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ncmrs_linked_supplier_id ON public.ncmrs USING btree (linked_supplier_id);


--
-- Name: idx_notification_preferences_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_module ON public.notification_preferences USING btree (module);


--
-- Name: idx_notification_preferences_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_user_email ON public.notification_preferences USING btree (user_email);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_deduplication_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_deduplication_key ON public.notifications USING btree (deduplication_key);


--
-- Name: idx_notifications_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_delivery_status ON public.notifications USING btree (delivery_status);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_related_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_related_module ON public.notifications USING btree (related_module);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_email, read_status);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_email);


--
-- Name: idx_notifications_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_email ON public.notifications USING btree (user_email);


--
-- Name: idx_oos_oot_investigations_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oos_oot_investigations_tenant_id ON public.oos_oot_investigations USING btree (tenant_id);


--
-- Name: idx_qms_capa_governance_rules_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_capa_governance_rules_version ON public.qms_capa_governance_rules USING btree (configuration_version_id);


--
-- Name: idx_qms_configuration_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_configuration_audit ON public.qms_configuration_audit_log USING btree (module_code, configuration_type, changed_at DESC);


--
-- Name: idx_qms_configuration_versions_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_configuration_versions_lookup ON public.qms_configuration_versions USING btree (module_code, configuration_type, status);


--
-- Name: idx_qms_decision_snapshots_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_decision_snapshots_record ON public.qms_decision_snapshots USING btree (module_code, record_id, decision_type);


--
-- Name: idx_qms_module_record_migrations_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_module_record_migrations_record ON public.qms_module_record_migrations USING btree (module_code, record_id, created_at DESC);


--
-- Name: idx_qms_module_record_migrations_release; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_module_record_migrations_release ON public.qms_module_record_migrations USING btree (to_workflow_version_id, migration_status);


--
-- Name: idx_qms_module_release_events_module_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_module_release_events_module_time ON public.qms_module_release_events USING btree (module_code, performed_at DESC);


--
-- Name: idx_qms_module_release_events_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_module_release_events_version ON public.qms_module_release_events USING btree (workflow_version_id, performed_at DESC);


--
-- Name: idx_qms_record_snapshots_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_record_snapshots_record ON public.qms_record_snapshots USING btree (module_code, record_id, snapshot_type);


--
-- Name: idx_qms_risk_matrix_rules_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_risk_matrix_rules_version ON public.qms_risk_matrix_rules USING btree (configuration_version_id);


--
-- Name: idx_qms_workflow_versions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_workflow_versions_module ON public.qms_workflow_versions USING btree (module_code);


--
-- Name: idx_qms_workflow_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qms_workflow_versions_status ON public.qms_workflow_versions USING btree (module_code, status);


--
-- Name: idx_receiving_inspections_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receiving_inspections_approval_status ON public.receiving_inspections USING btree (approval_status);


--
-- Name: idx_receiving_inspections_is_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receiving_inspections_is_locked ON public.receiving_inspections USING btree (is_locked);


--
-- Name: idx_receiving_inspections_linked_ncmr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receiving_inspections_linked_ncmr_id ON public.receiving_inspections USING btree (linked_ncmr_id);


--
-- Name: idx_receiving_inspections_part_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receiving_inspections_part_revision ON public.receiving_inspections USING btree (part_revision);


--
-- Name: idx_receiving_inspections_procedure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receiving_inspections_procedure ON public.receiving_inspections USING btree (receiving_inspection_procedure);


--
-- Name: idx_scars_effectiveness_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scars_effectiveness_due_date ON public.scars USING btree (effectiveness_due_date);


--
-- Name: idx_scars_effectiveness_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scars_effectiveness_result ON public.scars USING btree (effectiveness_result);


--
-- Name: idx_scars_linked_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scars_linked_supplier_id ON public.scars USING btree (linked_supplier_id);


--
-- Name: idx_scars_source_audit_finding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scars_source_audit_finding_id ON public.scars USING btree (source_audit_finding_id);


--
-- Name: idx_scars_source_ncmr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scars_source_ncmr_id ON public.scars USING btree (source_ncmr_id);


--
-- Name: idx_scars_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scars_supplier_id ON public.scars USING btree (supplier_id);


--
-- Name: idx_suppliers_risk_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_risk_level ON public.suppliers USING btree (supplier_risk_level);


--
-- Name: idx_suppliers_risk_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_risk_score ON public.suppliers USING btree (supplier_risk_score);


--
-- Name: idx_tenant_memberships_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_memberships_email ON public.tenant_memberships USING btree (lower(user_email));


--
-- Name: idx_tenant_memberships_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_memberships_tenant ON public.tenant_memberships USING btree (tenant_id);


--
-- Name: idx_tenant_module_access_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_module_access_tenant ON public.tenant_module_access USING btree (tenant_id);


--
-- Name: idx_training_assignments_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_assignments_assigned_to ON public.training_assignments USING btree (assigned_to_email);


--
-- Name: idx_training_assignments_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_assignments_document_id ON public.training_assignments USING btree (document_id);


--
-- Name: idx_training_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_assignments_status ON public.training_assignments USING btree (status);


--
-- Name: idx_training_effectiveness_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_effectiveness_assignment ON public.training_effectiveness_checks USING btree (training_assignment_id);


--
-- Name: idx_training_matrix_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_matrix_department ON public.training_matrix USING btree (department);


--
-- Name: idx_training_matrix_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_matrix_role ON public.training_matrix USING btree (role_name);


--
-- Name: idx_user_security_roles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_security_roles_email ON public.user_security_roles USING btree (lower(user_email));


--
-- Name: idx_user_security_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_security_roles_role ON public.user_security_roles USING btree (role_code);


--
-- Name: ix_approval_matrix_reviewers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_approval_matrix_reviewers_tenant ON public.approval_matrix_reviewers USING btree (tenant_id);


--
-- Name: ix_approval_matrix_reviewers_tenant_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_approval_matrix_reviewers_tenant_template ON public.approval_matrix_reviewers USING btree (tenant_id, template_id);


--
-- Name: ix_approval_matrix_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_approval_matrix_templates_tenant ON public.approval_matrix_templates USING btree (tenant_id);


--
-- Name: ix_approval_matrix_templates_tenant_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_approval_matrix_templates_tenant_module ON public.approval_matrix_templates USING btree (tenant_id, module_name);


--
-- Name: ix_company_dashboard_kpi_configuration_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_company_dashboard_kpi_configuration_lookup ON public.company_dashboard_kpi_configuration USING btree (tenant_id, module_name, kpi_key);


--
-- Name: ix_company_dashboard_kpi_configuration_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_company_dashboard_kpi_configuration_tenant ON public.company_dashboard_kpi_configuration USING btree (tenant_id);


--
-- Name: ix_company_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_company_settings_tenant ON public.company_settings USING btree (tenant_id);


--
-- Name: ix_custom_kpi_definitions_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_custom_kpi_definitions_lookup ON public.custom_kpi_definitions USING btree (tenant_id, kpi_key);


--
-- Name: ix_custom_kpi_definitions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_custom_kpi_definitions_tenant ON public.custom_kpi_definitions USING btree (tenant_id);


--
-- Name: ix_qms_capa_governance_rules_tenant_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_qms_capa_governance_rules_tenant_version ON public.qms_capa_governance_rules USING btree (tenant_id, configuration_version_id);


--
-- Name: ix_qms_configuration_audit_log_tenant_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_qms_configuration_audit_log_tenant_version ON public.qms_configuration_audit_log USING btree (tenant_id, configuration_version_id);


--
-- Name: ix_qms_configuration_versions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_qms_configuration_versions_tenant ON public.qms_configuration_versions USING btree (tenant_id);


--
-- Name: ix_qms_configuration_versions_tenant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_qms_configuration_versions_tenant_type ON public.qms_configuration_versions USING btree (tenant_id, module_code, configuration_type, status);


--
-- Name: ix_qms_risk_matrix_rules_tenant_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_qms_risk_matrix_rules_tenant_version ON public.qms_risk_matrix_rules USING btree (tenant_id, configuration_version_id);


--
-- Name: management_review_actions_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX management_review_actions_tenant_idx ON public.management_review_actions USING btree (tenant_id);


--
-- Name: management_review_approvers_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX management_review_approvers_tenant_idx ON public.management_review_approvers USING btree (tenant_id);


--
-- Name: management_reviews_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX management_reviews_tenant_idx ON public.management_reviews USING btree (tenant_id);


--
-- Name: md_document_impact_areas_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX md_document_impact_areas_tenant_idx ON public.md_document_impact_areas USING btree (tenant_id, sort_order);


--
-- Name: ncmrs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ncmrs_tenant_id_idx ON public.ncmrs USING btree (tenant_id);


--
-- Name: platform_administrators_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_administrators_email_key ON public.platform_administrators USING btree (lower(user_email));


--
-- Name: receiving_inspections_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receiving_inspections_tenant_idx ON public.receiving_inspections USING btree (tenant_id);


--
-- Name: scars_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scars_tenant_idx ON public.scars USING btree (tenant_id);


--
-- Name: scars_tenant_scar_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX scars_tenant_scar_number_uidx ON public.scars USING btree (tenant_id, scar_number) WHERE (scar_number IS NOT NULL);


--
-- Name: supplier_audit_findings_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_audit_findings_tenant_idx ON public.supplier_audit_findings USING btree (tenant_id);


--
-- Name: supplier_audits_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_audits_tenant_idx ON public.supplier_audits USING btree (tenant_id);


--
-- Name: supplier_documents_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_documents_tenant_idx ON public.supplier_documents USING btree (tenant_id);


--
-- Name: suppliers_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_tenant_idx ON public.suppliers USING btree (tenant_id);


--
-- Name: suppliers_tenant_supplier_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suppliers_tenant_supplier_number_uidx ON public.suppliers USING btree (tenant_id, supplier_number) WHERE (supplier_number IS NOT NULL);


--
-- Name: tenant_customer_contacts_one_active_primary_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_customer_contacts_one_active_primary_idx ON public.tenant_customer_contacts USING btree (tenant_id) WHERE ((is_primary = true) AND (status = 'active'::text));


--
-- Name: tenant_customer_contacts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_customer_contacts_tenant_idx ON public.tenant_customer_contacts USING btree (tenant_id);


--
-- Name: tenant_memberships_tenant_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_memberships_tenant_email_key ON public.tenant_memberships USING btree (tenant_id, lower(user_email));


--
-- Name: tenant_user_profiles_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_user_profiles_email_idx ON public.tenant_user_profiles USING btree (lower(user_email));


--
-- Name: tenant_user_profiles_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_user_profiles_tenant_idx ON public.tenant_user_profiles USING btree (tenant_id);


--
-- Name: tenant_user_role_assignments_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_user_role_assignments_tenant_idx ON public.tenant_user_role_assignments USING btree (tenant_id);


--
-- Name: tenant_user_role_assignments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_user_role_assignments_user_idx ON public.tenant_user_role_assignments USING btree (lower(user_email));


--
-- Name: training_assignments_requirement_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_assignments_requirement_idx ON public.training_assignments USING btree (training_requirement_id);


--
-- Name: training_assignments_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_assignments_tenant_id_idx ON public.training_assignments USING btree (tenant_id);


--
-- Name: training_certifications_tenant_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_certifications_tenant_employee ON public.training_certifications USING btree (tenant_id, employee_email);


--
-- Name: training_certifications_tenant_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_certifications_tenant_expiry ON public.training_certifications USING btree (tenant_id, expires_on);


--
-- Name: training_group_members_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_group_members_group_idx ON public.training_group_members USING btree (training_group_id);


--
-- Name: training_groups_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_groups_tenant_idx ON public.training_groups USING btree (tenant_id);


--
-- Name: training_matrix_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_matrix_tenant_id_idx ON public.training_matrix USING btree (tenant_id);


--
-- Name: training_methods_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_methods_tenant_idx ON public.training_methods USING btree (tenant_id);


--
-- Name: training_notifications_dedup_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX training_notifications_dedup_unique ON public.notifications USING btree (deduplication_key) WHERE ((related_module = 'training'::text) AND (deduplication_key IS NOT NULL));


--
-- Name: training_recurring_one_child_per_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX training_recurring_one_child_per_parent ON public.training_assignments USING btree (recurring_parent_assignment_id) WHERE (recurring_parent_assignment_id IS NOT NULL);


--
-- Name: training_retraining_rules_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_retraining_rules_tenant_id_idx ON public.training_retraining_rules USING btree (tenant_id);


--
-- Name: unique_active_custom_kpi_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_active_custom_kpi_name ON public.custom_kpi_definitions USING btree (company_name, module_name, lower(kpi_name)) WHERE (active = true);


--
-- Name: uq_capas_tenant_capa_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_capas_tenant_capa_number ON public.capas USING btree (tenant_id, capa_number) WHERE (capa_number IS NOT NULL);


--
-- Name: uq_collaboration_open_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_collaboration_open_thread ON public.collaboration_threads USING btree (module, record_id) WHERE (status = 'open'::text);


--
-- Name: uq_equipment_release_request_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_equipment_release_request_pending ON public.equipment_release_requests USING btree (equipment_id) WHERE (status = 'pending'::text);


--
-- Name: uq_ncmr_mrb_reviewers_record_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ncmr_mrb_reviewers_record_email ON public.ncmr_mrb_reviewers USING btree (ncmr_id, lower(approver_email));


--
-- Name: uq_ncmrs_tenant_ncmr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ncmrs_tenant_ncmr_number ON public.ncmrs USING btree (tenant_id, ncmr_number) WHERE ((tenant_id IS NOT NULL) AND (ncmr_number IS NOT NULL));


--
-- Name: uq_oos_oot_tenant_investigation_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_oos_oot_tenant_investigation_number ON public.oos_oot_investigations USING btree (tenant_id, investigation_number) WHERE (investigation_number IS NOT NULL);


--
-- Name: uq_qms_record_structure_templates_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_qms_record_structure_templates_one_active ON public.qms_record_structure_templates USING btree (module_code) WHERE (is_active = true);


--
-- Name: uq_qms_workflow_versions_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_qms_workflow_versions_one_active ON public.qms_workflow_versions USING btree (module_code) WHERE (status = 'active'::text);


--
-- Name: uq_qms_workflow_versions_one_active_per_module; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_qms_workflow_versions_one_active_per_module ON public.qms_workflow_versions USING btree (module_code) WHERE (lower(status) = 'active'::text);


--
-- Name: ux_company_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_company_settings_tenant ON public.company_settings USING btree (tenant_id);


--
-- Name: ux_controlled_documents_tenant_number_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_controlled_documents_tenant_number_revision ON public.controlled_documents USING btree (tenant_id, document_number, revision);


--
-- Name: ux_document_number_sequences_tenant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_document_number_sequences_tenant_type ON public.document_number_sequences USING btree (tenant_id, lower(document_type));


--
-- Name: ux_md_defect_categories_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_defect_categories_tenant_code ON public.md_defect_categories USING btree (tenant_id, code);


--
-- Name: ux_md_defect_subcategories_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_defect_subcategories_tenant_code ON public.md_defect_subcategories USING btree (tenant_id, code);


--
-- Name: ux_md_departments_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_departments_tenant_code ON public.md_departments USING btree (tenant_id, code);


--
-- Name: ux_md_detection_sources_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_detection_sources_tenant_code ON public.md_detection_sources USING btree (tenant_id, code);


--
-- Name: ux_md_dispositions_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_dispositions_tenant_code ON public.md_dispositions USING btree (tenant_id, code);


--
-- Name: ux_md_equipment_tenant_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_equipment_tenant_equipment_id ON public.md_equipment USING btree (tenant_id, equipment_id);


--
-- Name: ux_md_material_statuses_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_material_statuses_tenant_code ON public.md_material_statuses USING btree (tenant_id, code);


--
-- Name: ux_md_product_part_numbers_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_product_part_numbers_tenant_code ON public.md_product_part_numbers USING btree (tenant_id, code);


--
-- Name: ux_md_rooms_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_rooms_tenant_code ON public.md_rooms USING btree (tenant_id, code);


--
-- Name: ux_md_test_methods_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_md_test_methods_tenant_code ON public.md_test_methods USING btree (tenant_id, code);


--
-- Name: ux_qms_configuration_versions_one_active_per_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_qms_configuration_versions_one_active_per_tenant ON public.qms_configuration_versions USING btree (tenant_id, module_code, configuration_type) WHERE (status = 'active'::text);


--
-- Name: ux_qms_configuration_versions_tenant_module_type_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_qms_configuration_versions_tenant_module_type_version ON public.qms_configuration_versions USING btree (tenant_id, module_code, configuration_type, version_code);


--
-- Name: audit_findings audit_findings_set_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_findings_set_tenant BEFORE INSERT OR UPDATE ON public.audit_findings FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_audit_finding_tenant();


--
-- Name: audits audits_enforce_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audits_enforce_tenant BEFORE UPDATE ON public.audits FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_audit_row_tenant();


--
-- Name: audits audits_resolve_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audits_resolve_tenant BEFORE INSERT ON public.audits FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_audit_tenant();


--
-- Name: training_assignments enforce_training_completion_evidence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_training_completion_evidence BEFORE UPDATE ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_training_completion_evidence();


--
-- Name: employee_profiles guard_employee_training_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_employee_training_history BEFORE DELETE OR UPDATE OF user_email ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.qualisphere_guard_employee_training_history();


--
-- Name: training_assignments guard_training_assignment_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_training_assignment_update BEFORE UPDATE ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_guard_training_assignment_update();


--
-- Name: training_methods guard_training_method_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_training_method_history BEFORE DELETE OR UPDATE OF release_blocking, acknowledgement_required, evidence_required ON public.training_methods FOR EACH ROW EXECUTE FUNCTION public.qualisphere_guard_training_method_history();


--
-- Name: training_assignments training_assignment_notice; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER training_assignment_notice AFTER INSERT ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_training_assignment_notice();


--
-- Name: training_assignments training_without_effectiveness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER training_without_effectiveness BEFORE INSERT ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_training_without_effectiveness();


--
-- Name: equipment trg_00_equipment_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_00_equipment_tenant BEFORE INSERT ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_equipment_tenant();


--
-- Name: capas trg_00_resolve_capa_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_00_resolve_capa_tenant BEFORE INSERT ON public.capas FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_capa_tenant();


--
-- Name: ncmrs trg_00_resolve_ncmr_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_00_resolve_ncmr_tenant BEFORE INSERT ON public.ncmrs FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_ncmr_tenant();


--
-- Name: oos_oot_investigations trg_00_resolve_oos_oot_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_00_resolve_oos_oot_tenant BEFORE INSERT ON public.oos_oot_investigations FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_oos_oot_tenant();


--
-- Name: capas trg_01_enforce_capa_row_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_01_enforce_capa_row_tenant BEFORE INSERT OR UPDATE ON public.capas FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_capa_row_tenant();


--
-- Name: ncmrs trg_01_enforce_ncmr_row_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_01_enforce_ncmr_row_tenant BEFORE DELETE OR UPDATE ON public.ncmrs FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_row_tenant();


--
-- Name: controlled_documents trg_01_resolve_controlled_document_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_01_resolve_controlled_document_tenant BEFORE INSERT ON public.controlled_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_controlled_document_tenant();


--
-- Name: capas trg_02_capa_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_02_capa_number BEFORE INSERT ON public.capas FOR EACH ROW EXECUTE FUNCTION public.generate_capa_number();


--
-- Name: controlled_documents trg_02_enforce_controlled_document_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_02_enforce_controlled_document_tenant BEFORE INSERT OR UPDATE ON public.controlled_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_controlled_document_tenant();


--
-- Name: ncmrs trg_02_ncmr_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_02_ncmr_number BEFORE INSERT ON public.ncmrs FOR EACH ROW EXECUTE FUNCTION public.generate_ncmr_number();


--
-- Name: oos_oot_investigations trg_99_enforce_oos_oot_row_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_99_enforce_oos_oot_row_tenant BEFORE INSERT OR UPDATE ON public.oos_oot_investigations FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_oos_oot_row_tenant();


--
-- Name: approval_matrix_reviewers trg_approval_matrix_reviewer_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_matrix_reviewer_tenant BEFORE INSERT OR UPDATE OF template_id, tenant_id ON public.approval_matrix_reviewers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_approval_matrix_reviewer_tenant();


--
-- Name: equipment_calibration_events trg_assign_calibration_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_calibration_number BEFORE INSERT ON public.equipment_calibration_events FOR EACH ROW EXECUTE FUNCTION public.assign_calibration_number();


--
-- Name: equipment trg_assign_equipment_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_equipment_number BEFORE INSERT ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.assign_equipment_number();


--
-- Name: equipment_maintenance_events trg_assign_maintenance_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_maintenance_number BEFORE INSERT ON public.equipment_maintenance_events FOR EACH ROW EXECUTE FUNCTION public.assign_maintenance_number();


--
-- Name: equipment_qualification_events trg_assign_qualification_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_qualification_number BEFORE INSERT ON public.equipment_qualification_events FOR EACH ROW EXECUTE FUNCTION public.assign_qualification_number();


--
-- Name: change_control_documents trg_change_control_documents_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_change_control_documents_tenant BEFORE INSERT OR UPDATE OF change_control_id, tenant_id ON public.change_control_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_change_control_child_tenant();


--
-- Name: change_control_products trg_change_control_products_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_change_control_products_tenant BEFORE INSERT OR UPDATE OF change_control_id, tenant_id ON public.change_control_products FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_change_control_child_tenant();


--
-- Name: change_control_reviewers trg_change_control_reviewers_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_change_control_reviewers_tenant BEFORE INSERT OR UPDATE OF change_control_id, tenant_id ON public.change_control_reviewers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_change_control_child_tenant();


--
-- Name: change_control_tasks trg_change_control_tasks_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_change_control_tasks_tenant BEFORE INSERT OR UPDATE OF change_control_id, tenant_id ON public.change_control_tasks FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_change_control_child_tenant();


--
-- Name: change_controls trg_change_control_tenant_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_change_control_tenant_number BEFORE INSERT OR UPDATE OF tenant_id ON public.change_controls FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_change_control_tenant_and_number();


--
-- Name: complaint_activity_log trg_complaint_activity_log_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_complaint_activity_log_tenant BEFORE INSERT OR UPDATE OF complaint_id, tenant_id ON public.complaint_activity_log FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_complaint_child_tenant();


--
-- Name: complaint_quality_links trg_complaint_quality_links_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_complaint_quality_links_tenant BEFORE INSERT OR UPDATE OF complaint_id, tenant_id ON public.complaint_quality_links FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_complaint_child_tenant();


--
-- Name: complaints trg_complaints_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_complaints_tenant BEFORE INSERT OR UPDATE OF tenant_id ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_complaint_tenant();


--
-- Name: collaboration_participants trg_dci_collaboration_owner_handoff; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dci_collaboration_owner_handoff AFTER UPDATE OF status ON public.collaboration_participants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_dci_collaboration_owner_handoff();


--
-- Name: employee_profiles trg_employee_profiles_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_profiles_tenant BEFORE INSERT ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_training_config_tenant();


--
-- Name: equipment_calibration_events trg_equipment_calibration_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_calibration_events_updated_at BEFORE UPDATE ON public.equipment_calibration_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_event_number_counters trg_equipment_event_number_counters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_event_number_counters_updated_at BEFORE UPDATE ON public.equipment_event_number_counters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_governance_members trg_equipment_governance_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_governance_members_updated_at BEFORE UPDATE ON public.equipment_governance_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_import_batches trg_equipment_import_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_import_batches_updated_at BEFORE UPDATE ON public.equipment_import_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_import_rows trg_equipment_import_rows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_import_rows_updated_at BEFORE UPDATE ON public.equipment_import_rows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_maintenance_events trg_equipment_maintenance_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_maintenance_events_updated_at BEFORE UPDATE ON public.equipment_maintenance_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_numbering_configurations trg_equipment_numbering_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_numbering_configurations_updated_at BEFORE UPDATE ON public.equipment_numbering_configurations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_post_maintenance_assessments trg_equipment_post_maintenance_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_post_maintenance_assessments_updated_at BEFORE UPDATE ON public.equipment_post_maintenance_assessments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_qualification_events trg_equipment_qualification_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_qualification_events_updated_at BEFORE UPDATE ON public.equipment_qualification_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment_schedule_configurations trg_equipment_schedule_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_schedule_configurations_updated_at BEFORE UPDATE ON public.equipment_schedule_configurations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: equipment trg_equipment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ncmrs trg_freeze_ncmr_structure_on_close; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freeze_ncmr_structure_on_close AFTER UPDATE OF status ON public.ncmrs FOR EACH ROW EXECUTE FUNCTION public.freeze_ncmr_structure_on_close();


--
-- Name: scars trg_generate_scar_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_scar_number BEFORE INSERT ON public.scars FOR EACH ROW EXECUTE FUNCTION public.generate_scar_number();


--
-- Name: controlled_documents trg_invalidate_dci_pdf_verification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invalidate_dci_pdf_verification AFTER UPDATE OF release_pdf_file_path, release_pdf_file_url ON public.controlled_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_invalidate_dci_pdf_verification();


--
-- Name: management_review_actions trg_management_review_actions_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_management_review_actions_tenant BEFORE INSERT OR UPDATE ON public.management_review_actions FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_management_review_child_tenant();


--
-- Name: management_review_approvers trg_management_review_approvers_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_management_review_approvers_tenant BEFORE INSERT OR UPDATE ON public.management_review_approvers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_management_review_child_tenant();


--
-- Name: management_reviews trg_management_reviews_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_management_reviews_tenant BEFORE INSERT OR UPDATE ON public.management_reviews FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_management_review_tenant();


--
-- Name: approval_tasks trg_ncmr_company_boundary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ncmr_company_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.approval_tasks FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_approval_task_tenant();


--
-- Name: ncmr_affected_items trg_ncmr_company_boundary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ncmr_company_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.ncmr_affected_items FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_child_tenant();


--
-- Name: ncmr_comments trg_ncmr_company_boundary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ncmr_company_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.ncmr_comments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_child_tenant();


--
-- Name: ncmr_mrb_approvers trg_ncmr_company_boundary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ncmr_company_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.ncmr_mrb_approvers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_child_tenant();


--
-- Name: ncmr_mrb_reviewers trg_ncmr_company_boundary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ncmr_company_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.ncmr_mrb_reviewers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_child_tenant();


--
-- Name: qms_decision_snapshots trg_ncmr_company_boundary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ncmr_company_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.qms_decision_snapshots FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_ncmr_snapshot_tenant();


--
-- Name: platform_administrators trg_platform_administrators_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_platform_administrators_touch_updated_at BEFORE UPDATE ON public.platform_administrators FOR EACH ROW EXECUTE FUNCTION public.qualisphere_touch_updated_at();


--
-- Name: ncmr_affected_items trg_protect_closed_ncmr_affected_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_closed_ncmr_affected_items BEFORE INSERT OR DELETE OR UPDATE ON public.ncmr_affected_items FOR EACH ROW EXECUTE FUNCTION public.block_related_ncmr_change_when_closed();


--
-- Name: approval_tasks trg_protect_closed_ncmr_approval_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_closed_ncmr_approval_tasks BEFORE INSERT OR DELETE OR UPDATE ON public.approval_tasks FOR EACH ROW EXECUTE FUNCTION public.block_related_ncmr_change_when_closed();


--
-- Name: ncmr_mrb_reviewers trg_protect_closed_ncmr_mrb_reviewers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_closed_ncmr_mrb_reviewers BEFORE INSERT OR DELETE OR UPDATE ON public.ncmr_mrb_reviewers FOR EACH ROW EXECUTE FUNCTION public.block_related_ncmr_change_when_closed();


--
-- Name: ncmrs trg_protect_closed_ncmr_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_closed_ncmr_record BEFORE DELETE OR UPDATE ON public.ncmrs FOR EACH ROW EXECUTE FUNCTION public.protect_closed_ncmr_record();


--
-- Name: qms_capa_governance_rules trg_protect_controlled_capa_governance_rule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_controlled_capa_governance_rule BEFORE DELETE OR UPDATE ON public.qms_capa_governance_rules FOR EACH ROW EXECUTE FUNCTION public.protect_controlled_capa_governance_rule();


--
-- Name: qms_configuration_versions trg_protect_controlled_configuration_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_controlled_configuration_version BEFORE UPDATE ON public.qms_configuration_versions FOR EACH ROW EXECUTE FUNCTION public.protect_controlled_configuration_version();


--
-- Name: qms_risk_matrix_rules trg_protect_controlled_risk_matrix_rule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_controlled_risk_matrix_rule BEFORE DELETE OR UPDATE ON public.qms_risk_matrix_rules FOR EACH ROW EXECUTE FUNCTION public.protect_controlled_risk_matrix_rule();


--
-- Name: qms_workflow_versions trg_protect_controlled_workflow_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_controlled_workflow_version BEFORE UPDATE ON public.qms_workflow_versions FOR EACH ROW EXECUTE FUNCTION public.protect_controlled_workflow_version();


--
-- Name: audit_logs trg_protect_ncmr_audit_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_ncmr_audit_history BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.protect_ncmr_audit_history();


--
-- Name: qms_record_structure_freezes trg_protect_record_structure_freeze; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_record_structure_freeze BEFORE DELETE OR UPDATE ON public.qms_record_structure_freezes FOR EACH ROW EXECUTE FUNCTION public.protect_record_structure_freeze();


--
-- Name: tenants trg_provision_ncmr_governance_on_tenant_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_provision_ncmr_governance_on_tenant_insert AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_provision_ncmr_governance_on_tenant_insert();


--
-- Name: qms_capa_governance_rules trg_qms_capa_governance_rules_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qms_capa_governance_rules_tenant BEFORE INSERT OR UPDATE OF configuration_version_id, tenant_id ON public.qms_capa_governance_rules FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_qms_child_tenant();


--
-- Name: qms_configuration_audit_log trg_qms_configuration_audit_log_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qms_configuration_audit_log_tenant BEFORE INSERT OR UPDATE OF configuration_version_id, tenant_id ON public.qms_configuration_audit_log FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_qms_child_tenant();


--
-- Name: qms_risk_matrix_rules trg_qms_risk_matrix_rules_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qms_risk_matrix_rules_tenant BEFORE INSERT OR UPDATE OF configuration_version_id, tenant_id ON public.qms_risk_matrix_rules FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_qms_child_tenant();


--
-- Name: audit_logs trg_qualisphere_enforce_audit_log_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qualisphere_enforce_audit_log_identity BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_audit_log_identity();


--
-- Name: electronic_signatures trg_qualisphere_enforce_electronic_signature_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qualisphere_enforce_electronic_signature_identity BEFORE INSERT ON public.electronic_signatures FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_signature_identity();


--
-- Name: printable_management_review_signatures trg_qualisphere_enforce_printable_mr_signature_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qualisphere_enforce_printable_mr_signature_identity BEFORE INSERT ON public.printable_management_review_signatures FOR EACH ROW EXECUTE FUNCTION public.qualisphere_enforce_signature_identity();


--
-- Name: tenants trg_qualisphere_provision_company_settings_on_tenant_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qualisphere_provision_company_settings_on_tenant_create AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_provision_company_settings_on_tenant_create();


--
-- Name: tenants trg_qualisphere_provision_master_data_on_tenant_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qualisphere_provision_master_data_on_tenant_create AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_provision_master_data_on_tenant_create();


--
-- Name: tenants trg_qualisphere_provision_starter_roles_on_tenant_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qualisphere_provision_starter_roles_on_tenant_create AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_provision_starter_roles_on_tenant_create();


--
-- Name: receiving_inspections trg_receiving_inspections_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receiving_inspections_tenant BEFORE INSERT OR UPDATE ON public.receiving_inspections FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_supplier_quality_tenant();


--
-- Name: scars trg_scars_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scars_tenant BEFORE INSERT OR UPDATE ON public.scars FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_supplier_quality_tenant();


--
-- Name: tenants trg_seed_document_impact_areas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_seed_document_impact_areas AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_seed_document_impact_areas();


--
-- Name: audits trg_set_audit_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_audit_number BEFORE INSERT ON public.audits FOR EACH ROW EXECUTE FUNCTION public.set_audit_number();


--
-- Name: document_change_initiation_documents trg_set_dic_document_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_dic_document_tenant BEFORE INSERT OR UPDATE ON public.document_change_initiation_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_dci_document_tenant();


--
-- Name: document_change_initiations trg_set_dic_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_dic_tenant BEFORE INSERT OR UPDATE ON public.document_change_initiations FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_dci_tenant();


--
-- Name: oos_oot_investigations trg_set_oos_oot_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_oos_oot_number BEFORE INSERT ON public.oos_oot_investigations FOR EACH ROW EXECUTE FUNCTION public.set_oos_oot_number();


--
-- Name: training_assignments trg_set_training_assignment_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_training_assignment_tenant BEFORE INSERT OR UPDATE OF document_id, tenant_id ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_training_assignment_tenant();


--
-- Name: supplier_audit_findings trg_supplier_audit_findings_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supplier_audit_findings_tenant BEFORE INSERT OR UPDATE ON public.supplier_audit_findings FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_supplier_quality_tenant();


--
-- Name: supplier_audits trg_supplier_audits_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supplier_audits_tenant BEFORE INSERT OR UPDATE ON public.supplier_audits FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_supplier_quality_tenant();


--
-- Name: supplier_documents trg_supplier_documents_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supplier_documents_tenant BEFORE INSERT OR UPDATE ON public.supplier_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_supplier_quality_tenant();


--
-- Name: suppliers trg_suppliers_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suppliers_tenant BEFORE INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_supplier_quality_tenant();


--
-- Name: approval_tasks trg_sync_capa_from_approval_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_capa_from_approval_tasks AFTER INSERT OR UPDATE ON public.approval_tasks FOR EACH ROW EXECUTE FUNCTION public.sync_capa_from_approval_tasks();


--
-- Name: tenant_memberships trg_tenant_memberships_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_memberships_touch_updated_at BEFORE UPDATE ON public.tenant_memberships FOR EACH ROW EXECUTE FUNCTION public.qualisphere_touch_updated_at();


--
-- Name: tenant_module_access trg_tenant_module_access_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_module_access_touch_updated_at BEFORE UPDATE ON public.tenant_module_access FOR EACH ROW EXECUTE FUNCTION public.qualisphere_touch_updated_at();


--
-- Name: tenants trg_tenants_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenants_touch_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qualisphere_touch_updated_at();


--
-- Name: training_matrix trg_training_matrix_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_matrix_tenant BEFORE INSERT ON public.training_matrix FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_training_config_tenant();


--
-- Name: training_retraining_rules trg_training_retraining_rules_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_retraining_rules_tenant BEFORE INSERT ON public.training_retraining_rules FOR EACH ROW EXECUTE FUNCTION public.qualisphere_set_training_config_tenant();


--
-- Name: document_assigned_reviewers trg_validate_document_reviewer_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_document_reviewer_tenant BEFORE INSERT OR UPDATE OF document_id, reviewer_email ON public.document_assigned_reviewers FOR EACH ROW EXECUTE FUNCTION public.qualisphere_validate_document_reviewer_tenant();


--
-- Name: approval_matrix_reviewers approval_matrix_reviewers_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_reviewers
    ADD CONSTRAINT approval_matrix_reviewers_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.approval_matrix_templates(id) ON DELETE CASCADE;


--
-- Name: approval_matrix_reviewers approval_matrix_reviewers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_reviewers
    ADD CONSTRAINT approval_matrix_reviewers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: approval_matrix_template_reviewers approval_matrix_template_reviewers_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_template_reviewers
    ADD CONSTRAINT approval_matrix_template_reviewers_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.approval_matrix_templates(id) ON DELETE CASCADE;


--
-- Name: approval_matrix_templates approval_matrix_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix_templates
    ADD CONSTRAINT approval_matrix_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: approval_tasks approval_tasks_document_impact_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_tasks
    ADD CONSTRAINT approval_tasks_document_impact_assessment_id_fkey FOREIGN KEY (document_impact_assessment_id) REFERENCES public.document_impact_assessments(id) ON DELETE SET NULL;


--
-- Name: audit_findings audit_findings_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_findings
    ADD CONSTRAINT audit_findings_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audits(id) ON DELETE CASCADE;


--
-- Name: audit_findings audit_findings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_findings
    ADD CONSTRAINT audit_findings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_tenant_number_counters audit_tenant_number_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_tenant_number_counters
    ADD CONSTRAINT audit_tenant_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audits audits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
    ADD CONSTRAINT audits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: capa_tasks capa_tasks_capa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_tasks
    ADD CONSTRAINT capa_tasks_capa_id_fkey FOREIGN KEY (capa_id) REFERENCES public.capas(id) ON DELETE CASCADE;


--
-- Name: capa_tenant_number_counters capa_tenant_number_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capa_tenant_number_counters
    ADD CONSTRAINT capa_tenant_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: capas capas_ncmr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas
    ADD CONSTRAINT capas_ncmr_id_fkey FOREIGN KEY (ncmr_id) REFERENCES public.ncmrs(id);


--
-- Name: capas capas_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capas
    ADD CONSTRAINT capas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: change_control_documents change_control_documents_change_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_documents
    ADD CONSTRAINT change_control_documents_change_control_id_fkey FOREIGN KEY (change_control_id) REFERENCES public.change_controls(id) ON DELETE CASCADE;


--
-- Name: change_control_documents change_control_documents_controlled_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_documents
    ADD CONSTRAINT change_control_documents_controlled_document_id_fkey FOREIGN KEY (controlled_document_id) REFERENCES public.controlled_documents(id);


--
-- Name: change_control_documents change_control_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_documents
    ADD CONSTRAINT change_control_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: change_control_products change_control_products_change_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_products
    ADD CONSTRAINT change_control_products_change_control_id_fkey FOREIGN KEY (change_control_id) REFERENCES public.change_controls(id) ON DELETE CASCADE;


--
-- Name: change_control_products change_control_products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_products
    ADD CONSTRAINT change_control_products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: change_control_reviewers change_control_reviewers_change_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_reviewers
    ADD CONSTRAINT change_control_reviewers_change_control_id_fkey FOREIGN KEY (change_control_id) REFERENCES public.change_controls(id) ON DELETE CASCADE;


--
-- Name: change_control_reviewers change_control_reviewers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_reviewers
    ADD CONSTRAINT change_control_reviewers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: change_control_tasks change_control_tasks_change_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_tasks
    ADD CONSTRAINT change_control_tasks_change_control_id_fkey FOREIGN KEY (change_control_id) REFERENCES public.change_controls(id) ON DELETE CASCADE;


--
-- Name: change_control_tasks change_control_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_tasks
    ADD CONSTRAINT change_control_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: change_control_tenant_number_counters change_control_tenant_number_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_control_tenant_number_counters
    ADD CONSTRAINT change_control_tenant_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: change_controls change_controls_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_controls
    ADD CONSTRAINT change_controls_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: collaboration_comments collaboration_comments_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_comments
    ADD CONSTRAINT collaboration_comments_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.collaboration_threads(id) ON DELETE CASCADE;


--
-- Name: collaboration_participants collaboration_participants_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_participants
    ADD CONSTRAINT collaboration_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.collaboration_threads(id) ON DELETE CASCADE;


--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configuration_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_dashboard_kpi_configuration
    ADD CONSTRAINT company_dashboard_kpi_configuration_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: company_settings company_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: complaint_activity_log complaint_activity_log_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_activity_log
    ADD CONSTRAINT complaint_activity_log_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;


--
-- Name: complaint_activity_log complaint_activity_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_activity_log
    ADD CONSTRAINT complaint_activity_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: complaint_attachments complaint_attachments_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_attachments
    ADD CONSTRAINT complaint_attachments_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;


--
-- Name: complaint_quality_links complaint_quality_links_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_quality_links
    ADD CONSTRAINT complaint_quality_links_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;


--
-- Name: complaint_quality_links complaint_quality_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_quality_links
    ADD CONSTRAINT complaint_quality_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: complaints complaints_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: controlled_documents controlled_documents_approval_matrix_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_documents
    ADD CONSTRAINT controlled_documents_approval_matrix_template_id_fkey FOREIGN KEY (approval_matrix_template_id) REFERENCES public.approval_matrix_templates(id);


--
-- Name: controlled_documents controlled_documents_dic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_documents
    ADD CONSTRAINT controlled_documents_dic_id_fkey FOREIGN KEY (dci_id) REFERENCES public.document_change_initiations(id) ON DELETE SET NULL;


--
-- Name: controlled_documents controlled_documents_originating_change_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_documents
    ADD CONSTRAINT controlled_documents_originating_change_control_id_fkey FOREIGN KEY (originating_change_control_id) REFERENCES public.change_controls(id);


--
-- Name: controlled_documents controlled_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_documents
    ADD CONSTRAINT controlled_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: custom_kpi_definitions custom_kpi_definitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_kpi_definitions
    ADD CONSTRAINT custom_kpi_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customer_role_permissions customer_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.customer_roles(id) ON DELETE CASCADE;


--
-- Name: customer_role_permissions customer_role_permissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customer_roles customer_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_roles
    ADD CONSTRAINT customer_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: dci_pdf_verifications dci_pdf_verifications_dci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dci_pdf_verifications
    ADD CONSTRAINT dci_pdf_verifications_dci_id_fkey FOREIGN KEY (dci_id) REFERENCES public.document_change_initiations(id);


--
-- Name: dci_pdf_verifications dci_pdf_verifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dci_pdf_verifications
    ADD CONSTRAINT dci_pdf_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id);


--
-- Name: document_acknowledgements document_acknowledgements_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_assigned_reviewers document_assigned_reviewers_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assigned_reviewers
    ADD CONSTRAINT document_assigned_reviewers_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_change_document_files document_change_document_files_dci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_document_files
    ADD CONSTRAINT document_change_document_files_dci_id_fkey FOREIGN KEY (dci_id) REFERENCES public.document_change_initiations(id) ON DELETE CASCADE;


--
-- Name: document_change_document_files document_change_document_files_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_document_files
    ADD CONSTRAINT document_change_document_files_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_change_initiation_documents document_change_initiation_documents_dic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiation_documents
    ADD CONSTRAINT document_change_initiation_documents_dic_id_fkey FOREIGN KEY (dci_id) REFERENCES public.document_change_initiations(id) ON DELETE CASCADE;


--
-- Name: document_change_initiation_documents document_change_initiation_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiation_documents
    ADD CONSTRAINT document_change_initiation_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE RESTRICT;


--
-- Name: document_change_initiation_documents document_change_initiation_documents_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_change_initiation_documents
    ADD CONSTRAINT document_change_initiation_documents_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.controlled_documents(id) ON DELETE RESTRICT;


--
-- Name: document_collaboration_reviews document_collaboration_reviews_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_collaboration_reviews
    ADD CONSTRAINT document_collaboration_reviews_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_formal_reviews document_formal_reviews_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_formal_reviews
    ADD CONSTRAINT document_formal_reviews_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_impact_assessments document_impact_assessments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_impact_assessments
    ADD CONSTRAINT document_impact_assessments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_impact_assessments document_impact_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_impact_assessments
    ADD CONSTRAINT document_impact_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: document_number_sequences document_number_sequences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_number_sequences
    ADD CONSTRAINT document_number_sequences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_training_assignments document_training_assignments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_assignments
    ADD CONSTRAINT document_training_assignments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_training_requirements document_training_requirements_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_requirements
    ADD CONSTRAINT document_training_requirements_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: document_training_requirements document_training_requirements_impact_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_requirements
    ADD CONSTRAINT document_training_requirements_impact_assessment_id_fkey FOREIGN KEY (impact_assessment_id) REFERENCES public.document_impact_assessments(id) ON DELETE CASCADE;


--
-- Name: document_training_requirements document_training_requirements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_requirements
    ADD CONSTRAINT document_training_requirements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: document_training_requirements document_training_requirements_training_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_training_requirements
    ADD CONSTRAINT document_training_requirements_training_method_id_fkey FOREIGN KEY (training_method_id) REFERENCES public.training_methods(id);


--
-- Name: employee_profiles employee_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: equipment_calibration_events equipment_calibration_events_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_calibration_events
    ADD CONSTRAINT equipment_calibration_events_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_calibration_events equipment_calibration_events_schedule_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_calibration_events
    ADD CONSTRAINT equipment_calibration_events_schedule_configuration_id_fkey FOREIGN KEY (schedule_configuration_id) REFERENCES public.equipment_schedule_configurations(id) ON DELETE SET NULL;


--
-- Name: equipment_change_control_links equipment_change_control_links_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_change_control_links
    ADD CONSTRAINT equipment_change_control_links_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_document_links equipment_document_links_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_document_links
    ADD CONSTRAINT equipment_document_links_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_import_rows equipment_import_rows_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_import_rows
    ADD CONSTRAINT equipment_import_rows_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.equipment_import_batches(id) ON DELETE CASCADE;


--
-- Name: equipment_import_rows equipment_import_rows_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_import_rows
    ADD CONSTRAINT equipment_import_rows_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE SET NULL;


--
-- Name: equipment_maintenance_components equipment_maintenance_components_maintenance_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_components
    ADD CONSTRAINT equipment_maintenance_components_maintenance_event_id_fkey FOREIGN KEY (maintenance_event_id) REFERENCES public.equipment_maintenance_events(id) ON DELETE CASCADE;


--
-- Name: equipment_maintenance_events equipment_maintenance_events_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_events
    ADD CONSTRAINT equipment_maintenance_events_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_maintenance_events equipment_maintenance_events_schedule_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_events
    ADD CONSTRAINT equipment_maintenance_events_schedule_configuration_id_fkey FOREIGN KEY (schedule_configuration_id) REFERENCES public.equipment_schedule_configurations(id) ON DELETE SET NULL;


--
-- Name: equipment_oos_oot_links equipment_oos_oot_links_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_oos_oot_links
    ADD CONSTRAINT equipment_oos_oot_links_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_post_maintenance_assessments equipment_post_maintenance_ass_linked_calibration_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_post_maintenance_assessments
    ADD CONSTRAINT equipment_post_maintenance_ass_linked_calibration_event_id_fkey FOREIGN KEY (linked_calibration_event_id) REFERENCES public.equipment_calibration_events(id) ON DELETE SET NULL;


--
-- Name: equipment_post_maintenance_assessments equipment_post_maintenance_assessment_maintenance_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_post_maintenance_assessments
    ADD CONSTRAINT equipment_post_maintenance_assessment_maintenance_event_id_fkey FOREIGN KEY (maintenance_event_id) REFERENCES public.equipment_maintenance_events(id) ON DELETE CASCADE;


--
-- Name: equipment_post_maintenance_assessments equipment_post_maintenance_assessments_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_post_maintenance_assessments
    ADD CONSTRAINT equipment_post_maintenance_assessments_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_post_maintenance_assessments equipment_post_maintenance_assessments_linked_qualification_eve; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_post_maintenance_assessments
    ADD CONSTRAINT equipment_post_maintenance_assessments_linked_qualification_eve FOREIGN KEY (linked_qualification_event_id) REFERENCES public.equipment_qualification_events(id) ON DELETE SET NULL;


--
-- Name: equipment_qualification_events equipment_qualification_events_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_qualification_events
    ADD CONSTRAINT equipment_qualification_events_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_release_requests equipment_release_requests_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_release_requests
    ADD CONSTRAINT equipment_release_requests_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_schedule_configurations equipment_schedule_configurations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_schedule_configurations
    ADD CONSTRAINT equipment_schedule_configurations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_schedule_notifications equipment_schedule_notifications_schedule_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_schedule_notifications
    ADD CONSTRAINT equipment_schedule_notifications_schedule_configuration_id_fkey FOREIGN KEY (schedule_configuration_id) REFERENCES public.equipment_schedule_configurations(id) ON DELETE CASCADE;


--
-- Name: management_review_actions management_review_actions_management_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_actions
    ADD CONSTRAINT management_review_actions_management_review_id_fkey FOREIGN KEY (management_review_id) REFERENCES public.management_reviews(id) ON DELETE CASCADE;


--
-- Name: management_review_actions management_review_actions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_actions
    ADD CONSTRAINT management_review_actions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: management_review_approvers management_review_approvers_management_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_approvers
    ADD CONSTRAINT management_review_approvers_management_review_id_fkey FOREIGN KEY (management_review_id) REFERENCES public.management_reviews(id) ON DELETE CASCADE;


--
-- Name: management_review_approvers management_review_approvers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_review_approvers
    ADD CONSTRAINT management_review_approvers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: management_reviews management_reviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.management_reviews
    ADD CONSTRAINT management_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_defect_categories md_defect_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_defect_categories
    ADD CONSTRAINT md_defect_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_defect_subcategories md_defect_subcategories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_defect_subcategories
    ADD CONSTRAINT md_defect_subcategories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_departments md_departments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_departments
    ADD CONSTRAINT md_departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_detection_sources md_detection_sources_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_detection_sources
    ADD CONSTRAINT md_detection_sources_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_dispositions md_dispositions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_dispositions
    ADD CONSTRAINT md_dispositions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_document_impact_areas md_document_impact_areas_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_document_impact_areas
    ADD CONSTRAINT md_document_impact_areas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: md_equipment md_equipment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_equipment
    ADD CONSTRAINT md_equipment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_material_statuses md_material_statuses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_material_statuses
    ADD CONSTRAINT md_material_statuses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_oos_limits md_oos_limits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_oos_limits
    ADD CONSTRAINT md_oos_limits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_product_part_numbers md_product_part_numbers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_product_part_numbers
    ADD CONSTRAINT md_product_part_numbers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_rooms md_rooms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_rooms
    ADD CONSTRAINT md_rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: md_test_methods md_test_methods_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.md_test_methods
    ADD CONSTRAINT md_test_methods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ncmr_affected_items ncmr_affected_items_ncmr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_affected_items
    ADD CONSTRAINT ncmr_affected_items_ncmr_id_fkey FOREIGN KEY (ncmr_id) REFERENCES public.ncmrs(id) ON DELETE CASCADE;


--
-- Name: ncmr_comments ncmr_comments_ncmr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_comments
    ADD CONSTRAINT ncmr_comments_ncmr_id_fkey FOREIGN KEY (ncmr_id) REFERENCES public.ncmrs(id) ON DELETE CASCADE;


--
-- Name: ncmr_comments ncmr_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_comments
    ADD CONSTRAINT ncmr_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.ncmr_comments(id);


--
-- Name: ncmr_tenant_number_counters ncmr_tenant_number_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmr_tenant_number_counters
    ADD CONSTRAINT ncmr_tenant_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ncmrs ncmrs_capa_governance_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmrs
    ADD CONSTRAINT ncmrs_capa_governance_version_id_fkey FOREIGN KEY (capa_governance_version_id) REFERENCES public.qms_configuration_versions(id);


--
-- Name: ncmrs ncmrs_risk_configuration_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmrs
    ADD CONSTRAINT ncmrs_risk_configuration_version_id_fkey FOREIGN KEY (risk_configuration_version_id) REFERENCES public.qms_configuration_versions(id);


--
-- Name: ncmrs ncmrs_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmrs
    ADD CONSTRAINT ncmrs_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: ncmrs ncmrs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmrs
    ADD CONSTRAINT ncmrs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ncmrs ncmrs_workflow_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncmrs
    ADD CONSTRAINT ncmrs_workflow_version_id_fkey FOREIGN KEY (workflow_version_id) REFERENCES public.qms_workflow_versions(id);


--
-- Name: oos_oot_investigations oos_oot_investigations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oos_oot_investigations
    ADD CONSTRAINT oos_oot_investigations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: oos_oot_tenant_number_counters oos_oot_tenant_number_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oos_oot_tenant_number_counters
    ADD CONSTRAINT oos_oot_tenant_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: printable_management_review_signatures printable_management_review_signatures_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printable_management_review_signatures
    ADD CONSTRAINT printable_management_review_signatures_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.printable_management_reviews(id) ON DELETE CASCADE;


--
-- Name: qms_capa_governance_rules qms_capa_governance_rules_configuration_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_capa_governance_rules
    ADD CONSTRAINT qms_capa_governance_rules_configuration_version_id_fkey FOREIGN KEY (configuration_version_id) REFERENCES public.qms_configuration_versions(id) ON DELETE CASCADE;


--
-- Name: qms_capa_governance_rules qms_capa_governance_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_capa_governance_rules
    ADD CONSTRAINT qms_capa_governance_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: qms_configuration_audit_log qms_configuration_audit_log_configuration_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_configuration_audit_log
    ADD CONSTRAINT qms_configuration_audit_log_configuration_version_id_fkey FOREIGN KEY (configuration_version_id) REFERENCES public.qms_configuration_versions(id);


--
-- Name: qms_configuration_audit_log qms_configuration_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_configuration_audit_log
    ADD CONSTRAINT qms_configuration_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: qms_configuration_versions qms_configuration_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_configuration_versions
    ADD CONSTRAINT qms_configuration_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: qms_decision_snapshots qms_decision_snapshots_configuration_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_decision_snapshots
    ADD CONSTRAINT qms_decision_snapshots_configuration_version_id_fkey FOREIGN KEY (configuration_version_id) REFERENCES public.qms_configuration_versions(id);


--
-- Name: qms_decision_snapshots qms_decision_snapshots_workflow_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_decision_snapshots
    ADD CONSTRAINT qms_decision_snapshots_workflow_version_id_fkey FOREIGN KEY (workflow_version_id) REFERENCES public.qms_workflow_versions(id);


--
-- Name: qms_module_record_migrations qms_module_record_migrations_from_workflow_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_module_record_migrations
    ADD CONSTRAINT qms_module_record_migrations_from_workflow_version_id_fkey FOREIGN KEY (from_workflow_version_id) REFERENCES public.qms_workflow_versions(id) ON DELETE SET NULL;


--
-- Name: qms_module_record_migrations qms_module_record_migrations_to_workflow_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_module_record_migrations
    ADD CONSTRAINT qms_module_record_migrations_to_workflow_version_id_fkey FOREIGN KEY (to_workflow_version_id) REFERENCES public.qms_workflow_versions(id) ON DELETE RESTRICT;


--
-- Name: qms_module_release_events qms_module_release_events_workflow_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_module_release_events
    ADD CONSTRAINT qms_module_release_events_workflow_version_id_fkey FOREIGN KEY (workflow_version_id) REFERENCES public.qms_workflow_versions(id) ON DELETE SET NULL;


--
-- Name: qms_record_structure_freezes qms_record_structure_freezes_structure_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_record_structure_freezes
    ADD CONSTRAINT qms_record_structure_freezes_structure_template_id_fkey FOREIGN KEY (structure_template_id) REFERENCES public.qms_record_structure_templates(id);


--
-- Name: qms_risk_matrix_rules qms_risk_matrix_rules_configuration_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_risk_matrix_rules
    ADD CONSTRAINT qms_risk_matrix_rules_configuration_version_id_fkey FOREIGN KEY (configuration_version_id) REFERENCES public.qms_configuration_versions(id) ON DELETE CASCADE;


--
-- Name: qms_risk_matrix_rules qms_risk_matrix_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qms_risk_matrix_rules
    ADD CONSTRAINT qms_risk_matrix_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: receiving_inspections receiving_inspections_linked_ncmr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_inspections
    ADD CONSTRAINT receiving_inspections_linked_ncmr_id_fkey FOREIGN KEY (linked_ncmr_id) REFERENCES public.ncmrs(id);


--
-- Name: receiving_inspections receiving_inspections_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_inspections
    ADD CONSTRAINT receiving_inspections_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: receiving_inspections receiving_inspections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_inspections
    ADD CONSTRAINT receiving_inspections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: scar_tenant_number_counters scar_tenant_number_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scar_tenant_number_counters
    ADD CONSTRAINT scar_tenant_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: scars scars_linked_ncmr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scars
    ADD CONSTRAINT scars_linked_ncmr_id_fkey FOREIGN KEY (linked_ncmr_id) REFERENCES public.ncmrs(id);


--
-- Name: scars scars_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scars
    ADD CONSTRAINT scars_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: scars scars_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scars
    ADD CONSTRAINT scars_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: supplier_audit_findings supplier_audit_findings_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audit_findings
    ADD CONSTRAINT supplier_audit_findings_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.supplier_audits(id) ON DELETE CASCADE;


--
-- Name: supplier_audit_findings supplier_audit_findings_scar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audit_findings
    ADD CONSTRAINT supplier_audit_findings_scar_id_fkey FOREIGN KEY (scar_id) REFERENCES public.scars(id);


--
-- Name: supplier_audit_findings supplier_audit_findings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audit_findings
    ADD CONSTRAINT supplier_audit_findings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: supplier_audits supplier_audits_scar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audits
    ADD CONSTRAINT supplier_audits_scar_id_fkey FOREIGN KEY (scar_id) REFERENCES public.scars(id);


--
-- Name: supplier_audits supplier_audits_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audits
    ADD CONSTRAINT supplier_audits_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_audits supplier_audits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_audits
    ADD CONSTRAINT supplier_audits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: supplier_documents supplier_documents_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_documents
    ADD CONSTRAINT supplier_documents_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_documents supplier_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_documents
    ADD CONSTRAINT supplier_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: suppliers suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_customer_contacts tenant_customer_contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_customer_contacts
    ADD CONSTRAINT tenant_customer_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_memberships tenant_memberships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_module_access tenant_module_access_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_module_access
    ADD CONSTRAINT tenant_module_access_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_user_profiles tenant_user_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_profiles
    ADD CONSTRAINT tenant_user_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_role_assignments
    ADD CONSTRAINT tenant_user_role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.customer_roles(id) ON DELETE CASCADE;


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_role_assignments
    ADD CONSTRAINT tenant_user_role_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: training_assignments training_assignments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.controlled_documents(id) ON DELETE CASCADE;


--
-- Name: training_assignments training_assignments_originating_change_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_originating_change_control_id_fkey FOREIGN KEY (originating_change_control_id) REFERENCES public.change_controls(id);


--
-- Name: training_assignments training_assignments_recurring_parent_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_recurring_parent_assignment_id_fkey FOREIGN KEY (recurring_parent_assignment_id) REFERENCES public.training_assignments(id);


--
-- Name: training_assignments training_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: training_assignments training_assignments_training_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_training_group_id_fkey FOREIGN KEY (training_group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;


--
-- Name: training_assignments training_assignments_training_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_training_method_id_fkey FOREIGN KEY (training_method_id) REFERENCES public.training_methods(id) ON DELETE SET NULL;


--
-- Name: training_assignments training_assignments_training_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_assignments
    ADD CONSTRAINT training_assignments_training_requirement_id_fkey FOREIGN KEY (training_requirement_id) REFERENCES public.document_training_requirements(id) ON DELETE SET NULL;


--
-- Name: training_certifications training_certifications_renewal_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_certifications
    ADD CONSTRAINT training_certifications_renewal_of_id_fkey FOREIGN KEY (renewal_of_id) REFERENCES public.training_certifications(id) ON DELETE RESTRICT;


--
-- Name: training_certifications training_certifications_training_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_certifications
    ADD CONSTRAINT training_certifications_training_assignment_id_fkey FOREIGN KEY (training_assignment_id) REFERENCES public.training_assignments(id) ON DELETE SET NULL;


--
-- Name: training_effectiveness_checks training_effectiveness_checks_training_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_effectiveness_checks
    ADD CONSTRAINT training_effectiveness_checks_training_assignment_id_fkey FOREIGN KEY (training_assignment_id) REFERENCES public.training_assignments(id) ON DELETE CASCADE;


--
-- Name: training_group_members training_group_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_group_members
    ADD CONSTRAINT training_group_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: training_group_members training_group_members_training_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_group_members
    ADD CONSTRAINT training_group_members_training_group_id_fkey FOREIGN KEY (training_group_id) REFERENCES public.training_groups(id) ON DELETE CASCADE;


--
-- Name: training_groups training_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: training_matrix training_matrix_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_matrix
    ADD CONSTRAINT training_matrix_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: training_methods training_methods_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_methods
    ADD CONSTRAINT training_methods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: training_retraining_rules training_retraining_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_retraining_rules
    ADD CONSTRAINT training_retraining_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_security_roles user_security_roles_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_security_roles
    ADD CONSTRAINT user_security_roles_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.security_roles(code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ncmrs Allow all for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated users" ON public.ncmrs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: approval_tasks Allow authenticated approval task access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated approval task access" ON public.approval_tasks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: capa_approval_tasks Allow authenticated capa approval task access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated capa approval task access" ON public.capa_approval_tasks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: capa_gate_approvers Allow authenticated capa gate approver access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated capa gate approver access" ON public.capa_gate_approvers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: capa_tasks Allow authenticated delete capa tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated delete capa tasks" ON public.capa_tasks FOR DELETE TO authenticated USING (true);


--
-- Name: ncmr_affected_items Allow authenticated delete ncmr affected items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated delete ncmr affected items" ON public.ncmr_affected_items FOR DELETE TO authenticated USING (true);


--
-- Name: ncmr_comments Allow authenticated delete ncmr comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated delete ncmr comments" ON public.ncmr_comments FOR DELETE TO authenticated USING (true);


--
-- Name: capa_tasks Allow authenticated insert capa tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert capa tasks" ON public.capa_tasks FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: ncmr_affected_items Allow authenticated insert ncmr affected items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert ncmr affected items" ON public.ncmr_affected_items FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: ncmr_comments Allow authenticated insert ncmr comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert ncmr comments" ON public.ncmr_comments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notification_queue Allow authenticated insert notification queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert notification queue" ON public.notification_queue FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: ncmr_affected_items Allow authenticated read ncmr affected items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read ncmr affected items" ON public.ncmr_affected_items FOR SELECT TO authenticated USING (true);


--
-- Name: ncmr_comments Allow authenticated read ncmr comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read ncmr comments" ON public.ncmr_comments FOR SELECT TO authenticated USING (true);


--
-- Name: notification_queue Allow authenticated read notification queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read notification queue" ON public.notification_queue FOR SELECT TO authenticated USING (true);


--
-- Name: capa_tasks Allow authenticated select capa tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated select capa tasks" ON public.capa_tasks FOR SELECT TO authenticated USING (true);


--
-- Name: capa_tasks Allow authenticated update capa tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update capa tasks" ON public.capa_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: ncmr_affected_items Allow authenticated update ncmr affected items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update ncmr affected items" ON public.ncmr_affected_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: ncmr_comments Allow authenticated update ncmr comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update ncmr comments" ON public.ncmr_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: notification_queue Allow authenticated update notification queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated update notification queue" ON public.notification_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: kpi_library_definitions Allow authenticated users read KPI library; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users read KPI library" ON public.kpi_library_definitions FOR SELECT TO authenticated USING (true);


--
-- Name: complaint_quality_links Allow authenticated users to delete complaint quality links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to delete complaint quality links" ON public.complaint_quality_links FOR DELETE TO authenticated USING (true);


--
-- Name: complaints Allow authenticated users to delete complaints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to delete complaints" ON public.complaints FOR DELETE TO authenticated USING (true);


--
-- Name: custom_kpi_definitions Allow authenticated users to delete custom KPI definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to delete custom KPI definitions" ON public.custom_kpi_definitions FOR DELETE TO authenticated USING (true);


--
-- Name: kpi_history Allow authenticated users to insert KPI history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert KPI history" ON public.kpi_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_assigned_reviewers Allow authenticated users to insert assigned reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert assigned reviewers" ON public.document_assigned_reviewers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: complaint_activity_log Allow authenticated users to insert complaint activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert complaint activity log" ON public.complaint_activity_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: complaint_attachments Allow authenticated users to insert complaint attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert complaint attachments" ON public.complaint_attachments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: complaint_quality_links Allow authenticated users to insert complaint quality links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert complaint quality links" ON public.complaint_quality_links FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: complaints Allow authenticated users to insert complaints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert complaints" ON public.complaints FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: custom_kpi_definitions Allow authenticated users to insert custom KPI definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert custom KPI definitions" ON public.custom_kpi_definitions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: approval_matrix_reviewers Allow authenticated users to manage approval matrix reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to manage approval matrix reviewers" ON public.approval_matrix_reviewers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: approval_matrix_templates Allow authenticated users to manage approval matrix templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to manage approval matrix templates" ON public.approval_matrix_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: change_control_reviewers Allow authenticated users to manage change control reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to manage change control reviewers" ON public.change_control_reviewers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: company_dashboard_kpi_configuration Allow authenticated users to manage company dashboard KPI confi; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to manage company dashboard KPI confi" ON public.company_dashboard_kpi_configuration TO authenticated USING (true) WITH CHECK (true);


--
-- Name: md_dispositions Allow authenticated users to manage dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to manage dispositions" ON public.md_dispositions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: kpi_history Allow authenticated users to read KPI history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read KPI history" ON public.kpi_history FOR SELECT TO authenticated USING (true);


--
-- Name: kpi_library Allow authenticated users to read KPI library; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read KPI library" ON public.kpi_library FOR SELECT TO authenticated USING (true);


--
-- Name: approval_matrix_reviewers Allow authenticated users to read approval matrix reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read approval matrix reviewers" ON public.approval_matrix_reviewers FOR SELECT TO authenticated USING (true);


--
-- Name: approval_matrix_templates Allow authenticated users to read approval matrix templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read approval matrix templates" ON public.approval_matrix_templates FOR SELECT TO authenticated USING (true);


--
-- Name: document_assigned_reviewers Allow authenticated users to read assigned reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read assigned reviewers" ON public.document_assigned_reviewers FOR SELECT TO authenticated USING (true);


--
-- Name: company_dashboard_kpi_configuration Allow authenticated users to read company dashboard KPI configu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read company dashboard KPI configu" ON public.company_dashboard_kpi_configuration FOR SELECT TO authenticated USING (true);


--
-- Name: complaint_activity_log Allow authenticated users to read complaint activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read complaint activity log" ON public.complaint_activity_log FOR SELECT TO authenticated USING (true);


--
-- Name: complaint_attachments Allow authenticated users to read complaint attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read complaint attachments" ON public.complaint_attachments FOR SELECT TO authenticated USING (true);


--
-- Name: complaint_quality_links Allow authenticated users to read complaint quality links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read complaint quality links" ON public.complaint_quality_links FOR SELECT TO authenticated USING (true);


--
-- Name: complaints Allow authenticated users to read complaints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read complaints" ON public.complaints FOR SELECT TO authenticated USING (true);


--
-- Name: custom_kpi_definitions Allow authenticated users to read custom KPI definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read custom KPI definitions" ON public.custom_kpi_definitions FOR SELECT TO authenticated USING (true);


--
-- Name: dashboard_kpi_configuration Allow authenticated users to read dashboard KPI configuration; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read dashboard KPI configuration" ON public.dashboard_kpi_configuration FOR SELECT TO authenticated USING (true);


--
-- Name: md_dispositions Allow authenticated users to read dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read dispositions" ON public.md_dispositions FOR SELECT TO authenticated USING (true);


--
-- Name: document_assigned_reviewers Allow authenticated users to update assigned reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update assigned reviewers" ON public.document_assigned_reviewers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: complaint_quality_links Allow authenticated users to update complaint quality links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update complaint quality links" ON public.complaint_quality_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: complaints Allow authenticated users to update complaints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update complaints" ON public.complaints FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: custom_kpi_definitions Allow authenticated users to update custom KPI definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update custom KPI definitions" ON public.custom_kpi_definitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: ncmr_mrb_reviewers Authenticated users can add NCMR MRB reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can add NCMR MRB reviewers" ON public.ncmr_mrb_reviewers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_relationships Authenticated users can create document relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create document relationships" ON public.document_relationships FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications Authenticated users can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: capas Authenticated users can delete CAPAs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete CAPAs" ON public.capas FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: ncmr_mrb_reviewers Authenticated users can delete NCMR MRB reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete NCMR MRB reviewers" ON public.ncmr_mrb_reviewers FOR DELETE TO authenticated USING (true);


--
-- Name: change_controls Authenticated users can delete change controls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete change controls" ON public.change_controls FOR DELETE TO authenticated USING (true);


--
-- Name: change_control_documents Authenticated users can delete change documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete change documents" ON public.change_control_documents FOR DELETE TO authenticated USING (true);


--
-- Name: change_control_products Authenticated users can delete change products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete change products" ON public.change_control_products FOR DELETE TO authenticated USING (true);


--
-- Name: change_control_tasks Authenticated users can delete change tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete change tasks" ON public.change_control_tasks FOR DELETE TO authenticated USING (true);


--
-- Name: controlled_documents Authenticated users can delete controlled documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete controlled documents" ON public.controlled_documents FOR DELETE TO authenticated USING (true);


--
-- Name: document_relationships Authenticated users can delete document relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete document relationships" ON public.document_relationships FOR DELETE TO authenticated USING (true);


--
-- Name: md_product_part_numbers Authenticated users can delete product part numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete product part numbers" ON public.md_product_part_numbers FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: supplier_audits Authenticated users can delete supplier audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete supplier audits" ON public.supplier_audits FOR DELETE TO authenticated USING (true);


--
-- Name: user_roles Authenticated users can delete user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: capas Authenticated users can insert CAPAs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert CAPAs" ON public.capas FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: document_acknowledgements Authenticated users can insert acknowledgements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert acknowledgements" ON public.document_acknowledgements FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: change_controls Authenticated users can insert change controls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert change controls" ON public.change_controls FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: change_control_documents Authenticated users can insert change documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert change documents" ON public.change_control_documents FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: change_control_products Authenticated users can insert change products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert change products" ON public.change_control_products FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: change_control_tasks Authenticated users can insert change tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert change tasks" ON public.change_control_tasks FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_collaboration_reviews Authenticated users can insert collaboration reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert collaboration reviews" ON public.document_collaboration_reviews FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: company_settings Authenticated users can insert company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert company settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: controlled_documents Authenticated users can insert controlled documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert controlled documents" ON public.controlled_documents FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: training_effectiveness_checks Authenticated users can insert effectiveness checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert effectiveness checks" ON public.training_effectiveness_checks FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_formal_reviews Authenticated users can insert formal reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert formal reviews" ON public.document_formal_reviews FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: management_review_reports Authenticated users can insert management review reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert management review reports" ON public.management_review_reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: printable_management_review_signatures Authenticated users can insert own printable management review ; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert own printable management review " ON public.printable_management_review_signatures FOR INSERT TO authenticated WITH CHECK (((lower(signer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND ((signature_email_entered IS NULL) OR (lower(signature_email_entered) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));


--
-- Name: electronic_signatures Authenticated users can insert own signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert own signatures" ON public.electronic_signatures FOR INSERT TO authenticated WITH CHECK ((lower(signed_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: md_product_part_numbers Authenticated users can insert product part numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert product part numbers" ON public.md_product_part_numbers FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: supplier_audits Authenticated users can insert supplier audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert supplier audits" ON public.supplier_audits FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_training_assignments Authenticated users can insert training assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert training assignments" ON public.document_training_assignments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: user_roles Authenticated users can insert user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: capas Authenticated users can read CAPAs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read CAPAs" ON public.capas FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: ncmr_mrb_reviewers Authenticated users can read NCMR MRB reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read NCMR MRB reviewers" ON public.ncmr_mrb_reviewers FOR SELECT TO authenticated USING (true);


--
-- Name: document_number_sequences Authenticated users can read document number sequences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read document number sequences" ON public.document_number_sequences FOR SELECT TO authenticated USING (true);


--
-- Name: document_relationships Authenticated users can read document relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read document relationships" ON public.document_relationships FOR SELECT TO authenticated USING (true);


--
-- Name: qms_record_structure_freezes Authenticated users can read frozen record structures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read frozen record structures" ON public.qms_record_structure_freezes FOR SELECT TO authenticated USING (true);


--
-- Name: management_review_reports Authenticated users can read management review reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read management review reports" ON public.management_review_reports FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: md_product_part_numbers Authenticated users can read product part numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read product part numbers" ON public.md_product_part_numbers FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: qms_record_structure_templates Authenticated users can read record structure templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read record structure templates" ON public.qms_record_structure_templates FOR SELECT TO authenticated USING (true);


--
-- Name: electronic_signatures Authenticated users can read signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read signatures" ON public.electronic_signatures FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Authenticated users can read user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read user roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: qms_workflow_versions Authenticated users can read workflow versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read workflow versions" ON public.qms_workflow_versions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: capas Authenticated users can update CAPAs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update CAPAs" ON public.capas FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: ncmr_mrb_reviewers Authenticated users can update NCMR MRB reviewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update NCMR MRB reviewers" ON public.ncmr_mrb_reviewers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_acknowledgements Authenticated users can update acknowledgements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update acknowledgements" ON public.document_acknowledgements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: change_controls Authenticated users can update change controls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update change controls" ON public.change_controls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: change_control_documents Authenticated users can update change documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update change documents" ON public.change_control_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: change_control_products Authenticated users can update change products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update change products" ON public.change_control_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: change_control_tasks Authenticated users can update change tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update change tasks" ON public.change_control_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_collaboration_reviews Authenticated users can update collaboration reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update collaboration reviews" ON public.document_collaboration_reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: company_settings Authenticated users can update company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update company settings" ON public.company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: controlled_documents Authenticated users can update controlled documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update controlled documents" ON public.controlled_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_number_sequences Authenticated users can update document number sequences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update document number sequences" ON public.document_number_sequences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_relationships Authenticated users can update document relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update document relationships" ON public.document_relationships FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: training_effectiveness_checks Authenticated users can update effectiveness checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update effectiveness checks" ON public.training_effectiveness_checks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_formal_reviews Authenticated users can update formal reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update formal reviews" ON public.document_formal_reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: md_product_part_numbers Authenticated users can update product part numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update product part numbers" ON public.md_product_part_numbers FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: supplier_audits Authenticated users can update supplier audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update supplier audits" ON public.supplier_audits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_training_assignments Authenticated users can update training assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update training assignments" ON public.document_training_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: user_roles Authenticated users can update user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: qms_record_snapshots Authenticated users can view QMS record snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view QMS record snapshots" ON public.qms_record_snapshots FOR SELECT TO authenticated USING (true);


--
-- Name: document_acknowledgements Authenticated users can view acknowledgements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view acknowledgements" ON public.document_acknowledgements FOR SELECT TO authenticated USING (true);


--
-- Name: change_controls Authenticated users can view change controls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view change controls" ON public.change_controls FOR SELECT TO authenticated USING (true);


--
-- Name: change_control_documents Authenticated users can view change documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view change documents" ON public.change_control_documents FOR SELECT TO authenticated USING (true);


--
-- Name: change_control_products Authenticated users can view change products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view change products" ON public.change_control_products FOR SELECT TO authenticated USING (true);


--
-- Name: change_control_tasks Authenticated users can view change tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view change tasks" ON public.change_control_tasks FOR SELECT TO authenticated USING (true);


--
-- Name: document_collaboration_reviews Authenticated users can view collaboration reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view collaboration reviews" ON public.document_collaboration_reviews FOR SELECT TO authenticated USING (true);


--
-- Name: company_settings Authenticated users can view company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view company settings" ON public.company_settings FOR SELECT TO authenticated USING (true);


--
-- Name: controlled_documents Authenticated users can view controlled documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view controlled documents" ON public.controlled_documents FOR SELECT TO authenticated USING (true);


--
-- Name: training_effectiveness_checks Authenticated users can view effectiveness checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view effectiveness checks" ON public.training_effectiveness_checks FOR SELECT TO authenticated USING (true);


--
-- Name: document_formal_reviews Authenticated users can view formal reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view formal reviews" ON public.document_formal_reviews FOR SELECT TO authenticated USING (true);


--
-- Name: qms_module_record_migrations Authenticated users can view module record migrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view module record migrations" ON public.qms_module_record_migrations FOR SELECT TO authenticated USING (true);


--
-- Name: qms_module_release_events Authenticated users can view module release events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view module release events" ON public.qms_module_release_events FOR SELECT TO authenticated USING (true);


--
-- Name: supplier_audits Authenticated users can view supplier audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view supplier audits" ON public.supplier_audits FOR SELECT TO authenticated USING (true);


--
-- Name: document_training_assignments Authenticated users can view training assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view training assignments" ON public.document_training_assignments FOR SELECT TO authenticated USING (true);


--
-- Name: training_matrix Authenticated users can view training matrix; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view training matrix" ON public.training_matrix FOR SELECT TO authenticated USING (true);


--
-- Name: equipment_document_links Equipment authorized users can read document links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipment authorized users can read document links" ON public.equipment_document_links FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.equipment_governance_members gm
  WHERE ((gm.tenant_id = equipment_document_links.tenant_id) AND (lower(gm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['viewer'::text, 'coordinator'::text, 'quality_approver'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.equipment e
  WHERE ((e.id = equipment_document_links.equipment_id) AND (e.tenant_id = equipment_document_links.tenant_id) AND ((lower(COALESCE(e.owner_email, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(COALESCE(e.created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))))))));


--
-- Name: equipment_document_links Equipment controlled roles can create document links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipment controlled roles can create document links" ON public.equipment_document_links FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.equipment_governance_members gm
  WHERE ((gm.tenant_id = equipment_document_links.tenant_id) AND (lower(gm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.equipment e
  WHERE ((e.id = equipment_document_links.equipment_id) AND (e.tenant_id = equipment_document_links.tenant_id) AND ((lower(COALESCE(e.owner_email, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(COALESCE(e.created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))))))));


--
-- Name: equipment_document_links Equipment controlled roles can update document links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipment controlled roles can update document links" ON public.equipment_document_links FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.equipment_governance_members gm
  WHERE ((gm.tenant_id = equipment_document_links.tenant_id) AND (lower(gm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.equipment e
  WHERE ((e.id = equipment_document_links.equipment_id) AND (e.tenant_id = equipment_document_links.tenant_id) AND ((lower(COALESCE(e.owner_email, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(COALESCE(e.created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.equipment_governance_members gm
  WHERE ((gm.tenant_id = equipment_document_links.tenant_id) AND (lower(gm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.equipment e
  WHERE ((e.id = equipment_document_links.equipment_id) AND (e.tenant_id = equipment_document_links.tenant_id) AND ((lower(COALESCE(e.owner_email, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(COALESCE(e.created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))))))));


--
-- Name: tenant_memberships Platform admins can view all tenant memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all tenant memberships" ON public.tenant_memberships FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: tenant_module_access Platform admins can view all tenant module access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all tenant module access" ON public.tenant_module_access FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: tenants Platform admins can view all tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all tenants" ON public.tenants FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: platform_administrators Platform admins can view platform administrators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view platform administrators" ON public.platform_administrators FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: tenant_memberships Tenant admins can add tenant members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant admins can add tenant members" ON public.tenant_memberships FOR INSERT TO authenticated WITH CHECK (public.is_tenant_admin(tenant_id));


--
-- Name: tenant_memberships Tenant admins can remove tenant members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant admins can remove tenant members" ON public.tenant_memberships FOR DELETE TO authenticated USING (public.is_tenant_admin(tenant_id));


--
-- Name: tenant_memberships Tenant admins can update tenant members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant admins can update tenant members" ON public.tenant_memberships FOR UPDATE TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));


--
-- Name: tenants Tenant admins can update their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant admins can update their tenant" ON public.tenants FOR UPDATE TO authenticated USING (public.is_tenant_admin(id)) WITH CHECK (public.is_tenant_admin(id));


--
-- Name: tenant_memberships Tenant admins can view tenant memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant admins can view tenant memberships" ON public.tenant_memberships FOR SELECT TO authenticated USING (public.is_tenant_admin(tenant_id));


--
-- Name: tenant_module_access Tenant members can view module access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant members can view module access" ON public.tenant_module_access FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenants Tenant members can view their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant members can view their tenant" ON public.tenants FOR SELECT TO authenticated USING (public.is_tenant_member(id));


--
-- Name: notification_preferences Users can insert their notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their notification preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: notification_preferences Users can update their notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their notification preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text))) WITH CHECK ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: notifications Users can update their notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text))) WITH CHECK ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: notification_preferences Users can view their notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their notification preferences" ON public.notification_preferences FOR SELECT TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: notifications Users can view their notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_email = (auth.jwt() ->> 'email'::text)));


--
-- Name: tenant_memberships Users can view their own tenant memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own tenant memberships" ON public.tenant_memberships FOR SELECT TO authenticated USING ((lower(user_email) = public.current_user_email()));


--
-- Name: printable_management_reviews allow authenticated update printable management reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow authenticated update printable management reviews" ON public.printable_management_reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: audit_number_counters allow insert audit number counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow insert audit number counters" ON public.audit_number_counters FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: ncmr_mrb_approvers allow insert ncmr mrb approvers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow insert ncmr mrb approvers" ON public.ncmr_mrb_approvers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: printable_management_reviews allow insert printable management reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow insert printable management reviews" ON public.printable_management_reviews FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: audit_number_counters allow read audit number counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read audit number counters" ON public.audit_number_counters FOR SELECT TO authenticated USING (true);


--
-- Name: md_defect_categories allow read defect categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read defect categories" ON public.md_defect_categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_defect_subcategories allow read defect subcategories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read defect subcategories" ON public.md_defect_subcategories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_departments allow read departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read departments" ON public.md_departments FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_detection_sources allow read detection sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read detection sources" ON public.md_detection_sources FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_dispositions allow read dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read dispositions" ON public.md_dispositions FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_material_statuses allow read material statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read material statuses" ON public.md_material_statuses FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_equipment allow read md equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read md equipment" ON public.md_equipment FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_oos_limits allow read md oos limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read md oos limits" ON public.md_oos_limits FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_rooms allow read md rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read md rooms" ON public.md_rooms FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_test_methods allow read md test methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read md test methods" ON public.md_test_methods FOR SELECT TO authenticated, anon USING (true);


--
-- Name: ncmr_mrb_approvers allow read ncmr mrb approvers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read ncmr mrb approvers" ON public.ncmr_mrb_approvers FOR SELECT TO authenticated, anon USING (true);


--
-- Name: printable_management_review_signatures allow read printable management review signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read printable management review signatures" ON public.printable_management_review_signatures FOR SELECT TO authenticated, anon USING (true);


--
-- Name: printable_management_reviews allow read printable management reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read printable management reviews" ON public.printable_management_reviews FOR SELECT TO authenticated, anon USING (true);


--
-- Name: md_root_cause_categories allow read root cause categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read root cause categories" ON public.md_root_cause_categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: audit_number_counters allow update audit number counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow update audit number counters" ON public.audit_number_counters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: ncmr_mrb_approvers allow update ncmr mrb approvers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow update ncmr mrb approvers" ON public.ncmr_mrb_approvers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: printable_management_reviews allow update unlocked printable management reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow update unlocked printable management reviews" ON public.printable_management_reviews FOR UPDATE TO authenticated USING ((is_locked = false)) WITH CHECK ((is_locked = false));


--
-- Name: md_equipment allow write md equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow write md equipment" ON public.md_equipment TO authenticated USING (true) WITH CHECK (true);


--
-- Name: md_oos_limits allow write md oos limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow write md oos limits" ON public.md_oos_limits TO authenticated USING (true) WITH CHECK (true);


--
-- Name: md_rooms allow write md rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow write md rooms" ON public.md_rooms TO authenticated USING (true) WITH CHECK (true);


--
-- Name: md_test_methods allow write md test methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow write md test methods" ON public.md_test_methods TO authenticated USING (true) WITH CHECK (true);


--
-- Name: md_root_cause_categories allow write root cause categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow write root cause categories" ON public.md_root_cause_categories TO authenticated USING (true) WITH CHECK (true);


--
-- Name: approval_matrix_reviewers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_matrix_reviewers ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_matrix_template_reviewers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_matrix_template_reviewers ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_matrix_template_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_matrix_template_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_matrix_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_matrix_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_tasks approval_tasks_capa_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_tasks_capa_company_boundary ON public.approval_tasks AS RESTRICTIVE TO authenticated USING (((lower(entity_type) <> 'capa'::text) OR (EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = approval_tasks.entity_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text)))))) WITH CHECK (((lower(entity_type) <> 'capa'::text) OR (EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = approval_tasks.entity_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text))))));


--
-- Name: approval_tasks approval_tasks_controlled_documents_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_tasks_controlled_documents_company_boundary ON public.approval_tasks AS RESTRICTIVE TO authenticated USING (((lower(COALESCE(entity_type, ''::text)) <> ALL (ARRAY['controlled_document'::text, 'controlled_documents'::text, 'document'::text])) OR (EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = approval_tasks.entity_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))))) WITH CHECK (((lower(COALESCE(entity_type, ''::text)) <> ALL (ARRAY['controlled_document'::text, 'controlled_documents'::text, 'document'::text])) OR (EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = approval_tasks.entity_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))));


--
-- Name: approval_tasks approval_tasks_ncmr_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_tasks_ncmr_company_boundary ON public.approval_tasks AS RESTRICTIVE TO authenticated USING (((lower(entity_type) <> 'ncmr'::text) OR (EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE ((n.id = approval_tasks.entity_id) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text)))))) WITH CHECK (((lower(entity_type) <> 'ncmr'::text) OR (EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE ((n.id = approval_tasks.entity_id) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text))))));


--
-- Name: md_defect_categories approver delete defect categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete defect categories" ON public.md_defect_categories FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_defect_subcategories approver delete defect subcategories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete defect subcategories" ON public.md_defect_subcategories FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_departments approver delete departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete departments" ON public.md_departments FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_detection_sources approver delete detection sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete detection sources" ON public.md_detection_sources FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_dispositions approver delete dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete dispositions" ON public.md_dispositions FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_material_statuses approver delete material statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete material statuses" ON public.md_material_statuses FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_product_part_numbers approver delete product part numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver delete product part numbers" ON public.md_product_part_numbers FOR DELETE TO authenticated USING (public.is_approver());


--
-- Name: md_defect_categories approver insert defect categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert defect categories" ON public.md_defect_categories FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: md_defect_subcategories approver insert defect subcategories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert defect subcategories" ON public.md_defect_subcategories FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: md_departments approver insert departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert departments" ON public.md_departments FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: md_detection_sources approver insert detection sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert detection sources" ON public.md_detection_sources FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: md_dispositions approver insert dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert dispositions" ON public.md_dispositions FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: md_material_statuses approver insert material statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert material statuses" ON public.md_material_statuses FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: md_product_part_numbers approver insert product part numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "approver insert product part numbers" ON public.md_product_part_numbers FOR INSERT TO authenticated WITH CHECK (public.is_approver());


--
-- Name: audit_findings audit finding tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit finding tenant insert" ON public.audit_findings FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text)));


--
-- Name: audit_findings audit finding tenant select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit finding tenant select" ON public.audit_findings FOR SELECT TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text)));


--
-- Name: audit_findings audit finding tenant update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit finding tenant update" ON public.audit_findings FOR UPDATE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text)));


--
-- Name: audits audit tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit tenant insert" ON public.audits FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text)));


--
-- Name: audits audit tenant select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit tenant select" ON public.audits FOR SELECT TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text)));


--
-- Name: audits audit tenant update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit tenant update" ON public.audits FOR UPDATE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'audit_management'::text)));


--
-- Name: audit_findings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_tenant_select ON public.audit_logs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: audit_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_tenant_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_tenant_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

--
-- Name: receiving_inspections authenticated delete receiving inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated delete receiving inspections" ON public.receiving_inspections FOR DELETE TO authenticated USING (true);


--
-- Name: scars authenticated delete scars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated delete scars" ON public.scars FOR DELETE TO authenticated USING (true);


--
-- Name: supplier_documents authenticated delete supplier documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated delete supplier documents" ON public.supplier_documents FOR DELETE TO authenticated USING (true);


--
-- Name: suppliers authenticated delete suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);


--
-- Name: receiving_inspections authenticated insert receiving inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated insert receiving inspections" ON public.receiving_inspections FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: scars authenticated insert scars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated insert scars" ON public.scars FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: supplier_documents authenticated insert supplier documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated insert supplier documents" ON public.supplier_documents FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: suppliers authenticated insert suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: receiving_inspections authenticated read receiving inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read receiving inspections" ON public.receiving_inspections FOR SELECT TO authenticated USING (true);


--
-- Name: scars authenticated read scars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read scars" ON public.scars FOR SELECT TO authenticated USING (true);


--
-- Name: supplier_documents authenticated read supplier documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read supplier documents" ON public.supplier_documents FOR SELECT TO authenticated USING (true);


--
-- Name: suppliers authenticated read suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);


--
-- Name: receiving_inspections authenticated update receiving inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated update receiving inspections" ON public.receiving_inspections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: scars authenticated update scars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated update scars" ON public.scars FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: supplier_documents authenticated update supplier documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated update supplier documents" ON public.supplier_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: suppliers authenticated update suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: capa_approval_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capa_approval_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: capa_approval_tasks capa_approval_tasks_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capa_approval_tasks_company_boundary ON public.capa_approval_tasks AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_approval_tasks.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_approval_tasks.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text)))));


--
-- Name: capa_gate_approvers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capa_gate_approvers ENABLE ROW LEVEL SECURITY;

--
-- Name: capa_gate_approvers capa_gate_approvers_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capa_gate_approvers_company_boundary ON public.capa_gate_approvers AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_gate_approvers.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_gate_approvers.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text)))));


--
-- Name: capa_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capa_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: capa_tasks capa_tasks_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capa_tasks_company_boundary ON public.capa_tasks AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_tasks.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_tasks.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text)))));


--
-- Name: capa_tenant_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capa_tenant_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: capa_workflow_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capa_workflow_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: capa_workflow_returns capa_workflow_returns_authenticated_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capa_workflow_returns_authenticated_read ON public.capa_workflow_returns FOR SELECT TO authenticated USING (true);


--
-- Name: capa_workflow_returns capa_workflow_returns_authorized_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capa_workflow_returns_authorized_insert ON public.capa_workflow_returns FOR INSERT TO authenticated WITH CHECK (((lower(returned_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = 'vp_quality'::text)))) OR (EXISTS ( SELECT 1
   FROM public.user_security_roles usr
  WHERE ((lower(usr.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (usr.role_code = ANY (ARRAY['capa_administrator'::text, 'capa_coordinator'::text, 'vp_quality'::text]))))))));


--
-- Name: capa_workflow_returns capa_workflow_returns_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capa_workflow_returns_company_boundary ON public.capa_workflow_returns AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_workflow_returns.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = capa_workflow_returns.capa_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text)))));


--
-- Name: capas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capas ENABLE ROW LEVEL SECURITY;

--
-- Name: capas capas_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capas_company_boundary ON public.capas AS RESTRICTIVE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'capa'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'capa'::text)));


--
-- Name: change_control_tenant_number_counters change_control_counter_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_control_counter_company_boundary ON public.change_control_tenant_number_counters AS RESTRICTIVE FOR SELECT TO authenticated USING ((tenant_id = public.qualisphere_resolve_change_control_tenant()));


--
-- Name: change_control_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_control_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: change_control_documents change_control_documents_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_control_documents_company_boundary ON public.change_control_documents AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_change_control_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_change_control_tenant()));


--
-- Name: change_control_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_control_products ENABLE ROW LEVEL SECURITY;

--
-- Name: change_control_products change_control_products_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_control_products_company_boundary ON public.change_control_products AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_change_control_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_change_control_tenant()));


--
-- Name: change_control_reviewers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_control_reviewers ENABLE ROW LEVEL SECURITY;

--
-- Name: change_control_reviewers change_control_reviewers_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_control_reviewers_company_boundary ON public.change_control_reviewers AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_change_control_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_change_control_tenant()));


--
-- Name: change_control_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_control_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: change_control_tasks change_control_tasks_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_control_tasks_company_boundary ON public.change_control_tasks AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_change_control_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_change_control_tenant()));


--
-- Name: change_control_tenant_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_control_tenant_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: change_controls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_controls ENABLE ROW LEVEL SECURITY;

--
-- Name: change_controls change_controls_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_controls_company_boundary ON public.change_controls AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_change_control_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_change_control_tenant()));


--
-- Name: collaboration_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaboration_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboration_comments collaboration_comments_authenticated_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_comments_authenticated_insert ON public.collaboration_comments FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (lower(COALESCE(created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: collaboration_comments collaboration_comments_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_comments_authenticated_select ON public.collaboration_comments FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: collaboration_comments collaboration_comments_authenticated_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_comments_authenticated_update ON public.collaboration_comments FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND (lower(COALESCE(created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (lower(COALESCE(created_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: collaboration_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaboration_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboration_participants collaboration_participants_authenticated_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_participants_authenticated_delete ON public.collaboration_participants FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: collaboration_participants collaboration_participants_authenticated_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_participants_authenticated_insert ON public.collaboration_participants FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((assigned_by IS NULL) OR (lower(assigned_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));


--
-- Name: collaboration_participants collaboration_participants_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_participants_authenticated_select ON public.collaboration_participants FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: collaboration_participants collaboration_participants_authenticated_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_participants_authenticated_update ON public.collaboration_participants FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: collaboration_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaboration_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboration_threads collaboration_threads_authenticated_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_threads_authenticated_insert ON public.collaboration_threads FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((created_by IS NULL) OR (lower(created_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));


--
-- Name: collaboration_threads collaboration_threads_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_threads_authenticated_select ON public.collaboration_threads FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: collaboration_threads collaboration_threads_authenticated_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collaboration_threads_authenticated_update ON public.collaboration_threads FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: company_dashboard_kpi_configuration; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_dashboard_kpi_configuration ENABLE ROW LEVEL SECURITY;

--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configuration_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_dashboard_kpi_configuration_company_admin_delete ON public.company_dashboard_kpi_configuration FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configuration_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_dashboard_kpi_configuration_company_admin_insert ON public.company_dashboard_kpi_configuration FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configuration_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_dashboard_kpi_configuration_company_admin_update ON public.company_dashboard_kpi_configuration FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: company_dashboard_kpi_configuration company_dashboard_kpi_configuration_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_dashboard_kpi_configuration_tenant_member_select ON public.company_dashboard_kpi_configuration FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: company_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: company_settings company_settings_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_settings_company_admin_delete ON public.company_settings FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: company_settings company_settings_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_settings_company_admin_insert ON public.company_settings FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: company_settings company_settings_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_settings_company_admin_update ON public.company_settings FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: company_settings company_settings_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_settings_tenant_member_select ON public.company_settings FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: complaint_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.complaint_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: complaint_activity_log complaint_activity_log_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY complaint_activity_log_company_boundary ON public.complaint_activity_log AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_complaint_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_complaint_tenant()));


--
-- Name: complaint_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: complaint_quality_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.complaint_quality_links ENABLE ROW LEVEL SECURITY;

--
-- Name: complaint_quality_links complaint_quality_links_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY complaint_quality_links_company_boundary ON public.complaint_quality_links AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_complaint_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_complaint_tenant()));


--
-- Name: complaints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints complaints_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY complaints_company_boundary ON public.complaints AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_complaint_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_complaint_tenant()));


--
-- Name: controlled_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.controlled_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: controlled_documents controlled_documents_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY controlled_documents_company_boundary ON public.controlled_documents AS RESTRICTIVE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: custom_kpi_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_kpi_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_kpi_definitions custom_kpi_definitions_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_kpi_definitions_company_admin_delete ON public.custom_kpi_definitions FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: custom_kpi_definitions custom_kpi_definitions_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_kpi_definitions_company_admin_insert ON public.custom_kpi_definitions FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: custom_kpi_definitions custom_kpi_definitions_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_kpi_definitions_company_admin_update ON public.custom_kpi_definitions FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: custom_kpi_definitions custom_kpi_definitions_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_kpi_definitions_tenant_member_select ON public.custom_kpi_definitions FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: customer_role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_role_permissions customer_role_permissions_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_role_permissions_company_admin_delete ON public.customer_role_permissions FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: customer_role_permissions customer_role_permissions_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_role_permissions_company_admin_insert ON public.customer_role_permissions FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_company_admin(tenant_id) AND (EXISTS ( SELECT 1
   FROM public.customer_roles cr
  WHERE ((cr.id = customer_role_permissions.role_id) AND (cr.tenant_id = cr.tenant_id))))));


--
-- Name: customer_role_permissions customer_role_permissions_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_role_permissions_company_admin_update ON public.customer_role_permissions FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK ((public.qualisphere_is_company_admin(tenant_id) AND (EXISTS ( SELECT 1
   FROM public.customer_roles cr
  WHERE ((cr.id = customer_role_permissions.role_id) AND (cr.tenant_id = cr.tenant_id))))));


--
-- Name: customer_role_permissions customer_role_permissions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_role_permissions_member_select ON public.customer_role_permissions FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: customer_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_roles customer_roles_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_roles_company_admin_delete ON public.customer_roles FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: customer_roles customer_roles_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_roles_company_admin_insert ON public.customer_roles FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: customer_roles customer_roles_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_roles_company_admin_update ON public.customer_roles FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: customer_roles customer_roles_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_roles_member_select ON public.customer_roles FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: dashboard_kpi_configuration; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_kpi_configuration ENABLE ROW LEVEL SECURITY;

--
-- Name: document_change_document_files dci_document_files_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dci_document_files_company_boundary ON public.document_change_document_files TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: dci_pdf_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dci_pdf_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: dci_pdf_verifications dci_pdf_verifications_member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dci_pdf_verifications_member_read ON public.dci_pdf_verifications FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships m
  WHERE ((m.tenant_id = dci_pdf_verifications.tenant_id) AND (lower(m.user_email) = lower((auth.jwt() ->> 'email'::text))) AND (m.membership_status = 'active'::text)))));


--
-- Name: document_acknowledgements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_acknowledgements ENABLE ROW LEVEL SECURITY;

--
-- Name: document_acknowledgements document_acknowledgements_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_acknowledgements_company_boundary ON public.document_acknowledgements AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_acknowledgements.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_acknowledgements.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))));


--
-- Name: document_assigned_reviewers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_assigned_reviewers ENABLE ROW LEVEL SECURITY;

--
-- Name: document_assigned_reviewers document_assigned_reviewers_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_assigned_reviewers_company_boundary ON public.document_assigned_reviewers AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_assigned_reviewers.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_assigned_reviewers.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))));


--
-- Name: document_change_document_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_change_document_files ENABLE ROW LEVEL SECURITY;

--
-- Name: document_change_initiation_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_change_initiation_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: document_change_initiation_documents document_change_initiation_documents_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_change_initiation_documents_company_boundary ON public.document_change_initiation_documents TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: document_change_initiations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_change_initiations ENABLE ROW LEVEL SECURITY;

--
-- Name: document_change_initiations document_change_initiations_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_change_initiations_company_boundary ON public.document_change_initiations TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: document_change_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_change_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: document_change_number_counters document_change_number_counters_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_change_number_counters_company_boundary ON public.document_change_number_counters FOR SELECT TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: document_collaboration_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_collaboration_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: document_collaboration_reviews document_collaboration_reviews_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_collaboration_reviews_company_boundary ON public.document_collaboration_reviews AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_collaboration_reviews.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_collaboration_reviews.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))));


--
-- Name: document_formal_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_formal_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: document_formal_reviews document_formal_reviews_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_formal_reviews_company_boundary ON public.document_formal_reviews AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_formal_reviews.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_formal_reviews.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))));


--
-- Name: document_impact_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_impact_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_impact_assessments document_impact_assessments_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_impact_assessments_company_boundary ON public.document_impact_assessments TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: document_number_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_number_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: document_number_sequences document_number_sequences_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_number_sequences_company_boundary ON public.document_number_sequences AS RESTRICTIVE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: document_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: document_relationships document_relationships_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_relationships_company_boundary ON public.document_relationships AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.controlled_documents p
     JOIN public.controlled_documents d ON (((d.id = document_relationships.related_document_id) AND (d.tenant_id = p.tenant_id))))
  WHERE ((p.id = document_relationships.parent_document_id) AND public.qualisphere_is_active_tenant_member(p.tenant_id) AND public.qualisphere_tenant_module_enabled(p.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.controlled_documents p
     JOIN public.controlled_documents d ON (((d.id = document_relationships.related_document_id) AND (d.tenant_id = p.tenant_id))))
  WHERE ((p.id = document_relationships.parent_document_id) AND public.qualisphere_is_active_tenant_member(p.tenant_id) AND public.qualisphere_tenant_module_enabled(p.tenant_id, 'controlled_documents'::text)))));


--
-- Name: document_training_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_training_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_training_assignments document_training_assignments_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_training_assignments_company_boundary ON public.document_training_assignments AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_training_assignments.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_training_assignments.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))));


--
-- Name: document_training_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_training_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: document_training_requirements document_training_requirements_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_training_requirements_company_boundary ON public.document_training_requirements TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents'::text)));


--
-- Name: document_workflow_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_workflow_events ENABLE ROW LEVEL SECURITY;

--
-- Name: document_workflow_events document_workflow_events_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_workflow_events_company_boundary ON public.document_workflow_events AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_workflow_events.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.controlled_documents d
  WHERE ((d.id = document_workflow_events.document_id) AND public.qualisphere_is_active_tenant_member(d.tenant_id) AND public.qualisphere_tenant_module_enabled(d.tenant_id, 'controlled_documents'::text)))));


--
-- Name: electronic_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.electronic_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_profiles employee_profiles_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_profiles_admin_insert ON public.employee_profiles FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.tenant_memberships tm
  WHERE ((tm.tenant_id = employee_profiles.tenant_id) AND (lower(tm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (tm.membership_status = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['admin'::text, 'administrator'::text, 'vp_quality'::text])))))));


--
-- Name: employee_profiles employee_profiles_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_profiles_admin_update ON public.employee_profiles FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.tenant_memberships tm
  WHERE ((tm.tenant_id = employee_profiles.tenant_id) AND (lower(tm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (tm.membership_status = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['admin'::text, 'administrator'::text, 'vp_quality'::text]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.tenant_memberships tm
  WHERE ((tm.tenant_id = employee_profiles.tenant_id) AND (lower(tm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (tm.membership_status = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['admin'::text, 'administrator'::text, 'vp_quality'::text])))))));


--
-- Name: employee_profiles employee_profiles_coordinator_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_profiles_coordinator_delete ON public.employee_profiles FOR DELETE TO authenticated USING (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id)));


--
-- Name: employee_profiles employee_profiles_coordinator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_profiles_coordinator_insert ON public.employee_profiles FOR INSERT TO authenticated WITH CHECK (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id)));


--
-- Name: employee_profiles employee_profiles_coordinator_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_profiles_coordinator_update ON public.employee_profiles FOR UPDATE TO authenticated USING (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id))) WITH CHECK (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id)));


--
-- Name: employee_profiles employee_profiles_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_profiles_tenant_select ON public.employee_profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tenant_memberships tm
  WHERE ((tm.tenant_id = employee_profiles.tenant_id) AND (lower(tm.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (tm.membership_status = 'active'::text)))));


--
-- Name: equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_calibration_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_calibration_events ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_change_control_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_change_control_links ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_document_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_document_links ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_event_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_event_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_governance_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_governance_members ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_governance_members equipment_governance_members_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_governance_members_admin_select ON public.equipment_governance_members FOR SELECT TO authenticated USING (public.is_equipment_admin_for_tenant(tenant_id));


--
-- Name: equipment_governance_members equipment_governance_members_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_governance_members_select_own ON public.equipment_governance_members FOR SELECT TO authenticated USING ((lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: equipment_import_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_import_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_import_batches equipment_import_batches_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_import_batches_insert ON public.equipment_import_batches FOR INSERT TO authenticated WITH CHECK (((lower(created_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_batches.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text])))))));


--
-- Name: equipment_import_batches equipment_import_batches_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_import_batches_select ON public.equipment_import_batches FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_batches.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))));


--
-- Name: equipment_import_batches equipment_import_batches_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_import_batches_update ON public.equipment_import_batches FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_batches.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_batches.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))));


--
-- Name: equipment_import_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_import_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_import_rows equipment_import_rows_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_import_rows_insert ON public.equipment_import_rows FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_rows.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))));


--
-- Name: equipment_import_rows equipment_import_rows_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_import_rows_select ON public.equipment_import_rows FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_rows.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))));


--
-- Name: equipment_import_rows equipment_import_rows_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_import_rows_update ON public.equipment_import_rows FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_rows.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.equipment_governance_members m
  WHERE ((m.tenant_id = equipment_import_rows.tenant_id) AND (lower(m.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (m.is_active = true) AND (m.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text]))))));


--
-- Name: equipment_maintenance_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_maintenance_components ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_maintenance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_maintenance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_numbering_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_numbering_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_oos_oot_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_oos_oot_links ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_oos_oot_links equipment_oos_oot_links_module_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_oos_oot_links_module_boundary ON public.equipment_oos_oot_links TO authenticated USING ((public.is_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text) AND public.qualisphere_tenant_module_enabled(tenant_id, 'oos_oot'::text))) WITH CHECK ((public.is_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text) AND public.qualisphere_tenant_module_enabled(tenant_id, 'oos_oot'::text)));


--
-- Name: equipment_post_maintenance_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_post_maintenance_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_qualification_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_qualification_events ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_release_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_release_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_release_requests equipment_release_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_release_requests_insert ON public.equipment_release_requests FOR INSERT TO authenticated WITH CHECK (((lower(submitted_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (EXISTS ( SELECT 1
   FROM public.equipment_governance_members me
  WHERE ((me.tenant_id = equipment_release_requests.tenant_id) AND (lower(me.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (me.is_active = true) AND (me.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text])))))));


--
-- Name: equipment_release_requests equipment_release_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_release_requests_select ON public.equipment_release_requests FOR SELECT TO authenticated USING (((lower(submitted_by) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(approver_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (EXISTS ( SELECT 1
   FROM public.equipment_governance_members me
  WHERE ((me.tenant_id = equipment_release_requests.tenant_id) AND (lower(me.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (me.is_active = true) AND (me.role = ANY (ARRAY['coordinator'::text, 'quality_approver'::text, 'admin'::text])))))));


--
-- Name: equipment_release_requests equipment_release_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_release_requests_update ON public.equipment_release_requests FOR UPDATE TO authenticated USING ((((lower(approver_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (EXISTS ( SELECT 1
   FROM public.equipment_governance_members me
  WHERE ((me.tenant_id = equipment_release_requests.tenant_id) AND (lower(me.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (me.is_active = true) AND (me.role = ANY (ARRAY['quality_approver'::text, 'admin'::text])))))) OR (EXISTS ( SELECT 1
   FROM public.equipment_governance_members me
  WHERE ((me.tenant_id = equipment_release_requests.tenant_id) AND (lower(me.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (me.is_active = true) AND (me.role = 'admin'::text)))))) WITH CHECK ((((lower(approver_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (EXISTS ( SELECT 1
   FROM public.equipment_governance_members me
  WHERE ((me.tenant_id = equipment_release_requests.tenant_id) AND (lower(me.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (me.is_active = true) AND (me.role = ANY (ARRAY['quality_approver'::text, 'admin'::text])))))) OR (EXISTS ( SELECT 1
   FROM public.equipment_governance_members me
  WHERE ((me.tenant_id = equipment_release_requests.tenant_id) AND (lower(me.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (me.is_active = true) AND (me.role = 'admin'::text))))));


--
-- Name: equipment_schedule_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_schedule_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_schedule_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_schedule_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.governance_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_history ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_library ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_library_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_library_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: management_review_actions management review action tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review action tenant insert" ON public.management_review_actions FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_actions management review action tenant select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review action tenant select" ON public.management_review_actions FOR SELECT TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_actions management review action tenant update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review action tenant update" ON public.management_review_actions FOR UPDATE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_approvers management review approver tenant delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review approver tenant delete" ON public.management_review_approvers FOR DELETE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_approvers management review approver tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review approver tenant insert" ON public.management_review_approvers FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_approvers management review approver tenant select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review approver tenant select" ON public.management_review_approvers FOR SELECT TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_approvers management review approver tenant update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review approver tenant update" ON public.management_review_approvers FOR UPDATE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_reviews management review tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review tenant insert" ON public.management_reviews FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_reviews management review tenant select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review tenant select" ON public.management_reviews FOR SELECT TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_reviews management review tenant update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "management review tenant update" ON public.management_reviews FOR UPDATE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'management_review'::text)));


--
-- Name: management_review_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.management_review_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: management_review_approvers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.management_review_approvers ENABLE ROW LEVEL SECURITY;

--
-- Name: management_review_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.management_review_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: management_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.management_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: md_defect_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_defect_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: md_defect_categories md_defect_categories_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_categories_company_admin_delete ON public.md_defect_categories FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_defect_categories md_defect_categories_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_categories_company_admin_insert ON public.md_defect_categories FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_defect_categories md_defect_categories_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_categories_company_admin_update ON public.md_defect_categories FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_defect_categories md_defect_categories_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_categories_tenant_member_select ON public.md_defect_categories FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_defect_subcategories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_defect_subcategories ENABLE ROW LEVEL SECURITY;

--
-- Name: md_defect_subcategories md_defect_subcategories_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_subcategories_company_admin_delete ON public.md_defect_subcategories FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_defect_subcategories md_defect_subcategories_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_subcategories_company_admin_insert ON public.md_defect_subcategories FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_defect_subcategories md_defect_subcategories_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_subcategories_company_admin_update ON public.md_defect_subcategories FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_defect_subcategories md_defect_subcategories_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_defect_subcategories_tenant_member_select ON public.md_defect_subcategories FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_departments ENABLE ROW LEVEL SECURITY;

--
-- Name: md_departments md_departments_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_departments_company_admin_delete ON public.md_departments FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_departments md_departments_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_departments_company_admin_insert ON public.md_departments FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_departments md_departments_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_departments_company_admin_update ON public.md_departments FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_departments md_departments_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_departments_tenant_member_select ON public.md_departments FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_detection_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_detection_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: md_detection_sources md_detection_sources_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_detection_sources_company_admin_delete ON public.md_detection_sources FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_detection_sources md_detection_sources_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_detection_sources_company_admin_insert ON public.md_detection_sources FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_detection_sources md_detection_sources_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_detection_sources_company_admin_update ON public.md_detection_sources FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_detection_sources md_detection_sources_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_detection_sources_tenant_member_select ON public.md_detection_sources FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_dispositions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_dispositions ENABLE ROW LEVEL SECURITY;

--
-- Name: md_dispositions md_dispositions_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_dispositions_company_admin_delete ON public.md_dispositions FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_dispositions md_dispositions_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_dispositions_company_admin_insert ON public.md_dispositions FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_dispositions md_dispositions_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_dispositions_company_admin_update ON public.md_dispositions FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_dispositions md_dispositions_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_dispositions_tenant_member_select ON public.md_dispositions FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_document_impact_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_document_impact_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: md_document_impact_areas md_document_impact_areas_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_document_impact_areas_company_boundary ON public.md_document_impact_areas TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id)) WITH CHECK (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: md_equipment md_equipment_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_equipment_company_admin_delete ON public.md_equipment FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_equipment md_equipment_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_equipment_company_admin_insert ON public.md_equipment FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_equipment md_equipment_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_equipment_company_admin_update ON public.md_equipment FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_equipment md_equipment_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_equipment_tenant_member_select ON public.md_equipment FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_material_statuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_material_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: md_material_statuses md_material_statuses_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_material_statuses_company_admin_delete ON public.md_material_statuses FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_material_statuses md_material_statuses_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_material_statuses_company_admin_insert ON public.md_material_statuses FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_material_statuses md_material_statuses_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_material_statuses_company_admin_update ON public.md_material_statuses FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_material_statuses md_material_statuses_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_material_statuses_tenant_member_select ON public.md_material_statuses FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_oos_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_oos_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: md_oos_limits md_oos_limits_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_oos_limits_company_admin_delete ON public.md_oos_limits FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_oos_limits md_oos_limits_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_oos_limits_company_admin_insert ON public.md_oos_limits FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_oos_limits md_oos_limits_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_oos_limits_company_admin_update ON public.md_oos_limits FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_oos_limits md_oos_limits_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_oos_limits_tenant_member_select ON public.md_oos_limits FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_product_part_numbers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_product_part_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: md_product_part_numbers md_product_part_numbers_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_product_part_numbers_company_admin_delete ON public.md_product_part_numbers FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_product_part_numbers md_product_part_numbers_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_product_part_numbers_company_admin_insert ON public.md_product_part_numbers FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_product_part_numbers md_product_part_numbers_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_product_part_numbers_company_admin_update ON public.md_product_part_numbers FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_product_part_numbers md_product_part_numbers_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_product_part_numbers_tenant_member_select ON public.md_product_part_numbers FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: md_rooms md_rooms_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_rooms_company_admin_delete ON public.md_rooms FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_rooms md_rooms_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_rooms_company_admin_insert ON public.md_rooms FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_rooms md_rooms_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_rooms_company_admin_update ON public.md_rooms FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_rooms md_rooms_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_rooms_tenant_member_select ON public.md_rooms FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: md_root_cause_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_root_cause_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: md_test_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.md_test_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: md_test_methods md_test_methods_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_test_methods_company_admin_delete ON public.md_test_methods FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_test_methods md_test_methods_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_test_methods_company_admin_insert ON public.md_test_methods FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_test_methods md_test_methods_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_test_methods_company_admin_update ON public.md_test_methods FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: md_test_methods md_test_methods_tenant_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY md_test_methods_tenant_member_select ON public.md_test_methods FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: ncmr_affected_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncmr_affected_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ncmr_affected_items ncmr_affected_items_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncmr_affected_items_company_boundary ON public.ncmr_affected_items AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = (ncmr_affected_items.ncmr_id)::text) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = (ncmr_affected_items.ncmr_id)::text) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text)))));


--
-- Name: ncmr_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncmr_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: ncmr_comments ncmr_comments_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncmr_comments_company_boundary ON public.ncmr_comments AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = (ncmr_comments.ncmr_id)::text) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = (ncmr_comments.ncmr_id)::text) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text)))));


--
-- Name: ncmr_mrb_approvers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncmr_mrb_approvers ENABLE ROW LEVEL SECURITY;

--
-- Name: ncmr_mrb_approvers ncmr_mrb_approvers_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncmr_mrb_approvers_company_boundary ON public.ncmr_mrb_approvers AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = (ncmr_mrb_approvers.ncmr_id)::text) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = (ncmr_mrb_approvers.ncmr_id)::text) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text)))));


--
-- Name: ncmr_mrb_reviewers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncmr_mrb_reviewers ENABLE ROW LEVEL SECURITY;

--
-- Name: ncmr_mrb_reviewers ncmr_mrb_reviewers_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncmr_mrb_reviewers_company_boundary ON public.ncmr_mrb_reviewers AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = ncmr_mrb_reviewers.ncmr_id) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE (((n.id)::text = ncmr_mrb_reviewers.ncmr_id) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text)))));


--
-- Name: ncmr_tenant_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncmr_tenant_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: ncmrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncmrs ENABLE ROW LEVEL SECURITY;

--
-- Name: ncmrs ncmrs_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncmrs_company_boundary ON public.ncmrs AS RESTRICTIVE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'ncmr'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'ncmr'::text)));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: oos_oot_investigations oos_oot_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oos_oot_authenticated_access ON public.oos_oot_investigations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: oos_oot_investigations oos_oot_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oos_oot_company_boundary ON public.oos_oot_investigations AS RESTRICTIVE TO authenticated USING ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'oos_oot'::text))) WITH CHECK ((public.qualisphere_is_active_tenant_member(tenant_id) AND public.qualisphere_tenant_module_enabled(tenant_id, 'oos_oot'::text)));


--
-- Name: oos_oot_investigations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oos_oot_investigations ENABLE ROW LEVEL SECURITY;

--
-- Name: oos_oot_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oos_oot_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: oos_oot_tenant_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oos_oot_tenant_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_administrators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;

--
-- Name: printable_management_review_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.printable_management_review_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: printable_management_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.printable_management_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_capa_governance_rules qms capa rules company admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms capa rules company admin insert" ON public.qms_capa_governance_rules FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_capa_governance_rules qms capa rules company admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms capa rules company admin update" ON public.qms_capa_governance_rules FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_capa_governance_rules qms capa rules tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms capa rules tenant read" ON public.qms_capa_governance_rules FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: qms_configuration_audit_log qms config audit company admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms config audit company admin insert" ON public.qms_configuration_audit_log FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_configuration_audit_log qms config audit tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms config audit tenant read" ON public.qms_configuration_audit_log FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: qms_configuration_versions qms config versions company admin delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms config versions company admin delete" ON public.qms_configuration_versions FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_configuration_versions qms config versions company admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms config versions company admin insert" ON public.qms_configuration_versions FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_configuration_versions qms config versions company admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms config versions company admin update" ON public.qms_configuration_versions FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_configuration_versions qms config versions tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms config versions tenant read" ON public.qms_configuration_versions FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: qms_risk_matrix_rules qms risk rules company admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms risk rules company admin insert" ON public.qms_risk_matrix_rules FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_risk_matrix_rules qms risk rules company admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms risk rules company admin update" ON public.qms_risk_matrix_rules FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: qms_risk_matrix_rules qms risk rules tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qms risk rules tenant read" ON public.qms_risk_matrix_rules FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: qms_capa_governance_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_capa_governance_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_configuration_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_configuration_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_configuration_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_configuration_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_decision_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_decision_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_decision_snapshots qms_decision_snapshots_capa_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qms_decision_snapshots_capa_company_boundary ON public.qms_decision_snapshots AS RESTRICTIVE TO authenticated USING (((upper(module_code) <> 'CAPA'::text) OR (EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = qms_decision_snapshots.record_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text)))))) WITH CHECK (((upper(module_code) <> 'CAPA'::text) OR (EXISTS ( SELECT 1
   FROM public.capas c
  WHERE ((c.id = qms_decision_snapshots.record_id) AND public.qualisphere_is_active_tenant_member(c.tenant_id) AND public.qualisphere_tenant_module_enabled(c.tenant_id, 'capa'::text))))));


--
-- Name: qms_decision_snapshots qms_decision_snapshots_ncmr_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qms_decision_snapshots_ncmr_company_boundary ON public.qms_decision_snapshots AS RESTRICTIVE TO authenticated USING (((upper(module_code) <> 'NCMR'::text) OR (EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE ((n.id = qms_decision_snapshots.record_id) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text)))))) WITH CHECK (((upper(module_code) <> 'NCMR'::text) OR (EXISTS ( SELECT 1
   FROM public.ncmrs n
  WHERE ((n.id = qms_decision_snapshots.record_id) AND public.qualisphere_is_active_tenant_member(n.tenant_id) AND public.qualisphere_tenant_module_enabled(n.tenant_id, 'ncmr'::text))))));


--
-- Name: qms_module_record_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_module_record_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_module_release_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_module_release_events ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_record_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_record_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_record_structure_freezes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_record_structure_freezes ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_record_structure_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_record_structure_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_risk_matrix_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_risk_matrix_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_workflow_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qms_workflow_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_matrix_reviewers qualisphere approval matrix reviewers delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix reviewers delete" ON public.approval_matrix_reviewers FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: approval_matrix_reviewers qualisphere approval matrix reviewers insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix reviewers insert" ON public.approval_matrix_reviewers FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_company_admin(tenant_id) AND (EXISTS ( SELECT 1
   FROM public.approval_matrix_templates t
  WHERE ((t.id = approval_matrix_reviewers.template_id) AND (t.tenant_id = approval_matrix_reviewers.tenant_id))))));


--
-- Name: approval_matrix_reviewers qualisphere approval matrix reviewers read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix reviewers read" ON public.approval_matrix_reviewers FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: approval_matrix_reviewers qualisphere approval matrix reviewers update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix reviewers update" ON public.approval_matrix_reviewers FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK ((public.qualisphere_is_company_admin(tenant_id) AND (EXISTS ( SELECT 1
   FROM public.approval_matrix_templates t
  WHERE ((t.id = approval_matrix_reviewers.template_id) AND (t.tenant_id = approval_matrix_reviewers.tenant_id))))));


--
-- Name: approval_matrix_templates qualisphere approval matrix templates delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix templates delete" ON public.approval_matrix_templates FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: approval_matrix_templates qualisphere approval matrix templates insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix templates insert" ON public.approval_matrix_templates FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: approval_matrix_templates qualisphere approval matrix templates read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix templates read" ON public.approval_matrix_templates FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: approval_matrix_templates qualisphere approval matrix templates update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualisphere approval matrix templates update" ON public.approval_matrix_templates FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: equipment qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_calibration_events qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_calibration_events TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_change_control_links qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_change_control_links TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_document_links qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_document_links TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_event_number_counters qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_event_number_counters TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_governance_members qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_governance_members TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_import_batches qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_import_batches TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_import_rows qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_import_rows TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_maintenance_components qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_maintenance_components TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_maintenance_events qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_maintenance_events TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_numbering_configurations qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_numbering_configurations TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_post_maintenance_assessments qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_post_maintenance_assessments TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_qualification_events qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_qualification_events TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_release_requests qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_release_requests TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_schedule_configurations qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_schedule_configurations TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment_schedule_notifications qualisphere_equipment_authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_authenticated_access ON public.equipment_schedule_notifications TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: equipment qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_calibration_events qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_calibration_events AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_change_control_links qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_change_control_links AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_document_links qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_document_links AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_event_number_counters qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_event_number_counters AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_governance_members qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_governance_members AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_import_batches qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_import_batches AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_import_rows qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_import_rows AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_maintenance_components qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_maintenance_components AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_maintenance_events qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_maintenance_events AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_numbering_configurations qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_numbering_configurations AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_post_maintenance_assessments qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_post_maintenance_assessments AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_qualification_events qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_qualification_events AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_release_requests qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_release_requests AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_schedule_configurations qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_schedule_configurations AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: equipment_schedule_notifications qualisphere_equipment_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qualisphere_equipment_tenant_boundary ON public.equipment_schedule_notifications AS RESTRICTIVE TO authenticated USING (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text)) WITH CHECK (public.qualisphere_tenant_module_enabled(tenant_id, 'equipment'::text));


--
-- Name: receiving_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receiving_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: receiving_inspections receiving_inspections_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receiving_inspections_company_boundary ON public.receiving_inspections AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: record_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.record_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: scar_tenant_number_counters scar_number_counters_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scar_number_counters_company_boundary ON public.scar_tenant_number_counters AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: scar_tenant_number_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scar_tenant_number_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: scars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scars ENABLE ROW LEVEL SECURITY;

--
-- Name: scars scars_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scars_company_boundary ON public.scars AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: security_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: security_roles security_roles_authenticated_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_roles_authenticated_read ON public.security_roles FOR SELECT TO authenticated USING (true);


--
-- Name: supplier_audit_findings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_audit_findings ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_audit_findings supplier_audit_findings_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY supplier_audit_findings_company_boundary ON public.supplier_audit_findings AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: supplier_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_audits ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_audits supplier_audits_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY supplier_audits_company_boundary ON public.supplier_audits AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: supplier_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_documents supplier_documents_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY supplier_documents_company_boundary ON public.supplier_documents AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_company_boundary ON public.suppliers AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_supplier_quality_tenant()));


--
-- Name: tenant_customer_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_customer_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_customer_contacts tenant_customer_contacts_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_customer_contacts_member_select ON public.tenant_customer_contacts FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: tenant_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_module_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_module_access ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_user_profiles tenant_user_profiles_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_profiles_company_admin_delete ON public.tenant_user_profiles FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: tenant_user_profiles tenant_user_profiles_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_profiles_company_admin_insert ON public.tenant_user_profiles FOR INSERT TO authenticated WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: tenant_user_profiles tenant_user_profiles_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_profiles_company_admin_update ON public.tenant_user_profiles FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: tenant_user_profiles tenant_user_profiles_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_profiles_member_select ON public.tenant_user_profiles FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: tenant_user_role_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_user_role_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_company_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_role_assignments_company_admin_delete ON public.tenant_user_role_assignments FOR DELETE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_company_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_role_assignments_company_admin_insert ON public.tenant_user_role_assignments FOR INSERT TO authenticated WITH CHECK ((public.qualisphere_is_company_admin(tenant_id) AND (EXISTS ( SELECT 1
   FROM public.customer_roles cr
  WHERE ((cr.id = tenant_user_role_assignments.role_id) AND (cr.tenant_id = cr.tenant_id) AND (cr.is_active = true)))) AND (EXISTS ( SELECT 1
   FROM public.tenant_user_profiles tup
  WHERE ((tup.tenant_id = tup.tenant_id) AND (lower(tup.user_email) = lower(tup.user_email)) AND (tup.account_status = 'active'::text))))));


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_company_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_role_assignments_company_admin_update ON public.tenant_user_role_assignments FOR UPDATE TO authenticated USING (public.qualisphere_is_company_admin(tenant_id)) WITH CHECK (public.qualisphere_is_company_admin(tenant_id));


--
-- Name: tenant_user_role_assignments tenant_user_role_assignments_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_user_role_assignments_member_select ON public.tenant_user_role_assignments FOR SELECT TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: training_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: training_assignments training_assignments_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_assignments_company_boundary ON public.training_assignments AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_training_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_training_tenant()));


--
-- Name: training_assignments training_assignments_coordinator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_assignments_coordinator_insert ON public.training_assignments FOR INSERT TO authenticated WITH CHECK (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id)));


--
-- Name: training_assignments training_assignments_coordinator_or_assignee_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_assignments_coordinator_or_assignee_update ON public.training_assignments FOR UPDATE TO authenticated USING (((tenant_id = public.qualisphere_resolve_training_tenant()) AND (public.qualisphere_training_is_coordinator(tenant_id) OR public.qualisphere_training_is_assignee(assigned_to_email)))) WITH CHECK (((tenant_id = public.qualisphere_resolve_training_tenant()) AND (public.qualisphere_training_is_coordinator(tenant_id) OR public.qualisphere_training_is_assignee(assigned_to_email))));


--
-- Name: training_assignments training_assignments_role_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_assignments_role_read ON public.training_assignments FOR SELECT TO authenticated USING (((tenant_id = public.qualisphere_resolve_training_tenant()) AND (public.qualisphere_training_is_coordinator(tenant_id) OR public.qualisphere_training_is_assignee(assigned_to_email) OR public.qualisphere_training_is_direct_manager(tenant_id, assigned_to_email))));


--
-- Name: training_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: training_certifications training_certifications_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_certifications_read ON public.training_certifications FOR SELECT TO authenticated USING (true);


--
-- Name: training_certifications training_certifications_tenant_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_certifications_tenant_boundary ON public.training_certifications AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_training_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_training_tenant()));


--
-- Name: training_compliance_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_compliance_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: training_effectiveness_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_effectiveness_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: training_effectiveness_checks training_effectiveness_checks_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_effectiveness_checks_company_boundary ON public.training_effectiveness_checks AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.training_assignments ta
  WHERE ((ta.id = training_effectiveness_checks.training_assignment_id) AND (ta.tenant_id = public.qualisphere_resolve_training_tenant()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.training_assignments ta
  WHERE ((ta.id = training_effectiveness_checks.training_assignment_id) AND (ta.tenant_id = public.qualisphere_resolve_training_tenant())))));


--
-- Name: electronic_signatures training_electronic_signatures_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_electronic_signatures_company_boundary ON public.electronic_signatures AS RESTRICTIVE TO authenticated USING (((lower(module_name) <> 'training'::text) OR (EXISTS ( SELECT 1
   FROM public.training_assignments ta
  WHERE ((ta.id = electronic_signatures.record_id) AND (ta.tenant_id = public.qualisphere_resolve_training_tenant())))))) WITH CHECK (((lower(module_name) <> 'training'::text) OR (EXISTS ( SELECT 1
   FROM public.training_assignments ta
  WHERE ((ta.id = electronic_signatures.record_id) AND (ta.tenant_id = public.qualisphere_resolve_training_tenant()))))));


--
-- Name: training_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: training_group_members training_group_members_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_group_members_company_boundary ON public.training_group_members TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id)) WITH CHECK (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: training_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: training_groups training_groups_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_groups_company_boundary ON public.training_groups TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id)) WITH CHECK (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: training_matrix; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_matrix ENABLE ROW LEVEL SECURITY;

--
-- Name: training_matrix training_matrix_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_matrix_company_boundary ON public.training_matrix AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_training_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_training_tenant()));


--
-- Name: training_matrix training_matrix_coordinator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_matrix_coordinator_insert ON public.training_matrix FOR INSERT TO authenticated WITH CHECK (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id)));


--
-- Name: training_matrix training_matrix_coordinator_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_matrix_coordinator_update ON public.training_matrix FOR UPDATE TO authenticated USING (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id))) WITH CHECK (((tenant_id = public.qualisphere_resolve_training_tenant()) AND public.qualisphere_training_is_coordinator(tenant_id)));


--
-- Name: training_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: training_methods training_methods_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_methods_company_boundary ON public.training_methods TO authenticated USING (public.qualisphere_is_active_tenant_member(tenant_id)) WITH CHECK (public.qualisphere_is_active_tenant_member(tenant_id));


--
-- Name: training_methods training_methods_coordinator_delete_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_methods_coordinator_delete_guard ON public.training_methods AS RESTRICTIVE FOR DELETE TO authenticated USING (public.qualisphere_training_is_coordinator(tenant_id));


--
-- Name: training_methods training_methods_coordinator_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_methods_coordinator_insert_guard ON public.training_methods AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.qualisphere_training_is_coordinator(tenant_id));


--
-- Name: training_methods training_methods_coordinator_update_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_methods_coordinator_update_guard ON public.training_methods AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.qualisphere_training_is_coordinator(tenant_id)) WITH CHECK (public.qualisphere_training_is_coordinator(tenant_id));


--
-- Name: training_retraining_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_retraining_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: training_retraining_rules training_retraining_rules_company_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_retraining_rules_company_boundary ON public.training_retraining_rules AS RESTRICTIVE TO authenticated USING ((tenant_id = public.qualisphere_resolve_training_tenant())) WITH CHECK ((tenant_id = public.qualisphere_resolve_training_tenant()));


--
-- Name: training_compliance_settings training_settings_coordinator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_settings_coordinator_insert ON public.training_compliance_settings FOR INSERT TO authenticated WITH CHECK (((tenant_id = ( SELECT public.qualisphere_resolve_training_tenant() AS qualisphere_resolve_training_tenant)) AND ( SELECT public.qualisphere_training_is_coordinator(training_compliance_settings.tenant_id) AS qualisphere_training_is_coordinator)));


--
-- Name: training_compliance_settings training_settings_coordinator_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_settings_coordinator_select ON public.training_compliance_settings FOR SELECT TO authenticated USING (((tenant_id = ( SELECT public.qualisphere_resolve_training_tenant() AS qualisphere_resolve_training_tenant)) AND ( SELECT public.qualisphere_training_is_coordinator(training_compliance_settings.tenant_id) AS qualisphere_training_is_coordinator)));


--
-- Name: training_compliance_settings training_settings_coordinator_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_settings_coordinator_update ON public.training_compliance_settings FOR UPDATE TO authenticated USING (((tenant_id = ( SELECT public.qualisphere_resolve_training_tenant() AS qualisphere_resolve_training_tenant)) AND ( SELECT public.qualisphere_training_is_coordinator(training_compliance_settings.tenant_id) AS qualisphere_training_is_coordinator))) WITH CHECK (((tenant_id = ( SELECT public.qualisphere_resolve_training_tenant() AS qualisphere_resolve_training_tenant)) AND ( SELECT public.qualisphere_training_is_coordinator(training_compliance_settings.tenant_id) AS qualisphere_training_is_coordinator)));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_security_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_security_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_security_roles user_security_roles_authenticated_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_security_roles_authenticated_read ON public.user_security_roles FOR SELECT TO authenticated USING (true);


--
-- Name: user_security_roles user_security_roles_authorized_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_security_roles_authorized_delete ON public.user_security_roles FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['administrator'::text, 'admin'::text, 'vp_quality'::text]))))));


--
-- Name: user_security_roles user_security_roles_authorized_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_security_roles_authorized_insert ON public.user_security_roles FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['administrator'::text, 'admin'::text, 'vp_quality'::text]))))));


--
-- Name: user_security_roles user_security_roles_authorized_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_security_roles_authorized_update ON public.user_security_roles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['administrator'::text, 'admin'::text, 'vp_quality'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((lower(ur.user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (lower(ur.role) = ANY (ARRAY['administrator'::text, 'admin'::text, 'vp_quality'::text]))))));


--
-- Name: workflow_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;


--
-- Name: FUNCTION activate_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.activate_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activate_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) TO authenticated;
GRANT ALL ON FUNCTION public.activate_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) TO service_role;


--
-- Name: FUNCTION assign_calibration_number(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_calibration_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_calibration_number() TO authenticated;
GRANT ALL ON FUNCTION public.assign_calibration_number() TO service_role;


--
-- Name: FUNCTION assign_equipment_number(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_equipment_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_equipment_number() TO authenticated;
GRANT ALL ON FUNCTION public.assign_equipment_number() TO service_role;


--
-- Name: FUNCTION assign_maintenance_number(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_maintenance_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_maintenance_number() TO authenticated;
GRANT ALL ON FUNCTION public.assign_maintenance_number() TO service_role;


--
-- Name: FUNCTION assign_qualification_number(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_qualification_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_qualification_number() TO authenticated;
GRANT ALL ON FUNCTION public.assign_qualification_number() TO service_role;


--
-- Name: FUNCTION block_related_ncmr_change_when_closed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.block_related_ncmr_change_when_closed() FROM PUBLIC;
GRANT ALL ON FUNCTION public.block_related_ncmr_change_when_closed() TO authenticated;
GRANT ALL ON FUNCTION public.block_related_ncmr_change_when_closed() TO service_role;


--
-- Name: FUNCTION build_ncmr_frozen_display_values(p_ncmr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.build_ncmr_frozen_display_values(p_ncmr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.build_ncmr_frozen_display_values(p_ncmr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.build_ncmr_frozen_display_values(p_ncmr_id uuid) TO service_role;


--
-- Name: FUNCTION clone_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.clone_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clone_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) TO authenticated;
GRANT ALL ON FUNCTION public.clone_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) TO service_role;


--
-- Name: FUNCTION close_ncmr_with_controlled_record(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text, p_record_structure jsonb, p_frozen_values jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.close_ncmr_with_controlled_record(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text, p_record_structure jsonb, p_frozen_values jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.close_ncmr_with_controlled_record(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text, p_record_structure jsonb, p_frozen_values jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.close_ncmr_with_controlled_record(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text, p_record_structure jsonb, p_frozen_values jsonb) TO service_role;


--
-- Name: FUNCTION close_ncmr_with_snapshot(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.close_ncmr_with_snapshot(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.close_ncmr_with_snapshot(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text) TO authenticated;
GRANT ALL ON FUNCTION public.close_ncmr_with_snapshot(p_ncmr_id uuid, p_signature_meaning text, p_signature_email text) TO service_role;


--
-- Name: FUNCTION create_qualisphere_module_access_role(p_category text, p_label text, p_permission_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_qualisphere_module_access_role(p_category text, p_label text, p_permission_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_qualisphere_module_access_role(p_category text, p_label text, p_permission_key text) TO authenticated;
GRANT ALL ON FUNCTION public.create_qualisphere_module_access_role(p_category text, p_label text, p_permission_key text) TO service_role;


--
-- Name: FUNCTION current_user_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_user_email() TO anon;
GRANT ALL ON FUNCTION public.current_user_email() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_email() TO service_role;


--
-- Name: FUNCTION custom_access_token_hook(event jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.custom_access_token_hook(event jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.custom_access_token_hook(event jsonb) TO service_role;
GRANT ALL ON FUNCTION public.custom_access_token_hook(event jsonb) TO supabase_auth_admin;


--
-- Name: TABLE equipment_release_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_release_requests TO authenticated;
GRANT ALL ON TABLE public.equipment_release_requests TO service_role;


--
-- Name: FUNCTION decide_equipment_record_release(p_release_request_id uuid, p_decision text, p_comment text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decide_equipment_record_release(p_release_request_id uuid, p_decision text, p_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decide_equipment_record_release(p_release_request_id uuid, p_decision text, p_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.decide_equipment_record_release(p_release_request_id uuid, p_decision text, p_comment text) TO service_role;


--
-- Name: FUNCTION delete_qualisphere_user_profile(p_user_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_qualisphere_user_profile(p_user_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_qualisphere_user_profile(p_user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_qualisphere_user_profile(p_user_email text) TO service_role;


--
-- Name: FUNCTION freeze_ncmr_structure_on_close(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.freeze_ncmr_structure_on_close() FROM PUBLIC;
GRANT ALL ON FUNCTION public.freeze_ncmr_structure_on_close() TO authenticated;
GRANT ALL ON FUNCTION public.freeze_ncmr_structure_on_close() TO service_role;


--
-- Name: FUNCTION generate_audit_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_audit_number() TO anon;
GRANT ALL ON FUNCTION public.generate_audit_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_audit_number() TO service_role;


--
-- Name: FUNCTION generate_audit_number(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_audit_number(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.generate_audit_number(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.generate_audit_number(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION generate_capa_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_capa_number() TO anon;
GRANT ALL ON FUNCTION public.generate_capa_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_capa_number() TO service_role;


--
-- Name: FUNCTION generate_dci_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_dci_number() TO anon;
GRANT ALL ON FUNCTION public.generate_dci_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_dci_number() TO service_role;


--
-- Name: FUNCTION generate_document_number(p_document_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_document_number(p_document_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_document_number(p_document_type text) TO anon;
GRANT ALL ON FUNCTION public.generate_document_number(p_document_type text) TO authenticated;
GRANT ALL ON FUNCTION public.generate_document_number(p_document_type text) TO service_role;


--
-- Name: FUNCTION generate_ncmr_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_ncmr_number() TO anon;
GRANT ALL ON FUNCTION public.generate_ncmr_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_ncmr_number() TO service_role;


--
-- Name: FUNCTION generate_oos_oot_number(p_prefix text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_oos_oot_number(p_prefix text) TO anon;
GRANT ALL ON FUNCTION public.generate_oos_oot_number(p_prefix text) TO authenticated;
GRANT ALL ON FUNCTION public.generate_oos_oot_number(p_prefix text) TO service_role;


--
-- Name: FUNCTION generate_oos_oot_number(p_tenant_id uuid, p_prefix text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_oos_oot_number(p_tenant_id uuid, p_prefix text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_oos_oot_number(p_tenant_id uuid, p_prefix text) TO service_role;


--
-- Name: FUNCTION generate_record_number(p_record_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_record_number(p_record_type text) TO anon;
GRANT ALL ON FUNCTION public.generate_record_number(p_record_type text) TO authenticated;
GRANT ALL ON FUNCTION public.generate_record_number(p_record_type text) TO service_role;


--
-- Name: FUNCTION generate_scar_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_scar_number() TO anon;
GRANT ALL ON FUNCTION public.generate_scar_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_scar_number() TO service_role;


--
-- Name: TABLE equipment_document_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_document_links TO authenticated;
GRANT ALL ON TABLE public.equipment_document_links TO service_role;


--
-- Name: FUNCTION get_equipment_controlled_document_links(p_equipment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_equipment_controlled_document_links(p_equipment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_equipment_controlled_document_links(p_equipment_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_equipment_controlled_document_links(p_equipment_id uuid) TO service_role;


--
-- Name: FUNCTION get_qualisphere_enterprise_authority(p_user_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_qualisphere_enterprise_authority(p_user_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_qualisphere_enterprise_authority(p_user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.get_qualisphere_enterprise_authority(p_user_email text) TO service_role;


--
-- Name: FUNCTION has_equipment_role_for_tenant(p_tenant_id uuid, p_user_email text, p_allowed_roles text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_equipment_role_for_tenant(p_tenant_id uuid, p_user_email text, p_allowed_roles text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_equipment_role_for_tenant(p_tenant_id uuid, p_user_email text, p_allowed_roles text[]) TO authenticated;
GRANT ALL ON FUNCTION public.has_equipment_role_for_tenant(p_tenant_id uuid, p_user_email text, p_allowed_roles text[]) TO service_role;


--
-- Name: FUNCTION has_tenant_module_access(p_tenant_id uuid, p_module_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_tenant_module_access(p_tenant_id uuid, p_module_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_tenant_module_access(p_tenant_id uuid, p_module_code text) TO anon;
GRANT ALL ON FUNCTION public.has_tenant_module_access(p_tenant_id uuid, p_module_code text) TO authenticated;
GRANT ALL ON FUNCTION public.has_tenant_module_access(p_tenant_id uuid, p_module_code text) TO service_role;


--
-- Name: FUNCTION is_approver(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_approver() TO anon;
GRANT ALL ON FUNCTION public.is_approver() TO authenticated;
GRANT ALL ON FUNCTION public.is_approver() TO service_role;


--
-- Name: FUNCTION is_equipment_admin_for_tenant(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_equipment_admin_for_tenant(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_equipment_admin_for_tenant(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_equipment_admin_for_tenant(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION is_platform_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_platform_admin() TO anon;
GRANT ALL ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_platform_admin() TO service_role;


--
-- Name: FUNCTION is_qms_governance_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_qms_governance_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_qms_governance_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_qms_governance_admin() TO service_role;


--
-- Name: FUNCTION is_qualisphere_role_administrator(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_qualisphere_role_administrator() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_qualisphere_role_administrator() TO authenticated;
GRANT ALL ON FUNCTION public.is_qualisphere_role_administrator() TO service_role;


--
-- Name: FUNCTION is_tenant_admin(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_tenant_admin(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_tenant_admin(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_tenant_admin(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_tenant_admin(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION is_tenant_member(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_tenant_member(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_tenant_member(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_tenant_member(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_tenant_member(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text) TO authenticated;
GRANT ALL ON FUNCTION public.link_equipment_controlled_document(p_equipment_id uuid, p_document_id uuid, p_relationship_type text) TO service_role;


--
-- Name: FUNCTION list_equipment_release_approvers(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_equipment_release_approvers() FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_equipment_release_approvers() TO authenticated;
GRANT ALL ON FUNCTION public.list_equipment_release_approvers() TO service_role;


--
-- Name: FUNCTION ncmr_cancel_pending_tasks_governed(p_ncmr_id uuid, p_reason text, p_task_types text[], p_exclude_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_cancel_pending_tasks_governed(p_ncmr_id uuid, p_reason text, p_task_types text[], p_exclude_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_cancel_pending_tasks_governed(p_ncmr_id uuid, p_reason text, p_task_types text[], p_exclude_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_cancel_pending_tasks_governed(p_ncmr_id uuid, p_reason text, p_task_types text[], p_exclude_task_id uuid) TO service_role;


--
-- Name: FUNCTION ncmr_cancel_task_ids_governed(p_ncmr_id uuid, p_task_ids uuid[], p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_cancel_task_ids_governed(p_ncmr_id uuid, p_task_ids uuid[], p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_cancel_task_ids_governed(p_ncmr_id uuid, p_task_ids uuid[], p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_cancel_task_ids_governed(p_ncmr_id uuid, p_task_ids uuid[], p_reason text) TO service_role;


--
-- Name: TABLE approval_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval_tasks TO authenticated;
GRANT ALL ON TABLE public.approval_tasks TO service_role;


--
-- Name: FUNCTION ncmr_create_governed_task(p_ncmr_id uuid, p_task jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_create_governed_task(p_ncmr_id uuid, p_task jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_create_governed_task(p_ncmr_id uuid, p_task jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_create_governed_task(p_ncmr_id uuid, p_task jsonb) TO service_role;


--
-- Name: FUNCTION ncmr_create_mrb_approval_package(p_ncmr_id uuid, p_tasks jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_create_mrb_approval_package(p_ncmr_id uuid, p_tasks jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_create_mrb_approval_package(p_ncmr_id uuid, p_tasks jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_create_mrb_approval_package(p_ncmr_id uuid, p_tasks jsonb) TO service_role;


--
-- Name: FUNCTION ncmr_decide_mrb_approval_task(p_task_id uuid, p_decision text, p_comment text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_decide_mrb_approval_task(p_task_id uuid, p_decision text, p_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_decide_mrb_approval_task(p_task_id uuid, p_decision text, p_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_decide_mrb_approval_task(p_task_id uuid, p_decision text, p_comment text) TO service_role;


--
-- Name: FUNCTION ncmr_get_mrb_approval_tasks(p_ncmr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_get_mrb_approval_tasks(p_ncmr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_get_mrb_approval_tasks(p_ncmr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_get_mrb_approval_tasks(p_ncmr_id uuid) TO service_role;


--
-- Name: FUNCTION ncmr_resubmit_returned_rework_task(p_task_id uuid, p_assigned_to_email text, p_due_date date, p_task_instructions text, p_assignment_attachments jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_resubmit_returned_rework_task(p_task_id uuid, p_assigned_to_email text, p_due_date date, p_task_instructions text, p_assignment_attachments jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_resubmit_returned_rework_task(p_task_id uuid, p_assigned_to_email text, p_due_date date, p_task_instructions text, p_assignment_attachments jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_resubmit_returned_rework_task(p_task_id uuid, p_assigned_to_email text, p_due_date date, p_task_instructions text, p_assignment_attachments jsonb) TO service_role;


--
-- Name: FUNCTION ncmr_supersede_current_mrb_approval_cycle(p_ncmr_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_supersede_current_mrb_approval_cycle(p_ncmr_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_supersede_current_mrb_approval_cycle(p_ncmr_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_supersede_current_mrb_approval_cycle(p_ncmr_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION ncmr_verify_completed_task(p_task_id uuid, p_verification_comment text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ncmr_verify_completed_task(p_task_id uuid, p_verification_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ncmr_verify_completed_task(p_task_id uuid, p_verification_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.ncmr_verify_completed_task(p_task_id uuid, p_verification_comment text) TO service_role;


--
-- Name: FUNCTION next_equipment_event_number(p_tenant_id uuid, p_event_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.next_equipment_event_number(p_tenant_id uuid, p_event_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.next_equipment_event_number(p_tenant_id uuid, p_event_type text) TO authenticated;
GRANT ALL ON FUNCTION public.next_equipment_event_number(p_tenant_id uuid, p_event_type text) TO service_role;


--
-- Name: FUNCTION next_equipment_import_batch_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.next_equipment_import_batch_number() TO anon;
GRANT ALL ON FUNCTION public.next_equipment_import_batch_number() TO authenticated;
GRANT ALL ON FUNCTION public.next_equipment_import_batch_number() TO service_role;


--
-- Name: FUNCTION next_qualisphere_equipment_number(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.next_qualisphere_equipment_number(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.next_qualisphere_equipment_number(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.next_qualisphere_equipment_number(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION protect_closed_ncmr_record(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_closed_ncmr_record() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_closed_ncmr_record() TO authenticated;
GRANT ALL ON FUNCTION public.protect_closed_ncmr_record() TO service_role;


--
-- Name: FUNCTION protect_controlled_capa_governance_rule(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_controlled_capa_governance_rule() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_controlled_capa_governance_rule() TO authenticated;
GRANT ALL ON FUNCTION public.protect_controlled_capa_governance_rule() TO service_role;


--
-- Name: FUNCTION protect_controlled_configuration_version(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_controlled_configuration_version() TO anon;
GRANT ALL ON FUNCTION public.protect_controlled_configuration_version() TO authenticated;
GRANT ALL ON FUNCTION public.protect_controlled_configuration_version() TO service_role;


--
-- Name: FUNCTION protect_controlled_risk_matrix_rule(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_controlled_risk_matrix_rule() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_controlled_risk_matrix_rule() TO authenticated;
GRANT ALL ON FUNCTION public.protect_controlled_risk_matrix_rule() TO service_role;


--
-- Name: FUNCTION protect_controlled_workflow_version(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_controlled_workflow_version() TO anon;
GRANT ALL ON FUNCTION public.protect_controlled_workflow_version() TO authenticated;
GRANT ALL ON FUNCTION public.protect_controlled_workflow_version() TO service_role;


--
-- Name: FUNCTION protect_ncmr_audit_history(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_ncmr_audit_history() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_ncmr_audit_history() TO authenticated;
GRANT ALL ON FUNCTION public.protect_ncmr_audit_history() TO service_role;


--
-- Name: FUNCTION protect_record_structure_freeze(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_record_structure_freeze() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_record_structure_freeze() TO authenticated;
GRANT ALL ON FUNCTION public.protect_record_structure_freeze() TO service_role;


--
-- Name: FUNCTION qualisphere_activate_tenant_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_activate_tenant_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_activate_tenant_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_activate_tenant_qms_configuration_version(p_configuration_version_id uuid, p_change_justification text) TO service_role;


--
-- Name: FUNCTION qualisphere_add_audit_log(p_entity_type text, p_entity_id uuid, p_action text, p_details text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_add_audit_log(p_entity_type text, p_entity_id uuid, p_action text, p_details text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_add_audit_log(p_entity_type text, p_entity_id uuid, p_action text, p_details text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_add_audit_log(p_entity_type text, p_entity_id uuid, p_action text, p_details text) TO service_role;


--
-- Name: FUNCTION qualisphere_approval_task_access(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_approval_task_access(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_approval_task_access(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_approval_task_access(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_assign_training_matrix(p_targets jsonb, p_method uuid, p_due date, p_months integer, p_basis text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_assign_training_matrix(p_targets jsonb, p_method uuid, p_due date, p_months integer, p_basis text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_assign_training_matrix(p_targets jsonb, p_method uuid, p_due date, p_months integer, p_basis text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_assign_training_matrix(p_targets jsonb, p_method uuid, p_due date, p_months integer, p_basis text) TO service_role;


--
-- Name: FUNCTION qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_bridge_internal_legacy_access(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_bridge_internal_legacy_access() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_bridge_internal_legacy_access() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_bridge_internal_legacy_access() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_bridge_internal_legacy_access() TO service_role;


--
-- Name: FUNCTION qualisphere_can_access_audit_evidence_object(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_can_access_audit_evidence_object(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_can_access_audit_evidence_object(p_name text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_can_access_audit_evidence_object(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_access_audit_evidence_object(p_name text) TO service_role;


--
-- Name: FUNCTION qualisphere_can_access_controlled_document_storage_object(p_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_can_access_controlled_document_storage_object(p_name text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_can_access_controlled_document_storage_object(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_access_controlled_document_storage_object(p_name text) TO service_role;


--
-- Name: FUNCTION qualisphere_can_access_ncmr(p_ncmr_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_can_access_ncmr(p_ncmr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_access_ncmr(p_ncmr_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_can_access_supplier_document_storage_object(p_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_can_access_supplier_document_storage_object(p_name text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_can_access_supplier_document_storage_object(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_access_supplier_document_storage_object(p_name text) TO service_role;


--
-- Name: FUNCTION qualisphere_can_access_training_evidence(p_path text, p_write boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_can_access_training_evidence(p_path text, p_write boolean) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_can_access_training_evidence(p_path text, p_write boolean) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_access_training_evidence(p_path text, p_write boolean) TO service_role;


--
-- Name: FUNCTION qualisphere_can_act_on_approval_task(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_can_act_on_approval_task(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_can_act_on_approval_task(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_act_on_approval_task(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_can_govern_ncmr_tasks(p_ncmr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_can_view_approval_task(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_can_view_approval_task(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_can_view_approval_task(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_can_view_approval_task(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_capa_authorized_users(p_purpose text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_capa_authorized_users(p_purpose text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_capa_authorized_users(p_purpose text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_capa_authorized_users(p_purpose text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_capa_authorized_users(p_purpose text) TO service_role;


--
-- Name: FUNCTION qualisphere_claim_dci_administrative_review(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_claim_dci_administrative_review(p_task_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_claim_dci_administrative_review(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_claim_dci_administrative_review(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_claim_dci_post_approval(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_claim_dci_post_approval(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_claim_dci_post_approval(p_task_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_claim_dci_post_approval(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_claim_dci_post_approval(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_clone_company_settings_to_tenant(p_target_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_clone_company_settings_to_tenant(p_target_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_clone_company_settings_to_tenant(p_target_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_clone_company_settings_to_tenant(p_target_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_clone_company_settings_to_tenant(p_target_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_clone_master_data_to_tenant(p_target_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_clone_master_data_to_tenant(p_target_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_clone_master_data_to_tenant(p_target_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_clone_master_data_to_tenant(p_target_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_clone_master_data_to_tenant(p_target_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_clone_starter_roles_to_tenant(p_target_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_clone_starter_roles_to_tenant(p_target_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_clone_starter_roles_to_tenant(p_target_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_clone_starter_roles_to_tenant(p_target_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_clone_starter_roles_to_tenant(p_target_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_clone_tenant_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_clone_tenant_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_clone_tenant_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_clone_tenant_qms_configuration_version(p_source_configuration_version_id uuid, p_new_version_code text, p_new_version_name text, p_change_summary text, p_change_justification text) TO service_role;


--
-- Name: FUNCTION qualisphere_close_dci_post_approval(p_dci_id uuid, p_comment text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_close_dci_post_approval(p_dci_id uuid, p_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_close_dci_post_approval(p_dci_id uuid, p_comment text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_close_dci_post_approval(p_dci_id uuid, p_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_close_dci_post_approval(p_dci_id uuid, p_comment text) TO service_role;


--
-- Name: FUNCTION qualisphere_complete_dci_formal_approval(p_dci_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_complete_dci_formal_approval(p_dci_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_complete_dci_formal_approval(p_dci_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_complete_dci_formal_approval(p_dci_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_complete_dci_formal_approval(p_dci_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_create_tenant(p_company_name text, p_legal_name text, p_tenant_code text, p_slug text, p_primary_contact_email text, p_company_admin_email text, p_country_code text, p_default_timezone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_create_tenant(p_company_name text, p_legal_name text, p_tenant_code text, p_slug text, p_primary_contact_email text, p_company_admin_email text, p_country_code text, p_default_timezone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_create_tenant(p_company_name text, p_legal_name text, p_tenant_code text, p_slug text, p_primary_contact_email text, p_company_admin_email text, p_country_code text, p_default_timezone text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_create_tenant(p_company_name text, p_legal_name text, p_tenant_code text, p_slug text, p_primary_contact_email text, p_company_admin_email text, p_country_code text, p_default_timezone text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_create_tenant(p_company_name text, p_legal_name text, p_tenant_code text, p_slug text, p_primary_contact_email text, p_company_admin_email text, p_country_code text, p_default_timezone text) TO service_role;


--
-- Name: FUNCTION qualisphere_current_audit_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_current_audit_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_current_audit_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_current_audit_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_current_capa_role_codes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_current_capa_role_codes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_current_capa_role_codes() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_current_capa_role_codes() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_current_capa_role_codes() TO service_role;


--
-- Name: FUNCTION qualisphere_current_capa_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_current_capa_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_current_capa_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_current_capa_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_current_capa_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_current_controlled_documents_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_current_controlled_documents_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_current_controlled_documents_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_current_controlled_documents_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_current_controlled_documents_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_current_management_review_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_current_management_review_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_current_management_review_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_current_management_review_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_current_user_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_current_user_email() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_current_user_email() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_current_user_email() TO service_role;


--
-- Name: FUNCTION qualisphere_dci_collaboration_owner_handoff(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_dci_collaboration_owner_handoff() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_dci_collaboration_owner_handoff() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_dci_collaboration_owner_handoff() TO service_role;


--
-- Name: FUNCTION qualisphere_decide_management_review_approval(p_task_id uuid, p_decision text, p_comment text, p_signature_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_decide_management_review_approval(p_task_id uuid, p_decision text, p_comment text, p_signature_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_decide_management_review_approval(p_task_id uuid, p_decision text, p_comment text, p_signature_email text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_decide_management_review_approval(p_task_id uuid, p_decision text, p_comment text, p_signature_email text) TO service_role;


--
-- Name: FUNCTION qualisphere_email_belongs_to_tenant(p_email text, p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_email_belongs_to_tenant(p_email text, p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_email_belongs_to_tenant(p_email text, p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_email_belongs_to_tenant(p_email text, p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_audit_log_identity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_enforce_audit_log_identity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_enforce_audit_log_identity() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_audit_row_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_audit_row_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_enforce_audit_row_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_audit_row_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_capa_row_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_capa_row_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_enforce_capa_row_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_capa_row_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_controlled_document_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_controlled_document_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_enforce_controlled_document_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_controlled_document_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_management_review_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_management_review_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_enforce_management_review_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_management_review_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_ncmr_approval_task_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_approval_task_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_approval_task_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_ncmr_child_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_child_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_child_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_ncmr_row_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_row_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_row_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_ncmr_snapshot_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_snapshot_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_ncmr_snapshot_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_oos_oot_row_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_enforce_oos_oot_row_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_enforce_oos_oot_row_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_enforce_oos_oot_row_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_oos_oot_row_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_signature_identity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_enforce_signature_identity() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_enforce_signature_identity() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_enforce_signature_identity() TO service_role;


--
-- Name: FUNCTION qualisphere_enforce_training_completion_evidence(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_enforce_training_completion_evidence() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_enforce_training_completion_evidence() TO service_role;


--
-- Name: FUNCTION qualisphere_generate_recurring_training_cycles(p_as_of date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_generate_recurring_training_cycles(p_as_of date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_generate_recurring_training_cycles(p_as_of date) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_generate_recurring_training_cycles(p_as_of date) TO service_role;


--
-- Name: FUNCTION qualisphere_guard_employee_training_history(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_guard_employee_training_history() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_guard_employee_training_history() TO service_role;


--
-- Name: FUNCTION qualisphere_guard_training_assignment_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_guard_training_assignment_update() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_guard_training_assignment_update() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_guard_training_assignment_update() TO service_role;


--
-- Name: FUNCTION qualisphere_guard_training_method_history(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_guard_training_method_history() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_guard_training_method_history() TO service_role;


--
-- Name: FUNCTION qualisphere_import_employees(p_tenant_id uuid, p_employees jsonb, p_overwrite boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_import_employees(p_tenant_id uuid, p_employees jsonb, p_overwrite boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_import_employees(p_tenant_id uuid, p_employees jsonb, p_overwrite boolean) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_import_employees(p_tenant_id uuid, p_employees jsonb, p_overwrite boolean) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_import_employees(p_tenant_id uuid, p_employees jsonb, p_overwrite boolean) TO service_role;


--
-- Name: FUNCTION qualisphere_invalidate_dci_pdf_verification(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_invalidate_dci_pdf_verification() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_invalidate_dci_pdf_verification() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_invalidate_dci_pdf_verification() TO service_role;


--
-- Name: FUNCTION qualisphere_is_active_tenant_member(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_is_active_tenant_member(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_is_active_tenant_member(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_is_active_tenant_member(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_is_active_tenant_member(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_is_company_admin(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_is_company_admin(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_is_company_admin(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_is_company_admin(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_is_company_admin(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_is_customer_contact(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_is_customer_contact(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_is_customer_contact(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_is_customer_contact(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_provision_company_settings_on_tenant_create(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_provision_company_settings_on_tenant_create() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_provision_company_settings_on_tenant_create() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_provision_company_settings_on_tenant_create() TO service_role;


--
-- Name: FUNCTION qualisphere_provision_master_data_on_tenant_create(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_provision_master_data_on_tenant_create() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_provision_master_data_on_tenant_create() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_provision_master_data_on_tenant_create() TO service_role;


--
-- Name: FUNCTION qualisphere_provision_ncmr_governance_baseline(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_provision_ncmr_governance_baseline(p_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_provision_ncmr_governance_baseline(p_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_provision_ncmr_governance_baseline(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_provision_ncmr_governance_on_tenant_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_provision_ncmr_governance_on_tenant_insert() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_provision_ncmr_governance_on_tenant_insert() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_provision_ncmr_governance_on_tenant_insert() TO service_role;


--
-- Name: FUNCTION qualisphere_provision_starter_roles_on_tenant_create(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_provision_starter_roles_on_tenant_create() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_provision_starter_roles_on_tenant_create() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_provision_starter_roles_on_tenant_create() TO service_role;


--
-- Name: FUNCTION qualisphere_release_dci_coordinated(p_dci_id uuid, p_effective_date date, p_manifest jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_release_dci_coordinated(p_dci_id uuid, p_effective_date date, p_manifest jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_release_dci_coordinated(p_dci_id uuid, p_effective_date date, p_manifest jsonb) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_release_dci_coordinated(p_dci_id uuid, p_effective_date date, p_manifest jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_release_dci_coordinated(p_dci_id uuid, p_effective_date date, p_manifest jsonb) TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_audit_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_audit_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_audit_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_audit_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_capa_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_capa_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_capa_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_capa_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_change_control_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_resolve_change_control_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_resolve_change_control_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_change_control_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_complaint_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_complaint_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_complaint_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_complaint_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_controlled_document_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_controlled_document_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_controlled_document_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_controlled_document_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_equipment_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_resolve_equipment_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_resolve_equipment_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_equipment_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_equipment_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_ncmr_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_ncmr_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_ncmr_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_oos_oot_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_resolve_oos_oot_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_resolve_oos_oot_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_oos_oot_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_oos_oot_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_supplier_quality_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_supplier_quality_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_supplier_quality_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_supplier_quality_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_resolve_training_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_resolve_training_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_resolve_training_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_resolve_training_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_save_training_matrix_audience(p_document_number text, p_targets jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_save_training_matrix_audience(p_document_number text, p_targets jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_save_training_matrix_audience(p_document_number text, p_targets jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_save_training_matrix_audience(p_document_number text, p_targets jsonb) TO service_role;


--
-- Name: FUNCTION qualisphere_save_training_method(p_tenant uuid, p_id uuid, p_label text, p_release_blocking boolean, p_acknowledgement_required boolean, p_evidence_required boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_save_training_method(p_tenant uuid, p_id uuid, p_label text, p_release_blocking boolean, p_acknowledgement_required boolean, p_evidence_required boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_save_training_method(p_tenant uuid, p_id uuid, p_label text, p_release_blocking boolean, p_acknowledgement_required boolean, p_evidence_required boolean) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_save_training_method(p_tenant uuid, p_id uuid, p_label text, p_release_blocking boolean, p_acknowledgement_required boolean, p_evidence_required boolean) TO service_role;


--
-- Name: FUNCTION qualisphere_seed_document_impact_areas(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_seed_document_impact_areas() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_seed_document_impact_areas() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_seed_document_impact_areas() TO service_role;


--
-- Name: FUNCTION qualisphere_send_training_due_notices(p_as_of date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_send_training_due_notices(p_as_of date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_send_training_due_notices(p_as_of date) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_send_training_due_notices(p_as_of date) TO service_role;


--
-- Name: FUNCTION qualisphere_set_approval_matrix_reviewer_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_approval_matrix_reviewer_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_approval_matrix_reviewer_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_approval_matrix_reviewer_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_audit_finding_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_audit_finding_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_audit_finding_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_audit_finding_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_change_control_child_tenant(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_set_change_control_child_tenant() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_set_change_control_child_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_change_control_tenant_and_number(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_set_change_control_tenant_and_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_set_change_control_tenant_and_number() TO service_role;


--
-- Name: FUNCTION qualisphere_set_company_user(p_tenant_id uuid, p_user_email text, p_job_title text, p_department text, p_account_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_set_company_user(p_tenant_id uuid, p_user_email text, p_job_title text, p_department text, p_account_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_set_company_user(p_tenant_id uuid, p_user_email text, p_job_title text, p_department text, p_account_status text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_company_user(p_tenant_id uuid, p_user_email text, p_job_title text, p_department text, p_account_status text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_company_user(p_tenant_id uuid, p_user_email text, p_job_title text, p_department text, p_account_status text) TO service_role;


--
-- Name: FUNCTION qualisphere_set_complaint_child_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_complaint_child_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_complaint_child_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_complaint_child_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_complaint_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_complaint_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_complaint_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_complaint_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_dci_document_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_dci_document_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_dci_document_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_dci_document_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_dci_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_dci_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_dci_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_dci_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_management_review_child_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_management_review_child_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_management_review_child_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_management_review_child_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_qms_child_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_qms_child_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_qms_child_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_qms_child_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_supplier_quality_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_supplier_quality_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_supplier_quality_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_supplier_quality_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_training_assignment_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_training_assignment_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_training_assignment_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_training_assignment_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_set_training_config_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_set_training_config_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_set_training_config_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_set_training_config_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_tenant_module_enabled(p_tenant_id uuid, p_module_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_tenant_module_enabled(p_tenant_id uuid, p_module_code text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_tenant_module_enabled(p_tenant_id uuid, p_module_code text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_tenant_module_enabled(p_tenant_id uuid, p_module_code text) TO service_role;


--
-- Name: FUNCTION qualisphere_touch_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_touch_updated_at() TO service_role;


--
-- Name: FUNCTION qualisphere_training_assignment_notice(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_training_assignment_notice() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_training_assignment_notice() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_training_assignment_notice() TO service_role;


--
-- Name: FUNCTION qualisphere_training_daily_automation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_training_daily_automation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_training_daily_automation() TO service_role;


--
-- Name: FUNCTION qualisphere_training_is_assignee(p_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_training_is_assignee(p_email text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_training_is_assignee(p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_training_is_assignee(p_email text) TO service_role;


--
-- Name: FUNCTION qualisphere_training_is_coordinator(p_tenant uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_training_is_coordinator(p_tenant uuid) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_training_is_coordinator(p_tenant uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_training_is_coordinator(p_tenant uuid) TO service_role;


--
-- Name: FUNCTION qualisphere_training_is_direct_manager(p_tenant uuid, p_assignee text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_training_is_direct_manager(p_tenant uuid, p_assignee text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_training_is_direct_manager(p_tenant uuid, p_assignee text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_training_is_direct_manager(p_tenant uuid, p_assignee text) TO service_role;


--
-- Name: FUNCTION qualisphere_training_without_effectiveness(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_training_without_effectiveness() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_training_without_effectiveness() TO service_role;


--
-- Name: FUNCTION qualisphere_validate_capa_user(p_user_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_validate_capa_user(p_user_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_validate_capa_user(p_user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_validate_capa_user(p_user_email text) TO service_role;


--
-- Name: FUNCTION qualisphere_validate_document_reviewer_tenant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.qualisphere_validate_document_reviewer_tenant() TO anon;
GRANT ALL ON FUNCTION public.qualisphere_validate_document_reviewer_tenant() TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_validate_document_reviewer_tenant() TO service_role;


--
-- Name: FUNCTION qualisphere_verify_dci_pdf(p_dci_id uuid, p_document_id uuid, p_pdf_path text, p_comment text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.qualisphere_verify_dci_pdf(p_dci_id uuid, p_document_id uuid, p_pdf_path text, p_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qualisphere_verify_dci_pdf(p_dci_id uuid, p_document_id uuid, p_pdf_path text, p_comment text) TO anon;
GRANT ALL ON FUNCTION public.qualisphere_verify_dci_pdf(p_dci_id uuid, p_document_id uuid, p_pdf_path text, p_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.qualisphere_verify_dci_pdf(p_dci_id uuid, p_document_id uuid, p_pdf_path text, p_comment text) TO service_role;


--
-- Name: FUNCTION recalculate_all_supplier_risks(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recalculate_all_supplier_risks() TO anon;
GRANT ALL ON FUNCTION public.recalculate_all_supplier_risks() TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_all_supplier_risks() TO service_role;


--
-- Name: FUNCTION recalculate_supplier_risk(p_supplier_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recalculate_supplier_risk(p_supplier_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalculate_supplier_risk(p_supplier_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_supplier_risk(p_supplier_id uuid) TO service_role;


--
-- Name: FUNCTION seed_default_equipment_schedule_notifications(p_schedule_configuration_id uuid, p_tenant_id uuid, p_created_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seed_default_equipment_schedule_notifications(p_schedule_configuration_id uuid, p_tenant_id uuid, p_created_by text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.seed_default_equipment_schedule_notifications(p_schedule_configuration_id uuid, p_tenant_id uuid, p_created_by text) TO authenticated;
GRANT ALL ON FUNCTION public.seed_default_equipment_schedule_notifications(p_schedule_configuration_id uuid, p_tenant_id uuid, p_created_by text) TO service_role;


--
-- Name: FUNCTION set_audit_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_audit_number() TO anon;
GRANT ALL ON FUNCTION public.set_audit_number() TO authenticated;
GRANT ALL ON FUNCTION public.set_audit_number() TO service_role;


--
-- Name: FUNCTION set_capa_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_capa_number() TO anon;
GRANT ALL ON FUNCTION public.set_capa_number() TO authenticated;
GRANT ALL ON FUNCTION public.set_capa_number() TO service_role;


--
-- Name: FUNCTION set_ncmr_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_ncmr_number() TO anon;
GRANT ALL ON FUNCTION public.set_ncmr_number() TO authenticated;
GRANT ALL ON FUNCTION public.set_ncmr_number() TO service_role;


--
-- Name: FUNCTION set_oos_oot_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_oos_oot_number() TO anon;
GRANT ALL ON FUNCTION public.set_oos_oot_number() TO authenticated;
GRANT ALL ON FUNCTION public.set_oos_oot_number() TO service_role;


--
-- Name: FUNCTION set_qualisphere_module_access_role_active(p_role_code text, p_is_active boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_qualisphere_module_access_role_active(p_role_code text, p_is_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_qualisphere_module_access_role_active(p_role_code text, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_qualisphere_module_access_role_active(p_role_code text, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION snapshot_ncmr_qms_decision(p_ncmr_id uuid, p_decision_type text, p_configuration_version_id uuid, p_input_snapshot jsonb, p_decision_snapshot jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.snapshot_ncmr_qms_decision(p_ncmr_id uuid, p_decision_type text, p_configuration_version_id uuid, p_input_snapshot jsonb, p_decision_snapshot jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.snapshot_ncmr_qms_decision(p_ncmr_id uuid, p_decision_type text, p_configuration_version_id uuid, p_input_snapshot jsonb, p_decision_snapshot jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.snapshot_ncmr_qms_decision(p_ncmr_id uuid, p_decision_type text, p_configuration_version_id uuid, p_input_snapshot jsonb, p_decision_snapshot jsonb) TO service_role;


--
-- Name: FUNCTION submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text) TO service_role;


--
-- Name: FUNCTION submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text, p_approver_department text, p_approver_job_title text, p_approve_by_date date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text, p_approver_department text, p_approver_job_title text, p_approve_by_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text, p_approver_department text, p_approver_job_title text, p_approve_by_date date) TO authenticated;
GRANT ALL ON FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text, p_approver_department text, p_approver_job_title text, p_approve_by_date date) TO service_role;


--
-- Name: FUNCTION sync_capa_from_approval_tasks(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_capa_from_approval_tasks() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_capa_from_approval_tasks() TO authenticated;
GRANT ALL ON FUNCTION public.sync_capa_from_approval_tasks() TO service_role;


--
-- Name: FUNCTION user_has_qualisphere_permission(p_user_email text, p_permission_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.user_has_qualisphere_permission(p_user_email text, p_permission_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_has_qualisphere_permission(p_user_email text, p_permission_key text) TO authenticated;
GRANT ALL ON FUNCTION public.user_has_qualisphere_permission(p_user_email text, p_permission_key text) TO service_role;


--
-- Name: TABLE approval_matrix_reviewers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval_matrix_reviewers TO authenticated;
GRANT ALL ON TABLE public.approval_matrix_reviewers TO service_role;


--
-- Name: TABLE approval_matrix_template_reviewers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval_matrix_template_reviewers TO authenticated;
GRANT ALL ON TABLE public.approval_matrix_template_reviewers TO service_role;


--
-- Name: TABLE approval_matrix_template_rows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval_matrix_template_rows TO authenticated;
GRANT ALL ON TABLE public.approval_matrix_template_rows TO service_role;


--
-- Name: TABLE approval_matrix_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval_matrix_templates TO authenticated;
GRANT ALL ON TABLE public.approval_matrix_templates TO service_role;


--
-- Name: TABLE audit_findings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_findings TO authenticated;
GRANT ALL ON TABLE public.audit_findings TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;


--
-- Name: TABLE audit_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_number_counters TO authenticated;
GRANT ALL ON TABLE public.audit_number_counters TO service_role;


--
-- Name: TABLE audit_tenant_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_tenant_number_counters TO service_role;


--
-- Name: TABLE audits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audits TO authenticated;
GRANT ALL ON TABLE public.audits TO service_role;


--
-- Name: TABLE capa_approval_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capa_approval_tasks TO authenticated;
GRANT ALL ON TABLE public.capa_approval_tasks TO service_role;


--
-- Name: TABLE capa_gate_approvers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capa_gate_approvers TO authenticated;
GRANT ALL ON TABLE public.capa_gate_approvers TO service_role;


--
-- Name: SEQUENCE capa_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.capa_seq TO anon;
GRANT ALL ON SEQUENCE public.capa_seq TO authenticated;
GRANT ALL ON SEQUENCE public.capa_seq TO service_role;


--
-- Name: TABLE capa_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capa_tasks TO authenticated;
GRANT ALL ON TABLE public.capa_tasks TO service_role;


--
-- Name: TABLE capa_tenant_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capa_tenant_number_counters TO service_role;


--
-- Name: TABLE capa_workflow_returns; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.capa_workflow_returns TO authenticated;
GRANT ALL ON TABLE public.capa_workflow_returns TO service_role;


--
-- Name: TABLE capas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capas TO authenticated;
GRANT ALL ON TABLE public.capas TO service_role;


--
-- Name: TABLE change_control_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_control_documents TO authenticated;
GRANT ALL ON TABLE public.change_control_documents TO service_role;


--
-- Name: TABLE change_control_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_control_products TO authenticated;
GRANT ALL ON TABLE public.change_control_products TO service_role;


--
-- Name: TABLE change_control_reviewers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_control_reviewers TO authenticated;
GRANT ALL ON TABLE public.change_control_reviewers TO service_role;


--
-- Name: TABLE change_control_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_control_tasks TO authenticated;
GRANT ALL ON TABLE public.change_control_tasks TO service_role;


--
-- Name: TABLE change_control_tenant_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_control_tenant_number_counters TO anon;
GRANT ALL ON TABLE public.change_control_tenant_number_counters TO authenticated;
GRANT ALL ON TABLE public.change_control_tenant_number_counters TO service_role;


--
-- Name: TABLE change_controls; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_controls TO authenticated;
GRANT ALL ON TABLE public.change_controls TO service_role;


--
-- Name: TABLE collaboration_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.collaboration_comments TO authenticated;
GRANT ALL ON TABLE public.collaboration_comments TO service_role;


--
-- Name: TABLE collaboration_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.collaboration_participants TO authenticated;
GRANT ALL ON TABLE public.collaboration_participants TO service_role;


--
-- Name: TABLE collaboration_threads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.collaboration_threads TO authenticated;
GRANT ALL ON TABLE public.collaboration_threads TO service_role;


--
-- Name: TABLE company_dashboard_kpi_configuration; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_dashboard_kpi_configuration TO authenticated;
GRANT ALL ON TABLE public.company_dashboard_kpi_configuration TO service_role;


--
-- Name: TABLE company_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_settings TO authenticated;
GRANT ALL ON TABLE public.company_settings TO service_role;


--
-- Name: TABLE complaint_activity_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.complaint_activity_log TO authenticated;
GRANT ALL ON TABLE public.complaint_activity_log TO service_role;


--
-- Name: TABLE complaint_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.complaint_attachments TO authenticated;
GRANT ALL ON TABLE public.complaint_attachments TO service_role;


--
-- Name: TABLE complaint_quality_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.complaint_quality_links TO authenticated;
GRANT ALL ON TABLE public.complaint_quality_links TO service_role;


--
-- Name: TABLE complaints; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.complaints TO authenticated;
GRANT ALL ON TABLE public.complaints TO service_role;


--
-- Name: TABLE controlled_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.controlled_documents TO authenticated;
GRANT ALL ON TABLE public.controlled_documents TO service_role;


--
-- Name: TABLE custom_kpi_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_kpi_definitions TO authenticated;
GRANT ALL ON TABLE public.custom_kpi_definitions TO service_role;


--
-- Name: TABLE customer_role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customer_role_permissions TO anon;
GRANT ALL ON TABLE public.customer_role_permissions TO authenticated;
GRANT ALL ON TABLE public.customer_role_permissions TO service_role;


--
-- Name: TABLE customer_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customer_roles TO anon;
GRANT ALL ON TABLE public.customer_roles TO authenticated;
GRANT ALL ON TABLE public.customer_roles TO service_role;


--
-- Name: TABLE dashboard_kpi_configuration; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dashboard_kpi_configuration TO authenticated;
GRANT ALL ON TABLE public.dashboard_kpi_configuration TO service_role;


--
-- Name: TABLE dci_pdf_verifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dci_pdf_verifications TO service_role;
GRANT SELECT ON TABLE public.dci_pdf_verifications TO authenticated;


--
-- Name: TABLE document_acknowledgements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_acknowledgements TO authenticated;
GRANT ALL ON TABLE public.document_acknowledgements TO service_role;


--
-- Name: TABLE document_assigned_reviewers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_assigned_reviewers TO authenticated;
GRANT ALL ON TABLE public.document_assigned_reviewers TO service_role;


--
-- Name: TABLE document_change_document_files; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_change_document_files TO anon;
GRANT ALL ON TABLE public.document_change_document_files TO authenticated;
GRANT ALL ON TABLE public.document_change_document_files TO service_role;


--
-- Name: TABLE document_change_initiation_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_change_initiation_documents TO anon;
GRANT ALL ON TABLE public.document_change_initiation_documents TO authenticated;
GRANT ALL ON TABLE public.document_change_initiation_documents TO service_role;


--
-- Name: TABLE document_change_initiations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_change_initiations TO anon;
GRANT ALL ON TABLE public.document_change_initiations TO authenticated;
GRANT ALL ON TABLE public.document_change_initiations TO service_role;


--
-- Name: TABLE document_change_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_change_number_counters TO anon;
GRANT ALL ON TABLE public.document_change_number_counters TO authenticated;
GRANT ALL ON TABLE public.document_change_number_counters TO service_role;


--
-- Name: TABLE document_collaboration_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_collaboration_reviews TO authenticated;
GRANT ALL ON TABLE public.document_collaboration_reviews TO service_role;


--
-- Name: TABLE document_formal_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_formal_reviews TO authenticated;
GRANT ALL ON TABLE public.document_formal_reviews TO service_role;


--
-- Name: TABLE document_impact_assessments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_impact_assessments TO anon;
GRANT ALL ON TABLE public.document_impact_assessments TO authenticated;
GRANT ALL ON TABLE public.document_impact_assessments TO service_role;


--
-- Name: TABLE document_number_sequences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_number_sequences TO authenticated;
GRANT ALL ON TABLE public.document_number_sequences TO service_role;


--
-- Name: TABLE document_relationships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_relationships TO authenticated;
GRANT ALL ON TABLE public.document_relationships TO service_role;


--
-- Name: TABLE document_training_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_training_assignments TO authenticated;
GRANT ALL ON TABLE public.document_training_assignments TO service_role;


--
-- Name: TABLE document_training_requirements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_training_requirements TO anon;
GRANT ALL ON TABLE public.document_training_requirements TO authenticated;
GRANT ALL ON TABLE public.document_training_requirements TO service_role;


--
-- Name: TABLE document_workflow_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.document_workflow_events TO authenticated;
GRANT ALL ON TABLE public.document_workflow_events TO service_role;


--
-- Name: TABLE electronic_signatures; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE public.electronic_signatures TO authenticated;
GRANT ALL ON TABLE public.electronic_signatures TO service_role;


--
-- Name: TABLE employee_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_profiles TO authenticated;
GRANT ALL ON TABLE public.employee_profiles TO service_role;


--
-- Name: TABLE equipment; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment TO authenticated;
GRANT ALL ON TABLE public.equipment TO service_role;


--
-- Name: TABLE equipment_calibration_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_calibration_events TO authenticated;
GRANT ALL ON TABLE public.equipment_calibration_events TO service_role;


--
-- Name: TABLE equipment_change_control_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_change_control_links TO authenticated;
GRANT ALL ON TABLE public.equipment_change_control_links TO service_role;


--
-- Name: TABLE equipment_schedule_configurations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_schedule_configurations TO authenticated;
GRANT ALL ON TABLE public.equipment_schedule_configurations TO service_role;


--
-- Name: TABLE equipment_current_schedule_status; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_current_schedule_status TO authenticated;
GRANT ALL ON TABLE public.equipment_current_schedule_status TO service_role;


--
-- Name: TABLE equipment_event_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_event_number_counters TO authenticated;
GRANT ALL ON TABLE public.equipment_event_number_counters TO service_role;


--
-- Name: TABLE equipment_governance_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_governance_members TO authenticated;
GRANT ALL ON TABLE public.equipment_governance_members TO service_role;


--
-- Name: SEQUENCE equipment_import_batch_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.equipment_import_batch_seq TO anon;
GRANT ALL ON SEQUENCE public.equipment_import_batch_seq TO authenticated;
GRANT ALL ON SEQUENCE public.equipment_import_batch_seq TO service_role;


--
-- Name: TABLE equipment_import_batches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_import_batches TO authenticated;
GRANT ALL ON TABLE public.equipment_import_batches TO service_role;


--
-- Name: TABLE equipment_import_rows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_import_rows TO authenticated;
GRANT ALL ON TABLE public.equipment_import_rows TO service_role;


--
-- Name: TABLE equipment_maintenance_components; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_maintenance_components TO authenticated;
GRANT ALL ON TABLE public.equipment_maintenance_components TO service_role;


--
-- Name: TABLE equipment_maintenance_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_maintenance_events TO authenticated;
GRANT ALL ON TABLE public.equipment_maintenance_events TO service_role;


--
-- Name: TABLE equipment_numbering_configurations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_numbering_configurations TO authenticated;
GRANT ALL ON TABLE public.equipment_numbering_configurations TO service_role;


--
-- Name: TABLE equipment_oos_oot_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_oos_oot_links TO authenticated;
GRANT ALL ON TABLE public.equipment_oos_oot_links TO service_role;


--
-- Name: TABLE equipment_post_maintenance_assessments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_post_maintenance_assessments TO authenticated;
GRANT ALL ON TABLE public.equipment_post_maintenance_assessments TO service_role;


--
-- Name: TABLE equipment_qualification_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_qualification_events TO authenticated;
GRANT ALL ON TABLE public.equipment_qualification_events TO service_role;


--
-- Name: TABLE equipment_related_event_counts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_related_event_counts TO authenticated;
GRANT ALL ON TABLE public.equipment_related_event_counts TO service_role;


--
-- Name: TABLE equipment_schedule_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.equipment_schedule_notifications TO authenticated;
GRANT ALL ON TABLE public.equipment_schedule_notifications TO service_role;


--
-- Name: TABLE governance_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.governance_rules TO authenticated;
GRANT ALL ON TABLE public.governance_rules TO service_role;


--
-- Name: TABLE kpi_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.kpi_history TO authenticated;
GRANT ALL ON TABLE public.kpi_history TO service_role;


--
-- Name: TABLE kpi_library; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kpi_library TO authenticated;
GRANT ALL ON TABLE public.kpi_library TO service_role;


--
-- Name: TABLE kpi_library_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kpi_library_definitions TO authenticated;
GRANT ALL ON TABLE public.kpi_library_definitions TO service_role;


--
-- Name: TABLE management_review_actions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.management_review_actions TO authenticated;
GRANT ALL ON TABLE public.management_review_actions TO service_role;


--
-- Name: TABLE management_review_approvers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.management_review_approvers TO authenticated;
GRANT ALL ON TABLE public.management_review_approvers TO service_role;


--
-- Name: TABLE management_review_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.management_review_reports TO authenticated;
GRANT ALL ON TABLE public.management_review_reports TO service_role;


--
-- Name: TABLE management_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.management_reviews TO authenticated;
GRANT ALL ON TABLE public.management_reviews TO service_role;


--
-- Name: TABLE md_defect_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_defect_categories TO authenticated;
GRANT ALL ON TABLE public.md_defect_categories TO service_role;


--
-- Name: TABLE md_defect_subcategories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_defect_subcategories TO authenticated;
GRANT ALL ON TABLE public.md_defect_subcategories TO service_role;


--
-- Name: TABLE md_departments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_departments TO authenticated;
GRANT ALL ON TABLE public.md_departments TO service_role;


--
-- Name: TABLE md_detection_sources; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_detection_sources TO authenticated;
GRANT ALL ON TABLE public.md_detection_sources TO service_role;


--
-- Name: TABLE md_dispositions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_dispositions TO authenticated;
GRANT ALL ON TABLE public.md_dispositions TO service_role;


--
-- Name: TABLE md_document_impact_areas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_document_impact_areas TO anon;
GRANT ALL ON TABLE public.md_document_impact_areas TO authenticated;
GRANT ALL ON TABLE public.md_document_impact_areas TO service_role;


--
-- Name: TABLE md_equipment; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_equipment TO authenticated;
GRANT ALL ON TABLE public.md_equipment TO service_role;


--
-- Name: TABLE md_material_statuses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_material_statuses TO authenticated;
GRANT ALL ON TABLE public.md_material_statuses TO service_role;


--
-- Name: TABLE md_oos_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_oos_limits TO authenticated;
GRANT ALL ON TABLE public.md_oos_limits TO service_role;


--
-- Name: TABLE md_product_part_numbers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_product_part_numbers TO authenticated;
GRANT ALL ON TABLE public.md_product_part_numbers TO service_role;


--
-- Name: TABLE md_rooms; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_rooms TO authenticated;
GRANT ALL ON TABLE public.md_rooms TO service_role;


--
-- Name: TABLE md_root_cause_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_root_cause_categories TO authenticated;
GRANT ALL ON TABLE public.md_root_cause_categories TO service_role;


--
-- Name: TABLE md_test_methods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.md_test_methods TO authenticated;
GRANT ALL ON TABLE public.md_test_methods TO service_role;


--
-- Name: TABLE ncmr_affected_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ncmr_affected_items TO authenticated;
GRANT ALL ON TABLE public.ncmr_affected_items TO service_role;


--
-- Name: TABLE ncmr_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ncmr_comments TO authenticated;
GRANT ALL ON TABLE public.ncmr_comments TO service_role;


--
-- Name: TABLE ncmr_mrb_approvers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ncmr_mrb_approvers TO authenticated;
GRANT ALL ON TABLE public.ncmr_mrb_approvers TO service_role;


--
-- Name: TABLE ncmr_mrb_reviewers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ncmr_mrb_reviewers TO authenticated;
GRANT ALL ON TABLE public.ncmr_mrb_reviewers TO service_role;


--
-- Name: SEQUENCE ncmr_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.ncmr_seq TO anon;
GRANT ALL ON SEQUENCE public.ncmr_seq TO authenticated;
GRANT ALL ON SEQUENCE public.ncmr_seq TO service_role;


--
-- Name: TABLE ncmr_tenant_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ncmr_tenant_number_counters TO service_role;


--
-- Name: TABLE ncmrs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ncmrs TO authenticated;
GRANT ALL ON TABLE public.ncmrs TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE notification_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_queue TO authenticated;
GRANT ALL ON TABLE public.notification_queue TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE oos_oot_investigations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.oos_oot_investigations TO authenticated;
GRANT ALL ON TABLE public.oos_oot_investigations TO service_role;


--
-- Name: TABLE oos_oot_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.oos_oot_number_counters TO service_role;


--
-- Name: TABLE oos_oot_tenant_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.oos_oot_tenant_number_counters TO service_role;


--
-- Name: TABLE platform_administrators; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_administrators TO anon;
GRANT ALL ON TABLE public.platform_administrators TO authenticated;
GRANT ALL ON TABLE public.platform_administrators TO service_role;


--
-- Name: TABLE printable_management_review_signatures; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE public.printable_management_review_signatures TO authenticated;
GRANT ALL ON TABLE public.printable_management_review_signatures TO service_role;


--
-- Name: TABLE printable_management_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.printable_management_reviews TO authenticated;
GRANT ALL ON TABLE public.printable_management_reviews TO service_role;


--
-- Name: TABLE qms_capa_governance_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_capa_governance_rules TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_capa_governance_rules TO authenticated;


--
-- Name: TABLE qms_configuration_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_configuration_audit_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.qms_configuration_audit_log TO authenticated;


--
-- Name: TABLE qms_configuration_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_configuration_versions TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_configuration_versions TO authenticated;


--
-- Name: TABLE qms_decision_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_decision_snapshots TO service_role;


--
-- Name: TABLE qms_module_record_migrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_module_record_migrations TO authenticated;
GRANT ALL ON TABLE public.qms_module_record_migrations TO service_role;


--
-- Name: TABLE qms_module_release_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE public.qms_module_release_events TO authenticated;
GRANT ALL ON TABLE public.qms_module_release_events TO service_role;


--
-- Name: TABLE qms_record_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE public.qms_record_snapshots TO authenticated;
GRANT ALL ON TABLE public.qms_record_snapshots TO service_role;


--
-- Name: TABLE qms_record_structure_freezes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE public.qms_record_structure_freezes TO authenticated;
GRANT ALL ON TABLE public.qms_record_structure_freezes TO service_role;


--
-- Name: TABLE qms_record_structure_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_record_structure_templates TO authenticated;
GRANT ALL ON TABLE public.qms_record_structure_templates TO service_role;


--
-- Name: TABLE qms_risk_matrix_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_risk_matrix_rules TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_risk_matrix_rules TO authenticated;


--
-- Name: TABLE qms_workflow_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qms_workflow_versions TO service_role;
GRANT SELECT ON TABLE public.qms_workflow_versions TO authenticated;


--
-- Name: TABLE receiving_inspections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.receiving_inspections TO authenticated;
GRANT ALL ON TABLE public.receiving_inspections TO service_role;


--
-- Name: TABLE record_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.record_number_counters TO authenticated;
GRANT ALL ON TABLE public.record_number_counters TO service_role;


--
-- Name: TABLE scar_tenant_number_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scar_tenant_number_counters TO anon;
GRANT ALL ON TABLE public.scar_tenant_number_counters TO authenticated;
GRANT ALL ON TABLE public.scar_tenant_number_counters TO service_role;


--
-- Name: TABLE scars; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scars TO authenticated;
GRANT ALL ON TABLE public.scars TO service_role;


--
-- Name: TABLE security_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.security_roles TO authenticated;
GRANT ALL ON TABLE public.security_roles TO service_role;


--
-- Name: TABLE supplier_audit_findings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.supplier_audit_findings TO authenticated;
GRANT ALL ON TABLE public.supplier_audit_findings TO service_role;


--
-- Name: TABLE supplier_audits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.supplier_audits TO authenticated;
GRANT ALL ON TABLE public.supplier_audits TO service_role;


--
-- Name: TABLE supplier_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.supplier_documents TO authenticated;
GRANT ALL ON TABLE public.supplier_documents TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE supplier_risk_dashboard; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.supplier_risk_dashboard TO authenticated;
GRANT ALL ON TABLE public.supplier_risk_dashboard TO service_role;


--
-- Name: TABLE tenant_customer_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_customer_contacts TO anon;
GRANT ALL ON TABLE public.tenant_customer_contacts TO authenticated;
GRANT ALL ON TABLE public.tenant_customer_contacts TO service_role;


--
-- Name: TABLE tenant_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_memberships TO anon;
GRANT ALL ON TABLE public.tenant_memberships TO authenticated;
GRANT ALL ON TABLE public.tenant_memberships TO service_role;


--
-- Name: TABLE tenant_module_access; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_module_access TO anon;
GRANT ALL ON TABLE public.tenant_module_access TO authenticated;
GRANT ALL ON TABLE public.tenant_module_access TO service_role;


--
-- Name: TABLE tenant_user_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_user_profiles TO anon;
GRANT ALL ON TABLE public.tenant_user_profiles TO authenticated;
GRANT ALL ON TABLE public.tenant_user_profiles TO service_role;


--
-- Name: TABLE tenant_user_role_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_user_role_assignments TO anon;
GRANT ALL ON TABLE public.tenant_user_role_assignments TO authenticated;
GRANT ALL ON TABLE public.tenant_user_role_assignments TO service_role;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenants TO anon;
GRANT ALL ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;


--
-- Name: TABLE training_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_assignments TO authenticated;
GRANT ALL ON TABLE public.training_assignments TO service_role;


--
-- Name: TABLE training_certifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_certifications TO anon;
GRANT ALL ON TABLE public.training_certifications TO authenticated;
GRANT ALL ON TABLE public.training_certifications TO service_role;


--
-- Name: TABLE training_compliance_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_compliance_settings TO authenticated;
GRANT ALL ON TABLE public.training_compliance_settings TO service_role;


--
-- Name: TABLE training_effectiveness_checks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_effectiveness_checks TO authenticated;
GRANT ALL ON TABLE public.training_effectiveness_checks TO service_role;


--
-- Name: TABLE training_group_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_group_members TO anon;
GRANT ALL ON TABLE public.training_group_members TO authenticated;
GRANT ALL ON TABLE public.training_group_members TO service_role;


--
-- Name: TABLE training_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_groups TO anon;
GRANT ALL ON TABLE public.training_groups TO authenticated;
GRANT ALL ON TABLE public.training_groups TO service_role;


--
-- Name: TABLE training_matrix; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_matrix TO authenticated;
GRANT ALL ON TABLE public.training_matrix TO service_role;


--
-- Name: TABLE training_methods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_methods TO anon;
GRANT ALL ON TABLE public.training_methods TO authenticated;
GRANT ALL ON TABLE public.training_methods TO service_role;


--
-- Name: TABLE training_retraining_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_retraining_rules TO authenticated;
GRANT ALL ON TABLE public.training_retraining_rules TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE user_security_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_security_roles TO authenticated;
GRANT ALL ON TABLE public.user_security_roles TO service_role;


--
-- Name: TABLE workflow_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workflow_tasks TO authenticated;
GRANT ALL ON TABLE public.workflow_tasks TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--



-- Keep the incomplete environment unavailable through public client roles.
-- An explicit reviewed activation migration must restore schema usage later.
REVOKE USAGE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
SET check_function_bodies = true;
NOTIFY pgrst, 'reload schema';
