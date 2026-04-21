"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AuditLog = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  action: string | null;
  details: string | null;
  created_at: string | null;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLogs((data as AuditLog[]) || []);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Audit Trail</h1>

      {logs.length === 0 ? (
        <p>No audit records yet.</p>
      ) : (
        <ul>
          {logs.map((log) => (
            <li key={log.id} style={{ marginBottom: "12px" }}>
              <strong>{log.entity_type}</strong> — {log.action}
              <br />
              {log.details}
              <br />
              <small>{log.created_at}</small>
            </li>
          ))}
        </ul>
      )}

      <br />
      <a href="/dashboard">Back to Dashboard</a>
    </main>
  );
}
