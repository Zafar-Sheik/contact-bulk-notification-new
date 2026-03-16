import mongoose, { Schema, Document } from 'mongoose';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'scheduled';

export interface INotification extends Document {
  title: string;
  message: string;
  imageUrl?: string;
  link?: string;
  sentByAdmin: string;
  status: NotificationStatus;
  sentCount: number;
  sentAt?: Date;
  scheduledAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    link: {
      type: String,
      default: '',
      trim: true,
    },
    sentByAdmin: {
      type: String,
      required: [true, 'Admin ID is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'scheduled'],
      default: 'pending',
      required: true,
    },
    sentCount: {
      type: Number,
      default: 0,
      min: [0, 'Sent count cannot be negative'],
    },
    sentAt: {
      type: Date,
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for efficient queries
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ sentByAdmin: 1 });
NotificationSchema.index({ status: 1, createdAt: -1 });

// Prevent model overwrite in development
export const Notification = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
