"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const PUBLIC_ROUTES = ["/", "/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      if (PUBLIC_ROUTES.includes(pathname)) {
        setChecking(false);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace(`/login?redirectedFrom=${encodeURIComponent(pathname)}`);
        return;
      }

      setChecking(false);
    };

    checkSession();
  }, [pathname, router]);

  if (checking && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
        Checking access...
      </main>
    );
  }

  return <>{children}</>;
}
