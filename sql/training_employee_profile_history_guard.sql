-- Training employee management: preserve links to existing training history.
-- Run before deploying the profile edit/delete UI. No existing records are changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.qualisphere_guard_employee_training_history()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_guard_employee_training_history() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE TRIGGER guard_employee_training_history BEFORE DELETE OR UPDATE OF user_email ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.qualisphere_guard_employee_training_history();
COMMIT;
