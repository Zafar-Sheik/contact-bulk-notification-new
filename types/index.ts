// TypeScript type definitions for the PWA Notification System

export interface IDevice {
  _id: string;
  fcmToken: string;
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
  deviceInfo: {
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
  notification: {
    title: string;
    body: string;
    image?: string;
  };
  webpush?: {
    notification?: {
      icon?: string;
      badge?: string;
      tag?: string;
      data?: Record<string, unknown>;
    };
    fcmOptions?: {
      link?: string;
    };
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
