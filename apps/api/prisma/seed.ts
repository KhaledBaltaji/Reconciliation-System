import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient, UserRole, MarketType, MarketStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'sports' },
      update: {},
      create: { name: 'Sports', slug: 'sports', displayOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'politics' },
      update: {},
      create: { name: 'Politics', slug: 'politics', displayOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'crypto' },
      update: {},
      create: { name: 'Crypto', slug: 'crypto', displayOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: 'entertainment' },
      update: {},
      create: { name: 'Entertainment', slug: 'entertainment', displayOrder: 4 },
    }),
    prisma.category.upsert({
      where: { slug: 'finance' },
      update: {},
      create: { name: 'Finance', slug: 'finance', displayOrder: 5 },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Create super admin user
  const adminPhone = '+961000000000';
  let admin = await prisma.user.findUnique({ where: { phoneNumber: adminPhone } });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phoneNumber: adminPhone,
        fullName: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        kycStatus: 'APPROVED',
        wallet: {
          create: { balanceUsd: 1000000 }, // $1M for testing
        },
      },
    });
    console.log('✅ Created super admin user');
  }

  // Create demo deposit method
  await prisma.depositMethod.upsert({
    where: { id: 'demo-deposit' },
    update: {},
    create: {
      id: 'demo-deposit',
      name: 'Demo Credit',
      type: 'demo',
      feePercentage: 0,
      feeFixed: 0,
      minAmount: 1,
      isActive: true,
      instructions: { message: 'Demo credits are added instantly' },
    },
  });
  console.log('✅ Created demo deposit method');

  // Create sample markets
  const sportsCategory = categories.find(c => c.slug === 'sports')!;
  const cryptoCategory = categories.find(c => c.slug === 'crypto')!;
  const politicsCategory = categories.find(c => c.slug === 'politics')!;

  // Binary market example
  const binaryMarket = await prisma.market.upsert({
    where: { id: 'sample-binary-market' },
    update: {},
    create: {
      id: 'sample-binary-market',
      categoryId: sportsCategory.id,
      title: 'Will Lebanon qualify for the World Cup 2026?',
      description: 'Market resolves YES if Lebanon qualifies for the FIFA World Cup 2026.',
      marketType: MarketType.BINARY,
      status: MarketStatus.OPEN,
      expiresAt: new Date('2026-06-01'),
      createdById: admin.id,
      outcomes: {
        create: [
          { name: 'Yes', displayOrder: 0, currentPrice: 0.15 },
          { name: 'No', displayOrder: 1, currentPrice: 0.85 },
        ],
      },
    },
  });

  // Multiple choice market example
  const multipleChoiceMarket = await prisma.market.upsert({
    where: { id: 'sample-multi-market' },
    update: {},
    create: {
      id: 'sample-multi-market',
      categoryId: cryptoCategory.id,
      title: 'What will be Bitcoin price range by end of 2026?',
      description: 'Market resolves to the price range Bitcoin falls into on December 31, 2026.',
      marketType: MarketType.MULTIPLE_CHOICE,
      status: MarketStatus.OPEN,
      expiresAt: new Date('2026-12-31'),
      createdById: admin.id,
      outcomes: {
        create: [
          { name: 'Below $50,000', displayOrder: 0, currentPrice: 0.10 },
          { name: '$50,000 - $100,000', displayOrder: 1, currentPrice: 0.25 },
          { name: '$100,000 - $150,000', displayOrder: 2, currentPrice: 0.35 },
          { name: '$150,000 - $200,000', displayOrder: 3, currentPrice: 0.20 },
          { name: 'Above $200,000', displayOrder: 4, currentPrice: 0.10 },
        ],
      },
    },
  });

  // Politics market
  const politicsMarket = await prisma.market.upsert({
    where: { id: 'sample-politics-market' },
    update: {},
    create: {
      id: 'sample-politics-market',
      categoryId: politicsCategory.id,
      title: 'Will there be a new government formed in Lebanon by March 2026?',
      description: 'Market resolves YES if a new government is officially formed and announced.',
      marketType: MarketType.BINARY,
      status: MarketStatus.OPEN,
      expiresAt: new Date('2026-03-31'),
      createdById: admin.id,
      outcomes: {
        create: [
          { name: 'Yes', displayOrder: 0, currentPrice: 0.45 },
          { name: 'No', displayOrder: 1, currentPrice: 0.55 },
        ],
      },
    },
  });

  console.log('✅ Created sample markets');

  // Create some demo users
  for (let i = 1; i <= 5; i++) {
    const phone = `+96170000000${i}`;
    await prisma.user.upsert({
      where: { phoneNumber: phone },
      update: {},
      create: {
        phoneNumber: phone,
        fullName: `Demo User ${i}`,
        role: UserRole.USER,
        kycStatus: 'APPROVED',
        wallet: {
          create: { balanceUsd: 10000 }, // $10k demo money
        },
      },
    });
  }

  console.log('✅ Created 5 demo users');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
