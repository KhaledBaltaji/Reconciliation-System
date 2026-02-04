import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as walletService from './wallet.service.js';

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.string().optional(),
});

const depositSchema = z.object({
  amount: z.number().positive(),
  methodId: z.string().min(1),
});

const withdrawSchema = z.object({
  amount: z.number().positive(),
  methodId: z.string().min(1),
  destination: z.string().min(1), // bank account, wallet address, etc.
});

export async function getWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await walletService.getWallet(req.user!.id);
    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paginationSchema.parse(req.query);
    const transactions = await walletService.getTransactions(req.user!.id, params);
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
}

export async function getDepositMethods(req: Request, res: Response, next: NextFunction) {
  try {
    const methods = await walletService.getDepositMethods();
    res.json({ success: true, data: methods });
  } catch (error) {
    next(error);
  }
}

export async function initiateDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const data = depositSchema.parse(req.body);
    const result = await walletService.initiateDeposit(req.user!.id, data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function requestWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const data = withdrawSchema.parse(req.body);
    const result = await walletService.requestWithdrawal(req.user!.id, data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
