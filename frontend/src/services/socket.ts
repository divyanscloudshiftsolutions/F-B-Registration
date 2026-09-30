import { io, Socket } from 'socket.io-client';
import { api } from './api';

let socket: Socket | null = null;
const activeRooms = new Set<string>();

export const getSocket = async (): Promise<Socket> => {
  if (socket && socket.connected) {
    return socket;
  }

  const baseUrl = await api.getBaseUrl();
  // Strip '/api' from base url to get root Socket.io host
  const socketUrl = baseUrl.replace(/\/api$/, '');

  if (!socket) {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // Rejoin all active rooms on reconnect
      activeRooms.forEach((room) => {
        socket?.emit('join', room);
      });
    });

    socket.on('disconnect', () => {
      // Handled silently
    });
  }

  return socket;
};

export const joinRoom = async (roomName: string) => {
  if (!roomName) return;
  activeRooms.add(roomName);
  const s = await getSocket();
  s.emit('join', roomName);
};

export const leaveRoom = async (roomName: string) => {
  if (!roomName) return;
  activeRooms.delete(roomName);
  if (socket && socket.connected) {
    socket.emit('leave', roomName);
  }
};

export const onSocketEvent = (event: string, callback: (data: any) => void): (() => void) => {
  let isSubscribed = true;

  getSocket().then((s) => {
    if (isSubscribed) {
      s.on(event, callback);
    }
  });

  return () => {
    isSubscribed = false;
    if (socket) {
      socket.off(event, callback);
    }
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    activeRooms.clear();
  }
};
