import { Router } from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../../middleware/auth.js';
import * as adminController from './admin.controller.js';

export const adminRouter = Router();

// All admin routes require authentication and admin role
adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

// Dashboard
adminRouter.get('/stats', adminController.getDashboardStats);

// Market management
adminRouter.get('/markets', adminController.listMarkets);
adminRouter.post('/markets', adminController.createMarket);
adminRouter.put('/markets/:id', adminController.updateMarket);
adminRouter.post('/markets/:id/open', adminController.openMarket);
adminRouter.post('/markets/:id/suspend', adminController.suspendMarket);
adminRouter.post('/markets/:id/close', adminController.closeMarket);
adminRouter.post('/markets/:id/resolve', adminController.resolveMarket);

// Category management
adminRouter.post('/categories', adminController.createCategory);
adminRouter.put('/categories/:id', adminController.updateCategory);
adminRouter.delete('/categories/:id', adminController.deleteCategory);

// User management
adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/users/:id', adminController.getUser);
adminRouter.put('/users/:id', adminController.updateUser);
adminRouter.post('/users/:id/credit', adminController.creditUser);

// KYC management
adminRouter.get('/kyc/pending', adminController.getPendingKyc);
adminRouter.post('/kyc/:userId/approve', adminController.approveKyc);
adminRouter.post('/kyc/:userId/reject', adminController.rejectKyc);

// Transaction management
adminRouter.get('/transactions', adminController.listTransactions);
adminRouter.post('/transactions/:id/complete', adminController.completeTransaction);

// Deposit methods (super admin only)
adminRouter.post('/deposit-methods', requireSuperAdmin, adminController.createDepositMethod);
adminRouter.put('/deposit-methods/:id', requireSuperAdmin, adminController.updateDepositMethod);
