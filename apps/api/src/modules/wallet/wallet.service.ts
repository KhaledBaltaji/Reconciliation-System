import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError, InsufficientFundsError } from '../../middleware/error-handler.js';
import { TransactionType } from '@prisma/client';

interface PaginationParams {
  page: number;
  limit: number;
  type?: string;
}

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    // Create wallet if doesn't exist
    return prisma.wallet.create({
      data: { userId },
    });
  }

  return {
    ...wallet,
    availableBalance: Number(wallet.balanceUsd) - Number(wallet.lockedBalance),
  };
}

export async function getTransactions(userId: string, params: PaginationParams) {
  const { page, limit, type } = params;

  const where = {
    userId,
    ...(type && { type: type as TransactionType }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getDepositMethods() {
  return prisma.depositMethod.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
}

export async function initiateDeposit(
  userId: string,
  data: { amount: number; methodId: string }
) {
  const method = await prisma.depositMethod.findUnique({
    where: { id: data.methodId },
  });

  if (!method || !method.isActive) {
    throw new NotFoundError('Deposit method not found');
  }

  if (data.amount < Number(method.minAmount)) {
    throw new ValidationError(`Minimum deposit is $${method.minAmount}`);
  }

  if (method.maxAmount && data.amount > Number(method.maxAmount)) {
    throw new ValidationError(`Maximum deposit is $${method.maxAmount}`);
  }

  // Calculate fee
  const feePercent = Number(method.feePercentage) * data.amount;
  const feeFixed = Number(method.feeFixed);
  const totalFee = feePercent + feeFixed;

  const wallet = await getWallet(userId);

  // Create pending transaction
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: 'DEPOSIT',
      amount: data.amount,
      fee: totalFee,
      balanceBefore: wallet.balanceUsd,
      balanceAfter: Number(wallet.balanceUsd) + data.amount - totalFee,
      status: 'PENDING',
      paymentMethod: method.name,
      metadata: {
        methodId: method.id,
        methodType: method.type,
      },
    },
  });

  // For demo: Auto-complete deposit
  // In production: Return payment instructions or redirect URL
  if (method.type === 'demo') {
    await completeDeposit(transaction.id);
    return {
      status: 'completed',
      amount: data.amount - totalFee,
    };
  }

  return {
    transactionId: transaction.id,
    status: 'pending',
    instructions: method.instructions,
    amount: data.amount,
    fee: totalFee,
    netAmount: data.amount - totalFee,
  };
}

export async function completeDeposit(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction || transaction.status !== 'PENDING') {
    throw new ValidationError('Invalid transaction');
  }

  const netAmount = Number(transaction.amount) - Number(transaction.fee);

  await prisma.$transaction(async (tx) => {
    // Update wallet
    await tx.wallet.update({
      where: { userId: transaction.userId },
      data: {
        balanceUsd: { increment: netAmount },
      },
    });

    // Update transaction
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(transaction.balanceBefore) + netAmount,
      },
    });
  });
}

export async function requestWithdrawal(
  userId: string,
  data: { amount: number; methodId: string; destination: string }
) {
  const method = await prisma.depositMethod.findUnique({
    where: { id: data.methodId },
  });

  if (!method || !method.isActive) {
    throw new NotFoundError('Withdrawal method not found');
  }

  const wallet = await getWallet(userId);
  const availableBalance = Number(wallet.balanceUsd) - Number(wallet.lockedBalance);

  // Calculate fee
  const feePercent = Number(method.feePercentage) * data.amount;
  const feeFixed = Number(method.feeFixed);
  const totalFee = feePercent + feeFixed;
  const totalDeduction = data.amount + totalFee;

  if (availableBalance < totalDeduction) {
    throw new InsufficientFundsError(
      `Insufficient funds. Available: $${availableBalance.toFixed(2)}, Required: $${totalDeduction.toFixed(2)}`
    );
  }

  if (data.amount < Number(method.minAmount)) {
    throw new ValidationError(`Minimum withdrawal is $${method.minAmount}`);
  }

  // Create pending withdrawal and deduct from balance
  return prisma.$transaction(async (tx) => {
    // Deduct from wallet
    await tx.wallet.update({
      where: { userId },
      data: {
        balanceUsd: { decrement: totalDeduction },
      },
    });

    // Create transaction
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        amount: -data.amount,
        fee: totalFee,
        balanceBefore: wallet.balanceUsd,
        balanceAfter: Number(wallet.balanceUsd) - totalDeduction,
        status: 'PENDING',
        paymentMethod: method.name,
        metadata: {
          methodId: method.id,
          destination: data.destination,
        },
      },
    });

    return {
      transactionId: transaction.id,
      status: 'pending',
      amount: data.amount,
      fee: totalFee,
      netAmount: data.amount - totalFee,
      message: 'Withdrawal request submitted. Processing may take 1-3 business days.',
    };
  });
}
