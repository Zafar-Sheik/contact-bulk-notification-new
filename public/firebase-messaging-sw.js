// Firebase Messaging Service Worker
// Handles background push notifications from Firebase Cloud Messaging

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

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  // Skip if app is in foreground - the foreground handler will show the notification
  // This prevents duplicate notifications on iOS devices
  if (payload.data?.foreground === 'true') {
    return;
  }

  // iOS Safari in PWA mode: Check if there's an active client (app is in foreground)
  // If so, skip showing notification to prevent duplicates
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const activeClient = clientList.find(client => 
      client.url.startsWith(self.location.origin)
    );
    
    // If app is in foreground/active, skip showing notification
    if (activeClient) {
      return;
    }

    // Extract notification data - use notificationId as unique tag for iOS
    const notificationId = payload.data?.notificationId || `notification-${Date.now()}`;
    const notificationTitle = payload.notification?.title || 'Notification';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.image || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Use unique tag with notificationId to prevent duplicate notifications on iOS
      tag: notificationId,
      data: payload.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ],
    };

    // Show notification
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  // Prevent default behavior
  event.notification.close();

  // Handle action
  if (event.action === 'close') {
    return;
  }

  // Get the URL to open from notification data
  // Check for notificationId first to create a deep link
  const notificationId = event.notification.data?.notificationId;
  let linkUrl = event.notification.data?.url || 
                event.notification.data?.link || 
                '/';
  
  // If we have a notificationId, create a deep link to view that specific notification
  if (notificationId) {
    linkUrl = `/?notification=${notificationId}`;
  }

  // Ensure URL is absolute (add origin if relative)
  let urlToOpen = linkUrl;
  if (linkUrl && !linkUrl.startsWith('http') && !linkUrl.startsWith('//')) {
    urlToOpen = self.location.origin + (linkUrl.startsWith('/') ? linkUrl : '/' + linkUrl);
  }

  // Handle PWA vs Browser behavior
  event.waitUntil(
    // Get all clients (windows/tabs)
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's a client already open (PWA is running)
      const openClient = clientList.find(client => 
        client.url.startsWith(self.location.origin)
      );
      
      if (openClient) {
        // PWA is installed and running - focus the existing window
        // Then navigate to the link
        return openClient.focus().then(client => {
          // Send message to client to navigate to the URL
          if (client && 'postMessage' in client) {
            client.postMessage({
              type: 'NAVIGATE_TO',
              url: urlToOpen
            });
          }
          return client;
        });
      } else {
        // PWA is not running - open in browser
        // If PWA is installed, it will open in PWA
        // If not installed, it will open in browser
        return clients.openWindow(urlToOpen);
      }
    }).catch((error) => {
      // Fallback: open the window
      return clients.openWindow(urlToOpen);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Notification was closed by user
});

// Handle push event (fallback for non-FCM push)
self.addEventListener('push', (event) => {
  // Check if it's a Firebase message
  if (event.data) {
    try {
      const payload = event.data.json();
      
      // If it's a Firebase notification, let the onBackgroundMessage handler deal with it
      if (payload.notification || payload.data) {
        return;
      }
    } catch (e) {
      // Not JSON, treat as plain push
    }
  }

  // Plain push notification fallback
  const title = 'Push Notification';
  const options = {
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'plain-push-notification'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle message event (foreground messages)
self.addEventListener('message', (event) => {
  // Handle different message types
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
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});
