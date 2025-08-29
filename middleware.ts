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
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          res.cookies.set({ name, value: "", ...options, maxAge: 0 }),
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