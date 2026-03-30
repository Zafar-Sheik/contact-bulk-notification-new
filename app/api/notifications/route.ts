import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Notification from '@/lib/models/notification.model';

/**
 * GET /api/notifications
 * 
 * Fetch notifications for the public page
 * Returns the latest notifications sent to devices
 * 
 * Query params:
 * - limit: number (default: 3, max: 10)
 * 
 * Returns:
 * - success: boolean
 * - notifications: array of notification objects
 */
export async function GET(request: NextRequest) {
  try {
    // Connect to database
    await connectDB();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 10);

    // Fetch latest sent notifications - newest first
    const notifications = await Notification.find({ status: 'sent' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Format notifications for response
    const formattedNotifications = notifications.map(notification => ({
      _id: notification._id?.toString(),
      title: notification.title,
      message: notification.message,
      image: notification.imageUrl || notification.image || '',
      link: notification.link || '',
      sentAt: notification.sentAt?.toISOString() || notification.createdAt?.toISOString(),
      createdAt: notification.createdAt?.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
