'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthProvider';

const SocketContext = createContext<Socket | null>(null);

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketInstance = io(BACKEND_URL, {
      auth: {
        token: `Bearer ${token}`,
      },
      transports: ['polling', 'websocket'],
    });

    socketInstance.on('connect', () => {
      console.log('🔌 Connected to Socket.io server');
    });

    socketInstance.on('connect_error', (err) => {
      if (
        err.message.toLowerCase().includes('authentication') ||
        err.message.toLowerCase().includes('token')
      ) {
        console.warn('⚠️ Socket auth check:', err.message);
        // Disconnect immediately to prevent infinite reconnect attempts with an expired/invalid token
        socketInstance.disconnect();
      } else {
        console.error('❌ Socket connection error:', err.message);
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 Disconnected from Socket.io server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
