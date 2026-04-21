"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Capa = {
  id: string;
  title: string | null;
  status: string | null;
  owner: string | null;
  due_date: string | null;
  effectiveness_check: string | null;
};

export default function CapaPage() {
  const [list, setList] = useState<Capa[]>([]);
  const [userRole, setUserRole] = useState<string>("");

  const fetchUserRole = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .single();

    setUserRole(data?.role || "");
  };

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("capas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setList((data as Capa[]) || []);
  };

  const updateStatus = async (item: Capa, status: string) => {
    if (status === "closed") {
      if (!item.effectiveness_check) {
        alert("Cannot close CAPA until effectiveness check is completed.");
        return;
      }

      if (userRole !== "approver") {
        alert("Only an approver can close CAPA.");
        return;
      }
    }

    const { error } = await supabase
      .from("capas")
      .update({ status })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  useEffect(() => {
    fetchUserRole();
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Records</h1>

      <p><strong>Your Role:</strong> {userRole || "none"}</p>

      {list.length === 0 ? (
        <p>No CAPA records yet.</p>
      ) : (
        <ul>
          {list.map((item) => (
            <li key={item.id} style={{ marginBottom: "16px" }}>
              <a href={`/capa/${item.id}`}>
                <strong>{item.title}</strong>
              </a>{" "}
              — {item.status}
              <br />
              Owner: {item.owner || "Not assigned"}
              <br />
              Due Date: {item.due_date || "Not set"}
              <br />
              Effectiveness Check: {item.effectiveness_check || "Not started"}

              <div style={{ marginTop: "8px" }}>
                <button
                  onClick={() => updateStatus(item, "in_progress")}
                  style={{ marginRight: "8px" }}
                >
                  Move to In Progress
                </button>

                <button
                  onClick={() => updateStatus(item, "effectiveness_check")}
                  style={{ marginRight: "8px" }}
                >
                  Move to Effectiveness Check
                </button>

                <button onClick={() => updateStatus(item, "closed")}>
                  Close
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <br />
      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
