import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { prisma } from '../../lib/prisma.js';
import { cache, CACHE_KEYS } from '../../lib/redis.js';
import { config, TRADING_CONFIG } from '../../config/index.js';
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
} from '../../middleware/error-handler.js';
import { JwtPayload } from '../../middleware/auth.js';

// Generate 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT tokens
function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { userId, role } as JwtPayload,
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

export async function sendOtp(phoneNumber: string) {
  // Rate limiting check (gracefully skipped if Redis unavailable)
  const attemptsKey = CACHE_KEYS.otpAttempts(phoneNumber);
  const attempts = await cache.incr(attemptsKey);

  if (attempts === 1) {
    await cache.expire(attemptsKey, 3600); // 1 hour window
  }

  if (attempts > 5) {
    throw new ValidationError('Too many OTP requests. Please try again later.');
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP in database
  await prisma.otpVerification.create({
    data: {
      phoneNumber,
      code,
      expiresAt,
    },
  });

  // TODO: Send OTP via WhatsApp API
  // For development, log the OTP
  console.log(`📱 OTP for ${phoneNumber}: ${code}`);

  return {
    message: 'OTP sent successfully',
    // Only include code in development
    ...(config.nodeEnv === 'development' && { code }),
  };
}

export async function verifyOtp(phoneNumber: string, code: string) {
  const otp = await prisma.otpVerification.findFirst({
    where: {
      phoneNumber,
      code,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    // Increment attempts
    await prisma.otpVerification.updateMany({
      where: { phoneNumber, verifiedAt: null },
      data: { attempts: { increment: 1 } },
    });
    throw new ValidationError('Invalid or expired OTP');
  }

  if (otp.attempts >= 5) {
    throw new ValidationError('Too many failed attempts. Please request a new OTP.');
  }

  // Mark OTP as verified
  await prisma.otpVerification.update({
    where: { id: otp.id },
    data: { verifiedAt: new Date() },
  });

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber },
    include: { wallet: true },
  });

  if (existingUser) {
    // Existing user - generate tokens
    const tokens = generateTokens(existingUser.id, existingUser.role);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      isNewUser: false,
      user: {
        id: existingUser.id,
        fullName: existingUser.fullName,
        phoneNumber: existingUser.phoneNumber,
        kycStatus: existingUser.kycStatus,
        balance: existingUser.wallet?.balanceUsd || 0,
      },
      ...tokens,
    };
  }

  // New user - return verification token for registration
  return {
    isNewUser: true,
    verificationToken: jwt.sign(
      { phoneNumber, verified: true },
      config.jwtSecret,
      { expiresIn: '30m' }
    ),
  };
}

export async function register(data: {
  phoneNumber: string;
  fullName: string;
  otpCode: string;
}) {
  // Verify OTP first
  const otpResult = await verifyOtp(data.phoneNumber, data.otpCode);

  if (!otpResult.isNewUser) {
    throw new ConflictError('User already exists');
  }

  // Create user with wallet
  const user = await prisma.user.create({
    data: {
      phoneNumber: data.phoneNumber,
      fullName: data.fullName,
      wallet: {
        create: {
          balanceUsd: TRADING_CONFIG.DEMO_CREDIT_AMOUNT, // Demo money
        },
      },
    },
    include: { wallet: true },
  });

  // Create demo credit transaction
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'DEMO_CREDIT',
      amount: TRADING_CONFIG.DEMO_CREDIT_AMOUNT,
      balanceBefore: 0,
      balanceAfter: TRADING_CONFIG.DEMO_CREDIT_AMOUNT,
      status: 'COMPLETED',
    },
  });

  const tokens = generateTokens(user.id, user.role);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      kycStatus: user.kycStatus,
      balance: user.wallet?.balanceUsd || TRADING_CONFIG.DEMO_CREDIT_AMOUNT,
    },
    ...tokens,
  };
}

export async function handleBetarabiaCallback(code: string, state: string) {
  // TODO: Implement BetArabia OAuth flow
  // 1. Exchange code for tokens
  // 2. Fetch user info from BetArabia
  // 3. Create or update user
  // 4. Sync wallet balance

  throw new Error('BetArabia integration not yet implemented');
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phoneNumber: true,
      betarabiaId: true,
      fullName: true,
      email: true,
      role: true,
      kycStatus: true,
      isActive: true,
      createdAt: true,
      wallet: {
        select: {
          balanceUsd: true,
          lockedBalance: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, config.jwtSecret) as { userId: string; type: string };

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const tokens = generateTokens(user.id, user.role);
    return tokens;
  } catch (error) {
    throw new UnauthorizedError('Invalid refresh token');
  }
}

export async function logout(userId: string, token: string) {
  // Invalidate session in Redis (if using session-based invalidation)
  const sessionKey = CACHE_KEYS.userSession(token);
  await cache.del(sessionKey);
}

export async function submitKyc(userId: string, documentUrl: string) {
  if (!documentUrl) {
    throw new ValidationError('Document is required');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      kycDocumentUrl: documentUrl,
      kycStatus: 'PENDING',
      kycSubmittedAt: new Date(),
    },
    select: {
      id: true,
      kycStatus: true,
      kycSubmittedAt: true,
    },
  });

  return user;
}
