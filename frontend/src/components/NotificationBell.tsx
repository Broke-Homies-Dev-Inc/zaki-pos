import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, Package, Truck, Check, Trash2 } from 'lucide-react';
import { useNotifications, Notification } from '../contexts/NotificationContext';

export function NotificationBell() {
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [showToast, setShowToast] = useState<Notification | null>(null);

    // Show toast for new notifications
    useEffect(() => {
        if (notifications.length > 0 && !notifications[0].read) {
            const latestNotification = notifications[0];
            if (latestNotification.type === 'delivery' || latestNotification.type === 'online_delivery') {
                setShowToast(latestNotification);

                // Auto-hide toast after 8 seconds
                const timer = setTimeout(() => {
                    setShowToast(null);
                }, 8000);

                return () => clearTimeout(timer);
            }
        }
    }, [notifications]);

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);
        setIsOpen(false);
        setShowToast(null);

        // Navigate to orders page with the order ID
        if (notification.orderId) {
            navigate(`/orders?orderId=${notification.orderId}`);
        } else {
            navigate('/orders');
        }
    };

    const handleToastClick = (notification: Notification) => {
        markAsRead(notification.id);
        setShowToast(null);

        if (notification.orderId) {
            navigate(`/orders?orderId=${notification.orderId}`);
        } else {
            navigate('/orders');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'delivery':
                return <Truck className="w-5 h-5 text-blue-500" />;
            case 'online_delivery':
                return <Package className="w-5 h-5 text-orange-500" />;
            default:
                return <Bell className="w-5 h-5 text-gray-500" />;
        }
    };

    const getTimeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <>
            {/* Toast Notification */}
            {showToast && (
                <div
                    className="fixed top-4 right-4 z-[100] animate-slide-in-right cursor-pointer"
                    style={{ animation: 'slideInRight 0.3s ease-out' }}
                    onClick={() => handleToastClick(showToast)}
                >
                    <div className={`flex items-start gap-3 p-4 rounded-lg shadow-xl border-l-4 min-w-[320px] max-w-md ${showToast.type === 'online_delivery'
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-blue-50 border-blue-500'
                        }`}>
                        <div className={`p-2 rounded-full ${showToast.type === 'online_delivery' ? 'bg-orange-100' : 'bg-blue-100'
                            }`}>
                            {getIcon(showToast.type)}
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-semibold ${showToast.type === 'online_delivery' ? 'text-orange-800' : 'text-blue-800'
                                }`}>
                                {showToast.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">{showToast.message}</p>
                            <p className="text-xs text-blue-600 mt-2 font-medium">Click to view order →</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowToast(null);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Bell Icon with Badge */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <Bell className="w-6 h-6 text-gray-600" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown Panel */}
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                                <h3 className="font-semibold text-gray-800">Notifications</h3>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllAsRead}
                                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                            <Check className="w-3 h-3" /> Mark all read
                                        </button>
                                    )}
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={clearAll}
                                            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 ml-2"
                                        >
                                            <Trash2 className="w-3 h-3" /> Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Notification List */}
                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="py-12 text-center text-gray-500">
                                        <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p>No notifications yet</p>
                                        <p className="text-sm mt-1">New delivery orders will appear here</p>
                                    </div>
                                ) : (
                                    notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors ${!notification.read ? 'bg-blue-50/50' : ''
                                                }`}
                                        >
                                            <div className={`p-2 rounded-full flex-shrink-0 ${notification.type === 'online_delivery' ? 'bg-orange-100' :
                                                notification.type === 'delivery' ? 'bg-blue-100' : 'bg-gray-100'
                                                }`}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <h4 className={`font-medium text-sm ${!notification.read ? 'text-gray-900' : 'text-gray-600'
                                                        }`}>
                                                        {notification.title}
                                                    </h4>
                                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                                        {getTimeAgo(notification.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 truncate">{notification.message}</p>
                                            </div>
                                            {!notification.read && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    clearNotification(notification.id);
                                                }}
                                                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Animation styles */}
            <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
        </>
    );
}

