import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
            console.log('✅ WebSocket connected:', socket?.id);
        });

        socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });
    }

    return socket;
}

export function useSocket(eventName: string, callback: (data: any) => void) {
    const callbackRef = useRef(callback);

    // Update ref when callback changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const socketInstance = getSocket();

        const handleEvent = (data: any) => {
            callbackRef.current(data);
        };

        socketInstance.on(eventName, handleEvent);

        return () => {
            socketInstance.off(eventName, handleEvent);
        };
    }, [eventName]);
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
