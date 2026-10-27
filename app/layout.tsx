import "./globals.css";
import DeploymentEnvironmentBanner from "../components/DeploymentEnvironmentBanner";
import SandboxAccessGate from "../components/SandboxAccessGate";
import HeaderWrapper from "./components/HeaderWrapper";
import PersistentAppShell from "./components/PersistentAppShell";

export const metadata = {
  title: "QualiSphere",
  description: "Enterprise Quality Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DeploymentEnvironmentBanner />
        <SandboxAccessGate>
          <HeaderWrapper />
          <PersistentAppShell>{children}</PersistentAppShell>
        </SandboxAccessGate>
      </body>
    </html>
  );
}
