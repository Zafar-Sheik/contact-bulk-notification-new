import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Device } from '@/lib/models';

/**
 * Device Registration API
 * 
 * POST /api/devices/register
 * 
 * Body:
 * {
 *   fcmToken: string,
 *   browser: string,
 *   platform: string,
 *   os: string,
 *   lastSeen?: Date
 * }
 * 
 * Prevents duplicate tokens by updating existing records.
 */

interface DeviceRegistrationBody {
  fcmToken: string;
  browser?: string;
  platform?: string;
  os?: string;
  lastSeen?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeviceRegistrationBody = await request.json();
    const { fcmToken, browser, platform, os, lastSeen } = body;

    // Validate FCM token
    if (!fcmToken || typeof fcmToken !== 'string') {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Check if device with this token already exists
    const existingDevice = await Device.findOne({ fcmToken });

    if (existingDevice) {
      // Update existing device
      existingDevice.browser = browser || existingDevice.browser;
      existingDevice.platform = platform || existingDevice.platform;
      existingDevice.os = os || existingDevice.os;
      existingDevice.lastSeen = lastSeen ? new Date(lastSeen) : new Date();
      
      await existingDevice.save();

      return NextResponse.json({
        success: true,
        message: 'Device updated successfully',
        deviceId: existingDevice._id,
        isNew: false,
      });
    }

    // Create new device
    const device = new Device({
      fcmToken,
      browser: browser || 'unknown',
      platform: platform || 'unknown',
      os: os || '',
      lastSeen: lastSeen ? new Date(lastSeen) : new Date(),
    });

    await device.save();

    return NextResponse.json({
      success: true,
      message: 'Device registered successfully',
      deviceId: device._id,
      isNew: true,
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
