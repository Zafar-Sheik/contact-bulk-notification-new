import mongoose, { Schema, Document } from 'mongoose';
import type { INotification } from '@/types';

export interface INotificationDocument extends Omit<INotification, '_id'>, Document {}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    link: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
    },
    scheduledAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['sent', 'pending', 'failed', 'scheduled'],
      default: 'pending',
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes for efficient queries
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ scheduledAt: 1 });
NotificationSchema.index({ sentAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model<INotificationDocument>('Notification', NotificationSchema);

export default Notification;
