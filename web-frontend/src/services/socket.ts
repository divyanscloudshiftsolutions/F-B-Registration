// Centralized Socket.io Client for Real-Time Event Subscriptions in Web-Frontend
import { io, Socket } from 'socket.io-client';

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:4000/api`
  : 'http://localhost:4000/api';

const SOCKET_SERVER_URL = API_BASE.replace(/\/api\/?$/, '');

let socketInstance: Socket | null = null;
const connectionListeners = new Set<(connected: boolean) => void>();
const activeRooms = new Set<string>();

export interface SocketAuthOptions {
  token?: string;
  tokenNumber?: string;
}

export function getSocket(authOptions?: SocketAuthOptions): Socket {
  if (!socketInstance) {
    const rawToken = authOptions?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('bar_web_token') || '' : '');
    const tokenNumber = authOptions?.tokenNumber || (typeof localStorage !== 'undefined' ? localStorage.getItem('bar_active_token') || '' : '');

    socketInstance = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        token: rawToken,
        tokenNumber: tokenNumber,
      },
    });

    socketInstance.on('connect', () => {
      console.log('⚡ [Socket.io] Connected to server:', socketInstance?.id);
      connectionListeners.forEach((l) => l(true));

      // Re-join all active rooms on reconnect
      activeRooms.forEach((room) => {
        socketInstance?.emit('room:join', room);
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.io] Disconnected from server. Reason:', reason);
      connectionListeners.forEach((l) => l(false));
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('⚠️ [Socket.io] Connection error (falling back to REST):', err.message);
      connectionListeners.forEach((l) => l(false));
    });
  } else if (authOptions) {
    if (authOptions.token) socketInstance.auth = { ...socketInstance.auth, token: authOptions.token };
    if (authOptions.tokenNumber) socketInstance.auth = { ...socketInstance.auth, tokenNumber: authOptions.tokenNumber };
  }

  return socketInstance;
}

export function joinRoom(room: string) {
  if (!room) return;
  activeRooms.add(room);
  const s = getSocket();
  if (s.connected) {
    s.emit('room:join', room);
  }
}

export function leaveRoom(room: string) {
  if (!room) return;
  activeRooms.delete(room);
  const s = getSocket();
  if (s.connected) {
    s.emit('room:leave', room);
  }
}

export function onSocketEvent<T = any>(event: string, callback: (data: T) => void): () => void {
  const s = getSocket();
  const handler = (data: T) => {
    callback(data);
  };
  s.on(event, handler);

  return () => {
    s.off(event, handler);
  };
}

export function onConnectionChange(callback: (connected: boolean) => void): () => void {
  connectionListeners.add(callback);
  if (socketInstance) {
    callback(socketInstance.connected);
  }
  return () => {
    connectionListeners.delete(callback);
  };
}

export function reconnectSocket(auth?: SocketAuthOptions) {
  if (socketInstance) {
    if (auth) {
      if (auth.token) socketInstance.auth = { ...socketInstance.auth, token: auth.token };
      if (auth.tokenNumber) socketInstance.auth = { ...socketInstance.auth, tokenNumber: auth.tokenNumber };
    }
    socketInstance.disconnect();
    socketInstance.connect();
  } else {
    getSocket(auth);
  }
}
