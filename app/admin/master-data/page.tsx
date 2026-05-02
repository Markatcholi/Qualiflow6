"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type SimpleItem = {
  id: string;
  code: string;
  label: string;
};

type DefectSubcategoryItem = {
  id: string;
  category_code: string;
  code: string;
  label: string;
};

type RoomItem = {
  id: string;
  code: string;
  label: string;
  room_type: string | null;
  is_active: boolean | null;
};

type EquipmentItem = {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string | null;
  room_code: string | null;
  is_active: boolean | null;
};

type TestMethodItem = {
  id: string;
  code: string;
  label: string;
  investigation_source: string | null;
  default_unit: string | null;
  is_active: boolean | null;
};

type OosLimitItem = {
  id: string;
  investigation_source: string;
  test_method_code: string;
  room_code: string | null;
  equipment_id: string | null;
  alert_limit: string | null;
  action_limit: string | null;
  specification_limit: string | null;
  unit_of_measure: string | null;
  is_active: boolean | null;
};

export default function MasterDataPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [partNumbers, setPartNumbers] = useState<SimpleItem[]>([]);
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
  const [newPartLabel, setNewPartLabel] = useState("");

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

  const fetchUserRole = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setLoading(false);
      return;
    }

    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setUserRole("");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUserRole(data?.role || "");
    setLoading(false);
  };

  const fetchAll = async () => {
    const [
      partRes,
      dispositionRes,
      detectionRes,
      departmentRes,
      materialRes,
      defectCategoryRes,
      defectSubcategoryRes,
      roomRes,
      equipmentRes,
      methodRes,
      limitRes,
    ] = await Promise.all([
      supabase.from("md_product_part_numbers").select("*").order("label"),
      supabase.from("md_dispositions").select("*").order("label"),
      supabase.from("md_detection_sources").select("*").order("label"),
      supabase.from("md_departments").select("*").order("label"),
      supabase.from("md_material_statuses").select("*").order("label"),
      supabase.from("md_defect_categories").select("*").order("label"),
      supabase.from("md_defect_subcategories").select("*").order("label"),
      supabase.from("md_rooms").select("*").order("label"),
      supabase.from("md_equipment").select("*").order("equipment_name"),
      supabase.from("md_test_methods").select("*").order("label"),
      supabase.from("md_oos_limits").select("*").order("investigation_source"),
    ]);

    if (partRes.error) return alert(partRes.error.message);
    if (dispositionRes.error) return alert(dispositionRes.error.message);
    if (detectionRes.error) return alert(detectionRes.error.message);
    if (departmentRes.error) return alert(departmentRes.error.message);
    if (materialRes.error) return alert(materialRes.error.message);
    if (defectCategoryRes.error) return alert(defectCategoryRes.error.message);
    if (defectSubcategoryRes.error) return alert(defectSubcategoryRes.error.message);
    if (roomRes.error) return alert(roomRes.error.message);
    if (equipmentRes.error) return alert(equipmentRes.error.message);
    if (methodRes.error) return alert(methodRes.error.message);
    if (limitRes.error) return alert(limitRes.error.message);

    setPartNumbers((partRes.data as SimpleItem[]) || []);
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
    fetchUserRole();
    fetchAll();
  }, []);

  const insertSimple = async (table: string, code: string, label: string, reset: () => void) => {
    if (!code || !label) {
      alert("Code and label are required.");
      return;
    }

    const { error } = await supabase.from(table).insert({ code, label });

    if (error) {
      alert(error.message);
      return;
    }

    reset();
    fetchAll();
  };

  const deleteSimple = async (table: string, id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchAll();
  };

  const insertDefectSubcategory = async () => {
    if (!newDefectSubcategoryCategoryCode || !newDefectSubcategoryCode || !newDefectSubcategoryLabel) {
      alert("Category, code, and label are required.");
      return;
    }

    const { error } = await supabase.from("md_defect_subcategories").insert({
      category_code: newDefectSubcategoryCategoryCode,
      code: newDefectSubcategoryCode,
      label: newDefectSubcategoryLabel,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewDefectSubcategoryCategoryCode("");
    setNewDefectSubcategoryCode("");
    setNewDefectSubcategoryLabel("");
    fetchAll();
  };

  const deleteDefectSubcategory = async (id: string) => {
    const { error } = await supabase.from("md_defect_subcategories").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchAll();
  };

  const insertRoom = async () => {
    if (!newRoomCode || !newRoomLabel) {
      alert("Room code and label are required.");
      return;
    }

    const { error } = await supabase.from("md_rooms").insert({
      code: newRoomCode,
      label: newRoomLabel,
      room_type: newRoomType || null,
      is_active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewRoomCode("");
    setNewRoomLabel("");
    setNewRoomType("");
    fetchAll();
  };

  const deleteRoom = async (id: string) => {
    const { error } = await supabase.from("md_rooms").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchAll();
  };

  const insertEquipment = async () => {
    if (!newEquipmentId || !newEquipmentName) {
      alert("Equipment ID and equipment name are required.");
      return;
    }

    const { error } = await supabase.from("md_equipment").insert({
      equipment_id: newEquipmentId,
      equipment_name: newEquipmentName,
      equipment_type: newEquipmentType || null,
      room_code: newEquipmentRoomCode || null,
      is_active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewEquipmentId("");
    setNewEquipmentName("");
    setNewEquipmentType("");
    setNewEquipmentRoomCode("");
    fetchAll();
  };

  const deleteEquipment = async (id: string) => {
    const { error } = await supabase.from("md_equipment").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchAll();
  };

  const insertTestMethod = async () => {
    if (!newMethodCode || !newMethodLabel) {
      alert("Method code and label are required.");
      return;
    }

    const { error } = await supabase.from("md_test_methods").insert({
      code: newMethodCode,
      label: newMethodLabel,
      investigation_source: newMethodSource || null,
      default_unit: newMethodUnit || null,
      is_active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewMethodCode("");
    setNewMethodLabel("");
    setNewMethodSource("Product Bioburden");
    setNewMethodUnit("");
    fetchAll();
  };

  const deleteTestMethod = async (id: string) => {
    const { error } = await supabase.from("md_test_methods").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchAll();
  };

  const insertOosLimit = async () => {
    if (!newLimitSource || !newLimitMethodCode) {
      alert("Investigation source and test method are required.");
      return;
    }

    if (!newAlertLimit && !newActionLimit && !newSpecificationLimit) {
      alert("At least one limit is required: alert, action, or specification.");
      return;
    }

    const selectedMethod = testMethods.find((m) => m.code === newLimitMethodCode);

    const { error } = await supabase.from("md_oos_limits").insert({
      investigation_source: newLimitSource,
      test_method_code: newLimitMethodCode,
      room_code: newLimitRoomCode || null,
      equipment_id: newLimitEquipmentId || null,
      alert_limit: newAlertLimit || null,
      action_limit: newActionLimit || null,
      specification_limit: newSpecificationLimit || null,
      unit_of_measure: newLimitUnit || selectedMethod?.default_unit || null,
      is_active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewLimitSource("Product Bioburden");
    setNewLimitMethodCode("");
    setNewLimitRoomCode("");
    setNewLimitEquipmentId("");
    setNewAlertLimit("");
    setNewActionLimit("");
    setNewSpecificationLimit("");
    setNewLimitUnit("");
    fetchAll();
  };

  const deleteOosLimit = async (id: string) => {
    const { error } = await supabase.from("md_oos_limits").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchAll();
  };

  const sectionStyle: React.CSSProperties = {
    border: "1px solid #ccc",
    padding: "16px",
    marginBottom: "20px",
    borderRadius: "8px",
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px",
    marginRight: "8px",
    marginBottom: "8px",
  };

  const selectStyle: React.CSSProperties = {
    padding: "8px",
    marginRight: "8px",
    marginBottom: "8px",
    minWidth: "180px",
  };

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (!userRole?.includes("approver") && !userRole?.includes("vp_quality")) {
    return (
      <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h1>Access Denied</h1>
        <p>Only approvers or VP of Quality can access Admin Master Data.</p>
        <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
        <p><strong>Your Role:</strong> {userRole || "none"}</p>
        <a href="/dashboard">Back to Dashboard</a>
      </main>
    );
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Admin Master Data</h1>
      <p><strong>Logged-in Email:</strong> {userEmail}</p>
      <p><strong>Your Role:</strong> {userRole}</p>

      <div style={sectionStyle}>
        <h2>Product Part Numbers</h2>
        <input value={newPartCode} onChange={(e) => setNewPartCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newPartLabel} onChange={(e) => setNewPartLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={() => insertSimple("md_product_part_numbers", newPartCode, newPartLabel, () => { setNewPartCode(""); setNewPartLabel(""); })}>Add</button>
        <ul>{partNumbers.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteSimple("md_product_part_numbers", item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>Dispositions</h2>
        <input value={newDispositionCode} onChange={(e) => setNewDispositionCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newDispositionLabel} onChange={(e) => setNewDispositionLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={() => insertSimple("md_dispositions", newDispositionCode, newDispositionLabel, () => { setNewDispositionCode(""); setNewDispositionLabel(""); })}>Add</button>
        <ul>{dispositions.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteSimple("md_dispositions", item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>Detection Sources</h2>
        <input value={newDetectionCode} onChange={(e) => setNewDetectionCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newDetectionLabel} onChange={(e) => setNewDetectionLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={() => insertSimple("md_detection_sources", newDetectionCode, newDetectionLabel, () => { setNewDetectionCode(""); setNewDetectionLabel(""); })}>Add</button>
        <ul>{detectionSources.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteSimple("md_detection_sources", item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>Departments</h2>
        <input value={newDepartmentCode} onChange={(e) => setNewDepartmentCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newDepartmentLabel} onChange={(e) => setNewDepartmentLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={() => insertSimple("md_departments", newDepartmentCode, newDepartmentLabel, () => { setNewDepartmentCode(""); setNewDepartmentLabel(""); })}>Add</button>
        <ul>{departments.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteSimple("md_departments", item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>Material Statuses</h2>
        <input value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newMaterialLabel} onChange={(e) => setNewMaterialLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={() => insertSimple("md_material_statuses", newMaterialCode, newMaterialLabel, () => { setNewMaterialCode(""); setNewMaterialLabel(""); })}>Add</button>
        <ul>{materialStatuses.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteSimple("md_material_statuses", item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>Defect Categories</h2>
        <input value={newDefectCategoryCode} onChange={(e) => setNewDefectCategoryCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newDefectCategoryLabel} onChange={(e) => setNewDefectCategoryLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={() => insertSimple("md_defect_categories", newDefectCategoryCode, newDefectCategoryLabel, () => { setNewDefectCategoryCode(""); setNewDefectCategoryLabel(""); })}>Add</button>
        <ul>{defectCategories.map((item) => <li key={item.id}>{item.code} — {item.label} <button onClick={() => deleteSimple("md_defect_categories", item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>Defect Subcategories</h2>
        <select value={newDefectSubcategoryCategoryCode} onChange={(e) => setNewDefectSubcategoryCategoryCode(e.target.value)} style={inputStyle}>
          <option value="">Select category</option>
          {defectCategories.map((item) => <option key={item.id} value={item.code}>{item.label}</option>)}
        </select>
        <input value={newDefectSubcategoryCode} onChange={(e) => setNewDefectSubcategoryCode(e.target.value)} placeholder="Code" style={inputStyle} />
        <input value={newDefectSubcategoryLabel} onChange={(e) => setNewDefectSubcategoryLabel(e.target.value)} placeholder="Label" style={inputStyle} />
        <button onClick={insertDefectSubcategory}>Add</button>
        <ul>{defectSubcategories.map((item) => <li key={item.id}>{item.category_code} — {item.code} — {item.label} <button onClick={() => deleteDefectSubcategory(item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>OOS/OOT Rooms / Areas</h2>
        <input value={newRoomCode} onChange={(e) => setNewRoomCode(e.target.value)} placeholder="Room code, e.g. CR-001" style={inputStyle} />
        <input value={newRoomLabel} onChange={(e) => setNewRoomLabel(e.target.value)} placeholder="Room label" style={inputStyle} />
        <input value={newRoomType} onChange={(e) => setNewRoomType(e.target.value)} placeholder="Room type, e.g. ISO 8" style={inputStyle} />
        <button onClick={insertRoom}>Add Room</button>
        <ul>{rooms.map((item) => <li key={item.id}>{item.code} — {item.label} — {item.room_type || "N/A"} <button onClick={() => deleteRoom(item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>OOS/OOT Equipment</h2>
        <input value={newEquipmentId} onChange={(e) => setNewEquipmentId(e.target.value)} placeholder="Equipment ID" style={inputStyle} />
        <input value={newEquipmentName} onChange={(e) => setNewEquipmentName(e.target.value)} placeholder="Equipment name" style={inputStyle} />
        <input value={newEquipmentType} onChange={(e) => setNewEquipmentType(e.target.value)} placeholder="Equipment type" style={inputStyle} />
        <select value={newEquipmentRoomCode} onChange={(e) => setNewEquipmentRoomCode(e.target.value)} style={selectStyle}>
          <option value="">Select room</option>
          {rooms.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.label}</option>)}
        </select>
        <button onClick={insertEquipment}>Add Equipment</button>
        <ul>{equipment.map((item) => <li key={item.id}>{item.equipment_id} — {item.equipment_name} — {item.equipment_type || "N/A"} — Room: {item.room_code || "N/A"} <button onClick={() => deleteEquipment(item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>OOS/OOT Test Methods</h2>
        <input value={newMethodCode} onChange={(e) => setNewMethodCode(e.target.value)} placeholder="Method code" style={inputStyle} />
        <input value={newMethodLabel} onChange={(e) => setNewMethodLabel(e.target.value)} placeholder="Method label" style={inputStyle} />
        <select value={newMethodSource} onChange={(e) => setNewMethodSource(e.target.value)} style={selectStyle}>
          {investigationSources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <input value={newMethodUnit} onChange={(e) => setNewMethodUnit(e.target.value)} placeholder="Default unit, e.g. CFU/device" style={inputStyle} />
        <button onClick={insertTestMethod}>Add Test Method</button>
        <ul>{testMethods.map((item) => <li key={item.id}>{item.code} — {item.label} — Source: {item.investigation_source || "N/A"} — Unit: {item.default_unit || "N/A"} <button onClick={() => deleteTestMethod(item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={sectionStyle}>
        <h2>OOS/OOT Limits</h2>
        <select value={newLimitSource} onChange={(e) => setNewLimitSource(e.target.value)} style={selectStyle}>
          {investigationSources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <select value={newLimitMethodCode} onChange={(e) => { const methodCode = e.target.value; setNewLimitMethodCode(methodCode); const selectedMethod = testMethods.find((method) => method.code === methodCode); if (selectedMethod?.default_unit) setNewLimitUnit(selectedMethod.default_unit); }} style={selectStyle}>
          <option value="">Select method</option>
          {testMethods.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.label}</option>)}
        </select>
        <select value={newLimitRoomCode} onChange={(e) => setNewLimitRoomCode(e.target.value)} style={selectStyle}>
          <option value="">Room optional</option>
          {rooms.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.label}</option>)}
        </select>
        <select value={newLimitEquipmentId} onChange={(e) => setNewLimitEquipmentId(e.target.value)} style={selectStyle}>
          <option value="">Equipment optional</option>
          {equipment.map((item) => <option key={item.id} value={item.equipment_id}>{item.equipment_id} — {item.equipment_name}</option>)}
        </select>
        <input value={newAlertLimit} onChange={(e) => setNewAlertLimit(e.target.value)} placeholder="Alert limit" style={inputStyle} />
        <input value={newActionLimit} onChange={(e) => setNewActionLimit(e.target.value)} placeholder="Action limit" style={inputStyle} />
        <input value={newSpecificationLimit} onChange={(e) => setNewSpecificationLimit(e.target.value)} placeholder="Specification limit" style={inputStyle} />
        <input value={newLimitUnit} onChange={(e) => setNewLimitUnit(e.target.value)} placeholder="Unit" style={inputStyle} />
        <button onClick={insertOosLimit}>Add Limit</button>
        <ul>{oosLimits.map((item) => <li key={item.id}>{item.investigation_source} — Method: {item.test_method_code} — Room: {item.room_code || "Any"} — Equipment: {item.equipment_id || "Any"} — Alert: {item.alert_limit || "N/A"} — Action: {item.action_limit || "N/A"} — Spec: {item.specification_limit || "N/A"} — Unit: {item.unit_of_measure || "N/A"} <button onClick={() => deleteOosLimit(item.id)}>Delete</button></li>)}</ul>
      </div>

      <div style={{ marginTop: "20px" }}>
        <a href="/dashboard">Back to Dashboard</a>
      </div>
    </main>
  );
}
