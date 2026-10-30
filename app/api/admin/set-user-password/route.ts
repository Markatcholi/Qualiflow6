// Retired development endpoint. Passwords must be set by the account owner
// through Supabase's invitation or recovery flow, never by an administrator.
export async function POST() {
  return Response.json(
    { error: "Direct password setting is disabled. Use an account invitation or password recovery email." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
