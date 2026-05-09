"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function NewSupplierPage() {
  const router = useRouter();

  const [supplierNumber, setSupplierNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("");
  const [supplierStatus, setSupplierStatus] = useState("approved");
  const [supplierRiskLevel, setSupplierRiskLevel] = useState("medium");

  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");

  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierCountry, setSupplierCountry] = useState("");

  const [isoCertification, setIsoCertification] = useState("");
  const [isoExpirationDate, setIsoExpirationDate] = useState("");

  const saveSupplier = async () => {
    if (!supplierName.trim()) {
      alert("Supplier name is required.");
      return;
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        supplier_number: supplierNumber,
        supplier_name: supplierName,
        supplier_category: supplierCategory,
        supplier_status: supplierStatus,
        supplier_risk_level: supplierRiskLevel,
        primary_contact_name: primaryContactName,
        primary_contact_email: primaryContactEmail,
        primary_contact_phone: primaryContactPhone,
        supplier_address: supplierAddress,
        supplier_country: supplierCountry,
        iso_certification: isoCertification,
        iso_expiration_date: isoExpirationDate || null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    alert("Supplier created.");
    router.push(`/suppliers/${data.id}`);
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <h1>Create Supplier</h1>

      <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
        <Field label="Supplier Number">
          <input value={supplierNumber} onChange={(e) => setSupplierNumber(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Supplier Name">
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Supplier Category">
          <input value={supplierCategory} onChange={(e) => setSupplierCategory(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Supplier Status">
          <select value={supplierStatus} onChange={(e) => setSupplierStatus(e.target.value)} style={inputStyle}>
            <option value="approved">Approved</option>
            <option value="conditional">Conditional</option>
            <option value="probation">Probation</option>
            <option value="disqualified">Disqualified</option>
          </select>
        </Field>

        <Field label="Supplier Risk Level">
          <select value={supplierRiskLevel} onChange={(e) => setSupplierRiskLevel(e.target.value)} style={inputStyle}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>

        <Field label="Primary Contact Name">
          <input value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Primary Contact Email">
          <input value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Primary Contact Phone">
          <input value={primaryContactPhone} onChange={(e) => setPrimaryContactPhone(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Supplier Address">
          <textarea value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} style={textareaStyle} />
        </Field>

        <Field label="Supplier Country">
          <input value={supplierCountry} onChange={(e) => setSupplierCountry(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="ISO Certification">
          <input value={isoCertification} onChange={(e) => setIsoCertification(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="ISO Expiration Date">
          <input type="date" value={isoExpirationDate} onChange={(e) => setIsoExpirationDate(e.target.value)} style={inputStyle} />
        </Field>

        <button onClick={saveSupplier}>Create Supplier</button>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label>{label}</label>
      <br />
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
};

const textareaStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
  minHeight: "100px",
};
