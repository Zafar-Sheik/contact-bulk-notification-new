import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';
import { parseUserAgent } from '@/lib/utils/helpers';
import type { DeviceRegistrationBody } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: DeviceRegistrationBody = await request.json();
    const { fcmToken, deviceInfo } = body;

    if (!fcmToken) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Parse user agent if not provided
    const userAgent = deviceInfo?.userAgent || request.headers.get('user-agent') || '';
    const { platform, browser } = deviceInfo?.platform 
      ? { platform: deviceInfo.platform, browser: deviceInfo.browser || 'unknown' }
      : parseUserAgent(userAgent);

    // Check if device already exists
    const existingDevice = await Device.findOne({ fcmToken });

    if (existingDevice) {
      // Initialize metadata if it doesn't exist (for backward compatibility)
      if (!existingDevice.metadata) {
        existingDevice.metadata = {
          appVersion: undefined,
          lastSeen: new Date(),
          createdAt: new Date(),
          isActive: true,
        };
      } else {
        // Update existing metadata
        existingDevice.metadata.lastSeen = new Date();
        existingDevice.metadata.isActive = true;
        if ((deviceInfo as { appVersion?: string })?.appVersion) {
          existingDevice.metadata.appVersion = (deviceInfo as { appVersion?: string }).appVersion;
        }
      }
      await existingDevice.save();

      return NextResponse.json({
        success: true,
        message: 'Device updated successfully',
        deviceId: existingDevice._id,
      });
    }

    // Create new device
    const device = new Device({
      fcmToken,
      deviceInfo: {
        platform,
        browser,
        userAgent,
        language: deviceInfo?.language || 'en',
      },
      metadata: {
        appVersion: (deviceInfo as { appVersion?: string })?.appVersion,
        lastSeen: new Date(),
        createdAt: new Date(),
        isActive: true,
      },
    });

    await device.save();

    return NextResponse.json({
      success: true,
      message: 'Device registered successfully',
      deviceId: device._id,
    });
  } catch (error) {
    console.error('Device registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register device' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    status: 'ok',
    message: 'Device registration endpoint is running',
  });
}
