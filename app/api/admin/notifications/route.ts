import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Notification } from '@/lib/models';
import { requireAuth } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    await requireAuth();

    // Connect to database
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    // Build query
    const query: Record<string, unknown> = {};
    
    if (status) {
      query.status = status;
    }

    // Get total count
    const total = await Notification.countDocuments(query);

    // Get notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Transform notifications to match frontend expectations
    const transformedNotifications = notifications.map((notification: Record<string, unknown>) => {
      // Use sentAt if available, otherwise use scheduledAt, otherwise use createdAt
      const sentAt = notification.sentAt ? new Date(notification.sentAt as Date).toISOString() : 
                     (notification.scheduledAt ? new Date(notification.scheduledAt as Date).toISOString() : 
                     (notification.createdAt ? new Date(notification.createdAt as Date).toISOString() : undefined));
      
      return {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        image: notification.imageUrl || '',
        link: notification.link || '',
        status: notification.status,
        recipientCount: notification.sentCount || 0,
        sentAt,
        scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt as Date).toISOString() : undefined,
        createdAt: notification.createdAt ? new Date(notification.createdAt as Date).toISOString() : undefined,
      };
    });

    // Get statistics
    const stats = {
      total,
      sent: await Notification.countDocuments({ status: 'sent' }),
      failed: await Notification.countDocuments({ status: 'failed' }),
      scheduled: await Notification.countDocuments({ status: 'scheduled' }),
      pending: await Notification.countDocuments({ status: 'pending' }),
    };

    return NextResponse.json({
      notifications: transformedNotifications,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
