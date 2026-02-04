import { prisma } from '../../lib/prisma.js';
import { TRADING_CONFIG } from '../../config/index.js';
import {
  ValidationError,
  NotFoundError,
  InsufficientFundsError,
  ForbiddenError,
} from '../../middleware/error-handler.js';
import { matchOrder } from '../../services/matching-engine/index.js';
import { OrderSide, OrderStatus } from '@prisma/client';

interface PlaceOrderParams {
  marketId: string;
  outcomeId: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET';
  price: number;
  quantity: number;
}

interface ListOrdersParams {
  marketId?: string;
  status?: OrderStatus;
  page: number;
  limit: number;
}

export async function placeOrder(userId: string, params: PlaceOrderParams) {
  const { marketId, outcomeId, side, orderType, price, quantity } = params;

  // Validate market is open
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new NotFoundError('Market not found');
  }

  if (market.status !== 'OPEN') {
    throw new ValidationError('Market is not open for trading');
  }

  // Validate outcome belongs to market
  const outcome = market.outcomes.find(o => o.id === outcomeId);
  if (!outcome) {
    throw new NotFoundError('Outcome not found in this market');
  }

  // Validate price
  if (price < TRADING_CONFIG.MIN_PRICE || price > TRADING_CONFIG.MAX_PRICE) {
    throw new ValidationError(
      `Price must be between ${TRADING_CONFIG.MIN_PRICE} and ${TRADING_CONFIG.MAX_PRICE}`
    );
  }

  // Calculate required funds
  const orderValue = price * quantity;
  const entryFee = orderValue * TRADING_CONFIG.ENTRY_FEE_PERCENT;
  const totalRequired = orderValue + entryFee;

  // Get user wallet
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new NotFoundError('Wallet not found');
  }

  if (side === 'BUY') {
    // Check available balance for buy orders
    const availableBalance = Number(wallet.balanceUsd) - Number(wallet.lockedBalance);
    if (availableBalance < totalRequired) {
      throw new InsufficientFundsError(
        `Insufficient funds. Required: $${totalRequired.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`
      );
    }
  } else {
    // For sell orders, check position
    const position = await prisma.position.findUnique({
      where: {
        userId_marketId_outcomeId: {
          userId,
          marketId,
          outcomeId,
        },
      },
    });

    if (!position || Number(position.quantity) < quantity) {
      throw new ValidationError('Insufficient position to sell');
    }
  }

  // Create order and lock funds in a transaction
  const order = await prisma.$transaction(async (tx) => {
    // Lock funds for buy orders
    if (side === 'BUY') {
      await tx.wallet.update({
        where: { userId },
        data: {
          lockedBalance: { increment: totalRequired },
        },
      });
    }

    // Create order
    const newOrder = await tx.order.create({
      data: {
        userId,
        marketId,
        outcomeId,
        side,
        orderType,
        price,
        quantity,
        status: 'OPEN',
      },
      include: {
        market: { select: { id: true, title: true } },
        outcome: { select: { id: true, name: true } },
      },
    });

    return newOrder;
  });

  // Try to match the order
  await matchOrder(order.id);

  // Return updated order
  return prisma.order.findUnique({
    where: { id: order.id },
    include: {
      market: { select: { id: true, title: true } },
      outcome: { select: { id: true, name: true } },
    },
  });
}

export async function getUserOrders(userId: string, params: ListOrdersParams) {
  const { marketId, status, page, limit } = params;

  const where = {
    userId,
    ...(marketId && { marketId }),
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        market: { select: { id: true, title: true, status: true } },
        outcome: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function cancelOrder(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.userId !== userId) {
    throw new ForbiddenError('You can only cancel your own orders');
  }

  if (order.status !== 'OPEN' && order.status !== 'PARTIAL') {
    throw new ValidationError('Order cannot be cancelled');
  }

  // Calculate unfilled amount to unlock
  const unfilledQuantity = Number(order.quantity) - Number(order.filledQuantity);
  const unfilledValue = Number(order.price) * unfilledQuantity;
  const lockedFee = unfilledValue * TRADING_CONFIG.ENTRY_FEE_PERCENT;
  const totalToUnlock = unfilledValue + lockedFee;

  // Cancel order and unlock funds
  return prisma.$transaction(async (tx) => {
    // Unlock funds for buy orders
    if (order.side === 'BUY') {
      await tx.wallet.update({
        where: { userId },
        data: {
          lockedBalance: { decrement: totalToUnlock },
        },
      });
    }

    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: {
        market: { select: { id: true, title: true } },
        outcome: { select: { id: true, name: true } },
      },
    });

    return updatedOrder;
  });
}

export async function getUserPositions(userId: string) {
  return prisma.position.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
    },
    include: {
      market: {
        select: {
          id: true,
          title: true,
          status: true,
          expiresAt: true,
        },
      },
      outcome: {
        select: {
          id: true,
          name: true,
          currentPrice: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getMarketPositions(userId: string, marketId: string) {
  return prisma.position.findMany({
    where: {
      userId,
      marketId,
    },
    include: {
      outcome: {
        select: {
          id: true,
          name: true,
          currentPrice: true,
        },
      },
    },
  });
}
