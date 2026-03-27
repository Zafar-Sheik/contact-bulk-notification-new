// Firebase Messaging Service Worker
// Handles background push notifications from Firebase Cloud Messaging
// This file must be served from the root of the application

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration - must match the client config
firebase.initializeApp({
  apiKey: "AIzaSyAef0hFlHEWTise8yU88q-IYw7esxX2j54",
  authDomain: "bulk-notification-26726.firebaseapp.com",
  projectId: "bulk-notification-26726",
  storageBucket: "bulk-notification-26726.firebasestorage.app",
  messagingSenderId: "1094002262397",
  appId: "1:1094002262397:web:16f1fee5153ef171eb4c14"
});

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background push messages manually
// Do NOT rely on Firebase's default behavior - always manually display notification
self.addEventListener("push", (event) => {
  console.log('[FCM] Push event received:', event);
  
  if (!event.data) {
    console.log('[FCM] No data in push event');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[FCM] Push data:', data);
    console.log('[FCM] Title:', data.title);
    console.log('[FCM] Body:', data.body);
    console.log('[FCM] Image:', data.image);
    
    // Check if app is in foreground - skip if so
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const activeClient = clientList.find(client => 
        client.url.startsWith(self.location.origin)
      );
      
      if (activeClient) {
        console.log('[FCM] App is in foreground, skipping notification');
        return;
      }
      
      // Always manually show notification using the exact format requested
      const title = data.title || 'Notification';
      
      self.registration.showNotification(title, {
        body: data.body,
        icon: "/icons/icon-192.svg",
        image: data.image,
        badge: "/icons/icon-192.svg",
        tag: data.notificationId || 'notification',
        renotify: true,
        data: {
          url: data.link || '/',
          notificationId: data.notificationId
        },
        actions: [
          { action: 'open', title: 'Open' },
          { action: 'close', title: 'Close' }
        ]
      });
    });
  } catch (error) {
    console.error('[FCM] Error parsing push data:', error);
  }
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Get URL from notification data with notificationId for deep linking
  const baseUrl = event.notification.data?.url || '/';
  const notificationId = event.notification.data?.notificationId;
  
  // Build the URL with notification ID as query param to open the modal
  let url = baseUrl;
  if (notificationId) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    url = `${baseUrl}${separator}notification=${notificationId}`;
  }
  
  event.waitUntil(
    clients.openWindow(url)
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Notification was closed by user
});

// Handle message event (foreground messages)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'GET_TOKEN':
        // Respond with current token if needed
        break;
    }
  }
});

// Cache name for this service worker
const CACHE_NAME = 'firebase-messaging-sw-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});
