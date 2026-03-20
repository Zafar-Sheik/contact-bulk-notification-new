import { NextRequest, NextResponse } from 'next/server';
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  validateFileType,
  sanitizeError 
} from '@/lib/utils/security';

// Dynamic import for sharp to handle edge cases
let sharp: any = null;
async function getSharp() {
  if (!sharp) {
    sharp = (await import('sharp')).default;
  }
  return sharp;
}

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

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);
    
    // Keep original image quality - no compression or resizing
    let imageBuffer: Buffer;
    let mimeType = file.type;
    
    try {
      const sharpModule = await getSharp();
      if (sharpModule) {
        // Get image metadata to determine if processing is needed
        const metadata = await sharpModule(inputBuffer).metadata();
        
        // Convert to PNG for transparency support if needed, otherwise keep original format
        if (file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp') {
          // Keep original format for lossless images
          imageBuffer = await sharpModule(inputBuffer).toBuffer();
        } else {
          // For JPEG, use maximum quality to preserve original quality
          imageBuffer = await sharpModule(inputBuffer)
            .jpeg({ quality: 100 })
            .toBuffer();
        }
      } else {
        // Fallback: no processing
        imageBuffer = inputBuffer;
      }
    } catch (processingError) {
      console.error('Image processing failed, using original:', processingError);
      // Fallback: use original buffer
      imageBuffer = inputBuffer;
      mimeType = file.type;
    }
    
    const base64 = imageBuffer.toString('base64');
    
    // Create data URL for the image
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      imageData: imageDataUrl,
      base64: base64,
      mimeType: mimeType,
      size: imageBuffer.length,
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
