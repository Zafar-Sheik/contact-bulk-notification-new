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

function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  let platform = '';
  let browser = '';
  
  if (ua.includes('android')) {
    platform = 'android';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    platform = 'ios';
  } else if (ua.includes('windows')) {
    platform = 'windows';
  } else if (ua.includes('mac')) {
    platform = 'mac';
  } else if (ua.includes('linux')) {
    platform = 'linux';
  }
  
  if (ua.includes('chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edge')) {
    browser = 'Edge';
  }
  
  return { platform, browser };
}

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

export function PWAProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported = isNotificationsSupported();
    setIsSupported(supported);
    if (supported) {
      setPermission(getNotificationPermission());
    }
    initFirebase();
    setIsReady(true);

    // Auto-register if already registered before
    const checkAndRegister = async () => {
      const storedToken = localStorage.getItem('fcmToken');
      if (storedToken && permission === 'granted') {
        setToken(storedToken);
      }
    };
    checkAndRegister();
  }, []);

  const registerDevice = async (province?: string) => {
    if (!isSupported) {
      setError('Notifications not supported');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Check if already registered
      const storedToken = localStorage.getItem('fcmToken');
      const perm = await getNotificationPermission();
      setPermission(perm);
      
      if (perm !== 'granted') {
        const newPerm = await requestNotificationPermission();
        setPermission(newPerm);
        
        if (newPerm !== 'granted') {
          setError('Permission denied');
          setIsRegistering(false);
          return;
        }
      }

      const fcmToken = await getFcmToken();
      
      if (fcmToken) {
        setToken(fcmToken);
        
        const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
        const deviceInfo = parseUserAgent(userAgent);
        
        const response = await fetch('/api/device/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fcmToken,
            province,
            platform: deviceInfo.platform,
            browser: deviceInfo.browser,
            userAgent,
          }),
        });

        if (response.ok) {
          localStorage.setItem('deviceRegistered', 'true');
          localStorage.setItem('fcmToken', fcmToken);
          if (province) {
            localStorage.setItem('userProvince', province);
          }
        } else {
          throw new Error('Failed to register');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (!isReady || !isSupported) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log('FCM message:', payload);
    });

    return () => { unsubscribe(); };
  }, [isReady, isSupported]);

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