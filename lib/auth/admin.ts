import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import type { JwtPayload } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

const COOKIE_NAME = 'admin_session';

// Use ADMIN_EMAIL for consistency
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * Admin session payload
 */
export interface AdminSession {
  adminId: string;
  email: string;
  role: 'ADMIN';
  iat?: number;
  exp?: number;
  username?: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare a password with its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token for admin session (legacy function)
 */
export async function createToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Create admin JWT token
 */
export async function createAdminToken(payload: Omit<AdminSession, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify and decode a JWT token (legacy function)
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Verify admin JWT token
 */
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

/**
 * Set admin session cookie (legacy function)
 */
export async function setSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Set admin session cookie
 */
export async function setAdminSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Get admin session (legacy function)
 */
export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  return verifyToken(token);
}

/**
 * Get admin session from cookie
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  return verifyAdminToken(token);
}

/**
 * Clear admin session (legacy function)
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Clear admin session
 */
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Authenticate admin credentials (using email)
 */
export async function authenticateAdmin(username: string, password: string): Promise<boolean> {
  // For demo purposes, allow a default admin credentials
  // In production, this should check against the database
  
  // Check using email (ADMIN_EMAIL)
  if (username === ADMIN_EMAIL || username === ADMIN_USERNAME) {
    // If using environment password hash, verify it
    if (ADMIN_PASSWORD_HASH) {
      return verifyPassword(password, ADMIN_PASSWORD_HASH);
    }
    // For development/testing, accept the default password
    return password === ADMIN_PASSWORD;
  }
  return false;
}

/**
 * Authenticate admin with email and password
 */
export async function authenticateAdminByEmail(email: string, password: string): Promise<boolean> {
  // Check email
  if (email !== ADMIN_EMAIL) {
    return false;
  }
  
  // If using environment password hash, verify it
  if (ADMIN_PASSWORD_HASH) {
    return verifyPassword(password, ADMIN_PASSWORD_HASH);
  }
  
  // For development/testing, accept the default password
  return password === ADMIN_PASSWORD;
}

/**
 * Admin authentication middleware
 * Verifies session and ensures role === ADMIN
 */
export async function adminAuthMiddleware(request: NextRequest) {
  // Get session
  const session = await getAdminSession();
  
  // No session found
  if (!session) {
    return {
      authorized: false,
      reason: 'No session',
      redirect: '/admin/login',
    };
  }
  
  // Check role
  if (session.role !== 'ADMIN') {
    return {
      authorized: false,
      reason: 'Insufficient permissions',
      redirect: '/admin/login',
    };
  }
  
  // Session valid
  return {
    authorized: true,
    session,
  };
}

/**
 * Middleware function for Next.js
 * Use in middleware.ts or API routes
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (session: AdminSession) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await adminAuthMiddleware(request);
  
  if (!auth.authorized) {
    // API route - return 401
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized', reason: auth.reason },
        { status: 401 }
      );
    }
    
    // Page - redirect to login
    return NextResponse.redirect(new URL(auth.redirect || '/admin/login', request.url));
  }
  
  return handler((auth as { session: AdminSession }).session);
}

/**
 * Getter for session (for use in API routes)
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  if (session.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  
  return session;
}

/**
 * Check if admin is authenticated (non-throwing)
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const session = await getAdminSession();
    return session?.role === 'ADMIN';
  } catch {
    return false;
  }
}

/**
 * Check if request is from authenticated admin (legacy function)
 */
export async function requireAuth(): Promise<JwtPayload> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  return session;
}

export default adminAuthMiddleware;
