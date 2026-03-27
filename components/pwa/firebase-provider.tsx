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
  registerDevice: (province?: string) => Promise<void>;
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
    
    // Check if device is already registered and get stored token
    const isRegistered = localStorage.getItem('deviceRegistered');
    const storedToken = localStorage.getItem('fcmToken');
    
    // Auto-register if permission was already granted
    const autoRegister = async () => {
      if (permission === 'granted' && !token) {
        try {
          setIsRegistering(true);
          const fcmToken = await getFcmToken();
          
          if (fcmToken) {
            // Check if token has changed or not registered yet
            const shouldRegister = !isRegistered || fcmToken !== storedToken;
            
            if (shouldRegister) {
              setToken(fcmToken);
              
              // Get province from localStorage if available
              const savedProvince = localStorage.getItem('userProvince') || undefined;
              
              const response = await fetch('/api/device/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fcmToken, province: savedProvince }),
              });

              if (response.ok) {
                const data = await response.json();
                console.log('Device auto-registered:', data);
                // Mark as registered and store token in localStorage
                localStorage.setItem('deviceRegistered', 'true');
                localStorage.setItem('fcmToken', fcmToken);
              }
            } else {
              // Token hasn't changed and already registered, just set the token
              setToken(fcmToken);
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

  // Auto-request notification permission on first install
  useEffect(() => {
    if (!isReady || !isSupported) return;
    
    // Check if this is the first time the user is visiting
    const hasRequestedPermission = localStorage.getItem('permissionRequested');
    const isRegistered = localStorage.getItem('deviceRegistered');
    
    // Auto-request permission if never requested and not registered
    if (!hasRequestedPermission && !isRegistered && permission !== 'denied' && permission !== 'granted') {
      const requestPermission = async () => {
        try {
          setIsRegistering(true);
          localStorage.setItem('permissionRequested', 'true');
          
          // Request permission from browser
          const newPermission = await requestNotificationPermission();
          setPermission(newPermission);
          
          if (newPermission === 'granted') {
            // Get FCM token after permission is granted
            const fcmToken = await getFcmToken();
            
            if (fcmToken) {
              setToken(fcmToken);
              
              // Get province from localStorage if available
              const savedProvince = localStorage.getItem('userProvince') || undefined;
              
              // Register device with backend
              const response = await fetch('/api/device/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fcmToken, province: savedProvince }),
              });

              if (response.ok) {
                const data = await response.json();
                console.log('Device auto-registered on first visit:', data);
                localStorage.setItem('deviceRegistered', 'true');
                localStorage.setItem('fcmToken', fcmToken);
              }
            }
          }
        } catch (err) {
          console.error('Auto permission request error:', err);
        } finally {
          setIsRegistering(false);
        }
      };

      // Delay the request slightly to ensure the UI is ready
      requestPermission();
    }
  }, [isReady, isSupported, permission]);

  // Listen for foreground messages - don't show duplicate notifications on iOS
  // Firebase SDK handles foreground notifications natively on iOS
  useEffect(() => {
    if (!isReady || !isSupported) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // On iOS, Firebase SDK handles foreground notifications automatically
      // We only log here - do NOT show manual notifications to prevent duplicates
      console.log('[FCM] Foreground message received:', payload);
      
      // Handle any data-only messages if needed
      const payloadObj = payload as { notification?: { title?: string; body?: string }; data?: Record<string, unknown> };
      
      // Only handle data-only messages (no notification object)
      if (!payloadObj.notification || (!payloadObj.notification.title && !payloadObj.notification.body)) {
        // This is a data-only message, you could handle it here if needed
        console.log('[FCM] Data-only foreground message received');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isReady, isSupported]);

  const registerDevice = async (province?: string) => {
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
            province,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to register device');
        }

        const data = await response.json();
        console.log('Device registered:', data);
        // Mark as registered and store token in localStorage
        localStorage.setItem('deviceRegistered', 'true');
        localStorage.setItem('fcmToken', fcmToken);
        
        // Store province in localStorage if provided
        if (province) {
          localStorage.setItem('userProvince', province);
        }
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
