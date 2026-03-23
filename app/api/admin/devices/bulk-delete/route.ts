import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';
import { requireAdmin } from '@/lib/auth/admin';

/**
 * POST /api/admin/devices/bulk-delete
 * Delete multiple devices by IDs
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    await requireAdmin();

    // Connect to database
    await connectDB();

    // Parse request body
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No device IDs provided' },
        { status: 400 }
      );
    }

    // Delete devices
    const result = await Device.deleteMany({
      _id: { $in: ids }
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} device(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete devices' },
      { status: 500 }
    );
  }
}
