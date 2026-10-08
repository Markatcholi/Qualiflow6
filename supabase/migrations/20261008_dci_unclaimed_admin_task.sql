-- Allow one unclaimed DCI administrative review task to be visible to all
-- eligible Document Control Coordinators until the first atomic claim.
-- Existing assigned tasks and their owners remain unchanged.
alter table public.approval_tasks
  alter column assigned_to_email drop not null;

alter table public.approval_tasks
  add constraint approval_tasks_unassigned_only_dci_admin_check
  check (
    assigned_to_email is not null
    or (
      entity_type = 'document_change_initiation'
      and task_type = 'dci_administrative_review'
      and status = 'pending'
      and required_function = 'Document Control Coordinator'
    )
  );