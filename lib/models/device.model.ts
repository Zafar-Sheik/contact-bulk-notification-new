import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice extends Document {
  fcmToken: string;
  province: string;
  platform: string;
  browser: string;
  userAgent: string;
  createdAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    fcmToken: {
      type: String,
      required: true,
      unique: true,
    },
    province: {
      type: String,
      default: '',
    },
    platform: {
      type: String,
      default: '',
    },
    browser: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

DeviceSchema.index({ fcmToken: 1 });
DeviceSchema.index({ province: 1 });

const Device = mongoose.models.Device || mongoose.model<IDevice>('Device', DeviceSchema);

export default Device;