-- Preserve every existing DCI status while admitting the new administrative-review stage.
alter table public.document_change_initiations
  drop constraint document_change_initiations_status_check;

alter table public.document_change_initiations
  add constraint document_change_initiations_status_check
  check (status in (
    'draft', 'collaboration', 'document_control_review',
    'administrative_review', 'formal_review', 'approved',
    'implementation', 'released', 'withdrawn'
  ));