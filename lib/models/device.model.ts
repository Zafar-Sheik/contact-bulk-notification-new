import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice extends Document {
  fcmToken: string;
  platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
  browser: string;
  os: string;
  lastSeen: Date;
  createdAt: Date;
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
}

const DeviceSchema = new Schema<IDevice>(
  {
    fcmToken: {
      type: String,
      required: [true, 'FCM token is required'],
      unique: true,
      index: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'windows', 'mac', 'linux', 'unknown'],
      default: 'unknown',
      required: true,
    },
    browser: {
      type: String,
      default: 'unknown',
      trim: true,
    },
    os: {
      type: String,
      default: '',
      trim: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      required: true,
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
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for efficient queries
DeviceSchema.index({ platform: 1, createdAt: -1 });
DeviceSchema.index({ lastSeen: -1 });
DeviceSchema.index({ createdAt: -1 });
DeviceSchema.index({ 'metadata.isActive': 1 });
DeviceSchema.index({ 'metadata.lastSeen': -1 });
DeviceSchema.index({ 'receivedNotifications.receivedAt': -1 });

// Update lastSeen before save
DeviceSchema.pre('save', function (next) {
  this.lastSeen = new Date();
  next();
});

// Prevent model overwrite in development
export const Device = mongoose.models.Device || mongoose.model<IDevice>('Device', DeviceSchema);

export default Device;
