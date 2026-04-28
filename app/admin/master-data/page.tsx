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
    ] = await Promise.all([
      supabase.from("md_product_part_numbers").select("*").order("label"),
      supabase.from("md_dispositions").select("*").order("label"),
      supabase.from("md_detection_sources").select("*").order("label"),
      supabase.from("md_departments").select("*").order("label"),
      supabase.from("md_material_statuses").select("*").order("label"),
      supabase.from("md_defect_categories").select("*").order("label"),
      supabase.from("md_defect_subcategories").select("*").order("label"),
    ]);

    if (partRes.error) return alert(partRes.error.message);
    if (dispositionRes.error) return alert(dispositionRes.error.message);
    if (detectionRes.error) return alert(detectionRes.error.message);
    if (departmentRes.error) return alert(departmentRes.error.message);
    if (materialRes.error) return alert(materialRes.error.message);
    if (defectCategoryRes.error) return alert(defectCategoryRes.error.message);
    if (defectSubcategoryRes.error) return alert(defectSubcategoryRes.error.message);

    setPartNumbers((partRes.data as SimpleItem[]) || []);
    setDispositions((dispositionRes.data as SimpleItem[]) || []);
    setDetectionSources((detectionRes.data as SimpleItem[]) || []);
    setDepartments((departmentRes.data as SimpleItem[]) || []);
    setMaterialStatuses((materialRes.data as SimpleItem[]) || []);
    setDefectCategories((defectCategoryRes.data as SimpleItem[]) || []);
    setDefectSubcategories((defectSubcategoryRes.data as DefectSubcategoryItem[]) || []);
  };

  useEffect(() => {
    fetchUserRole();
    fetchAll();
  }, []);

  const insertSimple = async (
    table: string,
    code: string,
    label: string,
    reset: () => void
  ) => {
    if (!code || !label) {
      alert("Code and label are required.");
      return;
    }

    const { error } = await supabase.from(table).insert({
      code,
      label,
    });

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
    if (
      !newDefectSubcategoryCategoryCode ||
      !newDefectSubcategoryCode ||
      !newDefectSubcategoryLabel
    ) {
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
    const { error } = await supabase
      .from("md_defect_subcategories")
      .delete()
      .eq("id", id);

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

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (
  !userRole?.includes("approver") &&
  !userRole?.includes("vp_quality")
) {
    return (
      <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h1>Access Denied</h1>
        <p>Only approvers can access Admin Master Data.</p>
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
        <input
          value={newPartCode}
          onChange={(e) => setNewPartCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newPartLabel}
          onChange={(e) => setNewPartLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button
          onClick={() =>
            insertSimple(
              "md_product_part_numbers",
              newPartCode,
              newPartLabel,
              () => {
                setNewPartCode("");
                setNewPartLabel("");
              }
            )
          }
        >
          Add
        </button>

        <ul>
          {partNumbers.map((item) => (
            <li key={item.id}>
              {item.code} — {item.label}{" "}
              <button onClick={() => deleteSimple("md_product_part_numbers", item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2>Dispositions</h2>
        <input
          value={newDispositionCode}
          onChange={(e) => setNewDispositionCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newDispositionLabel}
          onChange={(e) => setNewDispositionLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button
          onClick={() =>
            insertSimple("md_dispositions", newDispositionCode, newDispositionLabel, () => {
              setNewDispositionCode("");
              setNewDispositionLabel("");
            })
          }
        >
          Add
        </button>

        <ul>
          {dispositions.map((item) => (
            <li key={item.id}>
              {item.code} — {item.label}{" "}
              <button onClick={() => deleteSimple("md_dispositions", item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2>Detection Sources</h2>
        <input
          value={newDetectionCode}
          onChange={(e) => setNewDetectionCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newDetectionLabel}
          onChange={(e) => setNewDetectionLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button
          onClick={() =>
            insertSimple(
              "md_detection_sources",
              newDetectionCode,
              newDetectionLabel,
              () => {
                setNewDetectionCode("");
                setNewDetectionLabel("");
              }
            )
          }
        >
          Add
        </button>

        <ul>
          {detectionSources.map((item) => (
            <li key={item.id}>
              {item.code} — {item.label}{" "}
              <button onClick={() => deleteSimple("md_detection_sources", item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2>Departments</h2>
        <input
          value={newDepartmentCode}
          onChange={(e) => setNewDepartmentCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newDepartmentLabel}
          onChange={(e) => setNewDepartmentLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button
          onClick={() =>
            insertSimple("md_departments", newDepartmentCode, newDepartmentLabel, () => {
              setNewDepartmentCode("");
              setNewDepartmentLabel("");
            })
          }
        >
          Add
        </button>

        <ul>
          {departments.map((item) => (
            <li key={item.id}>
              {item.code} — {item.label}{" "}
              <button onClick={() => deleteSimple("md_departments", item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2>Material Statuses</h2>
        <input
          value={newMaterialCode}
          onChange={(e) => setNewMaterialCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newMaterialLabel}
          onChange={(e) => setNewMaterialLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button
          onClick={() =>
            insertSimple(
              "md_material_statuses",
              newMaterialCode,
              newMaterialLabel,
              () => {
                setNewMaterialCode("");
                setNewMaterialLabel("");
              }
            )
          }
        >
          Add
        </button>

        <ul>
          {materialStatuses.map((item) => (
            <li key={item.id}>
              {item.code} — {item.label}{" "}
              <button onClick={() => deleteSimple("md_material_statuses", item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2>Defect Categories</h2>
        <input
          value={newDefectCategoryCode}
          onChange={(e) => setNewDefectCategoryCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newDefectCategoryLabel}
          onChange={(e) => setNewDefectCategoryLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button
          onClick={() =>
            insertSimple(
              "md_defect_categories",
              newDefectCategoryCode,
              newDefectCategoryLabel,
              () => {
                setNewDefectCategoryCode("");
                setNewDefectCategoryLabel("");
              }
            )
          }
        >
          Add
        </button>

        <ul>
          {defectCategories.map((item) => (
            <li key={item.id}>
              {item.code} — {item.label}{" "}
              <button onClick={() => deleteSimple("md_defect_categories", item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2>Defect Subcategories</h2>
        <select
          value={newDefectSubcategoryCategoryCode}
          onChange={(e) => setNewDefectSubcategoryCategoryCode(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select category</option>
          {defectCategories.map((item) => (
            <option key={item.id} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>

        <input
          value={newDefectSubcategoryCode}
          onChange={(e) => setNewDefectSubcategoryCode(e.target.value)}
          placeholder="Code"
          style={inputStyle}
        />
        <input
          value={newDefectSubcategoryLabel}
          onChange={(e) => setNewDefectSubcategoryLabel(e.target.value)}
          placeholder="Label"
          style={inputStyle}
        />
        <button onClick={insertDefectSubcategory}>Add</button>

        <ul>
          {defectSubcategories.map((item) => (
            <li key={item.id}>
              {item.category_code} — {item.code} — {item.label}{" "}
              <button onClick={() => deleteDefectSubcategory(item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: "20px" }}>
        <a href="/dashboard">Back to Dashboard</a>
      </div>
    </main>
  );
}
