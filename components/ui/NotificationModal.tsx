'use client';

import { useEffect, useCallback, useState } from 'react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: {
    _id: string;
    title: string;
    message: string;
    image?: string;
    sentAt?: string;
    createdAt?: string;
  } | null;
}

export default function NotificationModal({ isOpen, onClose, notification }: NotificationModalProps) {
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const handleCloseModal = () => {
    setIsImageExpanded(false);
    onClose();
  };

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen || !notification) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop"
          onClick={onClose}
        />

        {/* Modal Content */}
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden modal-content">
          {/* Header Gradient */}
          <div className="h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Title */}
            <h2 
              id="modal-title" 
              className="text-2xl font-bold text-gray-900 mb-4 pr-8"
            >
              {notification.title}
            </h2>

            {/* Image */}
            {notification.image && (
              <div className="mb-6">
                <div 
                  className={`relative rounded-xl overflow-hidden bg-gray-100 cursor-zoom-in transition-all duration-300 ${
                    isImageExpanded ? 'fixed inset-4 z-[60] m-0' : ''
                  }`}
                  onClick={() => setIsImageExpanded(!isImageExpanded)}
                >
                  <img 
                    src={notification.image} 
                    alt="Notification attachment"
                    className={`w-full h-auto max-h-[60vh] object-contain transition-all duration-300 ${
                      isImageExpanded ? 'h-full max-h-[90vh] w-auto' : ''
                    }`}
                  />
                  {/* Zoom indicator */}
                  {!isImageExpanded && (
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      Tap to expand
                    </div>
                  )}
                  {/* Close expanded view button */}
                  {isImageExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageExpanded(false);
                      }}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {isImageExpanded && (
                  <p className="text-center text-xs text-gray-500 mt-2">
                    Click outside or the X button to close
                  </p>
                )}
              </div>
            )}

            {/* Message */}
            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {notification.message}
              </p>
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-sm text-gray-500 border-t border-gray-100 pt-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatDate(notification.sentAt || notification.createdAt)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          animation: fadeIn 0.2s ease-out;
        }
        .modal-content {
          animation: scaleIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
