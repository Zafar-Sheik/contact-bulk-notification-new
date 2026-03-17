'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  initFirebase, 
  requestNotificationPermission,
  getFcmToken,
  onForegroundMessage,
  isNotificationsSupported,
  getNotificationPermission
} from '@/lib/firebase/client';

interface PWAContextType {
  isReady: boolean;
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  token: string | null;
  isRegistering: boolean;
  error: string | null;
  registerDevice: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | null>(null);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within PWAProvider');
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const supported = isNotificationsSupported();
    setIsSupported(supported);
    
    if (supported) {
      setPermission(getNotificationPermission());
    }

    // Initialize Firebase
    initFirebase();
    setIsReady(true);
  }, []);

  // Auto-register device on mount if permission is granted
  useEffect(() => {
    if (!isReady || !isSupported) return;
    
    // Auto-register if permission was already granted
    const autoRegister = async () => {
      if (permission === 'granted' && !token) {
        try {
          setIsRegistering(true);
          const fcmToken = await getFcmToken();
          
          if (fcmToken) {
            setToken(fcmToken);
            
            const response = await fetch('/api/device/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fcmToken }),
            });

            if (response.ok) {
              const data = await response.json();
              console.log('Device auto-registered:', data);
            }
          }
        } catch (err) {
          console.error('Auto-registration error:', err);
        } finally {
          setIsRegistering(false);
        }
      }
    };

    autoRegister();
  }, [isReady, isSupported, permission, token]);

  // Listen for foreground messages
  useEffect(() => {
    if (!isReady || !isSupported) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground message received:', payload);
    });

    return () => {
      unsubscribe();
    };
  }, [isReady, isSupported]);

  const registerDevice = async () => {
    if (!isSupported) {
      setError('Notifications are not supported on this device');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Request permission from browser
      const permission = await requestNotificationPermission();
      setPermission(permission);
      
      if (permission !== 'granted') {
        setError('Notification permission denied');
        setIsRegistering(false);
        return;
      }

      // Get FCM token after permission is granted
      const fcmToken = await getFcmToken();
      
      if (fcmToken) {
        setToken(fcmToken);
        
        // Register device with backend
        const response = await fetch('/api/device/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fcmToken,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to register device');
        }

        const data = await response.json();
        console.log('Device registered:', data);
      }
    } catch (err) {
      console.error('Error registering device:', err);
      setError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isReady,
        isSupported,
        permission,
        token,
        isRegistering,
        error,
        registerDevice,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
