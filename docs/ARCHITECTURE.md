# Prediction Market Platform - Architecture Plan

## Executive Summary

A prediction market trading platform partnering with BetArabia, featuring a Central Limit Order Book (CLOB), real-time trading, and TradingView-style charts. Users can trade on binary and multiple-choice markets across Sports, Politics, Crypto, Entertainment, and Finance categories.

---

## 1. Business Model Overview

### Market Types
| Type | Description | Example |
|------|-------------|---------|
| Binary | Yes/No outcomes (0-100%) | "Will Lebanon win the match?" |
| Multiple Choice | Multiple outcomes | "Who will win the election?" (Candidate A, B, C) |

### Fee Structure
- **Trading Fee**: 5% on position value
  - Split between entry (2.5%) and exit/settlement (2.5%) to reduce perceived impact
  - Can also be partially absorbed into spread
- **Deposit Fees**: Configurable per payment method
- **Withdrawal Fees**: Configurable per payment method
- **Market Creation**: Free (admin only)

### Trading Model: CLOB (Central Limit Order Book)
- Users place limit orders at desired prices (probabilities)
- Orders match when buy price ≥ sell price
- Platform takes no market-making risk
- Full secondary market (users can exit positions anytime)

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────────┬───────────────────────┬───────────────────────────────┤
│   Web App (React)   │  BetArabia WebView    │     Mobile App (Future)       │
└─────────┬───────────┴───────────┬───────────┴───────────────┬───────────────┘
          │                       │                           │
          ▼                       ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / LOAD BALANCER                          │
│                            (Nginx / AWS ALB)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ├──────────────────────┬──────────────────────┬─────────────────────┐
          ▼                      ▼                      ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   AUTH SERVICE   │  │  MARKET SERVICE  │  │  ORDER SERVICE   │  │  WALLET SERVICE  │
│                  │  │                  │  │                  │  │                  │
│ - Phone OTP      │  │ - Create Market  │  │ - Place Order    │  │ - Balances       │
│ - BetArabia SSO  │  │ - Categories     │  │ - Cancel Order   │  │ - Deposits       │
│ - KYC Upload     │  │ - Resolution     │  │ - Order Matching │  │ - Withdrawals    │
│ - Session Mgmt   │  │ - Settlement     │  │ - Order Book     │  │ - BetArabia Sync │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │                     │
         └─────────────────────┴─────────────────────┴─────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
          ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │   PostgreSQL     │  │      Redis       │  │   File Storage   │
          │   (Primary DB)   │  │  (Cache/Queue)   │  │   (S3/Minio)     │
          │                  │  │                  │  │                  │
          │ - Users          │  │ - Sessions       │  │ - KYC Documents  │
          │ - Markets        │  │ - Order Books    │  │ - Profile Images │
          │ - Orders         │  │ - Price Cache    │  │                  │
          │ - Transactions   │  │ - Real-time Data │  │                  │
          └──────────────────┘  └──────────────────┘  └──────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │   WebSocket Server   │
                              │                      │
                              │ - Live Prices        │
                              │ - Order Book Updates │
                              │ - Trade Feed         │
                              │ - Notifications      │
                              └──────────────────────┘
```

---

## 3. Technology Stack

### Frontend
| Component | Technology | Reason |
|-----------|------------|--------|
| Framework | React 18 + TypeScript | Industry standard, large ecosystem |
| State Management | Zustand or Redux Toolkit | Lightweight, good for real-time data |
| Styling | Tailwind CSS | Rapid development, consistent design |
| Charts | TradingView Lightweight Charts | Professional trading charts, free |
| Real-time | Socket.io Client | Reliable WebSocket handling |
| Forms | React Hook Form + Zod | Type-safe validation |
| Routing | React Router v6 | Standard routing solution |

### Backend
| Component | Technology | Reason |
|-----------|------------|--------|
| Runtime | Node.js 20 LTS | Reliable, excellent for real-time |
| Framework | Express.js or Fastify | Battle-tested, high performance |
| Language | TypeScript | Type safety, better maintainability |
| ORM | Prisma | Type-safe database access |
| Validation | Zod | Schema validation |
| WebSockets | Socket.io | Reliable real-time communication |
| Job Queue | BullMQ | Redis-based background jobs |

### Database & Infrastructure
| Component | Technology | Reason |
|-----------|------------|--------|
| Primary DB | PostgreSQL 15 | ACID compliance, reliability |
| Cache/Queue | Redis 7 | Fast in-memory operations |
| File Storage | AWS S3 or Minio | Scalable file storage |
| Search | PostgreSQL Full-Text | Sufficient for MVP |

### External Integrations
| Service | Purpose |
|---------|---------|
| WhatsApp Business API | OTP verification |
| BetArabia API | Wallet sync, SSO |
| Payment Gateways | Deposits (TBD based on Lebanon options) |

---

## 4. Database Schema (Core Tables)

```sql
-- USERS & AUTH
users
├── id (UUID, PK)
├── phone_number (unique, nullable)
├── betarabia_id (unique, nullable)
├── full_name
├── email (nullable)
├── kyc_status (pending/approved/rejected)
├── kyc_document_url
├── role (user/admin/super_admin)
├── is_active
├── created_at
└── updated_at

user_sessions
├── id (UUID, PK)
├── user_id (FK)
├── token_hash
├── device_info
├── expires_at
└── created_at

-- WALLETS & TRANSACTIONS
wallets
├── id (UUID, PK)
├── user_id (FK, unique)
├── balance_usd (DECIMAL)
├── locked_balance (DECIMAL) -- funds in open orders
├── is_betarabia_linked
└── updated_at

transactions
├── id (UUID, PK)
├── user_id (FK)
├── type (deposit/withdrawal/trade_fee/settlement)
├── amount
├── fee
├── payment_method
├── status (pending/completed/failed)
├── reference_id
├── metadata (JSONB)
└── created_at

-- MARKETS
categories
├── id (UUID, PK)
├── name
├── slug
├── icon_url
├── display_order
├── is_active
└── created_at

markets
├── id (UUID, PK)
├── category_id (FK)
├── title
├── description
├── market_type (binary/multiple_choice)
├── status (draft/open/suspended/closed/resolved)
├── resolution_source
├── expires_at
├── resolved_at
├── created_by (FK to users)
└── created_at

market_outcomes
├── id (UUID, PK)
├── market_id (FK)
├── name (e.g., "Yes", "No", "Candidate A")
├── current_price (DECIMAL 0.00-1.00)
├── total_volume
├── winning_outcome (BOOLEAN, null until resolved)
└── display_order

-- ORDER BOOK
orders
├── id (UUID, PK)
├── user_id (FK)
├── market_id (FK)
├── outcome_id (FK)
├── side (buy/sell)
├── order_type (limit/market)
├── price (DECIMAL 0.01-0.99)
├── quantity
├── filled_quantity
├── status (open/partial/filled/cancelled)
├── created_at
└── updated_at

trades
├── id (UUID, PK)
├── market_id (FK)
├── outcome_id (FK)
├── buy_order_id (FK)
├── sell_order_id (FK)
├── buyer_id (FK)
├── seller_id (FK)
├── price
├── quantity
├── buyer_fee
├── seller_fee
└── executed_at

-- POSITIONS
positions
├── id (UUID, PK)
├── user_id (FK)
├── market_id (FK)
├── outcome_id (FK)
├── quantity
├── avg_entry_price
├── realized_pnl
├── created_at
└── updated_at

-- PRICE HISTORY (for charts)
price_history
├── id (BIGSERIAL, PK)
├── outcome_id (FK)
├── price
├── volume
├── timestamp
└── INDEX on (outcome_id, timestamp)

-- ADMIN
admin_actions
├── id (UUID, PK)
├── admin_id (FK)
├── action_type
├── target_type
├── target_id
├── metadata (JSONB)
└── created_at

deposit_methods
├── id (UUID, PK)
├── name
├── type (bank/crypto/card/betarabia)
├── fee_percentage
├── fee_fixed
├── min_amount
├── max_amount
├── is_active
└── instructions (JSONB)
```

---

## 5. API Structure

### Authentication APIs
```
POST   /api/auth/phone/send-otp      # Send OTP via WhatsApp
POST   /api/auth/phone/verify-otp    # Verify OTP and login/register
POST   /api/auth/betarabia/callback  # BetArabia SSO callback
POST   /api/auth/logout
GET    /api/auth/me                  # Get current user
POST   /api/auth/kyc/upload          # Upload KYC documents
```

### Market APIs
```
GET    /api/markets                  # List markets (filterable)
GET    /api/markets/:id              # Get market details
GET    /api/markets/:id/orderbook    # Get order book
GET    /api/markets/:id/trades       # Get recent trades
GET    /api/markets/:id/chart        # Get price history for charts
GET    /api/categories               # List categories
```

### Trading APIs
```
POST   /api/orders                   # Place order
DELETE /api/orders/:id               # Cancel order
GET    /api/orders                   # Get user's orders
GET    /api/positions                # Get user's positions
```

### Wallet APIs
```
GET    /api/wallet                   # Get balance
GET    /api/wallet/transactions      # Transaction history
POST   /api/wallet/deposit           # Initiate deposit
POST   /api/wallet/withdraw          # Request withdrawal
GET    /api/wallet/deposit-methods   # Available deposit methods
```

### Admin APIs
```
POST   /api/admin/markets            # Create market
PUT    /api/admin/markets/:id        # Update market
POST   /api/admin/markets/:id/resolve # Resolve market
GET    /api/admin/users              # List users
PUT    /api/admin/users/:id/kyc      # Approve/reject KYC
GET    /api/admin/transactions       # All transactions
POST   /api/admin/categories         # Create category
PUT    /api/admin/deposit-methods    # Configure deposit methods
```

### WebSocket Events
```
# Client subscribes to:
market:{id}:orderbook    # Order book updates
market:{id}:trades       # New trades
market:{id}:price        # Price changes
user:{id}:orders         # User's order updates
user:{id}:notifications  # Personal notifications
```

---

## 6. Frontend Pages & Components

### Pages
```
/                           # Home - Featured markets, categories
/markets                    # All markets with filters
/markets/:category          # Markets by category
/market/:id                 # Market detail with trading interface
/portfolio                  # User's positions and orders
/wallet                     # Balance, deposit, withdraw
/history                    # Transaction & trade history
/settings                   # Profile, preferences
/login                      # Phone/BetArabia login
/register                   # Phone signup with KYC

# Admin
/admin                      # Dashboard
/admin/markets              # Manage markets
/admin/markets/create       # Create market
/admin/users                # User management
/admin/kyc                  # KYC review queue
/admin/transactions         # Transaction monitoring
/admin/settings             # Platform settings
```

### Key Components
```
Trading Interface (Market Page)
├── MarketHeader           # Title, status, countdown
├── TradingViewChart       # Toggle on/off
├── OrderBook              # Toggle on/off (with chart)
│   ├── BuyOrders
│   └── SellOrders
├── TradeHistory           # Recent trades
├── OrderForm              # Buy/Sell with limit price
│   ├── OutcomeSelector    # Yes/No or multiple choice
│   ├── PriceInput         # 0.01-0.99
│   ├── QuantityInput
│   ├── FeeDisplay         # Show 2.5% fee
│   └── SubmitButton
├── UserPositions          # Current holdings in this market
└── UserOrders             # Open orders in this market

Header
├── Logo
├── CategoryNav            # Sports, Politics, Crypto, etc.
├── SearchBar
├── WalletBalance          # Quick balance view
├── NotificationBell
└── UserMenu

Wallet Section
├── BalanceCard
├── DepositModal
│   └── PaymentMethodSelector
├── WithdrawModal
└── TransactionList
```

---

## 7. Order Matching Engine Logic

```typescript
// Simplified matching logic
async function matchOrder(newOrder: Order) {
  const oppositeOrders = await getOppositeOrders(
    newOrder.outcome_id,
    newOrder.side === 'buy' ? 'sell' : 'buy'
  );

  for (const existingOrder of oppositeOrders) {
    // Buy orders match with sell orders at same or lower price
    // Sell orders match with buy orders at same or higher price
    const priceMatches = newOrder.side === 'buy'
      ? newOrder.price >= existingOrder.price
      : newOrder.price <= existingOrder.price;

    if (!priceMatches) break; // Orders sorted by price

    const matchQty = Math.min(
      newOrder.quantity - newOrder.filled_quantity,
      existingOrder.quantity - existingOrder.filled_quantity
    );

    // Execute trade at existing order's price (price-time priority)
    await executeTrade(newOrder, existingOrder, matchQty, existingOrder.price);

    if (newOrder.filled_quantity >= newOrder.quantity) break;
  }

  // Remaining quantity stays in order book
  if (newOrder.filled_quantity < newOrder.quantity && newOrder.order_type === 'limit') {
    await addToOrderBook(newOrder);
  }
}
```

---

## 8. Fee Implementation Strategy

### Option A: Split Fee (Recommended)
- 2.5% when opening position
- 2.5% when closing/settlement
- User sees smaller individual fees

### Option B: Spread Integration
- Widen displayed spread slightly
- Take from the spread difference
- Less visible to users

### Implementation
```typescript
const ENTRY_FEE_PERCENT = 0.025; // 2.5%
const EXIT_FEE_PERCENT = 0.025;  // 2.5%

function calculateEntryFee(amount: number): number {
  return amount * ENTRY_FEE_PERCENT;
}

function calculateExitFee(amount: number): number {
  return amount * EXIT_FEE_PERCENT;
}

// When placing buy order
const fee = calculateEntryFee(orderAmount);
const totalCost = orderAmount + fee;

// When selling or at settlement
const exitFee = calculateExitFee(positionValue);
const netPayout = positionValue - exitFee;
```

---

## 9. Security Considerations

### Authentication
- JWT with short expiry + refresh tokens
- Rate limiting on OTP requests
- Device fingerprinting for suspicious activity

### Trading
- Atomic transactions for order matching
- Optimistic locking for balance updates
- Audit trail for all financial operations

### Data
- Encrypt sensitive data at rest
- HTTPS only
- Input validation on all endpoints
- SQL injection prevention via ORM

### Admin
- 2FA for admin accounts
- IP whitelisting option
- Action logging

---

## 10. MVP Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup (monorepo structure)
- [ ] Database schema & migrations
- [ ] Basic auth (phone OTP)
- [ ] User registration with KYC upload
- [ ] Admin user seeding

### Phase 2: Core Trading (Weeks 3-4)
- [ ] Market CRUD (admin)
- [ ] Category management
- [ ] Order book implementation
- [ ] Order matching engine
- [ ] Position tracking

### Phase 3: Wallet & Transactions (Week 5)
- [ ] Wallet service
- [ ] Demo money for sandbox
- [ ] Transaction logging
- [ ] Fee calculation

### Phase 4: Frontend MVP (Weeks 6-7)
- [ ] Home page with markets
- [ ] Market detail page
- [ ] TradingView chart integration
- [ ] Order book display
- [ ] Trading form
- [ ] Portfolio page

### Phase 5: Admin Panel (Week 8)
- [ ] Market creation interface
- [ ] Market resolution interface
- [ ] User management
- [ ] KYC review

### Phase 6: Polish & Testing (Weeks 9-10)
- [ ] Real-time WebSocket updates
- [ ] Error handling
- [ ] Mobile responsiveness
- [ ] Load testing
- [ ] Security audit

### Phase 7: BetArabia Integration (Week 11+)
- [ ] SSO integration
- [ ] Wallet sync
- [ ] Embedded WebView testing

---

## 11. Folder Structure

```
prediction-market/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── services/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   └── package.json
│   │
│   └── api/                    # Node.js backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── markets/
│       │   │   ├── orders/
│       │   │   ├── wallet/
│       │   │   └── admin/
│       │   ├── services/
│       │   │   ├── matching-engine/
│       │   │   └── websocket/
│       │   ├── middleware/
│       │   ├── utils/
│       │   └── types/
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types & utilities
│       ├── src/
│       │   ├── types/
│       │   └── validation/
│       └── package.json
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 12. Next Steps

1. **Review this plan** - Any changes or additions?
2. **Finalize tech decisions** - Confirm stack choices
3. **Set up repository** - Initialize monorepo structure
4. **Begin Phase 1** - Database and auth foundation

---

## Open Questions for Later

- [ ] Specific payment gateways available in Lebanon
- [ ] BetArabia API documentation review
- [ ] WhatsApp Business API setup
- [ ] Hosting provider selection (AWS, GCP, or local)
- [ ] Domain name for the platform
- [ ] Admin role definitions (detailed permissions)
