import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as socketClient, Socket as ClientSocket } from 'socket.io-client';
import { pool } from './server';

let io: SocketIOServer | null = null;
let waiterDevSocket: ClientSocket | null = null;

export function setupWebSocket(server: HTTPServer): void {
    io = new SocketIOServer(server, {
        cors: {
            origin: [
                process.env.FRONTEND_URL || 'http://localhost:5173',
                'http://103.182.102.250:5173',
                'http://103.182.102.250:4173',
            ],
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        console.log('✅ WebSocket client connected:', socket.id);

        // ============= FROM BACKENDS TO POS =============
        // Listen for order events from mobile-webview backend
        socket.on('orderCreated', (data) => {
            console.log(`📱 Order created from ${data.source}:`, data.order?.order_number);
            // Broadcast to all POS clients
            io?.emit('newOrder', data);
            console.log('📤 New order broadcasted to POS clients');
        });

        // Listen for order updates from any backend (mobile-webview, delivery-ui)
        socket.on('orderUpdated', (data) => {
            console.log(`🔄 Order updated from ${data.source}:`, data.order?.order_number, `(${data.updateType})`);
            // Broadcast to all POS clients
            io?.emit('orderUpdated', data);
            console.log('📤 Order update broadcasted to POS clients');
        });

        // ============= FROM POS TO BACKENDS (BIDIRECTIONAL) =============
        // POS updates order status (kitchen marks as preparing/ready, etc.)
        socket.on('posOrderStatusUpdate', (data) => {
            console.log(`🖥️ POS updated order status:`, data.order?.order_number, `→ ${data.newStatus}`);

            // Broadcast to ALL connected backends
            io?.emit('orderStatusUpdatedByPOS', data);
            console.log('📤 Status update broadcasted to all backends');

            // Forward to Upstream (Cloud Helper)
            if (waiterDevSocket) {
                waiterDevSocket.emit('posOrderStatusUpdate', data);
                console.log('📤 Forwarded posOrderStatusUpdate to upstream');
            }
        });

        // POS modifies order (adds items, discounts, etc.)
        socket.on('posOrderModified', (data) => {
            console.log(`🖥️ POS modified order:`, data.order?.order_number);

            // Broadcast to ALL connected backends
            io?.emit('orderModifiedByPOS', data);
            console.log('📤 Order modification broadcasted to all backends');

            // Forward to Upstream
            if (waiterDevSocket) {
                waiterDevSocket.emit('posOrderModified', data);
                console.log('📤 Forwarded posOrderModified to upstream');
            }
        });

        // POS updates inventory (stock changes, item availability)
        socket.on('posInventoryUpdate', (data) => {
            console.log(`🖥️ POS updated inventory:`, data.item_id, `(stock: ${data.stock})`);

            // Broadcast to ALL connected backends
            io?.emit('inventoryUpdatedByPOS', data);
            console.log('📤 Inventory update broadcasted to all backends');

            // Forward to Upstream
            if (waiterDevSocket) {
                waiterDevSocket.emit('posInventoryUpdate', data);
                console.log('📤 Forwarded posInventoryUpdate to upstream');
            }
        });

        // POS cancels order
        socket.on('posOrderCancelled', (data) => {
            console.log(`🖥️ POS cancelled order:`, data.order?.order_number);

            // Broadcast to ALL connected backends
            io?.emit('orderCancelledByPOS', data);
            console.log('📤 Order cancellation broadcasted to all backends');

            // Forward to Upstream
            if (waiterDevSocket) {
                waiterDevSocket.emit('posOrderCancelled', data);
                console.log('📤 Forwarded posOrderCancelled to upstream');
            }
        });

        socket.on('disconnect', () => {
            console.log('❌ WebSocket client disconnected:', socket.id);
        });
    });

    console.log('✅ WebSocket server initialized');
}

export function connectToWaiterDev(): void {
    const waiterDevUrl = process.env.WAITER_DEV_URL || 'http://localhost:3000';

    console.log(`🔌 Connecting to waiter-dev backend at ${waiterDevUrl}...`);

    waiterDevSocket = socketClient(waiterDevUrl, {
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
    });

    waiterDevSocket.on('connect', () => {
        console.log('✅ Connected to waiter-dev backend (cloud)');
    });

    waiterDevSocket.on('disconnect', () => {
        console.log('❌ Disconnected from waiter-dev backend');
    });

    waiterDevSocket.on('connect_error', (err) => {
        console.error('⚠️ waiter-dev connection error:', err.message);
    });

    // Listen for orders from waiter-dev and broadcast to POS clients
    waiterDevSocket.on('orderCreated', async (data) => {
        console.log(`📱 Order received from waiter-dev (cloud): ${data.order.order_number}`);

        // 🔒 CHECK IF SYSTEM IS ONLINE (Admin Session Active)
        try {
            const client = await pool.connect();
            const sessionCheck = await client.query("SELECT 1 FROM pos_sessions WHERE status = 'active' LIMIT 1");
            client.release();

            if (sessionCheck.rows.length === 0) {
                console.log("❌ socket-order rejected: System Offline (No Admin Session)");
                // Emit error back to waiter-dev if it expects a response, or log.
                // For now, we'll just log and prevent broadcasting to POS.
                // If waiter-dev needs to be informed, an explicit emit to waiterDevSocket would be needed.
                // waiterDevSocket.emit('orderError', { message: "System Offline. Manager must login." });
                return;
            }
        } catch (err) {
            console.error("Error checking session for socket order:", err);
            // Optionally, emit an error to waiter-dev or POS clients about the internal error
            // waiterDevSocket.emit('orderError', { message: "Internal server error checking system status." });
            return; // Prevent broadcasting if we can't verify system status
        }

        // Broadcast to all connected POS clients
        if (io) { // Ensure io is initialized before emitting
            io.emit('newOrder', data); // Changed to 'newOrder' for consistency with other orderCreated events
            console.log(`📤 Order broadcasted to POS clients`);
        } else {
            console.warn('⚠️ Socket.IO server not initialized, cannot broadcast new order.');
        }
    });

    waiterDevSocket.on('orderUpdated', (data) => {
        console.log('🔄 Order update received from waiter-dev:', data.order?.order_number);
        if (io) {
            io.emit('orderUpdated', data);
            console.log('📤 Order update broadcasted to POS clients');
        }
    });
}

export function initializeAllConnections(server: HTTPServer): void {
    setupWebSocket(server);
    connectToWaiterDev();
}

export function getIO(): SocketIOServer {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call setupWebSocket first.');
    }
    return io;
}

export function getWaiterDevSocket(): ClientSocket | null {
    return waiterDevSocket;
}
