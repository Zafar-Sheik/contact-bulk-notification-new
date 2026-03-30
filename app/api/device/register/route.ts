import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fcmToken, province, platform, browser, userAgent } = body;

    if (!fcmToken) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    await connectDB();

    // Check if device already exists
    let device = await Device.findOne({ fcmToken });

    if (device) {
      // Update existing device
      if (province) device.province = province;
      if (platform) device.platform = platform;
      if (browser) device.browser = browser;
      if (userAgent) device.userAgent = userAgent;
      await device.save();
      return NextResponse.json({ success: true, message: 'Device updated' });
    }

    // Create new device
    device = new Device({
      fcmToken,
      province: province || '',
      platform: platform || '',
      browser: browser || '',
      userAgent: userAgent || '',
    });
    await device.save();

    return NextResponse.json({ success: true, message: 'Device registered' });
  } catch (error) {
    console.error('Device registration error:', error);
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Device registration endpoint' });
}