import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { JwtPayload } from '../../middleware/auth.js';

let io: SocketServer;

export function setupWebSocket(socketServer: SocketServer) {
  io = socketServer;

  io.use((socket, next) => {
    // Optional authentication for WebSocket
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        socket.data.userId = payload.userId;
      } catch (err) {
        // Allow connection without auth for public data
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`📡 Client connected: ${socket.id}`);

    // Subscribe to market updates
    socket.on('subscribe:market', (marketId: string) => {
      socket.join(`market:${marketId}`);
      console.log(`Client ${socket.id} subscribed to market:${marketId}`);
    });

    socket.on('unsubscribe:market', (marketId: string) => {
      socket.leave(`market:${marketId}`);
    });

    // Subscribe to specific outcome orderbook
    socket.on('subscribe:orderbook', (data: { marketId: string; outcomeId: string }) => {
      socket.join(`orderbook:${data.marketId}:${data.outcomeId}`);
    });

    socket.on('unsubscribe:orderbook', (data: { marketId: string; outcomeId: string }) => {
      socket.leave(`orderbook:${data.marketId}:${data.outcomeId}`);
    });

    // Subscribe to user-specific updates (requires auth)
    socket.on('subscribe:user', () => {
      if (socket.data.userId) {
        socket.join(`user:${socket.data.userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`📡 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Emit functions for use throughout the app
export function emitOrderBookUpdate(marketId: string, outcomeId: string) {
  if (!io) return;
  io.to(`orderbook:${marketId}:${outcomeId}`).emit('orderbook:update', {
    marketId,
    outcomeId,
    timestamp: new Date(),
  });
}

export function emitTradeExecuted(
  marketId: string,
  trade: { id: string; marketId: string; outcomeId: string; price: number; quantity: number; timestamp: Date }
) {
  if (!io) return;
  io.to(`market:${marketId}`).emit('trade:executed', trade);
}

export function emitPriceUpdate(outcomeId: string, price: number) {
  if (!io) return;
  io.emit('price:update', { outcomeId, price, timestamp: new Date() });
}

export function emitUserNotification(userId: string, notification: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', notification);
}

export function emitMarketStatusChange(marketId: string, status: string) {
  if (!io) return;
  io.to(`market:${marketId}`).emit('market:status', { marketId, status });
}
