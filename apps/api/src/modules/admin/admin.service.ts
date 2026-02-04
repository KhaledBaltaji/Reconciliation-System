import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.js';
import { resolveMarket as resolveMarketCore } from '../markets/market.service.js';
import { MarketStatus, KycStatus } from '@prisma/client';
import { TRADING_CONFIG } from '../../config/index.js';

interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

// Dashboard
export async function getDashboardStats() {
  const [
    totalUsers,
    activeMarkets,
    totalVolume,
    pendingKyc,
    recentTransactions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.market.count({ where: { status: 'OPEN' } }),
    prisma.market.aggregate({ _sum: { totalVolume: true } }),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  return {
    totalUsers,
    activeMarkets,
    totalVolume: totalVolume._sum.totalVolume || 0,
    pendingKyc,
    recentTransactions,
  };
}

// Market management
export async function createMarket(data: {
  categoryId: string;
  title: string;
  description?: string;
  marketType: 'BINARY' | 'MULTIPLE_CHOICE';
  outcomes: string[];
  expiresAt: Date;
  createdById: string;
  imageUrl?: string;
}) {
  const { outcomes, ...marketData } = data;

  // Validate outcomes
  if (data.marketType === 'BINARY' && outcomes.length !== 2) {
    throw new ValidationError('Binary markets must have exactly 2 outcomes');
  }

  if (data.marketType === 'MULTIPLE_CHOICE' && outcomes.length < 2) {
    throw new ValidationError('Multiple choice markets must have at least 2 outcomes');
  }

  const market = await prisma.market.create({
    data: {
      ...marketData,
      status: 'DRAFT',
      outcomes: {
        create: outcomes.map((name, index) => ({
          name,
          displayOrder: index,
          currentPrice: 1 / outcomes.length,
        })),
      },
    },
    include: { outcomes: true, category: true },
  });

  await logAdminAction(data.createdById, 'CREATE_MARKET', 'market', market.id);

  return market;
}

export async function updateMarket(
  marketId: string,
  data: { title?: string; description?: string; expiresAt?: string; imageUrl?: string },
  adminId: string
) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });

  if (!market) {
    throw new NotFoundError('Market not found');
  }

  if (market.status === 'RESOLVED') {
    throw new ValidationError('Cannot update resolved market');
  }

  const updated = await prisma.market.update({
    where: { id: marketId },
    data: {
      ...data,
      ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
    },
    include: { outcomes: true, category: true },
  });

  await logAdminAction(adminId, 'UPDATE_MARKET', 'market', marketId, data);

  return updated;
}

export async function setMarketStatus(
  marketId: string,
  status: MarketStatus,
  adminId: string
) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });

  if (!market) {
    throw new NotFoundError('Market not found');
  }

  // Validate status transitions
  const validTransitions: Record<MarketStatus, MarketStatus[]> = {
    DRAFT: ['OPEN'],
    OPEN: ['SUSPENDED', 'CLOSED'],
    SUSPENDED: ['OPEN', 'CLOSED'],
    CLOSED: ['RESOLVED', 'OPEN'],
    RESOLVED: [],
    CANCELLED: [],
  };

  if (!validTransitions[market.status].includes(status)) {
    throw new ValidationError(
      `Cannot transition from ${market.status} to ${status}`
    );
  }

  const updated = await prisma.market.update({
    where: { id: marketId },
    data: { status },
    include: { outcomes: true, category: true },
  });

  await logAdminAction(adminId, `SET_MARKET_${status}`, 'market', marketId);

  return updated;
}

export async function resolveMarket(
  marketId: string,
  winningOutcomeId: string,
  adminId: string
) {
  return resolveMarketCore(marketId, winningOutcomeId, adminId);
}

// Category management
export async function createCategory(
  data: { name: string; slug: string; iconUrl?: string; displayOrder?: number },
  adminId: string
) {
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  });

  if (existing) {
    throw new ValidationError('Category with this name or slug already exists');
  }

  const category = await prisma.category.create({ data });

  await logAdminAction(adminId, 'CREATE_CATEGORY', 'category', category.id);

  return category;
}

export async function updateCategory(
  categoryId: string,
  data: Partial<{ name: string; slug: string; iconUrl: string; displayOrder: number; isActive: boolean }>,
  adminId: string
) {
  const category = await prisma.category.update({
    where: { id: categoryId },
    data,
  });

  await logAdminAction(adminId, 'UPDATE_CATEGORY', 'category', categoryId, data);

  return category;
}

export async function deleteCategory(categoryId: string, adminId: string) {
  const marketCount = await prisma.market.count({
    where: { categoryId },
  });

  if (marketCount > 0) {
    throw new ValidationError(
      `Cannot delete category with ${marketCount} markets. Move or delete markets first.`
    );
  }

  await prisma.category.delete({ where: { id: categoryId } });

  await logAdminAction(adminId, 'DELETE_CATEGORY', 'category', categoryId);
}

// User management
export async function listUsers(params: PaginationParams) {
  const { page, limit, search, status } = params;

  const where = {
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(status && { kycStatus: status as KycStatus }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        role: true,
        kycStatus: true,
        isActive: true,
        createdAt: true,
        wallet: { select: { balanceUsd: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getUserDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallet: true,
      positions: {
        include: {
          market: { select: { id: true, title: true, status: true } },
          outcome: { select: { name: true } },
        },
      },
      _count: {
        select: { orders: true, transactions: true },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function updateUser(
  userId: string,
  data: { isActive?: boolean; role?: string },
  adminId: string
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  await logAdminAction(adminId, 'UPDATE_USER', 'user', userId, data);

  return user;
}

export async function creditUser(
  userId: string,
  amount: number,
  reason: string,
  adminId: string
) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  if (!wallet) {
    throw new NotFoundError('User wallet not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId },
      data: { balanceUsd: { increment: amount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'DEMO_CREDIT',
        amount,
        balanceBefore: wallet.balanceUsd,
        balanceAfter: Number(wallet.balanceUsd) + amount,
        status: 'COMPLETED',
        metadata: { reason, creditedBy: adminId },
      },
    });
  });

  await logAdminAction(adminId, 'CREDIT_USER', 'user', userId, { amount, reason });

  return { success: true, newBalance: Number(wallet.balanceUsd) + amount };
}

// KYC management
export async function getPendingKyc(params: PaginationParams) {
  const { page, limit } = params;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { kycStatus: 'PENDING' },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        kycDocumentUrl: true,
        kycSubmittedAt: true,
        createdAt: true,
      },
      orderBy: { kycSubmittedAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
  ]);

  return {
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function approveKyc(userId: string, adminId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: 'APPROVED',
      kycReviewedAt: new Date(),
      kycReviewedBy: adminId,
    },
  });

  await logAdminAction(adminId, 'APPROVE_KYC', 'user', userId);

  return { success: true, kycStatus: user.kycStatus };
}

export async function rejectKyc(userId: string, reason: string, adminId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: 'REJECTED',
      kycReviewedAt: new Date(),
      kycReviewedBy: adminId,
    },
  });

  await logAdminAction(adminId, 'REJECT_KYC', 'user', userId, { reason });

  return { success: true, kycStatus: user.kycStatus };
}

// Transaction management
export async function listAllTransactions(params: PaginationParams) {
  const { page, limit, status } = params;

  const where = {
    ...(status && { status: status as any }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function completeTransaction(transactionId: string, adminId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  if (transaction.status !== 'PENDING') {
    throw new ValidationError('Transaction is not pending');
  }

  // For deposits, credit the wallet
  if (transaction.type === 'DEPOSIT') {
    const netAmount = Number(transaction.amount) - Number(transaction.fee);

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: { balanceUsd: { increment: netAmount } },
      });

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      });
    });
  } else {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED' },
    });
  }

  await logAdminAction(adminId, 'COMPLETE_TRANSACTION', 'transaction', transactionId);

  return { success: true };
}

// Deposit methods
export async function createDepositMethod(data: any, adminId: string) {
  const method = await prisma.depositMethod.create({ data });

  await logAdminAction(adminId, 'CREATE_DEPOSIT_METHOD', 'deposit_method', method.id);

  return method;
}

export async function updateDepositMethod(id: string, data: any, adminId: string) {
  const method = await prisma.depositMethod.update({
    where: { id },
    data,
  });

  await logAdminAction(adminId, 'UPDATE_DEPOSIT_METHOD', 'deposit_method', id, data);

  return method;
}

// Helper
async function logAdminAction(
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  metadata?: any
) {
  await prisma.adminAction.create({
    data: {
      adminId,
      actionType,
      targetType,
      targetId,
      metadata,
    },
  });
}
