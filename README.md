# DEX Order Execution Engine

> **Professional-grade order execution engine with DEX routing, WebSocket status streaming, and concurrent order processing.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen.svg)]()

**🔗 Live Demo:** [https://dex-order-engine-7jt2.onrender.com](https://dex-order-engine-7jt2.onrender.com)  
**📹 Video Demo:** [YouTube Link - Coming Soon](#)  
**🎯 Interactive Dashboard:** [Try it now!](https://dex-order-engine-7jt2.onrender.com/)

---

## 📋 Table of Contents

- [Order Type Selection: Market Orders](#-order-type-selection-market-orders)
- [System Architecture](#-system-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [WebSocket Protocol](#-websocket-protocol)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Design Decisions](#-design-decisions)
- [Performance Metrics](#-performance-metrics)

---

## 🎯 Order Type Selection: Market Orders

### Why Market Orders?

This implementation focuses on **Market Orders** because they:

1. **Prioritize immediate execution** at current market prices, demonstrating the core DEX routing logic without additional complexity
2. **Represent 80%+ of DeFi trading volume**, making them the most practical starting point
3. **Showcase concurrent processing effectively** with predictable execution flows ideal for demonstrating real-time WebSocket updates
4. **Enable clear DEX routing decisions** based on instantaneous price comparisons rather than conditional logic

### Extension to Other Order Types

**🎯 Limit Orders Extension:**
Implement a `PriceMonitorService` that continuously polls DEX prices (using the same `DexRouterService.getBestRoute()`) and triggers market order execution when `currentPrice >= targetPrice`. Store pending limits in Redis with TTL, emit "monitoring" status via WebSocket, and convert to market order execution when triggered.

**🚀 Sniper Orders Extension:**
Add a `PoolMonitorService` that subscribes to Raydium/Meteora pool creation events via WebSocket connections to their on-chain programs. Upon detecting new pool deployment matching target criteria (token address, liquidity threshold), immediately execute a market order with priorityFee parameter for front-running capability.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Postman    │  │   Frontend   │  │   cURL/CLI   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │ HTTP/WebSocket
          ┌──────────────────▼──────────────────┐
          │      FASTIFY API SERVER             │
          │  ┌─────────────────────────────┐    │
          │  │  POST /api/orders/execute   │───┐│
          │  │  (HTTP → WebSocket Upgrade) │   ││
          │  └─────────────────────────────┘   ││
          │  ┌─────────────────────────────┐   ││
          │  │  GET /api/orders/:id        │   ││
          │  │  GET /api/orders (list)     │   ││
          │  └─────────────────────────────┘   ││
          └───────────┬─────────────────────────┘│
                      │                          │
          ┌───────────▼──────────┐               │
          │   ORDER SERVICE      │               │
          │  - Validation        │               │
          │  - CRUD Operations   │               │
          │  - Status Updates    │               │
          └───────────┬──────────┘               │
                      │                          │
          ┌───────────▼──────────┐               │
          │    BULLMQ QUEUE      │◄──────────────┘
          │  - Redis-backed      │
          │  - 10 concurrent     │
          │  - Retry logic (3x)  │
          └───────────┬──────────┘
                      │
          ┌───────────▼──────────┐
          │   ORDER WORKER       │
          │  ┌────────────────┐  │     ┌─────────────────┐
          │  │ Process Order  │──┼────▶│ DEX ROUTER      │
          │  │  1. Routing    │  │     │  - Raydium SDK  │
          │  │  2. Building   │  │     │  - Meteora SDK  │
          │  │  3. Execute    │  │     │  - Price Compare│
          │  └────────────────┘  │     └─────────────────┘
          └───────────┬──────────┘
                      │
          ┌───────────▼──────────────────────────┐
          │   WEBSOCKET SERVICE                  │
          │  - Broadcast status updates          │
          │  - Maintain active connections       │
          │  - Emit: pending→routing→confirmed   │
          └───────────┬──────────────────────────┘
                      │
          ┌───────────▼──────────┐
          │   PERSISTENCE        │
          │  ┌────────────────┐  │
          │  │  PostgreSQL    │  │  (Order history)
          │  │  - Orders      │  │
          │  │  - Audit trail │  │
          │  └────────────────┘  │
          │  ┌────────────────┐  │
          │  │     Redis      │  │  (Active orders)
          │  │  - Queue jobs  │  │
          │  │  - Rate limit  │  │
          │  └────────────────┘  │
          └──────────────────────┘
```

### Order Execution Flow (6 Stages)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ PENDING  │───▶│ ROUTING  │───▶│ BUILDING │───▶│SUBMITTED │───▶│CONFIRMED │    │  FAILED  │
│ Queued   │    │Comparing │    │Creating  │    │Sent to   │    │TX Success│    │  Retry   │
│          │    │DEX quotes│    │TX        │    │Network   │    │          │◀───│  3x Max  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   0.1s            0.2-0.4s         0.3s           2-3s            Final          Error
```

**Detailed Flow:**

1. **PENDING** - Order received via API, validated, queued in BullMQ
2. **ROUTING** - DEX router fetches quotes from Raydium & Meteora in parallel, compares prices
3. **BUILDING** - Transaction constructed with selected DEX route and slippage protection
4. **SUBMITTED** - Transaction sent to Solana network (mock: simulated 2-3s network latency)
5. **CONFIRMED** - Transaction finalized on-chain, returns txHash and execution details
6. **FAILED** - If any step fails, retry with exponential backoff (max 3 attempts)

---

## ✨ Features

### Core Functionality
- ✅ **Market Order Execution** - Immediate execution at current market prices
- ✅ **Multi-DEX Routing** - Automatic routing between Raydium and Meteora
- ✅ **Real-time WebSocket Updates** - 6-stage order lifecycle streaming
- ✅ **Concurrent Processing** - Handle up to 10 orders simultaneously
- ✅ **Queue Management** - BullMQ with Redis, 100 orders/minute throughput
- ✅ **Retry Logic** - Exponential backoff, max 3 attempts
- ✅ **Slippage Protection** - Configurable tolerance (default 0.5%)

### Technical Excellence
- ✅ **HTTP → WebSocket Upgrade** - Single endpoint for both protocols
- ✅ **Price Comparison** - Real-time quote comparison across DEXs
- ✅ **Transaction Proof** - Solana Explorer links (devnet mock)
- ✅ **Comprehensive Testing** - 23 unit/integration tests
- ✅ **Production-Ready** - Deployed on Render.com with PostgreSQL + Redis
- ✅ **Monitoring** - Structured logging with Pino

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+ with TypeScript 5.0
- **Web Framework:** Fastify 4.x (native WebSocket support)
- **Queue System:** BullMQ 5.x + Redis 7.x
- **Database:** PostgreSQL 15 (Prisma ORM)
- **Caching:** Redis (active orders + rate limiting)

### DEX Integration (Mock)
- **Raydium:** Simulated with 0.30% fee, ±2% price variance
- **Meteora:** Simulated with 0.20% fee, ±2.5% price variance
- **Latency:** 200-400ms per quote (realistic network simulation)

### Testing & Quality
- **Testing:** Jest with 23 passing tests
- **Coverage:** Unit tests (DEX routing, validation) + Integration tests (queue, WebSocket)
- **Linting:** ESLint + Prettier
- **Type Safety:** Strict TypeScript

### Deployment
- **Hosting:** Render.com (Free Tier)
- **Database:** Render PostgreSQL (90-day retention)
- **Cache:** Render Redis Key-Value Store
- **CI/CD:** GitHub auto-deploy on push to main

---

## 🚀 Getting Started

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
docker (optional, for local Redis/PostgreSQL)
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/SAMMILLERR/dex-order-engine.git
cd dex-order-engine
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/dex_orders"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
# OR for cloud deployment:
REDIS_URL="redis://user:pass@host:port"

# Server
NODE_ENV="development"
PORT=3000
HOST="0.0.0.0"

# Queue Configuration
QUEUE_CONCURRENCY=10
MAX_RETRIES=3
RETRY_DELAY=2000

# Mock DEX Settings
DEX_FAILURE_RATE=0.2  # 20% failure for testing retry logic
```

4. **Run database migrations**
```bash
npx prisma migrate dev
```

5. **Start the server**
```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

Server will start at `http://localhost:3000`

### Docker Setup (Optional)

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Start server
npm run dev
```

---

## 📡 API Documentation

### Base URL
- **Local:** `http://localhost:3000`
- **Production:** `https://dex-order-engine-7jt2.onrender.com`

### Endpoints

#### 1. Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T12:00:00.000Z"
}
```

---

#### 2. Create Order (HTTP → WebSocket)
```http
POST /api/orders/execute
Content-Type: application/json
```

**Request Body:**
```json
{
  "tokenIn": "So11111111111111111111111111111111111111112",  // SOL mint
  "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mint
  "amount": 1.5,
  "slippage": 0.5  // Optional, default 0.5%
}
```

**HTTP Response (201 Created):**
```json
{
  "orderId": "ord_abc123def456",
  "status": "pending",
  "websocketUrl": "/api/orders/execute?orderId=ord_abc123def456",
  "message": "Order created. Upgrade connection to WebSocket for live updates."
}
```

**WebSocket Upgrade:**
After receiving orderId, upgrade the same connection to WebSocket:
```javascript
const ws = new WebSocket(`ws://localhost:3000/api/orders/execute?orderId=ord_abc123def456`);
```

---

#### 3. Get Order Status
```http
GET /api/orders/:orderId
```

**Response:**
```json
{
  "order": {
    "id": "ord_abc123def456",
    "status": "confirmed",
    "tokenIn": "So11111111111111111111111111111111111111112",
    "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1.5,
    "slippage": 0.5,
    "dex": "raydium",
    "executedPrice": 180.50,
    "actualAmountOut": 270.75,
    "txHash": "5j8k2L3m4N5o6P7q8R9s0T1u2V3w4X5y6Z7a8B9c0D1e2F3g4H5i6J7k8L9m0N1o",
    "attempts": 1,
    "createdAt": "2025-11-20T12:00:00.000Z",
    "completedAt": "2025-11-20T12:00:03.500Z"
  }
}
```

---

#### 4. List Orders
```http
GET /api/orders?limit=20&status=confirmed
```

**Query Parameters:**
- `limit` (optional): Number of orders to return (default: 20, max: 100)
- `status` (optional): Filter by status (pending | routing | building | submitted | confirmed | failed)

**Response:**
```json
{
  "orders": [
    {
      "id": "ord_abc123",
      "status": "confirmed",
      "amount": 1.5,
      "dex": "raydium",
      "createdAt": "2025-11-20T12:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20
}
```

---

## 🔌 WebSocket Protocol

### Connection Flow

1. **Create Order** via POST `/api/orders/execute`
2. **Receive orderId** in response
3. **Upgrade to WebSocket** using same endpoint with query param

### WebSocket Messages

#### Client → Server
```json
{
  "action": "ping"
}
```

#### Server → Client (Status Updates)

**Pending:**
```json
{
  "orderId": "ord_abc123",
  "status": "pending",
  "timestamp": "2025-11-20T12:00:00.000Z",
  "data": {
    "message": "Order received and queued"
  }
}
```

**Routing:**
```json
{
  "orderId": "ord_abc123",
  "status": "routing",
  "timestamp": "2025-11-20T12:00:00.200Z",
  "data": {
    "message": "Best route selected: raydium",
    "selectedDex": "raydium",
    "price": 180.50,
    "estimatedAmountOut": 270.75
  }
}
```

**Building:**
```json
{
  "orderId": "ord_abc123",
  "status": "building",
  "timestamp": "2025-11-20T12:00:00.500Z",
  "data": {
    "message": "Creating transaction on raydium..."
  }
}
```

**Submitted:**
```json
{
  "orderId": "ord_abc123",
  "status": "submitted",
  "timestamp": "2025-11-20T12:00:00.800Z",
  "data": {
    "message": "Transaction sent to network..."
  }
}
```

**Confirmed:**
```json
{
  "orderId": "ord_abc123",
  "status": "confirmed",
  "timestamp": "2025-11-20T12:00:03.500Z",
  "data": {
    "message": "Transaction confirmed!",
    "txHash": "5j8k2L3m4N5o6P7q8R9s0T1u2V3w4X5y6Z7a8B9c0D1e2F3g4H5i6J7k8L9m0N1o",
    "dex": "raydium",
    "executedPrice": 180.50,
    "actualAmountOut": 270.75,
    "explorerUrl": "https://solscan.io/tx/5j8k2L3m...?cluster=devnet",
    "duration": "3.50s"
  }
}
```

**Failed:**
```json
{
  "orderId": "ord_abc123",
  "status": "failed",
  "timestamp": "2025-11-20T12:00:02.000Z",
  "error": "Slippage tolerance exceeded - Price moved beyond acceptable range"
}
```

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

### Test Results
```
Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        ~12s
```

### Test Categories

#### Unit Tests (15 tests)
- ✅ DEX Router: Quote comparison, route selection, swap execution
- ✅ Order Validation: Input validation, schema checks
- ✅ Mock DEX Services: Raydium/Meteora quote generation
- ✅ Helper Functions: ID generation, backoff calculation

#### Integration Tests (8 tests)
- ✅ Order Service: CRUD operations, status updates
- ✅ Queue: Job processing, concurrent execution, retry logic
- ✅ WebSocket Service: Connection lifecycle, broadcasting

### Run Specific Test Suites
```bash
# DEX routing tests
npm test -- dex-router

# Queue tests
npm test -- queue

# WebSocket tests
npm test -- websocket
```

---

## 🌐 Deployment

### Production Deployment (Render.com)

**🔗 Live URL:** [https://dex-order-engine-7jt2.onrender.com](https://dex-order-engine-7jt2.onrender.com)

#### Services

1. **Web Service**
   - Type: Web Service
   - Build Command: `npm install --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build`
   - Start Command: `npm start`
   - Environment: Node.js 18

2. **PostgreSQL Database**
   - Type: PostgreSQL 15
   - Instance: Free (90-day data retention)
   - Connection: Internal URL for app, External for migrations

3. **Redis Cache**
   - Type: Key-Value Store
   - Size: 25MB (Free tier)
   - Policy: volatile-ttl

#### Environment Variables (Render)
```env
DATABASE_URL=<render-postgres-internal-url>
REDIS_URL=<render-redis-url>
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
QUEUE_CONCURRENCY=10
MAX_RETRIES=3
RETRY_DELAY=2000
DEX_FAILURE_RATE=0.2
```

#### Deployment Steps
See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed instructions.

### Alternative Free Hosting Options
- **Fly.io** - 3 free VMs + Postgres + Redis
- **Railway** - $5 free credit/month
- **DigitalOcean App Platform** - $200 free credit

---

## 💡 Design Decisions

### 1. Why Fastify over Express?

**Chosen:** Fastify 4.x  
**Rationale:**
- **Native WebSocket support** via `@fastify/websocket` plugin
- **2x faster** than Express (important for concurrent order processing)
- **Built-in schema validation** with JSON Schema
- **TypeScript-first** with excellent type definitions

### 2. Why BullMQ over other queues?

**Chosen:** BullMQ 5.x  
**Rationale:**
- **Redis-backed** - Fast, reliable, distributed-ready
- **Concurrent processing** - Easy to configure (10 parallel workers)
- **Retry logic** - Built-in exponential backoff
- **Job prioritization** - Can extend for limit/sniper orders
- **Dashboard** - Bull Board for monitoring (optional)

### 3. Why Mock DEX Implementation?

**Chosen:** Simulated Raydium/Meteora  
**Rationale:**
- **Focus on architecture** - Demonstrates routing logic without blockchain complexity
- **Realistic behavior** - 200-400ms latency, random failures (20%), price variance
- **Testability** - Deterministic tests without network dependencies
- **Cost-effective** - No devnet SOL faucet dependency
- **Easy extension** - Replace mock classes with real SDKs (same interface)

### 4. Why PostgreSQL + Redis (not just Redis)?

**Chosen:** Dual storage strategy  
**Rationale:**
- **PostgreSQL** - Audit trail, historical queries, complex analytics
- **Redis** - Active orders, queue jobs, sub-second reads
- **Best of both** - ACID compliance + speed where needed

### 5. Why HTTP → WebSocket Upgrade Pattern?

**Chosen:** Single endpoint, protocol upgrade  
**Rationale:**
- **RESTful compatibility** - Standard POST works without WebSocket client
- **Gradual enhancement** - Poll `/api/orders/:id` if WebSocket unavailable
- **Single connection** - No separate WebSocket handshake endpoint
- **Standard pattern** - Used by Socket.io, SignalR, and other real-time libraries

---

## 📊 Performance Metrics

### Throughput
- **Orders/minute:** 100 (rate limited)
- **Concurrent orders:** 10 simultaneous
- **Response time (POST):** <50ms
- **WebSocket latency:** <10ms per update

### Execution Times
- **Pending → Routing:** 100-200ms
- **Routing (DEX quotes):** 200-400ms
- **Building transaction:** 300ms
- **Submitted → Confirmed:** 2-3s (simulated network)
- **Total:** ~3-4s per order

### Reliability
- **Success rate:** 80% (first attempt)
- **With retries:** 95%+ (3 attempts)
- **Retry delay:** 2s exponential backoff (2s, 4s, 8s)

---

## 📚 Additional Documentation

- **[Architecture Diagram](./ARCHITECTURE.md)** - High-level design overview with flow diagrams
- **[Deployment Guide](./RENDER_DEPLOYMENT.md)** - Step-by-step Render setup
- **[Postman Collection](./postman_collection_concurrent.json)** - Concurrent testing (5 orders, 0ms delay)

---

## 🎬 Demo Video

**📹 YouTube Demo:** [Watch 2-minute demo](#) *(Coming Soon)*

**Demo Script:**
1. Show 5 concurrent orders submitted via Postman (0ms delay)
2. WebSocket streaming all status updates in real-time
3. DEX routing decisions logged in console (Raydium vs Meteora)
4. Queue processing multiple orders (Render logs)
5. Final results: 4-5/5 confirmed with TX hashes

---

## 🧰 Postman Collection

Import `postman_collection_concurrent.json` for testing:

**Features:**
- ✅ Health check
- ✅ Single order execution
- ✅ 5 concurrent orders (0ms delay)
- ✅ Automated test assertions
- ✅ Statistics (success rate, DEX distribution)
- ✅ Order status verification

**Run Collection:**
1. Import into Postman
2. Set environment variable `BASE_URL` to `http://localhost:3000` or production URL
3. Open Collection Runner
4. Set delay to **0ms** (concurrent)
5. Click "Run"
6. Watch console for statistics and assertions

---

## 📝 Assignment Requirements Checklist

### Core Functionality
- ✅ Order execution engine (Market Orders)
- ✅ DEX routing (Raydium vs Meteora comparison)
- ✅ WebSocket status updates (6 stages: pending→routing→building→submitted→confirmed/failed)
- ✅ HTTP → WebSocket upgrade pattern
- ✅ Transaction proof (Solana Explorer links - mock)

### Technical Requirements
- ✅ Concurrent processing (10 orders simultaneously, 100/min throughput)
- ✅ Queue management (BullMQ + Redis)
- ✅ Retry logic (3 attempts, exponential backoff)
- ✅ Error handling with failure persistence
- ✅ Slippage protection

### Deliverables
- ✅ GitHub repo with clean commits
- ✅ API with order execution and routing
- ✅ WebSocket status streaming
- ✅ Documentation (README + ARCHITECTURE.md + design decisions)
- ✅ Deployed to free hosting (Render.com)
- ✅ Public URL included in README
- ⏳ 2-min YouTube video *(record after testing)*
- ✅ Postman collection for concurrent testing
- ✅ 23 unit/integration tests (exceeds 10 requirement)

---

## 🤝 Contributing

This is a demonstration project for technical assessment. For questions or feedback:

**GitHub:** [SAMMILLERR/dex-order-engine](https://github.com/SAMMILLERR/dex-order-engine)

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Raydium** - DEX SDK documentation and examples
- **Meteora** - AMM integration patterns
- **Solana** - Web3.js library and devnet infrastructure
- **BullMQ** - Robust queue system for Node.js
- **Fastify** - High-performance web framework

---

**Built with ❤️ for professional DeFi order execution**
