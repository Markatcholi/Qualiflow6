-- QualiSphere Beta only: empty private storage containers, no files or client policies.
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM public.tenants) OR EXISTS (SELECT 1 FROM auth.users)
 OR EXISTS (SELECT 1 FROM storage.buckets) OR EXISTS (SELECT 1 FROM storage.objects)
 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage') THEN
  RAISE EXCEPTION 'Private sandbox storage setup requires an unused destination';
 END IF;
 IF has_schema_privilege('anon','public','USAGE') OR has_schema_privilege('authenticated','public','USAGE') THEN
  RAISE EXCEPTION 'Sandbox application access must remain disabled';
 END IF;
END;
$guard$;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES
('Evidence','Evidence',false,NULL),
('evidence','evidence',false,NULL),
('supplier-documents','supplier-documents',false,NULL),
('capa-evidence','capa-evidence',false,26214400),
('controlled-documents','controlled-documents',false,NULL),
('audit-evidence','audit-evidence',false,26214400),
('training-completion-evidence','training-completion-evidence',false,10485760);

