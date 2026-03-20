import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Device } from '@/lib/models';

interface ProvinceUpdateBody {
  fcmToken: string;
  province: string;
}

/**
 * PUT /api/device/province
 * Update the province for a device
 */
export async function PUT(request: NextRequest) {
  try {
    const body: ProvinceUpdateBody = await request.json();
    const { fcmToken, province } = body;

    if (!fcmToken) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    if (!province) {
      return NextResponse.json(
        { error: 'Province is required' },
        { status: 400 }
      );
    }

    // Validate province
    const validProvinces = [
      'Gauteng',
      'KwaZulu-Natal',
      'Western Cape',
      'Eastern Cape',
      'Free State',
      'Limpopo',
      'Mpumalanga',
      'North West',
      'Northern Cape',
      'unknown',
    ];

    if (!validProvinces.includes(province)) {
      return NextResponse.json(
        { error: 'Invalid province' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Find and update device
    const device = await Device.findOneAndUpdate(
      { fcmToken },
      { province },
      { new: true }
    );

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Province updated successfully',
      province: device.province,
    });
  } catch (error) {
    console.error('Province update error:', error);
    return NextResponse.json(
      { error: 'Failed to update province' },
      { status: 500 }
    );
  }
}
