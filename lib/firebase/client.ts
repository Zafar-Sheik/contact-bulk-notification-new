import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

/**
 * Firebase Client SDK Configuration
 * 
 * Used for client-side FCM token generation and foreground message handling.
 * This runs in the browser and needs public Firebase config.
 */

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

// Get Firebase config from environment variables
const firebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '',
};

let messagingInstance: Messaging | null = null;
let appInstance: FirebaseApp | null = null;

/**
 * Initialize Firebase Client SDK
 * Uses singleton pattern to prevent multiple initializations
 * 
 * @returns FirebaseApp instance or null if already initialized
 */
export function initFirebase(): FirebaseApp | null {
  if (typeof window === 'undefined') {
    console.warn('Firebase Client can only be initialized in browser');
    return null;
  }

  try {
    // Return existing app if initialized
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(firebaseConfig);
    }
    return appInstance;
  } catch (error) {
    console.error('Firebase Client initialization error:', error);
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 * 
 * @returns Messaging instance or null if not available
 */
export function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!messagingInstance) {
    const app = appInstance || initFirebase();
    if (app) {
      try {
        messagingInstance = getMessaging(app);
      } catch (error) {
        console.error('Error getting messaging instance:', error);
        return null;
      }
    }
  }

  return messagingInstance;
}

/**
 * Check if Firebase is properly configured
 * 
 * @returns true if all required config is present
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.vapidKey
  );
}

/**
 * Get current notification permission status
 * 
 * @returns 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Check if push messaging is supported in the browser
 * 
 * @returns true if supported
 */
export function isNotificationsSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Request notification permission from user
 * 
 * @returns Permission status
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!('Notification' in window)) {
    return null;
  }

  try {
    const messaging = getMessagingInstance();
    if (!messaging) {
      return null;
    }

    const vapidKey = firebaseConfig.vapidKey;
    if (!vapidKey) {
      console.error('VAPID key not configured');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Subscribe to foreground messages
 * 
 * @param callback Function to handle incoming messages
 * @returns Unsubscribe function
 */
export function onForegroundMessage(
  callback: (payload: unknown) => void
): () => void {
  const messaging = getMessagingInstance();
  
  if (!messaging) {
    console.warn('Messaging not available');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}

export default initFirebase;
export { firebaseConfig };
