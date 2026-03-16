import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Admin Route Protection Middleware
 * 
 * Protects all /admin routes except /admin/login
 * Redirects unauthenticated users to /admin (login page)
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow access to /admin/login
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Check for admin session cookie
  const adminSession = request.cookies.get('admin_session');

  if (!adminSession) {
    // No session found, redirect to login
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the session token is not empty
  if (!adminSession.value || adminSession.value.trim() === '') {
    // Invalid session, redirect to login
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists, allow access
  return NextResponse.next();
}

/**
 * Configure which routes the middleware applies to
 */
export const config = {
  matcher: [
    /*
     * Match all admin paths except:
     * - /admin/api/* (API routes - handled separately)
     * - /admin/login (public login page)
     */
    '/admin/:path*',
  ],
};
