-- DCI PDF verification: coordinator attestation bound to the exact stored object path.
CREATE TABLE IF NOT EXISTS public.dci_pdf_verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 dci_id uuid NOT NULL REFERENCES public.document_change_initiations(id),
 document_id uuid NOT NULL REFERENCES public.controlled_documents(id),
 pdf_storage_path text NOT NULL,
 verified_by_email text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 verification_comment text NOT NULL,
 UNIQUE (document_id, pdf_storage_path)
);
CREATE INDEX IF NOT EXISTS dci_pdf_verifications_lookup ON public.dci_pdf_verifications(tenant_id,dci_id,document_id);
ALTER TABLE public.dci_pdf_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dci_pdf_verifications FROM anon,authenticated;
GRANT SELECT ON public.dci_pdf_verifications TO authenticated;
CREATE POLICY dci_pdf_verifications_member_read ON public.dci_pdf_verifications FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=dci_pdf_verifications.tenant_id AND lower(m.user_email)=lower(auth.jwt()->>'email') AND m.membership_status='active')
);
CREATE OR REPLACE FUNCTION public.qualisphere_verify_dci_pdf(p_dci_id uuid,p_document_id uuid,p_pdf_path text,p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_verify_dci_pdf(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualisphere_verify_dci_pdf(uuid,uuid,text,text) TO authenticated;
-- Any change to the PDF reference revokes the prior verification for this document.
CREATE OR REPLACE FUNCTION public.qualisphere_invalidate_dci_pdf_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.release_pdf_file_path IS DISTINCT FROM NEW.release_pdf_file_path OR OLD.release_pdf_file_url IS DISTINCT FROM NEW.release_pdf_file_url THEN
  DELETE FROM public.dci_pdf_verifications WHERE document_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_invalidate_dci_pdf_verification ON public.controlled_documents;
CREATE TRIGGER trg_invalidate_dci_pdf_verification AFTER UPDATE OF release_pdf_file_path,release_pdf_file_url ON public.controlled_documents FOR EACH ROW EXECUTE FUNCTION public.qualisphere_invalidate_dci_pdf_verification();
