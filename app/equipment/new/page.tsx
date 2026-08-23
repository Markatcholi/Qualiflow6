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

function formatLifecyclePhase(value:string) {
  const labels:Record<string,string> = {
    planning:"Planning", acquisition:"Acquisition",
    operation_maintenance:"Operation & Maintenance", retirement:"Retirement",
  };
  return labels[value] || value;
}


function formatEquipmentStatus(value:string) {
  const labels:Record<string,string> = {
    pending_installation:"Pending Installation", pending_calibration:"Pending Calibration",
    pending_qualification:"Pending Qualification", pending_maintenance:"Pending Maintenance",
    pending_production_release:"Pending Production Release", active:"Active", retired:"Retired",
  };
  return labels[value] || value;
}

function formatEquipmentUseStatus(value:string) {
  const labels:Record<string,string> = {
    available_for_use:"Active / Available for Use",
    restricted:"Restricted",
    out_of_service:"Out of Service",
    retired:"Retired",
  };
  return labels[value] || value;
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
  const [lifecyclePhase,setLifecyclePhase] = useState("acquisition");
  const [equipmentStatus,setEquipmentStatus] = useState("pending_installation");
  const [useStatus,setUseStatus] = useState("out_of_service");
  const [useStatusReason,setUseStatusReason] = useState("");
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
        lifecycle_phase:lifecyclePhase,
        equipment_status:equipmentStatus,
        lifecycle_status:
          lifecyclePhase === "retirement" ? "retired" :
          equipmentStatus === "pending_calibration" ? "initial_calibration" :
          equipmentStatus === "pending_qualification" ? "qualification" :
          equipmentStatus === "pending_production_release" ? "pending_production_release" :
          equipmentStatus === "active" ? "released" : "draft",
        use_status:useStatus,
        use_status_reason:useStatusReason.trim() || null,
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
          <div><div style={labelStyle}>Lifecycle Phase</div><strong>{formatLifecyclePhase(lifecyclePhase)}</strong></div>
          <div><div style={labelStyle}>Equipment Status</div><strong>{formatEquipmentStatus(equipmentStatus)}</strong></div>
          <div><div style={labelStyle}>Use Status</div><strong>{formatEquipmentUseStatus(useStatus)}</strong></div>
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
        {sectionHeader("3. Equipment Lifecycle & Status","Record the asset lifecycle phase, current equipment status, and current use status. These are separate controls.")}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:"16px"}}>
          <Field label="Lifecycle Phase" required hint="Overall asset lifecycle: Planning → Acquisition → Operation & Maintenance → Retirement.">
            <select value={lifecyclePhase} onChange={e=>{
              const next=e.target.value; setLifecyclePhase(next);
              if(next==="retirement"){setEquipmentStatus("retired");setUseStatus("retired");}
            }} style={inputStyle}>
              <option value="planning">Planning</option>
              <option value="acquisition">Acquisition</option>
              <option value="operation_maintenance">Operation & Maintenance</option>
              <option value="retirement">Retirement</option>
            </select>
          </Field>
          <Field label="Equipment Status" required hint="Current workflow/readiness status within the lifecycle phase.">
            <select value={equipmentStatus} onChange={e=>{
              const next=e.target.value; setEquipmentStatus(next);
              if(next==="active" && lifecyclePhase!=="retirement") setLifecyclePhase("operation_maintenance");
              if(next==="retired"){setLifecyclePhase("retirement");setUseStatus("retired");}
            }} style={inputStyle}>
              <option value="pending_installation">Pending Installation</option>
              <option value="pending_calibration">Pending Calibration</option>
              <option value="pending_qualification">Pending Qualification</option>
              <option value="pending_maintenance">Pending Maintenance</option>
              <option value="pending_production_release">Pending Production Release</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </Field>
          <Field label="Use Status" required hint="Whether the equipment may currently be used.">
            <select value={useStatus} onChange={e=>{
              const next=e.target.value; setUseStatus(next);
              if(next==="retired"){setLifecyclePhase("retirement");setEquipmentStatus("retired");}
            }} style={inputStyle}>
              <option value="available_for_use">Available for Use</option>
              <option value="restricted">Restricted</option>
              <option value="out_of_service">Out of Service</option>
              <option value="retired">Retired</option>
            </select>
          </Field>
        </div>
        <div style={{marginTop:"16px"}}>
          <Field label="Status Rationale / Notes" hint="Optional context for the current status.">
            <textarea rows={3} value={useStatusReason} onChange={e=>setUseStatusReason(e.target.value)} placeholder="Optional status rationale or notes" style={{...inputStyle,resize:"vertical"}} />
          </Field>
        </div>
      </section>

      <section style={{...cardStyle,marginBottom:"16px"}}>
        {sectionHeader("4. Lifecycle Requirements","Identify which controlled lifecycle activities apply to this equipment.")}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"12px"}}>
          <ToggleCard title="Calibration Required" description="Equipment requires controlled calibration activities." checked={calibrationRequired} onChange={setCalibrationRequired}/>
          <ToggleCard title="Preventive Maintenance Required" description="Equipment requires recurring preventive maintenance." checked={preventiveMaintenanceRequired} onChange={setPreventiveMaintenanceRequired}/>
          <ToggleCard title="Qualification Required" description="Equipment requires qualification before release for use." checked={qualificationRequired} onChange={setQualificationRequired}/>
        </div>
      </section>

      <section style={{...cardStyle,marginBottom:"16px"}}>
        {sectionHeader("5. Post-Unplanned-Maintenance Assessment","Configure whether the lean calibration/requalification assessment is required after unplanned maintenance.")}
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
          Equipment status is customer-controlled. For new equipment, use the lifecycle and use-status selections required by the customer's QMS; existing equipment may be registered in its current approved state.
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
