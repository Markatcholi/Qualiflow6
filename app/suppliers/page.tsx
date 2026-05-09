"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSuppliers = async () => {
    let query = supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    if (search.trim()) {
      query = query.ilike("supplier_name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSuppliers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1>Supplier Quality Management</h1>

        <Link href="/suppliers/new">
          <button>Add Supplier</button>
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search supplier"
        style={{
          padding: "10px",
          width: "300px",
          marginBottom: "20px",
        }}
      />

      {loading ? (
        <p>Loading suppliers...</p>
      ) : suppliers.length === 0 ? (
        <p>No suppliers found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Supplier Number</th>
              <th style={thStyle}>Supplier Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Risk Level</th>
              <th style={thStyle}>ISO Expiration</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td style={tdStyle}>{supplier.supplier_number}</td>
                <td style={tdStyle}>{supplier.supplier_name}</td>
                <td style={tdStyle}>{supplier.supplier_category}</td>
                <td style={tdStyle}>{supplier.supplier_status}</td>
                <td style={tdStyle}>{supplier.supplier_risk_level}</td>
                <td style={tdStyle}>{supplier.iso_expiration_date}</td>
                <td style={tdStyle}>
                  <Link href={`/suppliers/${supplier.id}`}>
                    Open Supplier
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
};
