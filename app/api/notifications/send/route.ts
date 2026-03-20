import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device, Notification } from '@/lib/models';
import { sendNotificationToAllDevices } from '@/lib/firebase/messaging';
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  validateNotificationInput,
  sanitizeError 
} from '@/lib/utils/security';
import { requireAdmin } from '@/lib/auth/admin';

/**
 * POST /api/notifications/send
 * 
 * Send push notification to all registered devices
 * 
 * Input:
 * - title: string (required)
 * - message: string (required)
 * - imageUrl: string (optional)
 * - link: string (optional)
 * 
 * Returns:
 * - success: boolean
 * - message: string
 * - results: { success, failed, total }
 * - notificationId: string
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminSession = await requireAdmin();
    
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `notification-send:${clientIP}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.NOTIFICATION_SEND);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
          }
        }
      );
    }

    // Connect to database
    await connectDB();

    // Parse and validate input
    const body = await request.json();
    const validation = validateNotificationInput(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    const { title, message, imageUrl, link, targetProvince } = body;

    // Build device query based on targetProvince
    const deviceQuery: Record<string, unknown> = {
      $or: [
        { 'metadata.isActive': true },
        { metadata: { $exists: false } },
        { metadata: null }
      ]
    };

    // Filter by province if specified (and not "All")
    if (targetProvince && targetProvince !== 'All') {
      deviceQuery.province = targetProvince;
    }

    // Get all active device tokens (including devices without metadata for backward compatibility)
    const devices = await Device.find(deviceQuery).lean().select('fcmToken') as { fcmToken: string }[];
    
    if (devices.length === 0) {
      return NextResponse.json(
        { error: 'No active devices registered' },
        { status: 400 }
      );
    }

    const tokens = devices.map((d) => d.fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'No valid device tokens found' },
        { status: 400 }
      );
    }

    // Send notifications via FCM
    const result = await sendNotificationToAllDevices(
      tokens,
      title.trim(),
      message.trim(),
      imageUrl?.trim() || undefined,
      link?.trim() || undefined
    );

    // Save the full base64 image to database (after compression it's small enough)
    const imageForDb = imageUrl?.trim() || '';

    // Save notification to database
    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      imageUrl: imageForDb,
      link: link?.trim() || '',
      sentByAdmin: adminSession.adminId,
      targetProvince: targetProvince || 'All',
      sentAt: new Date(),
      status: result.success > 0 ? 'sent' : 'failed',
      sentCount: result.success,
    });

    await notification.save();

    // Clean up invalid tokens
    if (result.errors && result.errors.length > 0) {
      const invalidTokens = result.errors
        .filter(e => e.error.includes('NOT_FOUND') || e.error.includes('Invalid') || e.error.includes('NotRegistered'))
        .map(e => tokens[e.index]);
      
      if (invalidTokens.length > 0) {
        console.log('Cleaning up', invalidTokens.length, 'invalid tokens');
        await Device.deleteMany({ fcmToken: { $in: invalidTokens } });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${result.success} devices`,
      results: {
        success: result.success,
        failed: result.failed,
        total: tokens.length,
      },
      notificationId: notification._id,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/send
 * Check if notification endpoint is available
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Send notification endpoint',
    methods: ['POST'],
    fields: {
      required: ['title', 'message'],
      optional: ['imageUrl', 'link'],
    },
  });
}
