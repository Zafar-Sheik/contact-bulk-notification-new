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

    // Check if device already exists by deviceId, fcmToken, or in fcmTokens array
    let existingDevice = null;
    
    if (deviceId) {
      // First check by persistent deviceId
      existingDevice = await Device.findOne({ deviceId });
      
      // If device exists with same deviceId but different platform (iOS duplicate issue)
      // Check if the platform type changed significantly (e.g., Android -> iOS or vice versa)
      if (existingDevice && platform !== 'unknown' && existingDevice.deviceInfo?.platform !== 'unknown') {
        if (existingDevice.deviceInfo.platform !== platform) {
          // Platform changed - this is likely a duplicate from a different platform
          // Remove the old device and create fresh
          console.log(`Platform change detected: ${existingDevice.deviceInfo.platform} -> ${platform}. Removing old device.`);
          await Device.deleteOne({ _id: existingDevice._id });
          existingDevice = null;
        }
      }

      // Safari browser duplicate detection - check for same browser with different FCM tokens
      // Safari often triggers multiple registrations due to service worker behavior
      if (existingDevice && browser === 'safari' && existingDevice.deviceInfo?.browser === 'safari') {
        // Check if we have an older device with the same browser
        const existingCreatedAt = existingDevice.metadata?.createdAt ? new Date(existingDevice.metadata.createdAt) : new Date();
        const potentialDuplicates = await Device.find({
          _id: { $ne: existingDevice._id },
          'deviceInfo.browser': 'safari',
          'deviceInfo.platform': platform,
          'metadata.createdAt': { $lt: existingCreatedAt } // Only find older devices
        }).sort({ 'metadata.createdAt': 1 }); // Get oldest first

        if (potentialDuplicates.length > 0) {
          // Delete older Safari duplicates, keep the newest one
          for (const dup of potentialDuplicates) {
            console.log(`Safari duplicate detected: Deleting older device ${dup._id}, keeping ${existingDevice._id}`);
            await Device.deleteOne({ _id: dup._id });
          }
        }
      }
    }
    
    // Also check by FCM token (for devices registered before deviceId was added)
    if (!existingDevice) {
      existingDevice = await Device.findOne({ fcmToken });
    }
    
    // Check if the FCM token exists in the fcmTokens array of any device
    if (!existingDevice) {
      existingDevice = await Device.findOne({ fcmTokens: fcmToken });
    }
    
    // If still no existing device, check for potential duplicates on same platform
    // This handles iOS reinstall scenario where deviceId changes but platform is same
    if (!existingDevice && platform !== 'unknown') {
      const potentialDuplicates = await Device.find({
        'deviceInfo.platform': platform,
        'deviceInfo.browser': browser
      }).limit(10);
      
      // If we find a device with same platform/browser but different deviceId,
      // it's likely a reinstall - update the deviceId instead of creating new
      if (potentialDuplicates.length > 0) {
        for (const dup of potentialDuplicates) {
          // Check if it's truly a reinstall by checking if old token exists in the new device's context
          // or if the device has been inactive for a while
          const lastSeen = dup.metadata?.lastSeen;
          const hoursSinceLastSeen = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60) : 999;
          
          // If device hasn't been seen in over 24 hours, likely a reinstall - update it
          if (hoursSinceLastSeen > 24) {
            console.log(`Potential duplicate device found (inactive for ${hoursSinceLastSeen.toFixed(1)} hours). Updating deviceId from ${dup.deviceId} to ${deviceId}`);
            dup.deviceId = deviceId;
            dup.metadata.lastSeen = new Date();
            dup.metadata.isActive = true;
            await dup.save();
            existingDevice = dup;
            break;
          }
        }
      }
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
        // ALWAYS set isActive to true for any device that registers
        // This ensures devices don't become inactive unexpectedly
        if (existingDevice.metadata.isActive === false) {
          existingDevice.metadata.isActive = true;
        }
        // Update lastSeen
        existingDevice.metadata.lastSeen = new Date();
        if ((deviceInfo as { appVersion?: string })?.appVersion) {
          existingDevice.metadata.appVersion = (deviceInfo as { appVersion?: string }).appVersion;
        }
      }

      // Initialize fcmTokens array if it doesn't exist
      if (!existingDevice.fcmTokens) {
        existingDevice.fcmTokens = [];
      }

      // Update primary FCM token if it changed (token refresh)
      if (existingDevice.fcmToken !== fcmToken) {
        // Add old token to fcmTokens array if it's not already there
        if (existingDevice.fcmToken && !existingDevice.fcmTokens.includes(existingDevice.fcmToken)) {
          existingDevice.fcmTokens.push(existingDevice.fcmToken);
        }
        // Set new token as primary
        existingDevice.fcmToken = fcmToken;
      } else if (!existingDevice.fcmTokens.includes(fcmToken) && existingDevice.fcmToken !== fcmToken) {
        // Add additional token to fcmTokens array
        existingDevice.fcmTokens.push(fcmToken);
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

    // Safari browser duplicate detection - check for existing Safari duplicates BEFORE creating new device
    // Safari often triggers multiple registrations due to service worker behavior
    // We delete older duplicates and keep the newest one
    if (browser === 'safari') {
      const potentialDuplicates = await Device.find({
        'deviceInfo.browser': 'safari',
        'deviceInfo.platform': platform,
        fcmToken: { $ne: fcmToken } // Don't delete the device we're about to create if token matches
      }).sort({ 'metadata.createdAt': 1 });

      if (potentialDuplicates.length > 0) {
        // Delete older Safari duplicates, keep the newest one
        // The most recently created device should remain
        for (const dup of potentialDuplicates) {
          // Only delete if this device is older than the current one we're about to create
          // Use lastSeen as a proxy for recency since we're creating with current timestamp
          console.log(`Safari: Auto-deleting older duplicate device ${dup._id} (created: ${dup.metadata?.createdAt}) to keep only the newest registration`);
          await Device.deleteOne({ _id: dup._id });
        }
      }
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
