"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Preparation-stage routing only. Database grants enforce the actual boundary.
export default function SandboxAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sandbox = process.env.NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT === "sandbox";
  const allowed = pathname === "/" || pathname === "/login" || pathname === "/sandbox-access";
  useEffect(() => {
    if (sandbox && !allowed) window.location.replace("/sandbox-access");
  }, [sandbox, allowed]);
  if (sandbox && !allowed) return <p style={{ padding: 32 }}>Opening sandbox access…</p>;
  return <>{children}</>;
}
