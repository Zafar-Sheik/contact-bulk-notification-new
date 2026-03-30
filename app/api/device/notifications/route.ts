import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device, Notification } from '@/lib/models';

/**
 * GET /api/device/notifications
 * Get notifications for a device based on its province
 * Query params: ?fcmToken=<token>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fcmToken = searchParams.get('fcmToken');

    if (!fcmToken) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    await connectDB();

    const device = await Device.findOne({ fcmToken });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Get notifications sent to this device's province or province not set
    const deviceProvince = device.province || '';
    
    const query = {
      status: 'sent',
      $or: [
        { targetProvince: 'All' },
        { targetProvince: deviceProvince },
        { targetProvince: { $exists: false } },
        { targetProvince: '' }
      ]
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select('title message imageUrl link createdAt');

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n._id,
        title: n.title,
        message: n.message,
        image: n.imageUrl,
        link: n.link,
        receivedAt: n.createdAt,
      })),
      total: notifications.length,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}