import { NextResponse } from "next/server";
import { SESSION_COOKIE, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD is not configured on the server." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await hashPassword(expected);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
