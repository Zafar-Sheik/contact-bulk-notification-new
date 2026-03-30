import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Notification from '@/lib/models/notification.model';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 10);

    // Fetch latest notifications - newest first
    const notifications = await Notification.find({ status: 'sent' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      notifications: notifications.map(n => ({
        _id: n._id?.toString(),
        title: n.title,
        message: n.message,
        image: n.imageUrl || '',
        link: n.link || '',
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}