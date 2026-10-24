-- Customer-managed training methods. Existing records and references are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.qualisphere_guard_training_method_history()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_guard_training_method_history() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE TRIGGER guard_training_method_history BEFORE DELETE OR UPDATE OF release_blocking,acknowledgement_required,evidence_required ON public.training_methods FOR EACH ROW EXECUTE FUNCTION public.qualisphere_guard_training_method_history();

CREATE OR REPLACE FUNCTION public.qualisphere_save_training_method(p_tenant uuid,p_id uuid,p_label text,p_release_blocking boolean,p_acknowledgement_required boolean,p_evidence_required boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,auth AS $$
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
REVOKE ALL ON FUNCTION public.qualisphere_save_training_method(uuid,uuid,text,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qualisphere_save_training_method(uuid,uuid,text,boolean,boolean,boolean) TO authenticated;

-- Keep existing member read access; constrain method mutations to coordinators.
DROP POLICY IF EXISTS training_methods_coordinator_insert_guard ON public.training_methods;
CREATE POLICY training_methods_coordinator_insert_guard ON public.training_methods AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.qualisphere_training_is_coordinator(tenant_id));
DROP POLICY IF EXISTS training_methods_coordinator_update_guard ON public.training_methods;
CREATE POLICY training_methods_coordinator_update_guard ON public.training_methods AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.qualisphere_training_is_coordinator(tenant_id)) WITH CHECK(public.qualisphere_training_is_coordinator(tenant_id));
DROP POLICY IF EXISTS training_methods_coordinator_delete_guard ON public.training_methods;
CREATE POLICY training_methods_coordinator_delete_guard ON public.training_methods AS RESTRICTIVE FOR DELETE TO authenticated USING(public.qualisphere_training_is_coordinator(tenant_id));
COMMIT;
