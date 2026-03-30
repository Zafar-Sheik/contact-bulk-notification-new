import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device, Notification } from '@/lib/models';
import { sendNotificationToAllDevices } from '@/lib/firebase/messaging';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { title, message, image, link, targetProvince } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Title and message required' }, { status: 400 });
    }

    // Filter devices by province - if targetProvince is set, only send to those devices
    let query = {};
    if (targetProvince && targetProvince !== 'All') {
      // Send to matching province OR devices with no province set
      query = {
        $or: [
          { province: targetProvince },
          { province: { $exists: false } },
          { province: '' }
        ]
      };
    }
    
    const devices = await Device.find(query).lean().select('fcmToken') as { fcmToken: string }[];
    
    if (devices.length === 0) {
      return NextResponse.json({ error: 'No devices registered for this province' }, { status: 400 });
    }

    const tokens = devices.map(d => d.fcmToken).filter(Boolean);

    // Save notification
    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      imageUrl: image || '',
      link: link || '',
      sentByAdmin: 'admin',
      targetProvince: targetProvince || 'All',
      status: 'sent',
      sentCount: tokens.length,
    });
    await notification.save();

    // Send
    const result = await sendNotificationToAllDevices(
      tokens,
      title.trim(),
      message.trim(),
      image,
      link
    );

    return NextResponse.json({
      success: true,
      message: `Sent to ${result.success} devices`,
      results: result,
    });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', methods: ['POST'] });
}