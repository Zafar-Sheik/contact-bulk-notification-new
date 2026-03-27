// TypeScript type definitions for the PWA Notification System

export interface IDevice {
  _id: string;
  fcmToken: string;
  province: 'Gauteng' | 'KwaZulu-Natal' | 'Western Cape' | 'Eastern Cape' | 'Free State' | 'Limpopo' | 'Mpumalanga' | 'North West' | 'Northern Cape' | 'unknown';
  deviceInfo: {
    platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
    browser: string;
    userAgent: string;
    language: string;
  };
  metadata: {
    appVersion?: string;
    lastSeen: Date;
    createdAt: Date;
    isActive: boolean;
  };
}

export interface INotification {
  _id: string;
  title: string;
  message: string;
  image?: string;
  link?: string;
  sentAt?: Date;
  scheduledAt?: Date;
  status: 'sent' | 'pending' | 'failed' | 'scheduled';
  targetProvince: string;
  recipientCount: number;
  createdBy?: string;
  createdAt: Date;
}

export interface IAdmin {
  _id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'superadmin';
  createdAt: Date;
  lastLogin?: Date;
}

export interface DeviceRegistrationBody {
  fcmToken: string;
  province?: string;
  deviceInfo: {
    deviceId?: string;
    platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
    browser: string;
    userAgent: string;
    language: string;
  };
}

export interface SendNotificationBody {
  title: string;
  message: string;
  image?: string;
  link?: string;
  scheduledAt?: string;
  targetProvince?: string;
}

export interface AdminLoginBody {
  username: string;
  password: string;
}

export interface JwtPayload {
  adminId: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface FCMMessage {
  // notification is optional - if not present, it's a data-only message
  // Data-only messages must be handled manually in service worker
  notification?: {
    title: string;
    body: string;
    image?: string;
  };
  data?: Record<string, string>; // For data payload
  webpush?: {
    headers?: {
      Urgency?: 'high' | 'normal' | 'low';
    };
    // notification is optional - data-only messages don't include it
    notification?: {
      icon?: string;
      badge?: string;
      tag?: string;
      title?: string;
      body?: string;
      image?: string;
      data?: Record<string, string>;
    };
    fcmOptions?: {
      link?: string;
    };
    data?: Record<string, string>;
  };
  tokens: string[];
}

export interface DeviceStats {
  total: number;
  active: number;
  inactive: number;
  byPlatform: Record<string, number>;
  byBrowser: Record<string, number>;
}

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  scheduled: number;
  averageRecipients: number;
}
