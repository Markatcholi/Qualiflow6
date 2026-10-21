-- QualiSphere: employee training acknowledgment must be recorded by the assigned employee.
-- Preserve coordinator authority over assignment administration, waivers, cancellations,
-- withdrawals, and verification. No existing records are changed.
CREATE OR REPLACE FUNCTION public.qualisphere_guard_training_assignment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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
$function$;
