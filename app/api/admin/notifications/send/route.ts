import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device, Notification } from '@/lib/models';
import { requireAuth } from '@/lib/auth/admin';
import { sendNotificationToAllDevices } from '@/lib/firebase/messaging';
import { validateNotificationPayload } from '@/lib/utils/helpers';
import type { SendNotificationBody } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await requireAuth();

    // Connect to database
    await connectDB();

    const body: SendNotificationBody = await request.json();
    const { title, message, image, link, scheduledAt } = body;

    // Validate notification payload
    const validation = validateNotificationPayload({ title, message });
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check if scheduled
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    
    if (isScheduled) {
      // Save as scheduled notification
      const notification = new Notification({
        title,
        message,
        imageUrl: image || '',
        link: link || '',
        scheduledAt: new Date(scheduledAt),
        status: 'scheduled',
        sentCount: 0,
        sentByAdmin: session.username,
      });

      await notification.save();

      return NextResponse.json({
        success: true,
        message: 'Notification scheduled successfully',
        notificationId: notification._id,
      });
    }

    // Get all active device tokens (including additional tokens in fcmTokens array)
    console.log('Fetching active devices...');
    const devices = await Device.find({ 'metadata.isActive': true }).lean().select('fcmToken fcmTokens') as { fcmToken: string; fcmTokens?: string[] }[];
    console.log('Found devices:', devices.length);
    
    if (devices.length === 0) {
      console.log('No active devices found in database');
      return NextResponse.json(
        { error: 'No active devices registered' },
        { status: 400 }
      );
    }

    // Collect all tokens (primary + additional)
    const tokens: string[] = [];
    devices.forEach((d) => {
      // Add primary token
      if (d.fcmToken) {
        tokens.push(d.fcmToken);
      }
      // Add additional tokens from array
      if (d.fcmTokens && d.fcmTokens.length > 0) {
        d.fcmTokens.forEach((t) => {
          if (t && !tokens.includes(t)) {
            tokens.push(t);
          }
        });
      }
    });
    console.log('Total FCM tokens:', tokens.length);
    console.log('FCM tokens:', tokens.length);

    // Save to notification history first (to get the _id)
    const sentAt = new Date();
    
    const notification = new Notification({
      title,
      message,
      imageUrl: image || '',
      link: link || '',
      sentAt,
      status: 'sent', // Start with sent, will update if all fail
      sentCount: 0,
      sentByAdmin: session.username,
    });

    await notification.save();
    
    // Get the notification ID to include in the push notification
    const notificationId = notification._id.toString();

    // Send notifications with the notification ID for deep linking
    console.log('Sending notifications via FCM...');
    const result = await sendNotificationToAllDevices(
      tokens,
      title,
      message,
      image,
      link,
      notificationId
    );
    console.log('FCM result:', result);
    
    // Update the notification with the actual send result
    const finalStatus = result.success > 0 ? 'sent' : 'failed';
    await Notification.findByIdAndUpdate(notification._id, {
      status: finalStatus,
      sentCount: result.success,
    });

    // Record notification history for each device that received it
    const notificationEntry = {
      notificationId: notification._id.toString(),
      title,
      message,
      image: image || '',
      link: link || '',
      receivedAt: new Date(),
      read: false,
    };

    // Update all devices that were targeted (check both fcmToken and fcmTokens array)
    await Device.updateMany(
      {
        $or: [
          { fcmToken: { $in: tokens } },
          { fcmTokens: { $in: tokens } }
        ]
      },
      { $push: { receivedNotifications: notificationEntry } }
    );

    // Clean up invalid tokens
    if (result.errors && result.errors.length > 0) {
      const invalidTokens = result.errors
        .filter(e => e.error.includes('NOT_FOUND') || e.error.includes('NotRegistered') || e.error.includes('Invalid'))
        .map(e => tokens[e.index]);
      
      console.log('Cleaning up', invalidTokens.length, 'invalid tokens');
      if (invalidTokens.length > 0) {
        // For each invalid token, either remove it from fcmTokens array or delete the device
        for (const invalidToken of invalidTokens) {
          // Try to find device with this as primary token
          const device = await Device.findOne({ fcmToken: invalidToken });
          if (device) {
            // Check if device has additional tokens
            if (device.fcmTokens && device.fcmTokens.length > 0) {
              // Promote an additional token to primary and remove invalid
              const validToken = device.fcmTokens?.find((t: string) => t !== invalidToken);
              if (validToken) {
                device.fcmToken = validToken;
                device.fcmTokens = device.fcmTokens?.filter((t: string) => t !== invalidToken && t !== validToken);
                await device.save();
              } else {
                // No valid tokens left, delete device
                await Device.deleteOne({ _id: device._id });
              }
            } else {
              // No additional tokens, delete device
              await Device.deleteOne({ _id: device._id });
            }
          } else {
            // Token might be in fcmTokens array of another device
            await Device.updateOne(
              { fcmTokens: invalidToken },
              { $pull: { fcmTokens: invalidToken } }
            );
          }
        }
        console.log('Cleaned up invalid tokens');
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${result.success} device${result.success !== 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
      results: {
        success: result.success,
        failed: result.failed,
        total: tokens.length,
      },
      notificationId: notification._id,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
