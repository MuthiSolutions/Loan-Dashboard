import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, hashPassword } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const expected = process.env.DASHBOARD_PASSWORD;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const expectedToken = expected ? await hashPassword(expected) : null;

  if (!expectedToken || session !== expectedToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
