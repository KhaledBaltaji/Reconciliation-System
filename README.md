# Prediction Market Platform

A full-stack prediction market trading platform with real-time order book, TradingView charts, and admin panel.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand, Socket.io
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL, Redis
- **Charts**: TradingView Lightweight Charts

## Features

- Binary and multiple-choice prediction markets
- Central Limit Order Book (CLOB) trading
- Real-time price updates via WebSocket
- TradingView-style charts with toggle
- Phone OTP authentication
- KYC document upload
- Admin panel for market management
- Demo money for sandbox testing

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Setup

1. **Clone and install dependencies**
```bash
pnpm install
```

2. **Start infrastructure**
```bash
docker-compose up -d
```

3. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Run database migrations**
```bash
pnpm db:migrate
```

5. **Seed demo data**
```bash
pnpm db:seed
```

6. **Start development servers**
```bash
pnpm dev
```

The app will be available at:
- Frontend: http://localhost:5173
- API: http://localhost:3001

## Project Structure

```
├── apps/
│   ├── api/                # Backend API server
│   │   ├── src/
│   │   │   ├── modules/    # Feature modules (auth, markets, orders, etc.)
│   │   │   ├── services/   # Shared services (matching engine, websocket)
│   │   │   ├── middleware/ # Express middleware
│   │   │   └── lib/        # Database clients
│   │   └── prisma/         # Database schema & migrations
│   │
│   └── web/                # React frontend
│       └── src/
│           ├── pages/      # Route pages
│           ├── components/ # Reusable components
│           ├── stores/     # Zustand stores
│           └── services/   # API & WebSocket clients
│
├── docker-compose.yml      # Local infrastructure
└── docs/                   # Documentation
```

## Demo Credentials

After seeding, you can login with:
- **Admin**: +961000000000 (any 6-digit OTP in dev mode)
- **Demo Users**: +961700000001 through +961700000005

All accounts start with $10,000 demo balance.

## Trading Fee Structure

- **Entry Fee**: 2.5% when opening a position
- **Exit Fee**: 2.5% when closing or at settlement
- **Total**: 5% round-trip

## Admin Features

- Create and manage markets
- Resolve markets (select winning outcome)
- User management and KYC review
- Transaction monitoring
- Category management

## API Endpoints

### Public
- `GET /api/markets` - List markets
- `GET /api/markets/:id` - Market details
- `GET /api/markets/:id/orderbook` - Order book
- `GET /api/markets/categories` - Categories

### Authenticated
- `POST /api/orders` - Place order
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/orders/positions` - User positions
- `GET /api/wallet` - Balance

### Admin
- `POST /api/admin/markets` - Create market
- `POST /api/admin/markets/:id/resolve` - Resolve market
- `GET /api/admin/users` - List users

## WebSocket Events

```javascript
// Subscribe to market
socket.emit('subscribe:market', marketId);

// Listen for updates
socket.on('price:update', ({ outcomeId, price }) => {});
socket.on('trade:executed', (trade) => {});
socket.on('orderbook:update', ({ marketId, outcomeId }) => {});
```

## License

Private - BetArabia Partnership
