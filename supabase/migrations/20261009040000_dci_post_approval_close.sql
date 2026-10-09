-- Complete coordinator verification and advance the DCI to release readiness.
ALTER TABLE public.document_change_initiations DROP CONSTRAINT IF EXISTS document_change_initiations_status_check;
ALTER TABLE public.document_change_initiations ADD CONSTRAINT document_change_initiations_status_check CHECK (status IN ('draft','collaboration','document_control_review','administrative_review','formal_review','approved','implementation','post_approval','release_ready','released','withdrawn'));

CREATE OR REPLACE FUNCTION public.qualisphere_close_dci_post_approval(p_dci_id uuid,p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_close_dci_post_approval(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualisphere_close_dci_post_approval(uuid,text) TO authenticated;
