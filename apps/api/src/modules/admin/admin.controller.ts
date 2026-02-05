import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as adminService from './admin.service.js';

const createMarketSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(5).max(200),
  description: z.string().optional(),
  marketType: z.enum(['BINARY', 'MULTIPLE_CHOICE']),
  outcomes: z.array(z.string()).min(2).max(10),
  expiresAt: z.string().datetime(),
  imageUrl: z.string().url().optional(),
});

const updateMarketSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
  maxExposure: z.number().positive().optional(),
  liquidityParam: z.number().positive().optional(),
});

const resolveMarketSchema = z.object({
  winningOutcomeId: z.string().uuid(),
});

const createCategorySchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  iconUrl: z.string().url().optional(),
  displayOrder: z.number().int().optional(),
});

const creditUserSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
});

// Dashboard
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

// Markets
export async function listMarkets(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paginationSchema.parse(req.query);
    const markets = await adminService.listAllMarkets(params);
    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
}

export async function createMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createMarketSchema.parse(req.body);
    const market = await adminService.createMarket({
      ...data,
      expiresAt: new Date(data.expiresAt),
      createdById: req.user!.id,
    });
    res.status(201).json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function updateMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = updateMarketSchema.parse(req.body);
    const market = await adminService.updateMarket(id, data, req.user!.id);
    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function openMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const market = await adminService.setMarketStatus(id, 'OPEN', req.user!.id);
    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function suspendMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const market = await adminService.setMarketStatus(id, 'SUSPENDED', req.user!.id);
    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function closeMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const market = await adminService.setMarketStatus(id, 'CLOSED', req.user!.id);
    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function resolveMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { winningOutcomeId } = resolveMarketSchema.parse(req.body);
    const market = await adminService.resolveMarket(id, winningOutcomeId, req.user!.id);
    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

// Categories
export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createCategorySchema.parse(req.body);
    const category = await adminService.createCategory(data, req.user!.id);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = createCategorySchema.partial().parse(req.body);
    const category = await adminService.updateCategory(id, data, req.user!.id);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await adminService.deleteCategory(id, req.user!.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
}

// Users
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paginationSchema.parse(req.query);
    const users = await adminService.listUsers(params);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = await adminService.getUserDetails(id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = await adminService.updateUser(id, req.body, req.user!.id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function creditUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { amount, reason } = creditUserSchema.parse(req.body);
    const result = await adminService.creditUser(id, amount, reason, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// KYC
export async function getPendingKyc(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paginationSchema.parse(req.query);
    const kyc = await adminService.getPendingKyc(params);
    res.json({ success: true, data: kyc });
  } catch (error) {
    next(error);
  }
}

export async function approveKyc(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const result = await adminService.approveKyc(userId, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function rejectKyc(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const result = await adminService.rejectKyc(userId, reason, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// Transactions
export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paginationSchema.parse(req.query);
    const transactions = await adminService.listAllTransactions(params);
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
}

export async function completeTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await adminService.completeTransaction(id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// Deposit methods
export async function createDepositMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const method = await adminService.createDepositMethod(req.body, req.user!.id);
    res.status(201).json({ success: true, data: method });
  } catch (error) {
    next(error);
  }
}

export async function updateDepositMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const method = await adminService.updateDepositMethod(id, req.body, req.user!.id);
    res.json({ success: true, data: method });
  } catch (error) {
    next(error);
  }
}
