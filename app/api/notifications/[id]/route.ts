import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Notification from '@/lib/models/notification.model';
import mongoose from 'mongoose';

/**
 * GET /api/notifications/[id]
 * 
 * Fetch a single notification by ID
 * 
 * Returns:
 * - success: boolean
 * - notification: notification object
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Connect to database
    await connectDB();
    
    // Validate the ID
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification ID' },
        { status: 400 }
      );
    }
    
    // Fetch the notification
    const notification = await Notification.findById(id).lean() as Record<string, unknown> | null;
    
    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }
    
    // Format notification for response
    const sentAt = notification.sentAt || notification.createdAt;
    const formattedNotification = {
      _id: notification._id?.toString(),
      title: notification.title,
      message: notification.message,
      image: notification.imageUrl || notification.image || '',
      link: notification.link || '',
      sentAt: sentAt ? new Date(sentAt as unknown as Date).toISOString() : undefined,
      createdAt: notification.createdAt ? new Date(notification.createdAt as unknown as Date).toISOString() : undefined,
      status: notification.status,
    };
    
    return NextResponse.json({
      success: true,
      notification: formattedNotification,
    });
  } catch (error) {
    console.error('Fetch notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}
