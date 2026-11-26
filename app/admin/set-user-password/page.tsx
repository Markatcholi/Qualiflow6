import Link from "next/link";

export default function AdminSetUserPasswordPage() {
  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 680 }}>
      <h1>Password setup</h1>
      <p>Passwords are created privately by the account owner through a secure email link. Direct administrator password setting is no longer available.</p>
      <p>Use Company Administrator Activation for initial company administrator invitations. Existing users can request a password recovery email.</p>
      <Link href="/forgot-password">Request a password recovery email</Link>
    </main>
  );
}
