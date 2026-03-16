import mongoose, { Schema, Document } from 'mongoose';
import type { IDevice } from '@/types';

export interface IDeviceDocument extends Omit<IDevice, '_id'>, Document {}

const DeviceSchema = new Schema<IDeviceDocument>(
  {
    fcmToken: {
      type: String,
      required: true,
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
      appVersion: {
        type: String,
      },
      lastSeen: {
        type: Date,
        default: Date.now,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: false,
  }
);

// Index for efficient queries
DeviceSchema.index({ 'metadata.isActive': 1 });
DeviceSchema.index({ 'metadata.lastSeen': -1 });
DeviceSchema.index({ 'deviceInfo.platform': 1 });
DeviceSchema.index({ 'deviceInfo.browser': 1 });

const Device = mongoose.models.Device || mongoose.model<IDeviceDocument>('Device', DeviceSchema);

export default Device;
