import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';
import { requireAuth } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const platform = searchParams.get('platform');
    const browser = searchParams.get('browser');

    const query: Record<string, unknown> = {};
    
    if (platform) {
      query.platform = platform;
    }
    
    if (browser) {
      query.browser = browser;
    }

    const total = await Device.countDocuments(query);

    const devices = await Device.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-fcmToken');

    const stats = {
      total,
      active: total,
      inactive: 0,
      byPlatform: await Device.aggregate([
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      byBrowser: await Device.aggregate([
        { $group: { _id: '$browser', count: { $sum: 1 } } },
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const device = await Device.findByIdAndDelete(deviceId);

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    console.error('Delete device error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 });
  }
}