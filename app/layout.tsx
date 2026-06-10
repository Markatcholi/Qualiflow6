import "./globals.css";
import AppHeader from "./components/AppHeader";

export const metadata = {
  title: "QualiSphere",
  description: "Enterprise Quality Management System",
};

function HeaderWrapper() {
  if (typeof window === "undefined") return null;

  const publicRoutes = ["/", "/login"];

  if (publicRoutes.includes(window.location.pathname)) {
    return null;
  }

  return <AppHeader />;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <HeaderWrapper />
        {children}
      </body>
    </html>
  );
}
