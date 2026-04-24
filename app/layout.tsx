import "./globals.css";
import AppHeader from "./components/AppHeader";

export const metadata = {
  title: "QualiFlow",
  description: "Quality Management SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
