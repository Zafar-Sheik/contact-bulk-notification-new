import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Device from '@/lib/models/device.model';
import Notification from '@/lib/models/notification.model';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fcmToken = searchParams.get('fcmToken');

    if (!fcmToken) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    await connectDB();

    const device = await Device.findOne({ fcmToken }).lean() as { province?: string } | null;

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const deviceProvince = device.province || '';
    
    // Fetch notifications for this province - newest first
    const notifications = await Notification.find({
      status: 'sent',
      $or: [
        { targetProvince: 'All' },
        { targetProvince: deviceProvince },
        { targetProvince: { $exists: false } },
        { targetProvince: '' }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n._id?.toString(),
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