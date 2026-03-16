import { getToken as getClientToken } from 'firebase/messaging';
import { initFirebase, getMessagingInstance, firebaseConfig } from './client';
import { isFirebaseAdminConfigured, initFirebaseAdmin } from './admin';
import connectDB from '@/lib/db';
import { Device } from '@/lib/models';

/**
 * Device Information Interface
 */
export interface DeviceInfo {
  platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
  browser: string;
  os: string;
  userAgent: string;
  language: string;
  appVersion?: string;
}

/**
 * Parse user agent string to extract device info
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  
  let platform: DeviceInfo['platform'] = 'unknown';
  let browser = 'unknown';
  let os = '';
  
  // Detect platform
  if (ua.includes('android')) {
    platform = 'android';
    os = 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    platform = 'ios';
    os = ua.includes('ipad') ? 'iPadOS' : 'iOS';
  } else if (ua.includes('windows')) {
    platform = 'windows';
    os = 'Windows';
  } else if (ua.includes('mac')) {
    platform = 'mac';
    os = 'macOS';
  } else if (ua.includes('linux')) {
    platform = 'linux';
    os = 'Linux';
  }
  
  // Detect browser
  if (ua.includes('chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
  } else if (ua.includes('edge')) {
    browser = 'Edge';
  } else if (ua.includes('opera')) {
    browser = 'Opera';
  }
  
  return {
    platform,
    browser,
    os,
    userAgent,
    language: 'en',
  };
}

/**
 * Generate FCM token for client-side
 * This should be called from the browser
 * 
 * @returns FCM token or null if failed
 */
export async function generateClientToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    console.error('generateClientToken must be called from browser');
    return null;
  }

  // Check if Firebase is configured
  if (!firebaseConfig.vapidKey) {
    console.error('Firebase VAPID key not configured');
    return null;
  }

  // Check notification permission
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.error('Notification permission not granted');
    return null;
  }

  try {
    // Initialize Firebase Client
    initFirebase();
    
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.error('Failed to get messaging instance');
      return null;
    }

    // Get FCM token
    const token = await getClientToken(messaging, {
      vapidKey: firebaseConfig.vapidKey,
    });

    return token;
  } catch (error) {
    console.error('Error generating FCM token:', error);
    return null;
  }
}

/**
 * Register device with FCM token to MongoDB
 * 
 * @param fcmToken FCM token from client
 * @param deviceInfo Device information
 * @returns Device ID from MongoDB
 */
export async function registerDevice(
  fcmToken: string,
  deviceInfo?: Partial<DeviceInfo>
): Promise<string | null> {
  if (!fcmToken) {
    console.error('FCM token is required');
    return null;
  }

  try {
    // Connect to database
    await connectDB();

    // Parse user agent if not provided
    const userAgent = deviceInfo?.userAgent || '';
    const parsedInfo = parseUserAgent(userAgent);
    
    // Merge provided info with parsed info
    const finalInfo: DeviceInfo = {
      ...parsedInfo,
      ...deviceInfo,
      platform: deviceInfo?.platform || parsedInfo.platform,
      browser: deviceInfo?.browser || parsedInfo.browser,
    };

    // Check if device already exists
    const existingDevice = await Device.findOne({ fcmToken });

    if (existingDevice) {
      // Update existing device
      existingDevice.platform = finalInfo.platform;
      existingDevice.browser = finalInfo.browser;
      existingDevice.os = finalInfo.os;
      existingDevice.lastSeen = new Date();
      await existingDevice.save();
      
      console.log('Device updated:', existingDevice._id);
      return existingDevice._id.toString();
    }

    // Create new device
    const device = new Device({
      fcmToken,
      platform: finalInfo.platform,
      browser: finalInfo.browser,
      os: finalInfo.os,
      lastSeen: new Date(),
    });

    await device.save();
    console.log('Device registered:', device._id);
    return device._id.toString();
  } catch (error) {
    console.error('Error registering device:', error);
    return null;
  }
}

/**
 * Complete device registration flow
 * 1. Generate FCM token
 * 2. Request notification permission
 * 3. Save to MongoDB
 * 
 * @param deviceInfo Optional device information
 * @returns Registration result
 */
export async function completeDeviceRegistration(
  deviceInfo?: Partial<DeviceInfo>
): Promise<{
  success: boolean;
  token?: string;
  deviceId?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Must be called from browser' };
  }

  // Request notification permission
  if (!('Notification' in window)) {
    return { success: false, error: 'Notifications not supported' };
  }

  let permission: NotificationPermission = Notification.permission;
  
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      return { success: false, error: 'Permission denied' };
    }
  }

  if (permission !== 'granted') {
    return { success: false, error: 'Permission not granted' };
  }

  // Generate FCM token
  const token = await generateClientToken();
  if (!token) {
    return { success: false, error: 'Failed to generate token' };
  }

  // Save to MongoDB
  const deviceId = await registerDevice(token, deviceInfo);
  if (!deviceId) {
    return { success: false, error: 'Failed to register device' };
  }

  return {
    success: true,
    token,
    deviceId,
  };
}

/**
 * Unregister device from MongoDB
 * 
 * @param fcmToken FCM token to remove
 * @returns true if successful
 */
export async function unregisterDevice(fcmToken: string): Promise<boolean> {
  if (!fcmToken) {
    return false;
  }

  try {
    await connectDB();
    await Device.deleteOne({ fcmToken });
    console.log('Device unregistered:', fcmToken.substring(0, 20) + '...');
    return true;
  } catch (error) {
    console.error('Error unregistering device:', error);
    return false;
  }
}

/**
 * Check if FCM is properly configured on server
 */
export function isFCMConfigured(): boolean {
  const clientConfigured = !!(
    firebaseConfig.apiKey &&
    firebaseConfig.vapidKey
  );
  
  const serverConfigured = isFirebaseAdminConfigured();
  
  return clientConfigured && serverConfigured;
}

export default completeDeviceRegistration;
