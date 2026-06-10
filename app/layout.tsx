import "./globals.css";
import HeaderWrapper from "./components/HeaderWrapper";

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
        <HeaderWrapper />
        {children}
      </body>
    </html>
  );
}
