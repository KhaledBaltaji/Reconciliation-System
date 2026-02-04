import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

// Phone OTP authentication
authRouter.post('/phone/send-otp', authController.sendOtp);
authRouter.post('/phone/verify-otp', authController.verifyOtp);

// Registration with KYC
authRouter.post('/register', authController.register);

// BetArabia SSO
authRouter.post('/betarabia/callback', authController.betarabiaCallback);

// Session management
authRouter.get('/me', authenticate, authController.getMe);
authRouter.post('/refresh', authController.refreshToken);
authRouter.post('/logout', authenticate, authController.logout);

// KYC
authRouter.post('/kyc/upload', authenticate, authController.uploadKyc);
