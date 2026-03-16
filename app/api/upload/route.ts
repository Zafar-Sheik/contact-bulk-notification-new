import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  validateFileType,
  sanitizeFilename,
  sanitizeError 
} from '@/lib/utils/security';

// Allowed file types for images
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/upload
 * Upload an image file for notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `upload:${clientIP}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.UPLOAD);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
          }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // Validate file exists
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const typeValidation = validateFileType(file.name, ALLOWED_TYPES);
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: typeValidation.error },
        { status: 400 }
      );
    }

    // Also check the MIME type from the file
    if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedName = sanitizeFilename(file.name);
    
    // Get file extension
    const extension = sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `notification_${timestamp}_${randomSuffix}.${extension}`;

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Return the public URL
    const imageUrl = `/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      filename: filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * Check if upload endpoint is available
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    maxFileSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_TYPES,
  });
}
