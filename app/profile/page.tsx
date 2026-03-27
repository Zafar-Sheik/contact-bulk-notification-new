'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePWA } from '@/components/pwa/firebase-provider';
import { ProvinceSelector, useProvinceSelection, type Province } from '@/components/pwa/province-selector';
import NotificationModal from '@/components/ui/NotificationModal';

interface Notification {
  _id: string;
  title: string;
  message: string;
  image?: string;
  link?: string;
  sentAt?: string;
}

export default function ProfilePage() {
  const { 
    isReady, 
    isSupported, 
    permission, 
    token, 
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
  const [provinceConfirm, setProvinceConfirm] = useState<string | null>(null);
  const [isChangingProvince, setIsChangingProvince] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
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
            window.history.replaceState({}, document.title, '/profile');
          }
        } catch (error) {
          console.error('Failed to fetch notification:', error);
        }
      }
    };

    handleDeepLink();

    // Listen for messages from service worker
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNotification(null);
  };

  const handleProvinceChange = async (selectedProvince: Province) => {
    setIsChangingProvince(true);
    selectProvince(selectedProvince);
    setShowSelector(false);
    
    // Save to localStorage
    localStorage.setItem('userProvince', selectedProvince);
    
    // Update device in database if token exists - use dedicated province endpoint for immediate update
    if (token) {
      try {
        const response = await fetch('/api/device/province', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token, province: selectedProvince }),
        });
        
        if (!response.ok) {
          // Fallback to register device if province endpoint fails
          console.warn('Province update failed, falling back to register');
          await registerDevice(selectedProvince);
        }
      } catch (err) {
        console.error('Failed to update province:', err);
        // Fallback to register device
        try {
          await registerDevice(selectedProvince);
        } catch (fallbackErr) {
          console.error('Fallback registration also failed:', fallbackErr);
        }
      }
    }
    
    setProvinceConfirm(selectedProvince);
    setTimeout(() => {
      setProvinceConfirm(null);
      setIsChangingProvince(false);
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            My Profile
          </h1>
          <p className="text-gray-600">
            Manage your account settings and notifications
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Your Status
          </h2>

          <div className="space-y-4">
            {/* Support Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Browser Support</span>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                isSupported 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isSupported ? 'Supported' : 'Not Supported'}
              </span>
            </div>

            {/* Permission Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Notification Permission</span>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                permission === 'granted' 
                  ? 'bg-green-100 text-green-800' 
                  : permission === 'denied'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {permission === 'unsupported' 
                  ? 'N/A' 
                  : permission.charAt(0).toUpperCase() + permission.slice(1)}
              </span>
            </div>

            {/* Province Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-col">
                <span className="text-gray-700">Your Province</span>
                {!province && (
                  <span className="text-xs text-gray-500 mt-1">
                    If no province is selected, you will receive nationwide notifications
                  </span>
                )}
              </div>
              {provinceConfirm ? (
                <span className="px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  ✓ Saved: {provinceConfirm}
                </span>
              ) : (
                <button
                  onClick={() => setShowSelector(true)}
                  disabled={isChangingProvince}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  {isChangingProvince ? 'Saving...' : (province || 'Not set')}
                </button>
              )}
            </div>

            {/* Registration Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Device Registration</span>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                token 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {token ? 'Registered' : 'Not Registered'}
              </span>
            </div>

            {/* Install Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700">App Installed</span>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                isInstalled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isInstalled ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Province Selector Modal */}
        {showSelector && (
          <ProvinceSelector
            onSelect={handleProvinceChange}
            onClose={() => setShowSelector(false)}
            isOpen={showSelector}
          />
        )}

        {/* Notification Modal */}
        <NotificationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          notification={selectedNotification}
        />

        {/* Bottom Navigation */}
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
      </div>
    </main>
  );
}
