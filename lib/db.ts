import mongoose from 'mongoose';

/**
 * MongoDB Connection Layer for Next.js 16
 * 
 * Features:
 * - Prevents multiple connections during hot reload
 * - Uses environment variables for connection string
 * - Cached connection pattern for production performance
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bulk-notification';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

// Initialize cache on global object to prevent multiple connections during hot reload
const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

/**
 * Connect to MongoDB using Mongoose
 * Uses cached connection pattern to prevent multiple connections
 * 
 * @returns Mongoose connection instance
 * @throws Error if connection fails
 */
async function connectDB(): Promise<typeof mongoose> {
  // Return cached connection if already established
  if (cached.conn) {
    return cached.conn;
  }

  // Return existing promise if connection is in progress
  if (cached.promise) {
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch (error) {
      // If promise failed, reset for next attempt
      cached.promise = null;
      throw error;
    }
  }

  // Connection options
  const opts = {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  // Create new connection promise
  cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
    console.log('✅ MongoDB connected successfully');
    return mongoose;
  });

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }

  return cached.conn;
}

/**
 * Disconnect from MongoDB
 * Useful for cleanup during server shutdown
 */
async function disconnectDB(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log('✅ MongoDB disconnected');
  }
}

/**
 * Get the current connection status
 */
function getConnectionStatus(): string {
  if (cached.conn?.connection.readyState === 1) {
    return 'connected';
  }
  if (cached.promise) {
    return 'connecting';
  }
  return 'disconnected';
}

export default connectDB;
export { connectDB, disconnectDB, getConnectionStatus };
