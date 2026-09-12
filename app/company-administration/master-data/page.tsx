"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type SimpleItem = { id: string; code: string; label: string };
type ProductPartItem = { id: string; code: string; label: string; part_description: string | null; is_active: boolean | null };
type DefectSubcategoryItem = { id: string; category_code: string; code: string; label: string };
type RoomItem = { id: string; code: string; label: string; room_type: string | null; is_active: boolean | null };
type EquipmentItem = { id: string; equipment_id: string; equipment_name: string; equipment_type: string | null; room_code: string | null; is_active: boolean | null };
type TestMethodItem = { id: string; code: string; label: string; investigation_source: string | null; default_unit: string | null; is_active: boolean | null };
type OosLimitItem = { id: string; investigation_source: string; test_method_code: string; room_code: string | null; equipment_id: string | null; alert_limit: string | null; action_limit: string | null; specification_limit: string | null; unit_of_measure: string | null; is_active: boolean | null };

export default function CompanyMasterDataPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");

  const [partNumbers, setPartNumbers] = useState<ProductPartItem[]>([]);
  const [dispositions, setDispositions] = useState<SimpleItem[]>([]);
  const [detectionSources, setDetectionSources] = useState<SimpleItem[]>([]);
  const [departments, setDepartments] = useState<SimpleItem[]>([]);
  const [materialStatuses, setMaterialStatuses] = useState<SimpleItem[]>([]);
  const [defectCategories, setDefectCategories] = useState<SimpleItem[]>([]);
  const [defectSubcategories, setDefectSubcategories] = useState<DefectSubcategoryItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [testMethods, setTestMethods] = useState<TestMethodItem[]>([]);
  const [oosLimits, setOosLimits] = useState<OosLimitItem[]>([]);

  const [newPartCode, setNewPartCode] = useState("");
  const [newPartDescription, setNewPartDescription] = useState("");
  const [newPartIsActive, setNewPartIsActive] = useState(true);
  const [newDispositionCode, setNewDispositionCode] = useState("");
  const [newDispositionLabel, setNewDispositionLabel] = useState("");
  const [newDetectionCode, setNewDetectionCode] = useState("");
  const [newDetectionLabel, setNewDetectionLabel] = useState("");
  const [newDepartmentCode, setNewDepartmentCode] = useState("");
  const [newDepartmentLabel, setNewDepartmentLabel] = useState("");
  const [newMaterialCode, setNewMaterialCode] = useState("");
  const [newMaterialLabel, setNewMaterialLabel] = useState("");
  const [newDefectCategoryCode, setNewDefectCategoryCode] = useState("");
  const [newDefectCategoryLabel, setNewDefectCategoryLabel] = useState("");
  const [newDefectSubcategoryCategoryCode, setNewDefectSubcategoryCategoryCode] = useState("");
  const [newDefectSubcategoryCode, setNewDefectSubcategoryCode] = useState("");
  const [newDefectSubcategoryLabel, setNewDefectSubcategoryLabel] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [newRoomLabel, setNewRoomLabel] = useState("");
  const [newRoomType, setNewRoomType] = useState("");
  const [newEquipmentId, setNewEquipmentId] = useState("");
  const [newEquipmentName, setNewEquipmentName] = useState("");
  const [newEquipmentType, setNewEquipmentType] = useState("");
  const [newEquipmentRoomCode, setNewEquipmentRoomCode] = useState("");
  const [newMethodCode, setNewMethodCode] = useState("");
  const [newMethodLabel, setNewMethodLabel] = useState("");
  const [newMethodSource, setNewMethodSource] = useState("Product Bioburden");
  const [newMethodUnit, setNewMethodUnit] = useState("");
  const [newLimitSource, setNewLimitSource] = useState("Product Bioburden");
  const [newLimitMethodCode, setNewLimitMethodCode] = useState("");
  const [newLimitRoomCode, setNewLimitRoomCode] = useState("");
  const [newLimitEquipmentId, setNewLimitEquipmentId] = useState("");
  const [newAlertLimit, setNewAlertLimit] = useState("");
  const [newActionLimit, setNewActionLimit] = useState("");
  const [newSpecificationLimit, setNewSpecificationLimit] = useState("");
  const [newLimitUnit, setNewLimitUnit] = useState("");

  const investigationSources = [
    "Product Bioburden",
    "Cleanroom Routine Monitoring",
    "Room Temperature",
    "Room Humidity",
    "Differential Pressure",
    "pH Testing",
    "Equipment Calibration",
    "Other",
  ];

  const loadAll = async (activeTenantId: string) => {
    const [partRes, dispositionRes, detectionRes, departmentRes, materialRes, defectCategoryRes, defectSubcategoryRes, roomRes, equipmentRes, methodRes, limitRes] = await Promise.all([
      supabase.from("md_product_part_numbers").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_dispositions").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_detection_sources").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_departments").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_material_statuses").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_defect_categories").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_defect_subcategories").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_rooms").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_equipment").select("*").eq("tenant_id", activeTenantId).order("equipment_name"),
      supabase.from("md_test_methods").select("*").eq("tenant_id", activeTenantId).order("label"),
      supabase.from("md_oos_limits").select("*").eq("tenant_id", activeTenantId).order("investigation_source"),
    ]);

    const responses = [partRes, dispositionRes, detectionRes, departmentRes, materialRes, defectCategoryRes, defectSubcategoryRes, roomRes, equipmentRes, methodRes, limitRes];
    const firstError = responses.find((response) => response.error)?.error;
    if (firstError) throw new Error(firstError.message);

    setPartNumbers((partRes.data as ProductPartItem[]) || []);
    setDispositions((dispositionRes.data as SimpleItem[]) || []);
    setDetectionSources((detectionRes.data as SimpleItem[]) || []);
    setDepartments((departmentRes.data as SimpleItem[]) || []);
    setMaterialStatuses((materialRes.data as SimpleItem[]) || []);
    setDefectCategories((defectCategoryRes.data as SimpleItem[]) || []);
    setDefectSubcategories((defectSubcategoryRes.data as DefectSubcategoryItem[]) || []);
    setRooms((roomRes.data as RoomItem[]) || []);
    setEquipment((equipmentRes.data as EquipmentItem[]) || []);
    setTestMethods((methodRes.data as TestMethodItem[]) || []);
    setOosLimits((limitRes.data as OosLimitItem[]) || []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const userEmail = String(userData?.user?.email || "").trim().toLowerCase();
        setEmail(userEmail);
        if (!userEmail) return;

        const storedTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";
        if (!storedTenantId) return;

        const { data: membership, error: membershipError } = await supabase
          .from("tenant_memberships")
          .select("tenant_id,membership_role,membership_status,tenants(company_name)")
          .eq("tenant_id", storedTenantId)
          .ilike("user_email", userEmail)
          .eq("membership_status", "active")
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) return;

        const { data: isCompanyAdmin, error: adminError } = await supabase.rpc("qualisphere_is_company_admin", { p_tenant_id: storedTenantId });
        if (adminError) throw adminError;
        if (isCompanyAdmin !== true) return;

        const tenant = Array.isArray((membership as any).tenants) ? (membership as any).tenants[0] : (membership as any).tenants;
        setTenantId(storedTenantId);
        setCompanyName(String(tenant?.company_name || window.localStorage.getItem("qualisphere_active_tenant_name") || "Company Account"));
        setAuthorized(true);
        await loadAll(storedTenantId);
      } catch (error: any) {
        setMessage(error?.message || "Unable to load Company Administration.");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const refresh = async () => {
    if (!tenantId) return;
    await loadAll(tenantId);
  };

  const insertSimple = async (table: string, code: string, label: string, reset: () => void) => {
    if (!code.trim() || !label.trim()) return setMessage("Code and label are required.");
    const { error } = await supabase.from(table).insert({ tenant_id: tenantId, code: code.trim(), label: label.trim() });
    if (error) return setMessage(error.message);
    reset();
    setMessage("Master Data updated successfully.");
    await refresh();
  };

  const deleteRow = async (table: string, id: string) => {
    if (!window.confirm("Delete this Company Account Master Data item?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id).eq("tenant_id", tenantId);
    if (error) return setMessage(error.message);
    setMessage("Master Data updated successfully.");
    await refresh();
  };

  const insertProductPart = async () => {
    const partNumber = newPartCode.trim();
    const partDescription = newPartDescription.trim();
    if (!partNumber || !partDescription) return setMessage("Part Number and Part Description are required.");
    const { error } = await supabase.from("md_product_part_numbers").insert({ tenant_id: tenantId, code: partNumber, label: partNumber, part_description: partDescription, is_active: newPartIsActive });
    if (error) return setMessage(error.message);
    setNewPartCode(""); setNewPartDescription(""); setNewPartIsActive(true); setMessage("Product Part Master updated successfully."); await refresh();
  };

  const updateProductPart = async (item: ProductPartItem) => {
    const { error } = await supabase.from("md_product_part_numbers").update({ code: item.code.trim(), label: item.code.trim(), part_description: String(item.part_description || "").trim(), is_active: item.is_active !== false }).eq("id", item.id).eq("tenant_id", tenantId);
    if (error) return setMessage(error.message);
    setMessage("Product Part Master updated successfully."); await refresh();
  };

  const insertDefectSubcategory = async () => {
    if (!newDefectSubcategoryCategoryCode || !newDefectSubcategoryCode.trim() || !newDefectSubcategoryLabel.trim()) return setMessage("Category, code, and label are required.");
    const { error } = await supabase.from("md_defect_subcategories").insert({ tenant_id: tenantId, category_code: newDefectSubcategoryCategoryCode, code: newDefectSubcategoryCode.trim(), label: newDefectSubcategoryLabel.trim() });
    if (error) return setMessage(error.message);
    setNewDefectSubcategoryCategoryCode(""); setNewDefectSubcategoryCode(""); setNewDefectSubcategoryLabel(""); setMessage("Defect Subcategories updated successfully."); await refresh();
  };

  const insertRoom = async () => {
    if (!newRoomCode.trim() || !newRoomLabel.trim()) return setMessage("Room code and label are required.");
    const { error } = await supabase.from("md_rooms").insert({ tenant_id: tenantId, code: newRoomCode.trim(), label: newRoomLabel.trim(), room_type: newRoomType.trim() || null, is_active: true });
    if (error) return setMessage(error.message);
    setNewRoomCode(""); setNewRoomLabel(""); setNewRoomType(""); setMessage("Rooms / Areas updated successfully."); await refresh();
  };

  const insertEquipment = async () => {
    if (!newEquipmentId.trim() || !newEquipmentName.trim()) return setMessage("Equipment ID and equipment name are required.");
    const { error } = await supabase.from("md_equipment").insert({ tenant_id: tenantId, equipment_id: newEquipmentId.trim(), equipment_name: newEquipmentName.trim(), equipment_type: newEquipmentType.trim() || null, room_code: newEquipmentRoomCode || null, is_active: true });
    if (error) return setMessage(error.message);
    setNewEquipmentId(""); setNewEquipmentName(""); setNewEquipmentType(""); setNewEquipmentRoomCode(""); setMessage("Equipment updated successfully."); await refresh();
  };

  const insertTestMethod = async () => {
    if (!newMethodCode.trim() || !newMethodLabel.trim()) return setMessage("Method code and label are required.");
    const { error } = await supabase.from("md_test_methods").insert({ tenant_id: tenantId, code: newMethodCode.trim(), label: newMethodLabel.trim(), investigation_source: newMethodSource || null, default_unit: newMethodUnit.trim() || null, is_active: true });
    if (error) return setMessage(error.message);
    setNewMethodCode(""); setNewMethodLabel(""); setNewMethodSource("Product Bioburden"); setNewMethodUnit(""); setMessage("Test Methods updated successfully."); await refresh();
  };

  const insertOosLimit = async () => {
    if (!newLimitSource || !newLimitMethodCode) return setMessage("Investigation source and test method are required.");
    if (!newAlertLimit && !newActionLimit && !newSpecificationLimit) return setMessage("At least one limit is required.");
    const selectedMethod = testMethods.find((method) => method.code === newLimitMethodCode);
    const { error } = await supabase.from("md_oos_limits").insert({ tenant_id: tenantId, investigation_source: newLimitSource, test_method_code: newLimitMethodCode, room_code: newLimitRoomCode || null, equipment_id: newLimitEquipmentId || null, alert_limit: newAlertLimit || null, action_limit: newActionLimit || null, specification_limit: newSpecificationLimit || null, unit_of_measure: newLimitUnit || selectedMethod?.default_unit || null, is_active: true });
    if (error) return setMessage(error.message);
    setNewLimitSource("Product Bioburden"); setNewLimitMethodCode(""); setNewLimitRoomCode(""); setNewLimitEquipmentId(""); setNewAlertLimit(""); setNewActionLimit(""); setNewSpecificationLimit(""); setNewLimitUnit(""); setMessage("OOS/OOT Limits updated successfully."); await refresh();
  };

  const sectionStyle: React.CSSProperties = { border: "1px solid #ccc", padding: 16, marginBottom: 20, borderRadius: 8 };
  const inputStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8 };
  const selectStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8, minWidth: 180 };

  if (loading) return <main style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>Loading Company Administration...</main>;

  if (!authorized) {
    return (
      <main style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
        <h1>Access Denied</h1>
        <p>Only a Company Administrator for the active Company Account can access Admin Master Data.</p>
        <p><strong>Logged-in Email:</strong> {email || "none"}</p>
        {message ? <p style={{ color: "#b45309" }}>{message}</p> : null}
        <Link href="/workspace">Back to My Workspace</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Admin Master Data</h1>
          <p><strong>Company Account:</strong> {companyName}</p>
          <p><strong>Company Administrator:</strong> {email}</p>
        </div>
        <Link href="/workspace" style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>Back to My Workspace</Link>
      </div>

      <div style={{ padding: 14, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, margin: "18px 0" }}>
        QualiSphere starter Master Data was provisioned from the controlled baseline when this Company Account was created. Changes made here belong only to <strong>{companyName}</strong>.
      </div>
      {message ? <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 18 }}>{message}</div> : null}

      <div style={sectionStyle}>
        <h2>Product Part Master</h2>
        <p style={{ color: "#4b5563" }}>Maintain the controlled Part Number and Part Description used to auto-populate product information across QualiSphere workflows.</p>
        <input value={newPartCode} onChange={(e) => setNewPartCode(e.target.value)} placeholder="Part Number" style={inputStyle} />
        <input value={newPartDescription} onChange={(e) => setNewPartDescription(e.target.value)} placeholder="Part Description" style={{ ...inputStyle, minWidth: 320 }} />
        <select value={newPartIsActive ? "active" : "inactive"} onChange={(e) => setNewPartIsActive(e.target.value === "active")} style={selectStyle}><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <button onClick={insertProductPart}>Add Product Part</button>
        <div style={{ overflowX: "auto", marginTop: 16 }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th align="left">Part Number</th><th align="left">Part Description</th><th align="left">Status</th><th align="left">Actions</th></tr></thead><tbody>{partNumbers.map((item) => <tr key={item.id}><td><input value={item.code || ""} onChange={(e) => setPartNumbers((current) => current.map((part) => part.id === item.id ? { ...part, code: e.target.value, label: e.target.value } : part))} style={inputStyle} /></td><td><input value={item.part_description || ""} onChange={(e) => setPartNumbers((current) => current.map((part) => part.id === item.id ? { ...part, part_description: e.target.value } : part))} style={{ ...inputStyle, minWidth: 320 }} /></td><td><select value={item.is_active === false ? "inactive" : "active"} onChange={(e) => setPartNumbers((current) => current.map((part) => part.id === item.id ? { ...part, is_active: e.target.value === "active" } : part))} style={selectStyle}><option value="active">Active</option><option value="inactive">Inactive</option></select></td><td><button onClick={() => updateProductPart(item)} style={{ marginRight: 8 }}>Save</button><button onClick={() => deleteRow("md_product_part_numbers", item.id)}>Delete</button></td></tr>)}</tbody></table></div>
      </div>

      <div style={sectionStyle}><h2>Dispositions</h2><input value={newDispositionCode} onChange={(e) => setNewDispositionCode(e.target.value)} placeholder="Code" style={inputStyle} /><input value={newDispositionLabel} onChange={(e) => setNewDispositionLabel(e.target.value)} placeholder="Label" style={inputStyle} /><button onClick={() => insertSimple("md_dispositions", newDispositionCode, newDispositionLabel, () => { setNewDispositionCode(""); setNewDispositionLabel(""); })}>Add</button><ul>{dispositions.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteRow("md_dispositions", item.id)}>Delete</button></li>)}</ul></div>
      <div style={sectionStyle}><h2>Detection Sources</h2><input value={newDetectionCode} onChange={(e) => setNewDetectionCode(e.target.value)} placeholder="Code" style={inputStyle} /><input value={newDetectionLabel} onChange={(e) => setNewDetectionLabel(e.target.value)} placeholder="Label" style={inputStyle} /><button onClick={() => insertSimple("md_detection_sources", newDetectionCode, newDetectionLabel, () => { setNewDetectionCode(""); setNewDetectionLabel(""); })}>Add</button><ul>{detectionSources.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteRow("md_detection_sources", item.id)}>Delete</button></li>)}</ul></div>
      <div style={sectionStyle}><h2>Departments</h2><input value={newDepartmentCode} onChange={(e) => setNewDepartmentCode(e.target.value)} placeholder="Code" style={inputStyle} /><input value={newDepartmentLabel} onChange={(e) => setNewDepartmentLabel(e.target.value)} placeholder="Label" style={inputStyle} /><button onClick={() => insertSimple("md_departments", newDepartmentCode, newDepartmentLabel, () => { setNewDepartmentCode(""); setNewDepartmentLabel(""); })}>Add</button><ul>{departments.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteRow("md_departments", item.id)}>Delete</button></li>)}</ul></div>
      <div style={sectionStyle}><h2>Material Statuses</h2><input value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Code" style={inputStyle} /><input value={newMaterialLabel} onChange={(e) => setNewMaterialLabel(e.target.value)} placeholder="Label" style={inputStyle} /><button onClick={() => insertSimple("md_material_statuses", newMaterialCode, newMaterialLabel, () => { setNewMaterialCode(""); setNewMaterialLabel(""); })}>Add</button><ul>{materialStatuses.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteRow("md_material_statuses", item.id)}>Delete</button></li>)}</ul></div>
      <div style={sectionStyle}><h2>Defect Categories</h2><input value={newDefectCategoryCode} onChange={(e) => setNewDefectCategoryCode(e.target.value)} placeholder="Code" style={inputStyle} /><input value={newDefectCategoryLabel} onChange={(e) => setNewDefectCategoryLabel(e.target.value)} placeholder="Label" style={inputStyle} /><button onClick={() => insertSimple("md_defect_categories", newDefectCategoryCode, newDefectCategoryLabel, () => { setNewDefectCategoryCode(""); setNewDefectCategoryLabel(""); })}>Add</button><ul>{defectCategories.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteRow("md_defect_categories", item.id)}>Delete</button></li>)}</ul></div>

      <div style={sectionStyle}><h2>Defect Subcategories</h2><select value={newDefectSubcategoryCategoryCode} onChange={(e) => setNewDefectSubcategoryCategoryCode(e.target.value)} style={selectStyle}><option value="">Select category</option>{defectCategories.map((item) => <option key={item.id} value={item.code}>{item.label}</option>)}</select><input value={newDefectSubcategoryCode} onChange={(e) => setNewDefectSubcategoryCode(e.target.value)} placeholder="Code" style={inputStyle} /><input value={newDefectSubcategoryLabel} onChange={(e) => setNewDefectSubcategoryLabel(e.target.value)} placeholder="Label" style={inputStyle} /><button onClick={insertDefectSubcategory}>Add</button><ul>{defectSubcategories.map((item) => <li key={item.id}>{item.category_code} — {item.code} — {item.label} <button onClick={() => deleteRow("md_defect_subcategories", item.id)}>Delete</button></li>)}</ul></div>

      <div style={sectionStyle}><h2>OOS/OOT Rooms / Areas</h2><input value={newRoomCode} onChange={(e) => setNewRoomCode(e.target.value)} placeholder="Room code, e.g. CR-001" style={inputStyle} /><input value={newRoomLabel} onChange={(e) => setNewRoomLabel(e.target.value)} placeholder="Room label" style={inputStyle} /><input value={newRoomType} onChange={(e) => setNewRoomType(e.target.value)} placeholder="Room type, e.g. ISO 8" style={inputStyle} /><button onClick={insertRoom}>Add Room</button><ul>{rooms.map((item) => <li key={item.id}>{item.code} — {item.label} — {item.room_type || "N/A"} <button onClick={() => deleteRow("md_rooms", item.id)}>Delete</button></li>)}</ul></div>

      <div style={sectionStyle}><h2>OOS/OOT Equipment</h2><input value={newEquipmentId} onChange={(e) => setNewEquipmentId(e.target.value)} placeholder="Equipment ID" style={inputStyle} /><input value={newEquipmentName} onChange={(e) => setNewEquipmentName(e.target.value)} placeholder="Equipment name" style={inputStyle} /><input value={newEquipmentType} onChange={(e) => setNewEquipmentType(e.target.value)} placeholder="Equipment type" style={inputStyle} /><select value={newEquipmentRoomCode} onChange={(e) => setNewEquipmentRoomCode(e.target.value)} style={selectStyle}><option value="">Select room</option>{rooms.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.label}</option>)}</select><button onClick={insertEquipment}>Add Equipment</button><ul>{equipment.map((item) => <li key={item.id}>{item.equipment_id} — {item.equipment_name} — {item.equipment_type || "N/A"} — Room: {item.room_code || "N/A"} <button onClick={() => deleteRow("md_equipment", item.id)}>Delete</button></li>)}</ul></div>

      <div style={sectionStyle}><h2>OOS/OOT Test Methods</h2><input value={newMethodCode} onChange={(e) => setNewMethodCode(e.target.value)} placeholder="Method code" style={inputStyle} /><input value={newMethodLabel} onChange={(e) => setNewMethodLabel(e.target.value)} placeholder="Method label" style={inputStyle} /><select value={newMethodSource} onChange={(e) => setNewMethodSource(e.target.value)} style={selectStyle}>{investigationSources.map((source) => <option key={source} value={source}>{source}</option>)}</select><input value={newMethodUnit} onChange={(e) => setNewMethodUnit(e.target.value)} placeholder="Default unit, e.g. CFU/device" style={inputStyle} /><button onClick={insertTestMethod}>Add Test Method</button><ul>{testMethods.map((item) => <li key={item.id}>{item.code} — {item.label} — Source: {item.investigation_source || "N/A"} — Unit: {item.default_unit || "N/A"} <button onClick={() => deleteRow("md_test_methods", item.id)}>Delete</button></li>)}</ul></div>

      <div style={sectionStyle}><h2>OOS/OOT Limits</h2><select value={newLimitSource} onChange={(e) => setNewLimitSource(e.target.value)} style={selectStyle}>{investigationSources.map((source) => <option key={source} value={source}>{source}</option>)}</select><select value={newLimitMethodCode} onChange={(e) => { const methodCode = e.target.value; setNewLimitMethodCode(methodCode); const selectedMethod = testMethods.find((method) => method.code === methodCode); if (selectedMethod?.default_unit) setNewLimitUnit(selectedMethod.default_unit); }} style={selectStyle}><option value="">Select method</option>{testMethods.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.label}</option>)}</select><select value={newLimitRoomCode} onChange={(e) => setNewLimitRoomCode(e.target.value)} style={selectStyle}><option value="">Room optional</option>{rooms.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.label}</option>)}</select><select value={newLimitEquipmentId} onChange={(e) => setNewLimitEquipmentId(e.target.value)} style={selectStyle}><option value="">Equipment optional</option>{equipment.map((item) => <option key={item.id} value={item.equipment_id}>{item.equipment_id} — {item.equipment_name}</option>)}</select><input value={newAlertLimit} onChange={(e) => setNewAlertLimit(e.target.value)} placeholder="Alert limit" style={inputStyle} /><input value={newActionLimit} onChange={(e) => setNewActionLimit(e.target.value)} placeholder="Action limit" style={inputStyle} /><input value={newSpecificationLimit} onChange={(e) => setNewSpecificationLimit(e.target.value)} placeholder="Specification limit" style={inputStyle} /><input value={newLimitUnit} onChange={(e) => setNewLimitUnit(e.target.value)} placeholder="Unit" style={inputStyle} /><button onClick={insertOosLimit}>Add Limit</button><ul>{oosLimits.map((item) => <li key={item.id}>{item.investigation_source} — Method: {item.test_method_code} — Room: {item.room_code || "Any"} — Equipment: {item.equipment_id || "Any"} — Alert: {item.alert_limit || "N/A"} — Action: {item.action_limit || "N/A"} — Spec: {item.specification_limit || "N/A"} — Unit: {item.unit_of_measure || "N/A"} <button onClick={() => deleteRow("md_oos_limits", item.id)}>Delete</button></li>)}</ul></div>

      <div style={{ marginTop: 20 }}><Link href="/workspace">Back to My Workspace</Link></div>
    </main>
  );
}
