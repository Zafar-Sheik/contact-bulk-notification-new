'use client';

import { useEffect, useState, ReactNode } from 'react';

/**
 * Register the Firebase Messaging service worker
 * This is required for push notifications to work properly
 */
function useFirebaseMessagingWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register Firebase Messaging service worker
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Firebase Messaging Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Firebase Messaging Service Worker registration failed:', error);
      });
  }, []);
}

interface ServiceWorkerRegistrationOptions {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

/**
 * Register the service worker for PWA functionality
 */
function useServiceWorkerRegistration(options?: ServiceWorkerRegistrationOptions) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('Service Worker registered:', swRegistration);

        setRegistration(swRegistration);
        setIsRegistered(true);

        swRegistration.addEventListener('updatefound', () => {
          const newWorker = swRegistration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version available');
                options?.onUpdate?.(swRegistration);
              }
            });
          }
        });

        options?.onSuccess?.(swRegistration);
      } catch (err) {
        console.error('Service Worker registration failed:', err);
        setError(err instanceof Error ? err : new Error('Registration failed'));
        options?.onError?.(err instanceof Error ? err : new Error('Registration failed'));
      }
    };

    registerServiceWorker();
  }, [options]);

  return { registration, isRegistered, error };
}

/**
 * Component that handles service worker registration
 */
export function ServiceWorkerRegistration({ 
  children,
}: {
  children: ReactNode;
}) {
  // Register Firebase Messaging service worker
  useFirebaseMessagingWorker();
  // Register PWA service worker
  useServiceWorkerRegistration();
  
  return <>{children}</>;
}
