/**
 * AMM Trade Service
 *
 * Handles buying and selling shares against the LMSR AMM
 */

import { prisma } from '../../lib/prisma.js';
import { TRADING_CONFIG } from '../../config/index.js';
import { emitTradeExecuted, emitPriceUpdate } from '../websocket/index.js';
import {
  createAMMState,
  calculateBuyCost,
  calculateSellProceeds,
  calculateSharesForAmount,
  getPrices,
} from './lmsr.js';

/**
 * Get liquidity parameter for a market with default fallback
 * Default: $10,000 max exposure for binary, $25,000 for multi-outcome
 */
function getMarketLiquidityParam(market: { liquidityParam: any; outcomes: { length: number } }): number {
  const liquidityParam = Number(market.liquidityParam);
  if (liquidityParam && isFinite(liquidityParam) && liquidityParam > 0) {
    return liquidityParam;
  }
  const numOutcomes = market.outcomes.length;
  const defaultMaxExposure = numOutcomes === 2 ? 10000 : 25000;
  return defaultMaxExposure / Math.log(numOutcomes);
}

interface BuyParams {
  userId: string;
  marketId: string;
  outcomeId: string;
  amount: number; // USD amount to spend
}

interface SellParams {
  userId: string;
  marketId: string;
  outcomeId: string;
  shares: number; // Number of shares to sell
}

interface TradeResult {
  tradeId: string;
  shares: number;
  cost: number;
  fee: number;
  newPrice: number;
  avgPrice: number;
}

/**
 * Buy shares of an outcome using AMM
 */
export async function buyShares(params: BuyParams): Promise<TradeResult> {
  const { userId, marketId, outcomeId, amount } = params;

  // Get market with outcomes
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new Error('Market not found');
  }

  if (market.status !== 'OPEN') {
    throw new Error('Market is not open for trading');
  }

  // Get liquidity parameter with default fallback
  const liquidityParam = getMarketLiquidityParam(market);

  // Create AMM state
  const ammState = createAMMState(
    liquidityParam,
    market.outcomes.map(o => ({
      id: o.id,
      sharesOutstanding: Number(o.sharesOutstanding) || 0,
    }))
  );

  // Calculate shares to buy
  const { shares, actualCost, newPrice } = calculateSharesForAmount(ammState, outcomeId, amount);

  if (shares <= 0) {
    throw new Error('Invalid trade amount');
  }

  // Calculate fee
  const fee = actualCost * TRADING_CONFIG.ENTRY_FEE_PERCENT;
  const totalCost = actualCost + fee;

  // Check user balance
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const availableBalance = Number(wallet.balanceUsd) - Number(wallet.lockedBalance);
  if (availableBalance < totalCost) {
    throw new Error(`Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`);
  }

  // Execute trade in transaction
  const trade = await prisma.$transaction(async (tx) => {
    // Deduct from user wallet
    await tx.wallet.update({
      where: { userId },
      data: {
        balanceUsd: { decrement: totalCost },
      },
    });

    // Update shares outstanding for outcome
    await tx.marketOutcome.update({
      where: { id: outcomeId },
      data: {
        sharesOutstanding: { increment: shares },
        currentPrice: newPrice,
        totalVolume: { increment: actualCost },
      },
    });

    // Update all outcome prices (they must sum to 1)
    const newAmmState = createAMMState(
      liquidityParam,
      market.outcomes.map(o => ({
        id: o.id,
        sharesOutstanding: o.id === outcomeId
          ? Number(o.sharesOutstanding) + shares
          : Number(o.sharesOutstanding),
      }))
    );
    const newPrices = getPrices(newAmmState);

    for (const outcome of market.outcomes) {
      if (outcome.id !== outcomeId) {
        await tx.marketOutcome.update({
          where: { id: outcome.id },
          data: { currentPrice: newPrices.get(outcome.id) || 0 },
        });
      }
    }

    // Update market volume
    await tx.market.update({
      where: { id: marketId },
      data: {
        totalVolume: { increment: actualCost },
      },
    });

    // Create/update user position
    await tx.position.upsert({
      where: {
        userId_marketId_outcomeId: {
          userId,
          marketId,
          outcomeId,
        },
      },
      create: {
        userId,
        marketId,
        outcomeId,
        quantity: shares,
        avgEntryPrice: actualCost / shares,
      },
      update: {
        quantity: { increment: shares },
        // Update avg entry price (weighted average)
        avgEntryPrice: actualCost / shares, // Simplified for now
      },
    });

    // Create trade record (AMM trade - no order records needed)
    const tradeRecord = await tx.trade.create({
      data: {
        marketId,
        outcomeId,
        buyerId: userId,
        sellerId: 'AMM', // House/AMM
        price: actualCost / shares,
        quantity: shares,
        buyerFee: fee,
        sellerFee: 0,
        tradeType: 'AMM',
      },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'TRADE_BUY',
        amount: -actualCost,
        fee,
        balanceBefore: wallet.balanceUsd,
        balanceAfter: Number(wallet.balanceUsd) - totalCost,
        status: 'COMPLETED',
        referenceId: tradeRecord.id,
      },
    });

    // Record price history
    await tx.priceHistory.create({
      data: {
        outcomeId,
        price: newPrice,
        volume: actualCost,
      },
    });

    return tradeRecord;
  });

  // Emit WebSocket events
  emitTradeExecuted(marketId, {
    id: trade.id,
    marketId,
    outcomeId,
    price: actualCost / shares,
    quantity: shares,
    timestamp: new Date(),
  });

  emitPriceUpdate(outcomeId, newPrice);

  return {
    tradeId: trade.id,
    shares,
    cost: actualCost,
    fee,
    newPrice,
    avgPrice: actualCost / shares,
  };
}

/**
 * Sell shares of an outcome using AMM
 */
export async function sellShares(params: SellParams): Promise<TradeResult> {
  const { userId, marketId, outcomeId, shares } = params;

  // Check user position
  const position = await prisma.position.findUnique({
    where: {
      userId_marketId_outcomeId: {
        userId,
        marketId,
        outcomeId,
      },
    },
  });

  if (!position || Number(position.quantity) < shares) {
    throw new Error('Insufficient position to sell');
  }

  // Get market with outcomes
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new Error('Market not found');
  }

  if (market.status !== 'OPEN') {
    throw new Error('Market is not open for trading');
  }

  // Get liquidity parameter with default fallback
  const liquidityParam = getMarketLiquidityParam(market);

  // Create AMM state
  const ammState = createAMMState(
    liquidityParam,
    market.outcomes.map(o => ({
      id: o.id,
      sharesOutstanding: Number(o.sharesOutstanding) || 0,
    }))
  );

  // Calculate proceeds
  const { proceeds, newPrice, avgPrice } = calculateSellProceeds(ammState, outcomeId, shares);

  if (proceeds <= 0) {
    throw new Error('Invalid trade');
  }

  // Calculate fee
  const fee = proceeds * TRADING_CONFIG.EXIT_FEE_PERCENT;
  const netProceeds = proceeds - fee;

  // Get wallet for transaction record
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Execute trade in transaction
  const trade = await prisma.$transaction(async (tx) => {
    // Add to user wallet
    await tx.wallet.update({
      where: { userId },
      data: {
        balanceUsd: { increment: netProceeds },
      },
    });

    // Update shares outstanding for outcome
    await tx.marketOutcome.update({
      where: { id: outcomeId },
      data: {
        sharesOutstanding: { decrement: shares },
        currentPrice: newPrice,
        totalVolume: { increment: proceeds },
      },
    });

    // Update all outcome prices
    const newAmmState = createAMMState(
      liquidityParam,
      market.outcomes.map(o => ({
        id: o.id,
        sharesOutstanding: o.id === outcomeId
          ? Number(o.sharesOutstanding) - shares
          : Number(o.sharesOutstanding),
      }))
    );
    const newPrices = getPrices(newAmmState);

    for (const outcome of market.outcomes) {
      if (outcome.id !== outcomeId) {
        await tx.marketOutcome.update({
          where: { id: outcome.id },
          data: { currentPrice: newPrices.get(outcome.id) || 0 },
        });
      }
    }

    // Update market volume
    await tx.market.update({
      where: { id: marketId },
      data: {
        totalVolume: { increment: proceeds },
      },
    });

    // Update user position
    await tx.position.update({
      where: {
        userId_marketId_outcomeId: {
          userId,
          marketId,
          outcomeId,
        },
      },
      data: {
        quantity: { decrement: shares },
      },
    });

    // Create trade record (AMM trade - no order records needed)
    const tradeRecord = await tx.trade.create({
      data: {
        marketId,
        outcomeId,
        buyerId: 'AMM',
        sellerId: userId,
        price: avgPrice,
        quantity: shares,
        buyerFee: 0,
        sellerFee: fee,
        tradeType: 'AMM',
      },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'TRADE_SELL',
        amount: proceeds,
        fee,
        balanceBefore: wallet.balanceUsd,
        balanceAfter: Number(wallet.balanceUsd) + netProceeds,
        status: 'COMPLETED',
        referenceId: tradeRecord.id,
      },
    });

    // Record price history
    await tx.priceHistory.create({
      data: {
        outcomeId,
        price: newPrice,
        volume: proceeds,
      },
    });

    return tradeRecord;
  });

  // Emit WebSocket events
  emitTradeExecuted(marketId, {
    id: trade.id,
    marketId,
    outcomeId,
    price: avgPrice,
    quantity: shares,
    timestamp: new Date(),
  });

  emitPriceUpdate(outcomeId, newPrice);

  return {
    tradeId: trade.id,
    shares,
    cost: proceeds,
    fee,
    newPrice,
    avgPrice,
  };
}

/**
 * Get current AMM prices for a market
 */
export async function getMarketPrices(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new Error('Market not found');
  }

  const liquidityParam = getMarketLiquidityParam(market);

  const ammState = createAMMState(
    liquidityParam,
    market.outcomes.map(o => ({
      id: o.id,
      sharesOutstanding: Number(o.sharesOutstanding),
    }))
  );

  const prices = getPrices(ammState);

  return market.outcomes.map(o => ({
    id: o.id,
    name: o.name,
    price: prices.get(o.id) || 0,
    sharesOutstanding: Number(o.sharesOutstanding),
  }));
}

/**
 * Get quote for buying shares
 */
export async function getBuyQuote(marketId: string, outcomeId: string, amount: number) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new Error('Market not found');
  }

  const liquidityParam = getMarketLiquidityParam(market);

  const ammState = createAMMState(
    liquidityParam,
    market.outcomes.map(o => ({
      id: o.id,
      sharesOutstanding: Number(o.sharesOutstanding) || 0,
    }))
  );

  const { shares, actualCost, newPrice } = calculateSharesForAmount(ammState, outcomeId, amount);
  const fee = actualCost * TRADING_CONFIG.ENTRY_FEE_PERCENT;

  return {
    shares,
    cost: actualCost,
    fee,
    totalCost: actualCost + fee,
    avgPrice: actualCost / shares,
    newPrice,
    potentialPayout: shares, // If outcome wins, you get $1 per share
    potentialProfit: shares - (actualCost + fee),
  };
}

/**
 * Get quote for selling shares
 */
export async function getSellQuote(marketId: string, outcomeId: string, shares: number) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    throw new Error('Market not found');
  }

  const liquidityParam = getMarketLiquidityParam(market);

  const ammState = createAMMState(
    liquidityParam,
    market.outcomes.map(o => ({
      id: o.id,
      sharesOutstanding: Number(o.sharesOutstanding) || 0,
    }))
  );

  const { proceeds, newPrice, avgPrice } = calculateSellProceeds(ammState, outcomeId, shares);
  const fee = proceeds * TRADING_CONFIG.EXIT_FEE_PERCENT;

  return {
    shares,
    proceeds,
    fee,
    netProceeds: proceeds - fee,
    avgPrice,
    newPrice,
  };
}
