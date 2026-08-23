"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type NumberingStrategy = "customer_assigned" | "qualisphere_generated" | "allow_both";
type NumberSource = "customer_assigned" | "qualisphere_generated";

type NumberingConfiguration = {
  tenant_id: string;
  numbering_strategy: NumberingStrategy;
  generated_prefix: string | null;
  sequence_padding: number | null;
  next_sequence: number | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1",
  borderRadius: "8px", background: "#fff", fontSize: "14px", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 800,
  color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #dbe3ef", borderRadius: "12px", padding: "18px",
};
const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #315ee8", background: "#315ee8", color: "#fff",
  padding: "10px 16px", borderRadius: "8px", fontWeight: 800,
  cursor: "pointer", textDecoration: "none",
};
const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a",
  padding: "10px 16px", borderRadius: "8px", fontWeight: 700,
  cursor: "pointer", textDecoration: "none",
};

function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return <div>
    <label style={labelStyle}>{label}{required ? <span style={{color:"#b91c1c"}}> *</span> : null}</label>
    {children}
    {hint ? <div style={{color:"#64748b",fontSize:"12px",marginTop:"5px"}}>{hint}</div> : null}
  </div>;
}

function ToggleCard({ title, description, checked, onChange }: {
  title: string; description: string; checked: boolean; onChange: (v:boolean)=>void;
}) {
  return <label style={{
    display:"flex",gap:"12px",alignItems:"flex-start",padding:"14px",
    border:checked ? "1px solid #86efac":"1px solid #dbe3ef",
    background:checked ? "#f0fdf4":"#fff",borderRadius:"10px",cursor:"pointer"
  }}>
    <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{marginTop:"3px"}} />
    <span>
      <strong style={{display:"block",color:"#0f172a"}}>{title}</strong>
      <span style={{display:"block",color:"#64748b",fontSize:"13px",marginTop:"3px"}}>{description}</span>
    </span>
  </label>;
}

export default function RegisterEquipmentPage() {
  const router = useRouter();
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [loadError,setLoadError] = useState("");
  const [submitError,setSubmitError] = useState("");
  const [currentUserEmail,setCurrentUserEmail] = useState("");
  const [tenantId,setTenantId] = useState("");
  const [numberingConfig,setNumberingConfig] = useState<NumberingConfiguration|null>(null);

  const [numberSource,setNumberSource] = useState<NumberSource>("customer_assigned");
  const [equipmentNumber,setEquipmentNumber] = useState("");
  const [equipmentName,setEquipmentName] = useState("");
  const [equipmentType,setEquipmentType] = useState("");
  const [manufacturer,setManufacturer] = useState("");
  const [modelNumber,setModelNumber] = useState("");
  const [serialNumber,setSerialNumber] = useState("");
  const [assetNumber,setAssetNumber] = useState("");
  const [department,setDepartment] = useState("");
  const [siteLocation,setSiteLocation] = useState("");
  const [ownerEmail,setOwnerEmail] = useState("");
  const [description,setDescription] = useState("");
  const [specificationDocumentNumber,setSpecificationDocumentNumber] = useState("");
  const [specificationRevision,setSpecificationRevision] = useState("");
  const [calibrationRequired,setCalibrationRequired] = useState(false);
  const [preventiveMaintenanceRequired,setPreventiveMaintenanceRequired] = useState(false);
  const [qualificationRequired,setQualificationRequired] = useState(false);
  const [postAssessment,setPostAssessment] = useState<"required"|"optional"|"disabled">("optional");

  const strategy: NumberingStrategy = numberingConfig?.numbering_strategy || "allow_both";
  const generatedPreview = useMemo(() => {
    const prefix = numberingConfig?.generated_prefix || "EQ";
    const padding = numberingConfig?.sequence_padding || 6;
    const next = numberingConfig?.next_sequence || 1;
    return `${prefix}${String(next).padStart(padding,"0")}`;
  },[numberingConfig]);

  const loadPage = async () => {
    setLoading(true); setLoadError("");
    try {
      const {data:userData,error:userError} = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      const user:any = userData?.user;
      if (!user?.id) throw new Error("You must be signed in to register equipment.");

      // Prefer a company tenant UUID when present. The current NCMR creation
      // page has no separate tenant resolver, so user.id is the Phase-1 fallback.
      const resolvedTenantId =
        user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || user.id;
      const email = user.email || "";

      setTenantId(resolvedTenantId);
      setCurrentUserEmail(email);
      setOwnerEmail(email);

      const {data,error} = await supabase
        .from("equipment_numbering_configurations")
        .select("tenant_id,numbering_strategy,generated_prefix,sequence_padding,next_sequence")
        .eq("tenant_id",resolvedTenantId).eq("is_active",true).maybeSingle();
      if (error) throw new Error(error.message);

      const cfg = (data as NumberingConfiguration|null) || null;
      setNumberingConfig(cfg);
      const s = cfg?.numbering_strategy || "allow_both";
      setNumberSource(s === "qualisphere_generated" ? "qualisphere_generated" : "customer_assigned");
    } catch (e:any) {
      setLoadError(e?.message || "Unable to load Equipment Registration.");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ loadPage(); },[]);

  const addAuditLog = async (equipmentId:string,action:string,details:string) => {
    const {error} = await supabase.from("audit_logs").insert({
      entity_type:"equipment", entity_id:equipmentId, action, details,
      user_email:currentUserEmail || "unknown",
    });
    if (error) console.warn("Unable to add equipment audit log:",error.message);
  };

  const registerEquipment = async () => {
    setSubmitError("");
    if (!equipmentName.trim()) return setSubmitError("Equipment Name is required.");
    if (numberSource === "customer_assigned" && !equipmentNumber.trim())
      return setSubmitError("Equipment Number is required for Customer Assigned numbering.");
    if (ownerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim()))
      return setSubmitError("Enter a valid Equipment Owner email address.");
    if (!tenantId) return setSubmitError("Tenant could not be resolved. Refresh and try again.");

    setSubmitting(true);
    try {
      const {data,error} = await supabase.from("equipment").insert({
        tenant_id:tenantId,
        equipment_number:numberSource === "customer_assigned" ? equipmentNumber.trim() : "",
        number_source:numberSource,
        equipment_name:equipmentName.trim(),
        equipment_type:equipmentType.trim() || null,
        manufacturer:manufacturer.trim() || null,
        model_number:modelNumber.trim() || null,
        serial_number:serialNumber.trim() || null,
        asset_number:assetNumber.trim() || null,
        department:department.trim() || null,
        site_location:siteLocation.trim() || null,
        owner_email:ownerEmail.trim().toLowerCase() || null,
        description:description.trim() || null,
        specification_document_number:specificationDocumentNumber.trim() || null,
        specification_revision:specificationRevision.trim() || null,
        calibration_required:calibrationRequired,
        preventive_maintenance_required:preventiveMaintenanceRequired,
        qualification_required:qualificationRequired,
        post_unplanned_maintenance_assessment:postAssessment,
        lifecycle_status:"draft",
        use_status:"out_of_service",
        use_status_reason:"Equipment registration initiated. Equipment has not yet been released for use.",
        created_by:currentUserEmail || "unknown",
      }).select("id,equipment_number,equipment_name").single();

      if (error) throw new Error(error.message);
      await addAuditLog(data.id,"created",
        `Registered equipment ${data.equipment_number} (${data.equipment_name}). Number source: ${numberSource}. Initial lifecycle status: draft. Initial use status: out_of_service.`);
      router.push(`/equipment/${data.id}`);
    } catch(e:any) {
      setSubmitError(e?.message || "Unable to register equipment.");
      setSubmitting(false);
    }
  };

  if (loading) return <main style={{minHeight:"100vh",background:"#f8fafc",padding:"24px",fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:"1180px",margin:"0 auto"}}><div style={cardStyle}>Loading Equipment Registration…</div></div>
  </main>;

  const sectionHeader = (title:string,subtitle:string) => <div style={{marginBottom:"18px"}}>
    <h2 style={{margin:0,fontSize:"20px",color:"#0f172a"}}>{title}</h2>
    <p style={{margin:"5px 0 0",color:"#64748b",fontSize:"14px"}}>{subtitle}</p>
  </div>;

  return <main style={{minHeight:"100vh",background:"#f8fafc",padding:"24px",fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:"1180px",margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"16px",flexWrap:"wrap",marginBottom:"20px"}}>
        <div>
          <div style={{color:"#64748b",fontSize:"12px",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>QualiSphere Equipment Management</div>
          <h1 style={{margin:0,fontSize:"34px",color:"#0f172a"}}>Register Equipment</h1>
          <p style={{color:"#475569",margin:"6px 0 0",maxWidth:"760px",lineHeight:1.5}}>
            Establish the controlled equipment master record. Registration does not release equipment for use.
          </p>
        </div>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
          <Link href="/equipment" style={secondaryButtonStyle}>Equipment Registry</Link>
          <Link href="/" style={secondaryButtonStyle}>Home</Link>
        </div>
      </div>

      {loadError ? <div style={{...cardStyle,borderColor:"#fecaca",background:"#fef2f2",color:"#991b1b",marginBottom:"16px"}}>
        <strong>Unable to load registration:</strong> {loadError}
      </div> : null}

      <div style={{...cardStyle,marginBottom:"16px",background:"#f8fbff"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"14px"}}>
          <div><div style={labelStyle}>Registration Status</div><strong style={{color:"#b45309"}}>Draft / Not Released</strong></div>
          <div><div style={labelStyle}>Initial Use Status</div><strong style={{color:"#b91c1c"}}>Out of Service</strong></div>
          <div><div style={labelStyle}>Registered By</div><strong>{currentUserEmail || "Authenticated user"}</strong></div>
        </div>
      </div>

      <section style={{...cardStyle,marginBottom:"16px"}}>
        {sectionHeader("1. Equipment Identification","Capture the permanent identity and ownership information for the equipment record.")}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:"16px"}}>
          <Field label="Numbering Method" required hint={
            strategy==="allow_both" ? "Customer Assigned or QualiSphere Generated may be selected." :
            strategy==="customer_assigned" ? "Configured for customer-assigned equipment numbers." :
            "Configured for QualiSphere-generated equipment numbers."
          }>
            <select value={numberSource} onChange={e=>setNumberSource(e.target.value as NumberSource)}
              disabled={strategy!=="allow_both"} style={inputStyle}>
              {strategy!=="qualisphere_generated" ? <option value="customer_assigned">Customer Assigned</option> : null}
              {strategy!=="customer_assigned" ? <option value="qualisphere_generated">QualiSphere Generated</option> : null}
            </select>
          </Field>
          <Field label="Equipment Number" required={numberSource==="customer_assigned"}
            hint={numberSource==="qualisphere_generated" ? `Assigned automatically on save. Current preview: ${generatedPreview}` : "Customer equipment numbers may be alphanumeric."}>
            <input value={numberSource==="qualisphere_generated" ? generatedPreview : equipmentNumber}
              onChange={e=>setEquipmentNumber(e.target.value)} disabled={numberSource==="qualisphere_generated"}
              placeholder="Equipment number" style={{...inputStyle,background:numberSource==="qualisphere_generated"?"#f1f5f9":"#fff"}} />
          </Field>
          <Field label="Equipment Name" required><input value={equipmentName} onChange={e=>setEquipmentName(e.target.value)} placeholder="Equipment name" style={inputStyle}/></Field>
          <Field label="Equipment Type"><input value={equipmentType} onChange={e=>setEquipmentType(e.target.value)} placeholder="e.g., Temperature Chamber" style={inputStyle}/></Field>
          <Field label="Manufacturer"><input value={manufacturer} onChange={e=>setManufacturer(e.target.value)} placeholder="Manufacturer" style={inputStyle}/></Field>
          <Field label="Model Number"><input value={modelNumber} onChange={e=>setModelNumber(e.target.value)} placeholder="Model number" style={inputStyle}/></Field>
          <Field label="Serial Number"><input value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} placeholder="Serial number" style={inputStyle}/></Field>
          <Field label="Asset Number"><input value={assetNumber} onChange={e=>setAssetNumber(e.target.value)} placeholder="Internal asset number" style={inputStyle}/></Field>
          <Field label="Department"><input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Responsible department" style={inputStyle}/></Field>
          <Field label="Site / Location"><input value={siteLocation} onChange={e=>setSiteLocation(e.target.value)} placeholder="Building, room, line, or area" style={inputStyle}/></Field>
          <Field label="Equipment Owner"><input type="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} placeholder="owner@company.com" style={inputStyle}/></Field>
        </div>
        <div style={{marginTop:"16px"}}><Field label="Description / Intended Use">
          <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the equipment and its intended use." rows={4} style={{...inputStyle,resize:"vertical"}}/>
        </Field></div>
      </section>

      <section style={{...cardStyle,marginBottom:"16px"}}>
        {sectionHeader("2. Equipment Specification Reference","Reference the approved equipment specification. Requirements are controlled in the specification document, not recreated here.")}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"16px"}}>
          <Field label="Specification Document Number" hint="The controlled-document link can be established from the Equipment Master workflow.">
            <input value={specificationDocumentNumber} onChange={e=>setSpecificationDocumentNumber(e.target.value)} placeholder="e.g., ES-000123" style={inputStyle}/>
          </Field>
          <Field label="Specification Revision"><input value={specificationRevision} onChange={e=>setSpecificationRevision(e.target.value)} placeholder="Revision" style={inputStyle}/></Field>
        </div>
      </section>

      <section style={{...cardStyle,marginBottom:"16px"}}>
        {sectionHeader("3. Lifecycle Requirements","Identify which controlled lifecycle activities apply to this equipment.")}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"12px"}}>
          <ToggleCard title="Calibration Required" description="Equipment requires controlled calibration activities." checked={calibrationRequired} onChange={setCalibrationRequired}/>
          <ToggleCard title="Preventive Maintenance Required" description="Equipment requires recurring preventive maintenance." checked={preventiveMaintenanceRequired} onChange={setPreventiveMaintenanceRequired}/>
          <ToggleCard title="Qualification Required" description="Equipment requires qualification before release for use." checked={qualificationRequired} onChange={setQualificationRequired}/>
        </div>
      </section>

      <section style={{...cardStyle,marginBottom:"16px"}}>
        {sectionHeader("4. Post-Unplanned-Maintenance Assessment","Configure whether the lean calibration/requalification assessment is required after unplanned maintenance.")}
        <Field label="Assessment Setting">
          <select value={postAssessment} onChange={e=>setPostAssessment(e.target.value as "required"|"optional"|"disabled")} style={{...inputStyle,maxWidth:"520px"}}>
            <option value="optional">Optional</option>
            <option value="required">Required</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
      </section>

      {submitError ? <div style={{border:"1px solid #fecaca",background:"#fef2f2",color:"#991b1b",borderRadius:"10px",padding:"12px 14px",marginBottom:"16px"}}>
        <strong>Registration cannot be completed:</strong> {submitError}
      </div> : null}

      <div style={{...cardStyle,display:"flex",justifyContent:"space-between",gap:"12px",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{color:"#64748b",fontSize:"13px",maxWidth:"650px"}}>
          New equipment remains <strong>Out of Service</strong> until applicable specification, calibration, qualification, and release requirements are completed.
        </div>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
          <Link href="/equipment" style={secondaryButtonStyle}>Cancel</Link>
          <button type="button" onClick={registerEquipment} disabled={submitting || !!loadError}
            style={{...primaryButtonStyle,opacity:submitting||loadError?0.6:1,cursor:submitting||loadError?"not-allowed":"pointer"}}>
            {submitting ? "Registering…" : "Register Equipment"}
          </button>
        </div>
      </div>
    </div>
  </main>;
}
