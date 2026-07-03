import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
        },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: usersData, error: listError } =
      await adminClient.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const targetUser = usersData.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );

    if (!targetUser) {
      return NextResponse.json(
        { error: `No Supabase auth user found for ${normalizedEmail}.` },
        { status: 404 }
      );
    }

    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(targetUser.id, {
        password,
        email_confirm: true,
      });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Password updated for ${normalizedEmail}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error." },
      { status: 500 }
    );
  }
}
