import admin from 'firebase-admin';

/**
 * Firebase Admin SDK Configuration
 * 
 * Server-side Firebase for sending push notifications.
 * Uses service account credentials from environment variables.
 */

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Check if already initialized
let isInitialized = false;

/**
 * Get Firebase Admin credentials from environment variables
 */
function getServiceAccount(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

/**
 * Initialize Firebase Admin SDK
 * Uses singleton pattern to prevent multiple initializations
 * 
 * @returns Firebase Admin app instance
 * @throws Error if initialization fails
 */
export function initFirebaseAdmin(): admin.app.App {
  // Check if app already exists (handles hot reload in development)
  const existingApps = admin.apps;
  if (existingApps.length > 0) {
    isInitialized = true;
    return existingApps[0] as admin.app.App;
  }

  const serviceAccount = getServiceAccount();

  if (!serviceAccount) {
    throw new Error(
      'Firebase Admin credentials not configured. ' +
      'Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.'
    );
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized');
    return app;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    throw error;
  }
}

/**
 * Get Firebase Admin app instance
 * Initializes if not already done
 */
export function getFirebaseAdmin(): admin.app.App {
  // Always check if apps exist first (handles hot reload in development)
  if (admin.apps.length > 0) {
    isInitialized = true;
    return admin.apps[0] as admin.app.App;
  }
  
  if (!isInitialized) {
    return initFirebaseAdmin();
  }
  return admin.app();
}

/**
 * Get Firebase Messaging service
 */
export function getMessaging(): admin.messaging.Messaging {
  console.log('Firebase Admin: Getting messaging service...');
  const app = getFirebaseAdmin();
  console.log('Firebase Admin: App initialized, getting messaging');
  return app.messaging();
}

/**
 * Check if Firebase Admin is configured
 */
export function isFirebaseAdminConfigured(): boolean {
  return getServiceAccount() !== null;
}

/**
 * Send push notification to a single device
 * 
 * @param token FCM token of the target device
 * @param payload Notification payload
 * @returns Message ID if successful
 */
export async function sendToDevice(
  token: string,
  payload: admin.messaging.Message
): Promise<string> {
  const messaging = getMessaging();
  return messaging.send({ ...payload, token });
}

/**
 * Send push notification to multiple devices
 * 
 * @param tokens Array of FCM tokens
 * @param payload Notification payload
 * @returns BatchResponse with success/failure counts
 */
export async function sendToDevices(
  tokens: string[],
  payload: admin.messaging.Message
): Promise<admin.messaging.BatchResponse> {
  const messaging = getMessaging();
  return messaging.sendEachForMulticast({
    ...payload,
    tokens,
  });
}

/**
 * Send notification to topic
 * 
 * @param topic Topic name
 * @param payload Notification payload
 * @returns Message ID
 */
export async function sendToTopic(
  topic: string,
  payload: admin.messaging.Message
): Promise<string> {
  const messaging = getMessaging();
  return messaging.send({ ...payload, topic });
}

export default initFirebaseAdmin;
