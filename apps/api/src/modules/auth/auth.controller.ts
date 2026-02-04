import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service.js';

const sendOtpSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
});

const verifyOtpSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  code: z.string().length(6),
});

const registerSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  fullName: z.string().min(2).max(100),
  otpCode: z.string().length(6),
});

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phoneNumber } = sendOtpSchema.parse(req.body);
    const result = await authService.sendOtp(phoneNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phoneNumber, code } = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyOtp(phoneNumber, code);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function betarabiaCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state } = req.body;
    const result = await authService.handleBetarabiaCallback(code, state);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUser(req.user!.id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);
    if (token) {
      await authService.logout(req.user!.id, token);
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
}

export async function uploadKyc(req: Request, res: Response, next: NextFunction) {
  try {
    // Note: File upload handled by multer middleware
    const result = await authService.submitKyc(req.user!.id, req.file?.path || '');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
