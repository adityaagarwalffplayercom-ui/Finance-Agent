import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_PAGES = ["/login", "/signup"];
const PROTECTED_PAGES = ["/dashboard", "/documents", "/onboarding"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cookie-presence check only — fast, no DB round trip. Route Handlers and
  // Server Components still call auth.api.getSession() for the real session.
  const sessionCookie = getSessionCookie(request);

  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const isProtectedPage = PROTECTED_PAGES.some((page) => pathname.startsWith(page));

  if (isProtectedPage && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/documents/:path*", "/onboarding/:path*", "/login", "/signup"],
};
