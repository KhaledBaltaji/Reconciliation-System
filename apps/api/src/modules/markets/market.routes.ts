import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as marketController from './market.controller.js';

export const marketRouter = Router();

// Public routes
marketRouter.get('/', marketController.listMarkets);
marketRouter.get('/featured', marketController.getFeaturedMarkets);
marketRouter.get('/categories', marketController.listCategories);
marketRouter.get('/:id', marketController.getMarket);
marketRouter.get('/:id/orderbook', marketController.getOrderBook);
marketRouter.get('/:id/trades', marketController.getRecentTrades);
marketRouter.get('/:id/chart/:outcomeId', marketController.getChartData);
