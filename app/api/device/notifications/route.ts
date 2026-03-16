import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';

/**
 * GET /api/device/notifications
 * Get notification history for a specific device by FCM token
 * Query params: ?fcmToken=<token>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fcmToken = searchParams.get('fcmToken');

    if (!fcmToken) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Find device by FCM token
    const device = await Device.findOne({ fcmToken });

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Get received notifications, sorted by most recent first
    const notifications = (device.receivedNotifications || [])
      .sort((a: { receivedAt: Date }, b: { receivedAt: Date }) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .map((n: { notificationId: string; title: string; message: string; image?: string; link?: string; receivedAt: Date; read: boolean }) => ({
        id: n.notificationId,
        title: n.title,
        message: n.message,
        image: n.image,
        link: n.link,
        receivedAt: n.receivedAt,
        read: n.read,
      }));

    // Get unread count
    const unreadCount = (device.receivedNotifications || []).filter((n: { read: boolean }) => !n.read).length;

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error('Get device notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/device/notifications
 * Mark notifications as read
 * Body: { fcmToken: string, notificationIds: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fcmToken, notificationIds } = body;

    if (!fcmToken || !notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: 'FCM token and notification IDs are required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Find and update device
    const device = await Device.findOneAndUpdate(
      { fcmToken },
      {
        $set: {
          'receivedNotifications.$[elem].read': true,
        },
      },
      {
        arrayFilters: [{ elem: { notificationId: { $in: notificationIds } } }],
        new: true,
      }
    );

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Marked ${notificationIds.length} notifications as read`,
    });
  } catch (error) {
    console.error('Mark notifications as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
