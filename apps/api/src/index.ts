import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { marketRouter } from './modules/markets/market.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { walletRouter } from './modules/wallet/wallet.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { setupWebSocket } from './services/websocket/index.js';
import { prisma } from './lib/prisma.js';

const app = express();
const httpServer = createServer(app);

// WebSocket setup
const io = new SocketServer(httpServer, {
  cors: {
    origin: config.webUrl,
    methods: ['GET', 'POST'],
  },
});

setupWebSocket(io);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.webUrl, credentials: true }));
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/markets', marketRouter);
app.use('/api/orders', orderRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/admin', adminRouter);

// Error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
httpServer.listen(config.port, () => {
  console.log(`🚀 API Server running on port ${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
});

export { app, io };
