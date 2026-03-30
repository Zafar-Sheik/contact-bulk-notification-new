import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';
import { requireAuth } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    await requireAuth();

    // Connect to database
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const platform = searchParams.get('platform');
    const browser = searchParams.get('browser');
    const active = searchParams.get('active');

    // Build query
    const query: Record<string, unknown> = {};
    
    if (platform) {
      query['deviceInfo.platform'] = platform;
    }
    
    if (browser) {
      query['deviceInfo.browser'] = browser;
    }
    
    if (active !== null) {
      query['metadata.isActive'] = active === 'true';
    }

    // Get total count
    const total = await Device.countDocuments(query);

    // Get devices
    const devices = await Device.find(query)
      .sort({ 'metadata.lastSeen': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-fcmToken'); // Exclude FCM tokens from response for security

    // Get statistics
    // Include devices without metadata as active for backwards compatibility
    const activeQuery = {
      $or: [
        { 'metadata.isActive': true },
        { metadata: { $exists: false } },
        { metadata: null }
      ]
    };
    const inactiveQuery = {
      'metadata.isActive': false,
      metadata: { $exists: true, $ne: null }
    };
    const stats = {
      total,
      active: await Device.countDocuments(activeQuery),
      inactive: await Device.countDocuments(inactiveQuery),
      byPlatform: await Device.aggregate([
        { $group: { _id: '$deviceInfo.platform', count: { $sum: 1 } } },
      ]),
      byBrowser: await Device.aggregate([
        { $group: { _id: '$deviceInfo.browser', count: { $sum: 1 } } },
      ]),
    };

    return NextResponse.json({
      devices,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get devices error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    await requireAuth();

    // Connect to database
    await connectDB();

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    const device = await Device.findByIdAndDelete(deviceId);

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    console.error('Delete device error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete device' },
      { status: 500 }
    );
  }
}
