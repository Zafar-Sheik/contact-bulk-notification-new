import mongoose, { Schema, Document } from 'mongoose';

/**
 * Device Interface - Unified model for device registration and notification sending
 */
export interface IDevice extends Document {
  fcmToken: string;
  deviceInfo: {
    platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
    browser: string;
    userAgent: string;
    language: string;
  };
  metadata: {
    isActive: boolean;
    lastSeen: Date;
    createdAt: Date;
    appVersion?: string;
  };
  receivedNotifications: Array<{
    notificationId: string;
    title: string;
    message: string;
    image?: string;
    link?: string;
    receivedAt: Date;
    read: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    fcmToken: {
      type: String,
      required: [true, 'FCM token is required'],
      unique: true,
      index: true,
    },
    deviceInfo: {
      platform: {
        type: String,
        enum: ['android', 'ios', 'windows', 'mac', 'linux', 'unknown'],
        default: 'unknown',
      },
      browser: {
        type: String,
        default: 'unknown',
      },
      userAgent: {
        type: String,
        default: '',
      },
      language: {
        type: String,
        default: 'en',
      },
    },
    metadata: {
      isActive: {
        type: Boolean,
        default: true,
      },
      lastSeen: {
        type: Date,
        default: Date.now,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      appVersion: {
        type: String,
      },
    },
    receivedNotifications: {
      type: [{
        notificationId: { type: String, required: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' },
        receivedAt: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
      }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
DeviceSchema.index({ 'deviceInfo.platform': 1 });
DeviceSchema.index({ 'deviceInfo.browser': 1 });
DeviceSchema.index({ 'metadata.isActive': 1 });
DeviceSchema.index({ 'metadata.lastSeen': -1 });
DeviceSchema.index({ fcmToken: 1 });

// Update lastSeen before save
DeviceSchema.pre('save', function (next) {
  if (this.isModified()) {
    this.metadata.lastSeen = new Date();
  }
  next();
});

// Prevent model overwrite in development
const Device = mongoose.models.Device || mongoose.model<IDevice>('Device', DeviceSchema);

export default Device;
