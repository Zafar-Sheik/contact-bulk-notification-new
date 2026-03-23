import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Notification from '@/lib/models/notification.model';

export async function POST(request: Request) {
  try {
    await connectDB();
    
    const { ids } = await request.json();
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No notification IDs provided' },
        { status: 400 }
      );
    }
    
    const result = await Notification.deleteMany({
      _id: { $in: ids }
    });
    
    return NextResponse.json({
      success: true,
      deleted: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting notifications:', error);
    return NextResponse.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
