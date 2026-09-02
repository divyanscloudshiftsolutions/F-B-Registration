import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { SOCKET_EVENTS } from './events';
import {
  SocketAuthData,
  StaffSocketUser,
  CustomerSocketSession,
  OrderCreatedPayload,
  OrderItemUpdatedPayload,
  ServiceRequestCreatedPayload,
  ServiceRequestUpdatedPayload,
  TableUpdatedPayload,
  BillUpdatedPayload,
} from './types';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'nfc_bar_super_secret_key_123!';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io server has not been initialized');
  }
  return io;
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://nfc-qr-code-production.up.railway.app',
    'https://nfc-qr-code-two.vercel.app',
    'https://nfc-qr-code-007.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:19006',
  ].filter(Boolean) as string[];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.toLowerCase().trim();
        const isAllowed = allowedOrigins.some((allowed) => {
          const norm = allowed.toLowerCase().trim();
          return normalizedOrigin === norm || normalizedOrigin === `${norm}/`;
        });
        const isLocalNetwork = Boolean(
          normalizedOrigin.match(
            /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/
          )
        );
        if (isAllowed || isLocalNetwork) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev fallback
        }
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const query = socket.handshake.query || {};
      const headers = socket.handshake.headers || {};

      const rawToken = auth.token || (headers.authorization ? headers.authorization.replace(/^Bearer\s+/i, '') : null);
      const tokenNumber = auth.tokenNumber || query.tokenNumber;

      // 1. Check for Staff JWT
      if (rawToken && typeof rawToken === 'string' && rawToken.trim() !== '') {
        try {
          const decoded: any = jwt.verify(rawToken, JWT_SECRET);
          const userId = decoded.id || decoded.userId;
          if (userId) {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              include: { role: true },
            });

            if (user && user.isActive) {
              const permissions = typeof user.role?.permissions === 'object' && user.role?.permissions !== null
                ? Object.keys(user.role.permissions)
                : [];

              const staffUser: StaffSocketUser = {
                userId: user.id,
                email: user.username,
                role: user.role?.name || 'Staff',
                permissions,
              };
              socket.data.auth = { type: 'STAFF', staffUser } as SocketAuthData;
              return next();
            }
          }
        } catch (jwtErr) {
          logger.warn('Socket staff JWT verification failed', { error: String(jwtErr) });
        }
      }

      // 2. Check for Customer Dining Session Token
      if (tokenNumber && typeof tokenNumber === 'string') {
        const token = await prisma.token.findUnique({
          where: { tokenNumber },
          include: { table: true },
        });

        if (token && (token.status === 'ACTIVE' || token.status === 'EXTENDED')) {
          const customerSession: CustomerSocketSession = {
            tokenId: token.id,
            tokenNumber: token.tokenNumber,
            tableId: token.tableId || '',
            tableNumber: token.table?.tableNumber,
            customerId: token.customerId,
          };
          socket.data.auth = { type: 'CUSTOMER', customerSession } as SocketAuthData;
          return next();
        } else {
          return next(new Error('Invalid or expired dining session token'));
        }
      }

      // 3. Fallback: unauthenticated/anonymous socket (restricted from staff/KDS rooms)
      socket.data.auth = { type: 'CUSTOMER' } as SocketAuthData;
      return next();
    } catch (err: any) {
      logger.error('Socket authentication error:', { error: err.message });
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authData: SocketAuthData = socket.data.auth || { type: 'CUSTOMER' };

    logger.info(`Socket connected: ${socket.id}`, {
      type: authData.type,
      user: authData.staffUser?.email || authData.customerSession?.tokenNumber || 'anonymous',
    });

    // Auto-join default rooms
    if (authData.type === 'STAFF' && authData.staffUser) {
      const role = authData.staffUser.role.toLowerCase();
      socket.join(`role:${role}`);
      socket.join('staff:all');

      if (['admin', 'manager', 'chef'].includes(role)) {
        socket.join('kds:kitchen');
      }
      if (['admin', 'manager', 'bartender'].includes(role)) {
        socket.join('kds:bar');
      }
      if (['admin', 'manager', 'server', 'waiter', 'bartender', 'receptionist'].includes(role)) {
        socket.join('staff:ready');
        socket.join('staff:requests');
        socket.join('tables:all');
      }
      if (['admin', 'manager', 'receptionist'].includes(role)) {
        socket.join('billing:all');
      }
    } else if (authData.type === 'CUSTOMER' && authData.customerSession) {
      socket.join(`customer:token:${authData.customerSession.tokenNumber}`);
      if (authData.customerSession.tableId) {
        socket.join(`table:${authData.customerSession.tableId}`);
      }
    }

    // Explicit room join handler with strict RBAC enforcement
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (room: string) => {
      if (!room || typeof room !== 'string') return;

      const isStaff = authData.type === 'STAFF';
      const staffRole = (authData.staffUser?.role || '').toLowerCase();
      const customerToken = authData.customerSession?.tokenNumber;

      // Rule 1: KDS Kitchen access
      if (room === 'kds:kitchen') {
        if (isStaff && ['admin', 'manager', 'chef'].includes(staffRole)) {
          socket.join('kds:kitchen');
        } else {
          socket.emit('error', { message: 'Unauthorized room access for kds:kitchen' });
        }
        return;
      }

      // Rule 2: KDS Bar access
      if (room === 'kds:bar') {
        if (isStaff && ['admin', 'manager', 'bartender'].includes(staffRole)) {
          socket.join('kds:bar');
        } else {
          socket.emit('error', { message: 'Unauthorized room access for kds:bar' });
        }
        return;
      }

      // Rule 3: Billing access (Admin, Manager, Receptionist)
      if (room === 'billing:all') {
        if (isStaff && ['admin', 'manager', 'receptionist'].includes(staffRole)) {
          socket.join('billing:all');
        } else {
          socket.emit('error', { message: 'Unauthorized room access for billing:all' });
        }
        return;
      }

      // Rule 4: Staff Ready, Requests, Tables, Orders access
      if (['staff:ready', 'staff:requests', 'tables:all', 'staff:orders'].includes(room)) {
        if (isStaff && ['admin', 'manager', 'server', 'waiter', 'bartender', 'receptionist', 'chef'].includes(staffRole)) {
          socket.join(room);
        } else {
          socket.emit('error', { message: `Unauthorized room access for ${room}` });
        }
        return;
      }

      // Rule 5: Customer Token Room access
      if (room.startsWith('customer:token:')) {
        const requestedToken = room.replace('customer:token:', '');
        if (isStaff || (customerToken && customerToken === requestedToken)) {
          socket.join(room);
        } else {
          socket.emit('error', { message: `Unauthorized room access for ${room}` });
        }
        return;
      }

      // Rule 6: Specific Table Room access
      if (room.startsWith('table:')) {
        const requestedTableId = room.replace('table:', '');
        if (isStaff || (authData.customerSession && authData.customerSession.tableId === requestedTableId)) {
          socket.join(room);
        } else {
          socket.emit('error', { message: `Unauthorized room access for ${room}` });
        }
        return;
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (room: string) => {
      if (room && typeof room === 'string') {
        socket.leave(room);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  logger.info('Socket.io server initialized successfully');
  return io;
}

// -------------------------------------------------------------
// BROADCASTER HELPERS (Strictly safe to call after DB commit)
// -------------------------------------------------------------

export function broadcastOrderCreated(payload: OrderCreatedPayload) {
  if (!io) return;

  // 1. Emit to customer's own session room
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.ORDER_CREATED, payload);

  // 2. Filter food items for Kitchen KDS
  const hasKitchenItems = payload.items.some((i) => i.station === 'KITCHEN' || i.station === 'DESSERT');
  if (hasKitchenItems) {
    io.to('kds:kitchen').emit(SOCKET_EVENTS.ORDER_CREATED, payload);
  }

  // 3. Filter beverage items for Bar KDS
  const hasBarItems = payload.items.some((i) => i.station === 'BAR');
  if (hasBarItems) {
    io.to('kds:bar').emit(SOCKET_EVENTS.ORDER_CREATED, payload);
  }

  // 4. Emit to general staff orders feed
  io.to('staff:orders').emit(SOCKET_EVENTS.ORDER_CREATED, payload);
}

export function broadcastOrderItemUpdated(payload: OrderItemUpdatedPayload) {
  if (!io) return;

  // 1. Emit to customer session
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);

  // 2. Emit to relevant KDS station
  if (payload.station === 'KITCHEN' || payload.station === 'DESSERT') {
    io.to('kds:kitchen').emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);
  } else if (payload.station === 'BAR') {
    io.to('kds:bar').emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);
  }

  // 3. If item reached READY or SERVED, notify Waiter Ready Queue
  if (payload.status === 'READY' || payload.status === 'SERVED') {
    io.to('staff:ready').emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);
  }

  // 4. Emit to general staff orders
  io.to('staff:orders').emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);
}

export function broadcastServiceRequestCreated(payload: ServiceRequestCreatedPayload) {
  if (!io) return;
  io.to('staff:requests').emit(SOCKET_EVENTS.SERVICE_REQUEST_CREATED, payload);
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.SERVICE_REQUEST_CREATED, payload);
}

export function broadcastServiceRequestUpdated(payload: ServiceRequestUpdatedPayload) {
  if (!io) return;
  io.to('staff:requests').emit(SOCKET_EVENTS.SERVICE_REQUEST_UPDATED, payload);
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.SERVICE_REQUEST_UPDATED, payload);
}

export function broadcastTableUpdated(payload: TableUpdatedPayload) {
  if (!io) return;
  io.to('tables:all').emit(SOCKET_EVENTS.TABLE_UPDATED, payload);
  io.to(`table:${payload.tableId}`).emit(SOCKET_EVENTS.TABLE_UPDATED, payload);
}

export function broadcastBillSettled(payload: BillUpdatedPayload) {
  if (!io) return;
  io.to('billing:all').emit(SOCKET_EVENTS.BILL_UPDATED, payload);
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.BILL_UPDATED, payload);
  io.to(`table:${payload.tableId}`).emit(SOCKET_EVENTS.BILL_UPDATED, payload);
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.SESSION_UPDATED, {
    tokenId: payload.tokenId,
    tokenNumber: payload.tokenNumber,
    tableId: payload.tableId,
    status: 'CLOSED',
    updatedAt: payload.paidAt,
  });
}

export function broadcastTableSessionActivated(payload: {
  tableId: string;
  tableNumber: string;
  tokenNumber: string;
  customerName?: string;
  startTime: string | Date;
  endTime: string | Date;
}) {
  if (!io) return;
  io.to(`table:${payload.tableId}`).emit(SOCKET_EVENTS.TABLE_SESSION_ACTIVATED, payload);
  io.to(`table:${payload.tableNumber}`).emit(SOCKET_EVENTS.TABLE_SESSION_ACTIVATED, payload);
  io.to('tables:all').emit(SOCKET_EVENTS.TABLE_SESSION_ACTIVATED, payload);
}

export function broadcastTableSessionClosed(payload: {
  tableId: string;
  tableNumber: string;
  tokenNumber: string;
  closedAt: string | Date;
}) {
  if (!io) return;
  io.to(`table:${payload.tableId}`).emit(SOCKET_EVENTS.TABLE_SESSION_CLOSED, payload);
  io.to(`table:${payload.tableNumber}`).emit(SOCKET_EVENTS.TABLE_SESSION_CLOSED, payload);
  io.to(`customer:token:${payload.tokenNumber}`).emit(SOCKET_EVENTS.TABLE_SESSION_CLOSED, payload);
  io.to('tables:all').emit(SOCKET_EVENTS.TABLE_SESSION_CLOSED, payload);
}

