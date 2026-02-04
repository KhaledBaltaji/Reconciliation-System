import { prisma } from '../../lib/prisma.js';
import { TRADING_CONFIG } from '../../config/index.js';
import { emitOrderBookUpdate, emitTradeExecuted, emitPriceUpdate } from '../websocket/index.js';
import { Decimal } from '@prisma/client/runtime/library';

export async function matchOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      market: true,
      outcome: true,
    },
  });

  if (!order || order.status !== 'OPEN') {
    return;
  }

  // Get opposite side orders
  const oppositeOrders = await prisma.order.findMany({
    where: {
      outcomeId: order.outcomeId,
      side: order.side === 'BUY' ? 'SELL' : 'BUY',
      status: { in: ['OPEN', 'PARTIAL'] },
      // Price matching condition
      ...(order.side === 'BUY'
        ? { price: { lte: order.price } } // Buy matches with sells at same or lower price
        : { price: { gte: order.price } }), // Sell matches with buys at same or higher price
    },
    orderBy: [
      // Price-time priority
      { price: order.side === 'BUY' ? 'asc' : 'desc' },
      { createdAt: 'asc' },
    ],
  });

  let remainingQuantity = Number(order.quantity) - Number(order.filledQuantity);

  for (const oppositeOrder of oppositeOrders) {
    if (remainingQuantity <= 0) break;

    const oppositeRemaining =
      Number(oppositeOrder.quantity) - Number(oppositeOrder.filledQuantity);
    const matchQuantity = Math.min(remainingQuantity, oppositeRemaining);

    // Execute trade at the resting order's price (price-time priority)
    const tradePrice = Number(oppositeOrder.price);

    await executeTrade(order, oppositeOrder, matchQuantity, tradePrice);

    remainingQuantity -= matchQuantity;
  }

  // Update order status based on fill
  const filledQuantity = Number(order.quantity) - remainingQuantity;
  let newStatus = order.status;

  if (filledQuantity >= Number(order.quantity)) {
    newStatus = 'FILLED';
  } else if (filledQuantity > 0) {
    newStatus = 'PARTIAL';
  }

  if (newStatus !== order.status || filledQuantity > Number(order.filledQuantity)) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        filledQuantity,
        status: newStatus,
      },
    });
  }

  // Emit order book update
  emitOrderBookUpdate(order.marketId, order.outcomeId);
}

async function executeTrade(
  buyerOrder: any,
  sellerOrder: any,
  quantity: number,
  price: number
) {
  const isBuyerIncoming = buyerOrder.side === 'BUY';
  const incomingOrder = isBuyerIncoming ? buyerOrder : sellerOrder;
  const restingOrder = isBuyerIncoming ? sellerOrder : buyerOrder;

  const tradeValue = price * quantity;
  const buyerFee = tradeValue * TRADING_CONFIG.ENTRY_FEE_PERCENT;
  const sellerFee = tradeValue * TRADING_CONFIG.EXIT_FEE_PERCENT;

  await prisma.$transaction(async (tx) => {
    // Create trade record
    const trade = await tx.trade.create({
      data: {
        marketId: incomingOrder.marketId,
        outcomeId: incomingOrder.outcomeId,
        buyOrderId: isBuyerIncoming ? incomingOrder.id : restingOrder.id,
        sellOrderId: isBuyerIncoming ? restingOrder.id : incomingOrder.id,
        buyerId: isBuyerIncoming ? incomingOrder.userId : restingOrder.userId,
        sellerId: isBuyerIncoming ? restingOrder.userId : incomingOrder.userId,
        price,
        quantity,
        buyerFee,
        sellerFee,
      },
    });

    // Update buyer order
    const buyOrder = isBuyerIncoming ? incomingOrder : restingOrder;
    const newBuyerFilled = Number(buyOrder.filledQuantity) + quantity;
    await tx.order.update({
      where: { id: buyOrder.id },
      data: {
        filledQuantity: newBuyerFilled,
        status: newBuyerFilled >= Number(buyOrder.quantity) ? 'FILLED' : 'PARTIAL',
      },
    });

    // Update seller order
    const sellOrder = isBuyerIncoming ? restingOrder : incomingOrder;
    const newSellerFilled = Number(sellOrder.filledQuantity) + quantity;
    await tx.order.update({
      where: { id: sellOrder.id },
      data: {
        filledQuantity: newSellerFilled,
        status: newSellerFilled >= Number(sellOrder.quantity) ? 'FILLED' : 'PARTIAL',
      },
    });

    // Update buyer wallet - deduct cost + fee, unlock the locked amount
    const buyerTotalCost = tradeValue + buyerFee;
    const buyerWallet = await tx.wallet.findUnique({ where: { userId: buyOrder.userId } });

    if (buyerWallet) {
      await tx.wallet.update({
        where: { userId: buyOrder.userId },
        data: {
          balanceUsd: { decrement: buyerTotalCost },
          lockedBalance: { decrement: buyerTotalCost },
        },
      });

      // Record buyer transaction
      await tx.transaction.create({
        data: {
          userId: buyOrder.userId,
          type: 'TRADE_BUY',
          amount: -tradeValue,
          fee: buyerFee,
          balanceBefore: buyerWallet.balanceUsd,
          balanceAfter: Number(buyerWallet.balanceUsd) - buyerTotalCost,
          status: 'COMPLETED',
          referenceId: trade.id,
        },
      });
    }

    // Update seller wallet - add proceeds minus fee
    const sellerProceeds = tradeValue - sellerFee;
    const sellerWallet = await tx.wallet.findUnique({ where: { userId: sellOrder.userId } });

    if (sellerWallet) {
      await tx.wallet.update({
        where: { userId: sellOrder.userId },
        data: {
          balanceUsd: { increment: sellerProceeds },
        },
      });

      // Record seller transaction
      await tx.transaction.create({
        data: {
          userId: sellOrder.userId,
          type: 'TRADE_SELL',
          amount: tradeValue,
          fee: sellerFee,
          balanceBefore: sellerWallet.balanceUsd,
          balanceAfter: Number(sellerWallet.balanceUsd) + sellerProceeds,
          status: 'COMPLETED',
          referenceId: trade.id,
        },
      });
    }

    // Update buyer position
    await tx.position.upsert({
      where: {
        userId_marketId_outcomeId: {
          userId: buyOrder.userId,
          marketId: buyOrder.marketId,
          outcomeId: buyOrder.outcomeId,
        },
      },
      create: {
        userId: buyOrder.userId,
        marketId: buyOrder.marketId,
        outcomeId: buyOrder.outcomeId,
        quantity,
        avgEntryPrice: price,
      },
      update: {
        quantity: { increment: quantity },
        // Update average entry price
        avgEntryPrice: price, // Simplified - should calculate weighted average
      },
    });

    // Update seller position
    await tx.position.update({
      where: {
        userId_marketId_outcomeId: {
          userId: sellOrder.userId,
          marketId: sellOrder.marketId,
          outcomeId: sellOrder.outcomeId,
        },
      },
      data: {
        quantity: { decrement: quantity },
      },
    });

    // Update outcome price and volume
    await tx.marketOutcome.update({
      where: { id: incomingOrder.outcomeId },
      data: {
        currentPrice: price,
        totalVolume: { increment: tradeValue },
      },
    });

    // Update market total volume
    await tx.market.update({
      where: { id: incomingOrder.marketId },
      data: {
        totalVolume: { increment: tradeValue },
      },
    });

    // Record price history
    await tx.priceHistory.create({
      data: {
        outcomeId: incomingOrder.outcomeId,
        price,
        volume: tradeValue,
      },
    });

    // Emit WebSocket events
    emitTradeExecuted(incomingOrder.marketId, {
      id: trade.id,
      outcomeId: incomingOrder.outcomeId,
      price,
      quantity,
      timestamp: new Date(),
    });

    emitPriceUpdate(incomingOrder.outcomeId, price);
  });
}
