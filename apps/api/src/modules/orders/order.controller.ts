import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as ammTrade from '../../services/amm/trade.js';
import * as orderService from './order.service.js';

// AMM Buy - spend amount to buy shares
const buySchema = z.object({
  marketId: z.string().min(1, 'Market ID is required'),
  outcomeId: z.string().min(1, 'Outcome ID is required'),
  amount: z.preprocess(
    (val) => (val === null || val === undefined ? undefined : Number(val)),
    z.number().min(1, 'Minimum bet is $1')
  ),
});

// AMM Sell - sell shares
const sellSchema = z.object({
  marketId: z.string().min(1, 'Market ID is required'),
  outcomeId: z.string().min(1, 'Outcome ID is required'),
  shares: z.preprocess(
    (val) => (val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0.01, 'Minimum shares is 0.01')
  ),
});

// Quote request
const quoteSchema = z.object({
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  amount: z.coerce.number().optional(),
  shares: z.coerce.number().optional(),
  side: z.enum(['BUY', 'SELL']),
});

const listOrdersSchema = z.object({
  marketId: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'PARTIAL', 'FILLED', 'CANCELLED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Buy shares using AMM
 * POST /api/orders/buy
 */
export async function buyShares(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('📥 Buy request:', JSON.stringify(req.body, null, 2));

    const data = buySchema.parse(req.body);

    const result = await ammTrade.buyShares({
      userId: req.user!.id,
      marketId: data.marketId,
      outcomeId: data.outcomeId,
      amount: data.amount,
    });

    console.log('✅ Buy executed:', result);

    res.status(201).json({
      success: true,
      data: {
        tradeId: result.tradeId,
        shares: result.shares,
        cost: result.cost,
        fee: result.fee,
        totalCost: result.cost + result.fee,
        avgPrice: result.avgPrice,
        newPrice: result.newPrice,
      },
    });
  } catch (error: any) {
    console.error('❌ Buy error:', error.message);
    next(error);
  }
}

/**
 * Sell shares using AMM
 * POST /api/orders/sell
 */
export async function sellShares(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('📥 Sell request:', JSON.stringify(req.body, null, 2));

    const data = sellSchema.parse(req.body);

    const result = await ammTrade.sellShares({
      userId: req.user!.id,
      marketId: data.marketId,
      outcomeId: data.outcomeId,
      shares: data.shares,
    });

    console.log('✅ Sell executed:', result);

    res.status(201).json({
      success: true,
      data: {
        tradeId: result.tradeId,
        shares: result.shares,
        proceeds: result.cost,
        fee: result.fee,
        netProceeds: result.cost - result.fee,
        avgPrice: result.avgPrice,
        newPrice: result.newPrice,
      },
    });
  } catch (error: any) {
    console.error('❌ Sell error:', error.message);
    next(error);
  }
}

/**
 * Get quote for buy/sell
 * GET /api/orders/quote
 */
export async function getQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const data = quoteSchema.parse(req.query);

    let quote;
    if (data.side === 'BUY' && data.amount) {
      quote = await ammTrade.getBuyQuote(data.marketId, data.outcomeId, data.amount);
    } else if (data.side === 'SELL' && data.shares) {
      quote = await ammTrade.getSellQuote(data.marketId, data.outcomeId, data.shares);
    } else {
      return res.status(400).json({
        success: false,
        error: { message: 'Provide amount for BUY or shares for SELL' },
      });
    }

    res.json({ success: true, data: quote });
  } catch (error: any) {
    next(error);
  }
}

/**
 * Legacy: Place order (redirects to buy)
 * POST /api/orders
 */
export async function placeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('📥 Legacy order request:', JSON.stringify(req.body, null, 2));

    const { side, marketId, outcomeId, amount, price, quantity, shares } = req.body;

    // Redirect to appropriate AMM endpoint
    if (side === 'SELL') {
      // For sell, convert quantity to shares
      req.body = {
        marketId,
        outcomeId,
        shares: shares || quantity || 1,
      };
      return sellShares(req, res, next);
    } else {
      // For buy, use amount directly or calculate from price * quantity
      let buyAmount = amount;
      if (!buyAmount && price && quantity) {
        buyAmount = price * quantity;
      }
      if (!buyAmount || isNaN(buyAmount)) {
        buyAmount = 10; // Default $10 if nothing specified
      }

      req.body = {
        marketId,
        outcomeId,
        amount: buyAmount,
      };
      return buyShares(req, res, next);
    }
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
