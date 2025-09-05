﻿// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/(auth)/sign-in",
  "/sign-up",
  "/(auth)/sign-up",
  "/api/public",
  "/api/calendar/export",
  "/auth/callback",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow Next internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/api/webhooks") // allow webhooks if you have any
  ) {
    return NextResponse.next();
  }

  // Consider sign-in and public routes as open
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {
          // Middleware cannot set cookies. Session refresh should occur in
          // an API route or Server Action where cookies can be modified.
        },
      },
    }
  );

  // refresh session if needed
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && !isPublic) {
    // redirect to sign-in preserving where they tried to go
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // If the user is signed in and tries to go to sign-in or sign-up, bounce them to /today
  if (
    session &&
    (pathname === "/sign-in" ||
      pathname.startsWith("/(auth)/sign-in") ||
      pathname === "/sign-up" ||
      pathname.startsWith("/(auth)/sign-up"))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};