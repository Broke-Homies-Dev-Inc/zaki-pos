import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';

export interface Notification {
    id: string;
    type: 'delivery' | 'online_delivery' | 'order' | 'info' | 'success' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    orderId?: string;
    orderNumber?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotification: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...notification,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            read: false,
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep last 50 notifications

        // Play notification sound for delivery orders
        if (notification.type === 'delivery' || notification.type === 'online_delivery') {
            playNotificationSound();
        }
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Listen for new order events via WebSocket (from POS backend)
    useSocket('order:created', (data: { orderId: string; orderType: string; orderNumber?: string; customerName?: string; deliveryAddress?: string }) => {
        handleNewOrder(data);
    });

    // Listen for new order events from waiter-dev backend (via workspace backend relay)
    useSocket('newOrder', (data: { order: { id: string; order_type: string; order_number?: string; customer_name?: string; delivery_address?: string; grand_total?: number } }) => {
        handleNewOrder({
            orderId: data.order.id,
            orderType: data.order.order_type,
            orderNumber: data.order.order_number,
            customerName: data.order.customer_name,
            deliveryAddress: data.order.delivery_address,
        });
    });

    // Shared handler for new orders
    const handleNewOrder = useCallback((data: { orderId: string; orderType: string; orderNumber?: string; customerName?: string; deliveryAddress?: string }) => {
        const typeLabel = data.orderType === 'online_delivery' ? 'Online Delivery'
            : data.orderType === 'delivery' ? 'Delivery'
                : data.orderType === 'dine_in' ? 'Dine In'
                    : data.orderType === 'take_away' ? 'Take Away'
                        : 'Order';

        // For online delivery, show the partner name (stored in deliveryAddress)
        // For regular delivery, show customer name if not "Walk-in"
        let displayName = '';
        if (data.orderType === 'online_delivery' && data.deliveryAddress) {
            displayName = data.deliveryAddress; // Partner name
        } else if (data.customerName && data.customerName !== 'Walk-in') {
            displayName = data.customerName;
        }

        // Determine notification type for styling
        const notificationType = (data.orderType === 'delivery' || data.orderType === 'online_delivery')
            ? data.orderType as 'delivery' | 'online_delivery'
            : 'order';

        addNotification({
            type: notificationType,
            title: `New ${typeLabel} Order!`,
            message: data.orderNumber
                ? `Order #${data.orderNumber}${displayName ? ` - ${displayName}` : ''}`
                : `A new ${typeLabel.toLowerCase()} order has been received`,
            orderId: data.orderId,
            orderNumber: data.orderNumber,
        });
    }, [addNotification]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                addNotification,
                markAsRead,
                markAllAsRead,
                clearNotification,
                clearAll,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

// Simple notification sound
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Play a second beep
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            const gainNode2 = audioContext.createGain();
            oscillator2.connect(gainNode2);
            gainNode2.connect(audioContext.destination);
            oscillator2.frequency.value = 1047; // C6 note
            oscillator2.type = 'sine';
            gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 0.3);
        }, 200);
    } catch (e) {
        console.log('Could not play notification sound:', e);
    }
}
