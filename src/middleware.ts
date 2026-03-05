import { NextResponse, type NextRequest } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "@/server/better-auth/config";

export default async function middleware(request: NextRequest) {
  // Public routes that don't require authentication
  const authRoutes = ["/login", "/register"];
  const publicRoutes = ["/", ...authRoutes];
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)
    || request.nextUrl.pathname.startsWith("/s/");
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

  try {
    const { data: session } = await betterFetch<Session>(
      "/api/auth/get-session",
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get("cookie") || "", // Pass cookies forward
        },
      },
    );

    // If we're on a public route, don't enforce auth redirect
    // EXCEPT for auth routes (/login, /register) where we redirect logged in users
    if (isPublicRoute) {
      if (session && isAuthRoute) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.next();
    }

    // No session on a private route? Redirect to login
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  } catch (e) {
    console.error("Middleware Auth Error:", e);

    // If we're on a public route and fetch fails, just allow it
    if (isPublicRoute) {
      return NextResponse.next();
    }

    // On fetch error for private routes, err on the side of caution and redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|api|manifest.json|sw.js|trpc|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
