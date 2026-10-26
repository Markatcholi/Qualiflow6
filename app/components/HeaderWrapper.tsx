"use client";

import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";

export default function HeaderWrapper() {
  const pathname = usePathname();

  const publicRoutes = ["/", "/login"];

  if (publicRoutes.includes(pathname) || (process.env.NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT === "sandbox" && pathname === "/sandbox-access")) {
    return null;
  }

  return <AppHeader />;
}
