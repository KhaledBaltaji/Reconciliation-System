import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as orderController from './order.controller.js';

export const orderRouter = Router();

// All order routes require authentication
orderRouter.use(authenticate);

// AMM Trading endpoints
orderRouter.post('/buy', orderController.buyShares);
orderRouter.post('/sell', orderController.sellShares);
orderRouter.get('/quote', orderController.getQuote);

// Legacy order endpoint (redirects to AMM)
orderRouter.post('/', orderController.placeOrder);
orderRouter.get('/', orderController.getUserOrders);
orderRouter.delete('/:id', orderController.cancelOrder);

// Positions
orderRouter.get('/positions', orderController.getUserPositions);
orderRouter.get('/positions/:marketId', orderController.getMarketPosition);
