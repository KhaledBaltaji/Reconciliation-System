import { prisma } from '../../lib/prisma.js';
import { cache, CACHE_KEYS } from '../../lib/redis.js';
import { NotFoundError } from '../../middleware/error-handler.js';
import { MarketStatus, Prisma } from '@prisma/client';

interface ListMarketsParams {
  category?: string;
  status?: MarketStatus;
  search?: string;
  page: number;
  limit: number;
}

export async function listMarkets(params: ListMarketsParams) {
  const { category, status, search, page, limit } = params;

  const where: Prisma.MarketWhereInput = {
    ...(category && { category: { slug: category } }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    // Only show open markets to public by default
    ...(!status && { status: 'OPEN' }),
  };

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        outcomes: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            currentPrice: true,
            totalVolume: true,
          },
        },
        _count: { select: { trades: true } },
      },
      orderBy: [{ totalVolume: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.market.count({ where }),
  ]);

  return {
    markets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getFeaturedMarkets() {
  return prisma.market.findMany({
    where: { status: 'OPEN' },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      outcomes: {
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          name: true,
          currentPrice: true,
          totalVolume: true,
        },
      },
    },
    orderBy: { totalVolume: 'desc' },
    take: 6,
  });
}

export async function listCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      iconUrl: true,
      _count: {
        select: {
          markets: { where: { status: 'OPEN' } },
        },
      },
    },
  });
}

export async function getMarketById(id: string) {
  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      category: true,
      outcomes: {
        orderBy: { displayOrder: 'asc' },
      },
      createdBy: {
        select: { id: true, fullName: true },
      },
      _count: {
        select: { trades: true, positions: true },
      },
    },
  });

  if (!market) {
    throw new NotFoundError('Market not found');
  }

  return market;
}

export async function getOrderBook(marketId: string, outcomeId?: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new NotFoundError('Market not found');
  }

  const outcomeIds = outcomeId ? [outcomeId] : market.outcomes.map(o => o.id);

  const orderBooks: Record<string, { bids: any[]; asks: any[] }> = {};

  for (const oid of outcomeIds) {
    // Get buy orders (bids) - highest price first
    const bids = await prisma.order.groupBy({
      by: ['price'],
      where: {
        outcomeId: oid,
        side: 'BUY',
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      _sum: {
        quantity: true,
        filledQuantity: true,
      },
      orderBy: { price: 'desc' },
      take: 20,
    });

    // Get sell orders (asks) - lowest price first
    const asks = await prisma.order.groupBy({
      by: ['price'],
      where: {
        outcomeId: oid,
        side: 'SELL',
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      _sum: {
        quantity: true,
        filledQuantity: true,
      },
      orderBy: { price: 'asc' },
      take: 20,
    });

    orderBooks[oid] = {
      bids: bids.map(b => ({
        price: b.price,
        quantity: Number(b._sum.quantity) - Number(b._sum.filledQuantity || 0),
      })),
      asks: asks.map(a => ({
        price: a.price,
        quantity: Number(a._sum.quantity) - Number(a._sum.filledQuantity || 0),
      })),
    };
  }

  return orderBooks;
}

export async function getRecentTrades(marketId: string, limit: number) {
  return prisma.trade.findMany({
    where: { marketId },
    include: {
      outcome: { select: { id: true, name: true } },
    },
    orderBy: { executedAt: 'desc' },
    take: limit,
  });
}

export async function getChartData(
  outcomeId: string,
  params: { interval: string; from?: number; to?: number }
) {
  const { interval, from, to } = params;

  // Calculate time range
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days default

  const priceHistory = await prisma.priceHistory.findMany({
    where: {
      outcomeId,
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Aggregate into OHLCV based on interval
  // For simplicity, return raw data - frontend can aggregate
  return priceHistory.map(p => ({
    time: p.timestamp.getTime(),
    price: Number(p.price),
    volume: Number(p.volume),
  }));
}

// Admin functions
export async function createMarket(data: {
  categoryId: string;
  title: string;
  description?: string;
  marketType: 'BINARY' | 'MULTIPLE_CHOICE';
  outcomes: string[];
  expiresAt: Date;
  createdById: string;
}) {
  const { outcomes, ...marketData } = data;

  return prisma.market.create({
    data: {
      ...marketData,
      outcomes: {
        create: outcomes.map((name, index) => ({
          name,
          displayOrder: index,
          currentPrice: 1 / outcomes.length, // Equal probability initially
        })),
      },
    },
    include: { outcomes: true, category: true },
  });
}

export async function resolveMarket(
  marketId: string,
  winningOutcomeId: string,
  adminId: string
) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new NotFoundError('Market not found');
  }

  if (market.status !== 'OPEN' && market.status !== 'CLOSED') {
    throw new Error('Market cannot be resolved in current status');
  }

  const winningOutcome = market.outcomes.find(o => o.id === winningOutcomeId);
  if (!winningOutcome) {
    throw new NotFoundError('Outcome not found');
  }

  // Update market and outcomes
  await prisma.$transaction(async (tx) => {
    // Mark winning outcome
    await tx.marketOutcome.updateMany({
      where: { marketId },
      data: { winningOutcome: false },
    });

    await tx.marketOutcome.update({
      where: { id: winningOutcomeId },
      data: { winningOutcome: true },
    });

    // Update market status
    await tx.market.update({
      where: { id: marketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Cancel all open orders
    await tx.order.updateMany({
      where: {
        marketId,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      data: { status: 'CANCELLED' },
    });

    // Process settlements - pay out winning positions
    const winningPositions = await tx.position.findMany({
      where: {
        marketId,
        outcomeId: winningOutcomeId,
        quantity: { gt: 0 },
      },
      include: { user: { include: { wallet: true } } },
    });

    for (const position of winningPositions) {
      const payout = Number(position.quantity); // Each share pays $1 if winner
      const fee = payout * 0.025; // 2.5% exit fee
      const netPayout = payout - fee;

      if (position.user.wallet) {
        const balanceBefore = Number(position.user.wallet.balanceUsd);

        await tx.wallet.update({
          where: { userId: position.userId },
          data: { balanceUsd: { increment: netPayout } },
        });

        await tx.transaction.create({
          data: {
            userId: position.userId,
            type: 'SETTLEMENT_WIN',
            amount: netPayout,
            fee: fee,
            balanceBefore: balanceBefore,
            balanceAfter: balanceBefore + netPayout,
            status: 'COMPLETED',
            referenceId: marketId,
          },
        });
      }
    }

    // Log admin action
    await tx.adminAction.create({
      data: {
        adminId,
        actionType: 'RESOLVE_MARKET',
        targetType: 'market',
        targetId: marketId,
        metadata: { winningOutcomeId },
      },
    });
  });

  return getMarketById(marketId);
}
