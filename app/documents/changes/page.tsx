"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Dci = {
  id: string;
  dci_number: string;
  title: string | null;
  change_description: string;
  change_justification: string;
  owner_email: string;
  status: string;
  release_strategy: string;
  created_at: string;
};

const fmt = (value: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

export default function DocumentChangesPage() {
  const [items, setItems] = useState<Dci[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [form, setForm] = useState({ title: "", change_description: "", change_justification: "", release_strategy: "coordinated" });

  const load = async () => {
    setLoading(true);
    const user = await supabase.auth.getUser();
    setUserEmail(user.data?.user?.email || "");
    const { data, error } = await supabase.from("document_change_initiations").select("*").order("created_at", { ascending: false });
    if (error) alert(error.message);
    else setItems((data as Dci[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createDci = async () => {
    if (!form.change_description.trim() || !form.change_justification.trim()) {
      return alert("Change Description and Change Justification are required.");
    }
    setSaving(true);
    try {
      const number = await supabase.rpc("generate_dci_number");
      if (number.error) throw new Error(number.error.message);
      const inserted = await supabase.from("document_change_initiations").insert({
        dci_number: number.data,
        title: form.title.trim() || null,
        change_description: form.change_description.trim(),
        change_justification: form.change_justification.trim(),
        owner_email: userEmail,
        created_by: userEmail,
        release_strategy: form.release_strategy,
      }).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      window.location.href = `/documents/changes/${inserted.data.id}`;
    } catch (e: any) {
      alert(e.message || "Unable to create DCI.");
      setSaving(false);
    }
  };

  return <main style={{ padding: 28, maxWidth: 1320, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: "#536274" }}>DOCUMENT CONTROL</div>
        <h1 style={{ margin: "6px 0" }}>Document Change Initiations</h1>
        <p style={{ margin: 0, color: "#667085" }}>One DCI can contain multiple new, revised, or reinstated documents. Collaboration and formal approval occur at the DCI package level.</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <a href="/documents" style={secondary}>Controlled Documents</a>
        <button onClick={() => setShowCreate(!showCreate)} style={primary}>Create DCI</button>
      </div>
    </div>

    {showCreate && <section style={card}>
      <h2 style={{ marginTop: 0 }}>New Document Change Initiation</h2>
      <label style={label}>DCI Title / Short Description</label>
      <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={input} placeholder="Optional short package title" />
      <label style={label}>Change Description *</label>
      <textarea value={form.change_description} onChange={e => setForm({ ...form, change_description: e.target.value })} style={input} rows={3} />
      <label style={label}>Change Justification *</label>
      <textarea value={form.change_justification} onChange={e => setForm({ ...form, change_justification: e.target.value })} style={input} rows={3} />
      <label style={label}>Release Strategy</label>
      <select value={form.release_strategy} onChange={e => setForm({ ...form, release_strategy: e.target.value })} style={input}>
        <option value="coordinated">Coordinated release</option>
        <option value="independent">Independent document release</option>
      </select>
      <p style={{ color: "#667085", fontSize: 13 }}>This records the package strategy. Release gates will be enforced as the DCI workflow is completed.</p>
      <button disabled={saving} onClick={createDci} style={primary}>{saving ? "Creating..." : "Create DCI"}</button>
    </section>}

    <section style={card}>
      <h2 style={{ marginTop: 0 }}>DCI Register</h2>
      {loading ? <p>Loading...</p> : items.length === 0 ? <p style={{ color: "#667085" }}>No DIC records yet.</p> :
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["DCI","Title","Owner","Status","Release Strategy","Created",""].map(x => <th key={x} style={th}>{x}</th>)}</tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td style={td}><strong>{item.dci_number}</strong></td><td style={td}>{item.title || item.change_description}</td>
          <td style={td}>{item.owner_email}</td><td style={td}>{item.status.replaceAll("_"," ")}</td>
          <td style={td}>{item.release_strategy}</td><td style={td}>{fmt(item.created_at)}</td>
          <td style={td}><a href={`/documents/changes/${item.id}`} style={secondary}>Open DCI</a></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}

const card: React.CSSProperties = { border: "1px solid #d9e0e8", borderRadius: 10, padding: 20, marginBottom: 18, background: "#fff" };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 11px", border: "1px solid #c8d1dc", borderRadius: 6, marginBottom: 10 };
const label: React.CSSProperties = { display: "block", fontWeight: 700, margin: "8px 0 6px" };
const primary: React.CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#172033", color: "#fff", fontWeight: 700, cursor: "pointer", textDecoration: "none" };
const secondary: React.CSSProperties = { border: "1px solid #aab5c2", borderRadius: 6, padding: "9px 12px", background: "#fff", color: "#172033", fontWeight: 700, textDecoration: "none", display: "inline-block" };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #d9e0e8", fontSize: 12, color: "#536274" };
const td: React.CSSProperties = { padding: "12px 8px", borderBottom: "1px solid #edf0f4", verticalAlign: "top" };
