"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NewScarPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [linkedNcmrId, setLinkedNcmrId] = useState("");
  const [linkedNcmrNumber, setLinkedNcmrNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("major");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [assignedSupplierContact, setAssignedSupplierContact] = useState("");
  const [dueDate, setDueDate] = useState("");

  const fetchData = async () => {
    const suppliersRes = await supabase.from("suppliers").select("*").order("supplier_name", { ascending: true });
    if (!suppliersRes.error) setSuppliers(suppliersRes.data || []);

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("id, ncmr_number, title, supplier_id, supplier_name, severity, issue_description")
      .not("supplier_id", "is", null)
      .order("created_at", { ascending: false });

    if (!ncmrRes.error) setNcmrs(ncmrRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSupplierChange = (selectedId: string) => {
    const supplier = suppliers.find((item) => item.id === selectedId);
    setSupplierId(selectedId);
    setSupplierName(supplier?.supplier_name || "");
    setAssignedSupplierContact(supplier?.primary_contact_email || "");
  };

  const onNcmrChange = (selectedId: string) => {
    const ncmr = ncmrs.find((item) => item.id === selectedId);
    setLinkedNcmrId(selectedId);
    setLinkedNcmrNumber(ncmr?.ncmr_number || "");
    if (ncmr) {
      setSupplierId(ncmr.supplier_id || "");
      setSupplierName(ncmr.supplier_name || "");
      setTitle(`SCAR for ${ncmr.ncmr_number || ncmr.title}`);
      setDescription(ncmr.issue_description || ncmr.title || "");
      setSeverity(ncmr.severity || "major");
    }
  };

  const createScar = async () => {
    if (!supplierId) return alert("Supplier is required.");
    if (!title.trim()) return alert("SCAR title is required.");

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data, error } = await supabase
      .from("scars")
      .insert({
        supplier_id: supplierId,
        supplier_name: supplierName,
        linked_ncmr_id: linkedNcmrId || null,
        linked_ncmr_number: linkedNcmrNumber || null,
        title,
        description,
        severity,
        risk_level: riskLevel,
        issue_summary: description,
        assigned_supplier_contact: assignedSupplierContact,
        due_date: dueDate || null,
        response_due_date: dueDate || null,
        status: "supplier_response_pending",
        initiated_by: userEmail,
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return alert(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "scar",
      entity_id: data.id,
      action: "scar_created",
      details: `SCAR created for supplier ${supplierName}.`,
      user_email: userEmail,
    });

    alert("SCAR created.");
    router.push(`/supplier-quality/scars/${data.id}`);
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <h1>Create Supplier Corrective Action Request</h1>

      <section style={sectionStyle}>
        <h2>Source Linkage</h2>

        <Field label="Linked Supplier NCMR">
          <select value={linkedNcmrId} onChange={(e) => onNcmrChange(e.target.value)} style={inputStyle}>
            <option value="">Optional: select supplier-linked NCMR</option>
            {ncmrs.map((ncmr) => (
              <option key={ncmr.id} value={ncmr.id}>
                {ncmr.ncmr_number || ncmr.title} — {ncmr.supplier_name || "Supplier N/A"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier">
          <select value={supplierId} onChange={(e) => onSupplierChange(e.target.value)} style={inputStyle}>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_number ? `${supplier.supplier_number} - ` : ""}{supplier.supplier_name}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section style={sectionStyle}>
        <h2>SCAR Details</h2>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} /></Field>
        <Field label="Issue Summary / Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} style={textareaStyle} /></Field>
        <Field label="Severity">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle}>
            <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
          </select>
        </Field>
        <Field label="Risk Level">
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} style={inputStyle}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
        </Field>
        <Field label="Supplier Contact / Owner"><input value={assignedSupplierContact} onChange={(e) => setAssignedSupplierContact(e.target.value)} style={inputStyle} /></Field>
        <Field label="Response Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></Field>
        <button onClick={createScar}>Create SCAR</button>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "12px" }}><label>{label}</label><br />{children}</div>;
}

const sectionStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "20px" };
const inputStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "700px" };
const textareaStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "800px" };
