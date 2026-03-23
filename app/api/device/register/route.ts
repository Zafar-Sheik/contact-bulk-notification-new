import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';
import { parseUserAgent } from '@/lib/utils/helpers';
import type { DeviceRegistrationBody } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body: DeviceRegistrationBody = await request.json();
    const { fcmToken, deviceInfo, province } = body;

    if (!fcmToken) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Get or generate a persistent device ID
    // This helps identify the same device even if FCM token changes
    const clientDeviceId = deviceInfo?.deviceId || request.headers.get('x-device-id');
    let deviceId = clientDeviceId;

    // Parse user agent if not provided
    const userAgent = deviceInfo?.userAgent || request.headers.get('user-agent') || '';
    const { platform, browser } = deviceInfo?.platform 
      ? { platform: deviceInfo.platform, browser: deviceInfo.browser || 'unknown' }
      : parseUserAgent(userAgent);

    // Check if device already exists by deviceId or fcmToken
    let existingDevice = null;
    
    if (deviceId) {
      // First check by persistent deviceId
      existingDevice = await Device.findOne({ deviceId });
    }
    
    // Also check by FCM token (for devices registered before deviceId was added)
    if (!existingDevice) {
      existingDevice = await Device.findOne({ fcmToken });
    }

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

      // Update FCM token if it changed (token refresh)
      if (existingDevice.fcmToken !== fcmToken) {
        existingDevice.fcmToken = fcmToken;
      }

      // Update deviceId if not set
      if (!existingDevice.deviceId && deviceId) {
        existingDevice.deviceId = deviceId;
      }

      // Update province if provided
      if (province) {
        existingDevice.province = province;
      }

      await existingDevice.save();

      return NextResponse.json({
        success: true,
        message: 'Device updated successfully',
        deviceId: existingDevice.deviceId || existingDevice._id.toString(),
      });
    }

    // Generate a new deviceId if not provided
    if (!deviceId) {
      deviceId = uuidv4();
    }

    // Create new device
    const device = new Device({
      deviceId,
      fcmToken,
      province: province || 'unknown',
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
