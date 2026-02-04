import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  webUrl: z.string().default('http://localhost:5173'),

  // Database
  databaseUrl: z.string(),
  redisUrl: z.string().default('redis://localhost:6379'),

  // JWT
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('15m'),
  jwtRefreshExpiresIn: z.string().default('7d'),

  // External APIs (optional for now)
  whatsappApiUrl: z.string().optional(),
  whatsappApiToken: z.string().optional(),

  betarabiaApiUrl: z.string().optional(),
  betarabiaClientId: z.string().optional(),
  betarabiaClientSecret: z.string().optional(),

  // S3
  s3Endpoint: z.string().optional(),
  s3Bucket: z.string().optional(),
  s3AccessKey: z.string().optional(),
  s3SecretKey: z.string().optional(),
  s3Region: z.string().default('us-east-1'),
});

const parsed = configSchema.safeParse({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.API_PORT,
  webUrl: process.env.WEB_URL,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  whatsappApiUrl: process.env.WHATSAPP_API_URL,
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN,
  betarabiaApiUrl: process.env.BETARABIA_API_URL,
  betarabiaClientId: process.env.BETARABIA_CLIENT_ID,
  betarabiaClientSecret: process.env.BETARABIA_CLIENT_SECRET,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKey: process.env.S3_ACCESS_KEY,
  s3SecretKey: process.env.S3_SECRET_KEY,
  s3Region: process.env.S3_REGION,
});

if (!parsed.success) {
  console.error('❌ Invalid configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Trading constants
export const TRADING_CONFIG = {
  ENTRY_FEE_PERCENT: 0.025, // 2.5%
  EXIT_FEE_PERCENT: 0.025,  // 2.5%
  MIN_PRICE: 0.01,
  MAX_PRICE: 0.99,
  MIN_ORDER_AMOUNT: 1,
  DEMO_CREDIT_AMOUNT: 10000, // $10,000 demo money
} as const;
