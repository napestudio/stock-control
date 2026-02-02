import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/";
  const isDashboard = req.nextUrl.pathname.startsWith("/panel");
  const isChangePassword = req.nextUrl.pathname === "/panel/change-password";

  // Redirect to dashboard if authenticated and trying to access login
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/panel", req.url));
  }

  // Redirect to login if not authenticated and trying to access dashboard
  if (!isAuthenticated && isDashboard) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Check if user needs to change password
  if (isAuthenticated && isDashboard && !isChangePassword) {
    if (req.auth?.user?.requirePasswordChange) {
      return NextResponse.redirect(new URL("/panel/change-password", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (next-auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
