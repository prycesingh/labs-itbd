// ─────────────────────────────────────────────────────────────────────────
// proxy.ts — Next.js 16 request "Proxy" (the renamed successor to
// middleware.ts; `middleware` is deprecated as of Next 16). Runs on the
// Node.js runtime before routes render. See:
//   https://nextjs.org/docs/app/api-reference/file-conventions/proxy
//
// Responsibility: COARSE authentication + role gating at the network boundary,
// driven by the declarative policy in lib/rbac.ts. It reads the session role
// straight from the signed JWT cookie (no DB round-trip) so it stays cheap on
// every request.
//
// DEFENSE IN DEPTH: the Next.js docs warn that Server Functions are POSTs to
// the route they live on, so a matcher change can silently drop proxy coverage.
// Therefore this proxy is the first line, NOT the only one — keep verifying
// auth/role inside API route handlers and server actions (see lib/labs/auth.ts
// `requireApiUser` / `requireRole`). The proxy improves UX (redirect to login)
// and blocks obvious unauthorized navigation; it is not the sole gate.
// ─────────────────────────────────────────────────────────────────────────

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { evaluateAccess, type Role } from "@/lib/rbac";

// AUTH_SECRET / NEXTAUTH_SECRET — same secret NextAuth signs the JWT with.
// getToken needs it to decode the cookie. (auth.config.ts supports rotation
// with multiple secrets; getToken takes a single string, so we use the primary.)
const authSecret = (
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  ""
).trim();

// In production Auth.js uses the __Secure- cookie prefix over HTTPS. getToken
// auto-detects this from the request, but we pass secureCookie explicitly based
// on the forwarded proto so it works behind the Hostinger proxy too.
function isSecureRequest(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return request.nextUrl.protocol === "https:";
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Read + decode the session JWT from the cookie. Returns null when there is
  // no valid session. No DB access — this is just cookie verification.
  const token = await getToken({
    req: request,
    secret: authSecret,
    secureCookie: isSecureRequest(request),
  });

  const role = (typeof token?.role === "string" ? token.role : null) as
    | Role
    | null;

  const decision = evaluateAccess(pathname, role);

  switch (decision.kind) {
    case "public":
    case "allow":
      return NextResponse.next();

    case "needsAuth": {
      // Send unauthenticated users to the login page (pages.signIn = "/"),
      // preserving where they were headed so we can bounce them back later.
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      url.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }

    case "forbidden": {
      // Authenticated but wrong role → send to the dashboard root rather than
      // the login page (they ARE logged in). A ?denied flag lets the UI show a
      // toast if desired.
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
  }
}

// Run only on app routes that RBAC cares about, excluding static assets, image
// optimization, favicon/metadata, and the auth + public API endpoints (auth
// callbacks must NOT be gated or SSO login breaks). Server actions POST to the
// route they live on, so /dashboard/* actions are still covered here.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|itbd_logo_img.png|sitemap.xml|robots.txt).*)",
  ],
};
