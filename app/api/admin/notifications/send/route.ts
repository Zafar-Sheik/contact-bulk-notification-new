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

    // Get all active device tokens
    console.log('Fetching active devices...');
    const devices = await Device.find({ 'metadata.isActive': true }).lean().select('fcmToken') as { fcmToken: string }[];
    console.log('Found devices:', devices.length);
    
    if (devices.length === 0) {
      console.log('No active devices found in database');
      return NextResponse.json(
        { error: 'No active devices registered' },
        { status: 400 }
      );
    }

    const tokens = devices.map((d) => d.fcmToken);
    console.log('FCM tokens:', tokens.length);

    // Send notifications
    console.log('Sending notifications via FCM...');
    const result = await sendNotificationToAllDevices(
      tokens,
      title,
      message,
      image,
      link
    );
    console.log('FCM result:', result);

    // Save to notification history first (to get the _id)
    const sentAt = new Date();
    // Determine status: 'sent' if at least one succeeded, 'failed' if all failed
    const status = result.success > 0 ? 'sent' : 'failed';
    
    const notification = new Notification({
      title,
      message,
      imageUrl: image || '',
      link: link || '',
      sentAt,
      status,
      sentCount: result.success,
      sentByAdmin: session.username,
    });

    await notification.save();

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

    // Update all devices that were targeted
    await Device.updateMany(
      { fcmToken: { $in: tokens } },
      { $push: { receivedNotifications: notificationEntry } }
    );

    // Clean up invalid tokens
    if (result.errors && result.errors.length > 0) {
      const invalidTokens = result.errors
        .filter(e => e.error.includes('NOT_FOUND') || e.error.includes('NotRegistered') || e.error.includes('Invalid'))
        .map(e => tokens[e.index]);
      
      console.log('Cleaning up', invalidTokens.length, 'invalid tokens');
      if (invalidTokens.length > 0) {
        await Device.deleteMany({ fcmToken: { $in: invalidTokens } });
        console.log('Removed', invalidTokens.length, 'invalid devices from database');
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
