import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as marketService from './market.service.js';

const listMarketsSchema = z.object({
  category: z.string().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'SUSPENDED', 'CLOSED', 'RESOLVED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const chartDataSchema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
});

export async function listMarkets(req: Request, res: Response, next: NextFunction) {
  try {
    const params = listMarketsSchema.parse(req.query);
    const result = await marketService.listMarkets(params);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getFeaturedMarkets(req: Request, res: Response, next: NextFunction) {
  try {
    const markets = await marketService.getFeaturedMarkets();
    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
}

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await marketService.listCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function getMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const market = await marketService.getMarketById(id);
    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function getOrderBook(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { outcomeId } = req.query;
    const orderBook = await marketService.getOrderBook(id, outcomeId as string);
    res.json({ success: true, data: orderBook });
  } catch (error) {
    next(error);
  }
}

export async function getRecentTrades(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await marketService.getRecentTrades(id, limit);
    res.json({ success: true, data: trades });
  } catch (error) {
    next(error);
  }
}

export async function getChartData(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, outcomeId } = req.params;
    const params = chartDataSchema.parse(req.query);
    const data = await marketService.getChartData(outcomeId, params);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
