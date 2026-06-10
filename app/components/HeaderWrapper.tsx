"use client";

import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";

export default function HeaderWrapper() {
  const pathname = usePathname();

  const publicRoutes = ["/", "/login"];

  if (publicRoutes.includes(pathname)) {
    return null;
  }

  return <AppHeader />;
}
