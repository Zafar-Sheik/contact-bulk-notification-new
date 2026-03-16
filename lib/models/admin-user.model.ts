import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUser extends Document {
  email: string;
  passwordHash: string;
  role: 'ADMIN';
  createdAt: Date;
  lastLogin?: Date;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['ADMIN'],
      default: 'ADMIN',
      required: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for efficient queries
AdminUserSchema.index({ role: 1 });

// Prevent model overwrite in development
export const AdminUser = mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);

export default AdminUser;
