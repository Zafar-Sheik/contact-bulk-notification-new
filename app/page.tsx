'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePWA } from '@/components/pwa/firebase-provider';
import { ProvinceSelector, useProvinceSelection, type Province } from '@/components/pwa/province-selector';
import NotificationCard from '@/components/ui/NotificationCard';
import NotificationModal from '@/components/ui/NotificationModal';

interface Notification {
  _id: string;
  title: string;
  message: string;
  image?: string;
  sentAt?: string;
  createdAt?: string;
}

export default function HomePage() {
  const { 
    isReady, 
    isSupported, 
    permission, 
    token, 
    isRegistering, 
    error,
    registerDevice 
  } = usePWA();

  const { 
    province, 
    showSelector, 
    selectProvince,
    setShowSelector 
  } = useProvinceSelection();

  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [provinceConfirm, setProvinceConfirm] = useState<string | null>(null);
  const [isChangingProvince, setIsChangingProvince] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const router = useRouter();

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      setIsLoadingNotifications(true);
      try {
        const response = await fetch('/api/notifications?limit=3');
        const data = await response.json();
        if (data.success && data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, []);

  // Handle deep linking - check for notification query param
  useEffect(() => {
    const handleDeepLink = async () => {
      // Check URL for notification query param
      const urlParams = new URLSearchParams(window.location.search);
      const notificationId = urlParams.get('notification');
      
      if (notificationId) {
        // Fetch the specific notification
        try {
          const response = await fetch(`/api/notifications/${notificationId}`);
          const data = await response.json();
          if (data.success && data.notification) {
            setSelectedNotification(data.notification);
            setIsModalOpen(true);
            // Clear the URL param after opening
            window.history.replaceState({}, document.title, '/');
          }
        } catch (error) {
          console.error('Failed to fetch notification:', error);
        }
      }
    };

    handleDeepLink();

    // Listen for messages from service worker (for when app is already open)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_TO') {
        const url = new URL(event.data.url);
        const notificationId = url.searchParams.get('notification');
        if (notificationId) {
          handleDeepLink();
        }
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNotification(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    (deferredPrompt as unknown as { prompt: () => void }).prompt();
    const { outcome } = await (deferredPrompt as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    // Get province from localStorage if available
    const savedProvince = localStorage.getItem('userProvince') || undefined;
    await registerDevice(savedProvince);
  };

  const handleProvinceChange = async (newProvince: string) => {
    setIsChangingProvince(true);
    selectProvince(newProvince as Province);
    setProvinceConfirm(newProvince);
    
    // Re-register device with new province if token exists
    if (token) {
      try {
        await registerDevice(newProvince);
      } catch (err) {
        console.error('Failed to update province:', err);
      }
    }
    
    // Clear confirmation after 3 seconds
    setTimeout(() => {
      setProvinceConfirm(null);
      setIsChangingProvince(false);
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 pb-20">
      {/* Province Selector Modal */}
      {showSelector && (
        <ProvinceSelector
          onSelect={handleProvinceChange}
          onClose={() => setShowSelector(false)}
          isOpen={showSelector}
        />
      )}

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <p className="text-lg md:text-xl text-gray-600 max-w-md mx-auto">
              Stay connected and receive important updates instantly
            </p>
          </div>

          {/* Actions - Enable Notifications */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="space-y-4">
              {!token && isSupported && (
                <button
                  onClick={handleEnableNotifications}
                  disabled={isRegistering}
                  className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3"
                >
                  {isRegistering ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Enabling Notifications...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Enable Notifications
                    </>
                  )}
                </button>
              )}

              {token && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✓ You're all set! You'll receive push notifications.
                  </p>
                </div>
              )}

              {!isInstalled && deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Install App
                </button>
              )}
            </div>
          </div>

          {/* Notifications Section */}
          {(notifications.length > 0 || isLoadingNotifications) && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Recent Notifications
                </h2>
              </div>

              {isLoadingNotifications ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-lg p-5 animate-pulse">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                        <div className="h-4 w-16 bg-gray-200 rounded-full" />
                      </div>
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-full mb-1" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {notifications.map((notification, index) => (
                    <NotificationCard
                      key={notification._id}
                      notification={notification}
                      index={index}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Updates</h3>
              <p className="text-gray-600">Receive notifications instantly as soon as they're sent</p>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Works Everywhere</h3>
              <p className="text-gray-600">Works on mobile, tablet, and desktop browsers</p>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Private</h3>
              <p className="text-gray-600">Your data is protected with industry-standard security</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        notification={selectedNotification}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around h-16">
          {/* Messages Tab */}
          <button
            onClick={() => router.push('/')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              activeTab === 'messages' 
                ? 'text-blue-600' 
                : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs font-medium">Messages</span>
          </button>

          {/* My Profile Tab */}
          <button
            onClick={() => router.push('/profile')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              activeTab === 'profile' 
                ? 'text-blue-600' 
                : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium">My Profile</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
