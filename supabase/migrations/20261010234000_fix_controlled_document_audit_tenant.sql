-- Fix controlled-document audit tenant resolution while preserving existing mappings.
-- The audit resolver must derive the tenant from the authoritative document row.
CREATE OR REPLACE FUNCTION public.qualisphere_audit_entity_tenant(p_entity_type text, p_entity_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;
