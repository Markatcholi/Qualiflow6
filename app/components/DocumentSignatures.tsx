"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Signature = {
  id: string;
  module_name: string;
  record_id: string;
  action_type: string;
  signed_by: string;
  signer_role: string | null;
  signature_meaning: string;
  signature_reason: string | null;
  signed_at: string | null;
};

export default function DocumentSignatures({ documentId }: { documentId: string }) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignatures = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("electronic_signatures")
      .select("*")
      .eq("module_name", "documents")
      .eq("record_id", documentId)
      .order("signed_at", { ascending: false });

    if (!error) setSignatures((data as Signature[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    if (documentId) fetchSignatures();
  }, [documentId]);

  if (loading) return <p style={subtleText}>Loading signatures...</p>;

  if (signatures.length === 0) {
    return <p style={subtleText}>No electronic signatures recorded yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Signed By</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Action</th>
            <th style={thStyle}>Meaning</th>
            <th style={thStyle}>Reason</th>
            <th style={thStyle}>Signed At</th>
          </tr>
        </thead>
        <tbody>
          {signatures.map((sig) => (
            <tr key={sig.id}>
              <td style={tdStyle}>{sig.signed_by}</td>
              <td style={tdStyle}>{sig.signer_role || "N/A"}</td>
              <td style={tdStyle}>{sig.action_type}</td>
              <td style={tdStyle}>{sig.signature_meaning}</td>
              <td style={tdStyle}>{sig.signature_reason || "N/A"}</td>
              <td style={tdStyle}>{formatDateTime(sig.signed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};
