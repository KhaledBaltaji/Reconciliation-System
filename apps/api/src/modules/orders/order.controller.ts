import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as orderService from './order.service.js';

const placeOrderSchema = z.object({
  marketId: z.string().uuid(),
  outcomeId: z.string().uuid(),
  side: z.enum(['BUY', 'SELL']),
  orderType: z.enum(['LIMIT', 'MARKET']).default('LIMIT'),
  price: z.number().min(0.01).max(0.99),
  quantity: z.number().min(1),
});

const listOrdersSchema = z.object({
  marketId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'PARTIAL', 'FILLED', 'CANCELLED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function placeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = placeOrderSchema.parse(req.body);
    const order = await orderService.placeOrder(req.user!.id, data);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function getUserOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const params = listOrdersSchema.parse(req.query);
    const orders = await orderService.getUserOrders(req.user!.id, params);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const order = await orderService.cancelOrder(req.user!.id, id);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function getUserPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const positions = await orderService.getUserPositions(req.user!.id);
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
}

export async function getMarketPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const { marketId } = req.params;
    const positions = await orderService.getMarketPositions(req.user!.id, marketId);
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
}
