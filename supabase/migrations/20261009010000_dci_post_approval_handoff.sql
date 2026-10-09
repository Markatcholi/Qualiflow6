-- DCI formal-approval completion and Document Control handoff
ALTER TABLE public.document_change_initiations DROP CONSTRAINT IF EXISTS document_change_initiations_status_check;
ALTER TABLE public.document_change_initiations ADD CONSTRAINT document_change_initiations_status_check CHECK (status = ANY (ARRAY['draft','collaboration','document_control_review','administrative_review','formal_review','approved','implementation','post_approval','released','withdrawn']));

CREATE OR REPLACE FUNCTION public.qualisphere_complete_dci_formal_approval(p_dci_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_complete_dci_formal_approval(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualisphere_complete_dci_formal_approval(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.qualisphere_claim_dci_post_approval(p_task_id uuid)
RETURNS public.approval_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_claim_dci_post_approval(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualisphere_claim_dci_post_approval(uuid) TO authenticated;
