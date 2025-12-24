import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const anon = req.cookies.get("rb_anon")?.value;

  if (!anon) {
    // Edge runtime-safe
    const id = crypto.randomUUID();
    res.cookies.set("rb_anon", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // localhost
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"]
};

