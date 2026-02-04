import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as orderController from './order.controller.js';

export const orderRouter = Router();

// All order routes require authentication
orderRouter.use(authenticate);

// Orders
orderRouter.post('/', orderController.placeOrder);
orderRouter.get('/', orderController.getUserOrders);
orderRouter.delete('/:id', orderController.cancelOrder);

// Positions
orderRouter.get('/positions', orderController.getUserPositions);
orderRouter.get('/positions/:marketId', orderController.getMarketPosition);
