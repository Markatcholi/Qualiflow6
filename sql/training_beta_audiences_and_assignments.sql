-- QualiSphere beta: procedure audiences and reviewed matrix assignments.
-- Additive: existing matrix rows, assignments, signatures and evidence are retained.
-- New functions are SECURITY INVOKER and use the existing tenant/coordinator policies.
BEGIN;
CREATE OR REPLACE FUNCTION public.qualisphere_save_training_matrix_audience(p_document_number text, p_targets jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,auth AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_save_training_matrix_audience(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_save_training_matrix_audience(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.qualisphere_assign_training_matrix(p_targets jsonb,p_method uuid,p_due date,p_months integer DEFAULT NULL,p_basis text DEFAULT 'completion')
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,auth AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_assign_training_matrix(jsonb,uuid,date,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_assign_training_matrix(jsonb,uuid,date,integer,text) TO authenticated;

-- No new training, including recurring cycles, introduces effectiveness checks.
CREATE OR REPLACE FUNCTION public.qualisphere_training_without_effectiveness()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN NEW.effectiveness_required:=false; NEW.effectiveness_status:='not_required'; RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.qualisphere_training_without_effectiveness() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS training_without_effectiveness ON public.training_assignments;
CREATE TRIGGER training_without_effectiveness BEFORE INSERT ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION public.qualisphere_training_without_effectiveness();

-- Extend the existing evidence check to configured one-time methods too.
-- Retain its existing storage lookup privileges, validation, and completion-date rule.
CREATE OR REPLACE FUNCTION public.qualisphere_enforce_training_completion_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth,storage AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_enforce_training_completion_evidence() FROM PUBLIC,anon,authenticated;
COMMIT;
