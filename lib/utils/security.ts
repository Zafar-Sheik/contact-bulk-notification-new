/**
 * Security utilities for the application
 * Implements: rate limiting, input validation, sanitization
 */

// In-memory rate limiter (for production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

/**
 * Default rate limits
 */
export const RATE_LIMITS = {
  // Admin endpoints
  NOTIFICATION_SEND: { windowMs: 60000, maxRequests: 10 },  // 10 notifications per minute
  ADMIN_LOGIN: { windowMs: 300000, maxRequests: 5 },  // 5 login attempts per 5 minutes
  
  // Public endpoints
  DEVICE_REGISTER: { windowMs: 60000, maxRequests: 5 },  // 5 registrations per minute
  UPLOAD: { windowMs: 60000, maxRequests: 10 },  // 10 uploads per minute
} as const;

/**
 * Check if request exceeds rate limit
 */
export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetTime - now,
    };
  }
  
  // Increment count
  record.count++;
  rateLimitStore.set(key, record);
  
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetIn: record.resetTime - now,
  };
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

/**
 * Validate notification input
 */
export interface NotificationValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateNotificationInput(data: {
  title?: unknown;
  message?: unknown;
  imageUrl?: unknown;
  link?: unknown;
}): NotificationValidationResult {
  const errors: string[] = [];
  
  // Title validation
  if (!data.title || typeof data.title !== 'string') {
    errors.push('Title is required');
  } else if (data.title.trim().length === 0) {
    errors.push('Title cannot be empty');
  } else if (data.title.length > 100) {
    errors.push('Title must be 100 characters or less');
  }
  
  // Message validation
  if (!data.message || typeof data.message !== 'string') {
    errors.push('Message is required');
  } else if (data.message.trim().length === 0) {
    errors.push('Message cannot be empty');
  } else if (data.message.length > 500) {
    errors.push('Message must be 500 characters or less');
  }
  
  // Image URL validation (optional) - accepts regular URLs or base64 data URLs
  if (data.imageUrl) {
    if (typeof data.imageUrl !== 'string') {
      errors.push('Image URL must be a string');
    } else if (data.imageUrl.trim().length > 0) {
      // Check if it's a data URL (base64)
      if (data.imageUrl.trim().startsWith('data:')) {
        // Validate basic data URL format
        const dataUrlPattern = /^data:image\/\w+;base64,/;
        if (!dataUrlPattern.test(data.imageUrl.trim())) {
          errors.push('Invalid base64 image data URL format');
        }
      } else {
        // Validate as regular URL
        const urlValidation = validateUrl(data.imageUrl);
        if (!urlValidation.valid) {
          errors.push('Invalid image URL format');
        }
      }
    }
  }
  
  // Link validation (optional)
  if (data.link) {
    if (typeof data.link !== 'string') {
      errors.push('Link must be a string');
    } else if (data.link.trim().length > 0) {
      const urlValidation = validateUrl(data.link);
      if (!urlValidation.valid) {
        errors.push('Invalid link URL format');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }
    
    // Block dangerous protocols
    if (['javascript:', 'data:', 'blob:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Invalid URL protocol' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate admin credentials input
 */
export function validateAdminLogin(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid request body'] };
  }
  
  const body = data as Record<string, unknown>;
  
  // Email validation
  if (!body.email || typeof body.email !== 'string') {
    errors.push('Email is required');
  } else if (!isValidEmail(body.email)) {
    errors.push('Invalid email format');
  }
  
  // Password validation
  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  } else if (body.password.length < 1) {
    errors.push('Password is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize filename for uploads
 */
export function sanitizeFilename(filename: string): string {
  // Remove directory paths
  const sanitized = filename.replace(/^.*[/\\]/, '');
  
  // Remove special characters except alphanumeric, dash, underscore, dot
  return sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');
}

/**
 * Validate file type for uploads
 */
export function validateFileType(
  filename: string,
  allowedTypes: readonly string[]
): { valid: boolean; error?: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeType = getMimeType(ext);
  
  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }
  
  return { valid: true };
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Validate device registration input
 */
export function validateDeviceRegistration(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid request body'] };
  }
  
  const body = data as Record<string, unknown>;
  
  // FCM token validation
  if (!body.fcmToken || typeof body.fcmToken !== 'string') {
    errors.push('FCM token is required');
  } else if (body.fcmToken.length < 10) {
    errors.push('Invalid FCM token');
  }
  
  // Platform validation
  const validPlatforms = ['android', 'ios', 'windows', 'mac', 'linux', 'unknown'];
  if (body.platform && typeof body.platform === 'string') {
    if (!validPlatforms.includes(body.platform.toLowerCase())) {
      errors.push('Invalid platform');
    }
  }
  
  // Browser validation
  if (body.browser && typeof body.browser !== 'string') {
    errors.push('Browser must be a string');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/\"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Generate safe error messages (don't leak internal info)
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Don't expose internal errors to clients
    return 'An error occurred. Please try again.';
  }
  return 'An unexpected error occurred';
}
