create table if not exists public.document_change_document_files (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 dci_id uuid not null references public.document_change_initiations(id) on delete cascade,
 document_id uuid not null references public.controlled_documents(id) on delete cascade,
 file_name text not null,
 file_path text not null,
 uploaded_by text,
 created_at timestamptz not null default now()
);
create index if not exists idx_dci_document_files_document on public.document_change_document_files(dci_id,document_id,created_at);
alter table public.document_change_document_files enable row level security;
drop policy if exists dci_document_files_company_boundary on public.document_change_document_files;
create policy dci_document_files_company_boundary on public.document_change_document_files for all to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'controlled_documents'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'controlled_documents'));
grant select,insert,update,delete on public.document_change_document_files to authenticated;