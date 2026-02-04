import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as walletController from './wallet.controller.js';

export const walletRouter = Router();

// All wallet routes require authentication
walletRouter.use(authenticate);

walletRouter.get('/', walletController.getWallet);
walletRouter.get('/transactions', walletController.getTransactions);
walletRouter.get('/deposit-methods', walletController.getDepositMethods);
walletRouter.post('/deposit', walletController.initiateDeposit);
walletRouter.post('/withdraw', walletController.requestWithdrawal);
