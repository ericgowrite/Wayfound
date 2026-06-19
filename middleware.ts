import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Runs before route handlers and before the Next.js cache is consulted.
// Enforces that every /api/* request has a Bearer token.
// Token signature is still verified inside each route handler via getUserId().
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, private",
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
