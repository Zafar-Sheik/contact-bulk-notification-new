'use client';

interface NotificationCardProps {
  notification: {
    _id: string;
    title: string;
    message: string;
    image?: string;
    sentAt?: string;
    createdAt?: string;
  };
  onClick: () => void;
  index: number;
}

export default function NotificationCard({ notification, onClick, index }: NotificationCardProps) {
  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Different gradient backgrounds for visual variety
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-cyan-500 to-blue-600',
  ];

  const gradient = gradients[index % gradients.length];
  const truncatedMessage = notification.message.length > 100 
    ? notification.message.substring(0, 100) + '...'
    : notification.message;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
    >
      {/* Colored accent bar */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      
      <div className="p-5">
        {/* Header with icon and timestamp */}
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {formatTimeAgo(notification.sentAt || notification.createdAt)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-200 line-clamp-1">
          {notification.title}
        </h3>

        {/* Message preview */}
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
          {truncatedMessage}
        </p>

        {/* Image thumbnail if available */}
        {notification.image && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img 
              src={notification.image} 
              alt="" 
              className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        {/* Click hint */}
        <div className="mt-3 flex items-center text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span>View details</span>
          <svg className="w-3 h-3 ml-1 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
