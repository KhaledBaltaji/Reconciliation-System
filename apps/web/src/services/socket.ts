import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';
import { useMarketStore } from '../stores/market';

let socket: Socket | null = null;

// Trade event callbacks
type TradeCallback = (trade: { id: string; outcomeId: string; price: number; quantity: number; timestamp: Date }) => void;
const tradeCallbacks: Map<string, Set<TradeCallback>> = new Map();

export function initSocket() {
  if (socket) return socket;

  const { accessToken } = useAuthStore.getState();

  socket = io({
    auth: {
      token: accessToken,
    },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  // Price updates
  socket.on('price:update', (data: { outcomeId: string; price: number }) => {
    useMarketStore.getState().updatePrice(data.outcomeId, data.price);
  });

  // Order book updates
  socket.on('orderbook:update', (data: { marketId: string; outcomeId: string }) => {
    // Trigger refetch of order book
    useMarketStore.getState().fetchOrderBook(data.marketId, data.outcomeId);
  });

  // Trade executed - broadcast to all listeners
  socket.on('trade:executed', (trade: { id: string; outcomeId: string; price: number; quantity: number; timestamp: Date; marketId?: string }) => {
    console.log('🔥 Trade executed:', trade);
    // Notify all registered callbacks for this market
    tradeCallbacks.forEach((callbacks, marketId) => {
      if (!trade.marketId || trade.marketId === marketId) {
        callbacks.forEach(cb => cb(trade));
      }
    });
  });

  return socket;
}

// Subscribe to trade events for a specific market
export function onTradeExecuted(marketId: string, callback: TradeCallback) {
  if (!tradeCallbacks.has(marketId)) {
    tradeCallbacks.set(marketId, new Set());
  }
  tradeCallbacks.get(marketId)!.add(callback);

  // Return unsubscribe function
  return () => {
    const callbacks = tradeCallbacks.get(marketId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        tradeCallbacks.delete(marketId);
      }
    }
  };
}

export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

export function subscribeToMarket(marketId: string) {
  const s = getSocket();
  s.emit('subscribe:market', marketId);
}

export function unsubscribeFromMarket(marketId: string) {
  const s = getSocket();
  s.emit('unsubscribe:market', marketId);
}

export function subscribeToOrderBook(marketId: string, outcomeId: string) {
  const s = getSocket();
  s.emit('subscribe:orderbook', { marketId, outcomeId });
}

export function unsubscribeFromOrderBook(marketId: string, outcomeId: string) {
  const s = getSocket();
  s.emit('unsubscribe:orderbook', { marketId, outcomeId });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
