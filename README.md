# DEX Order Execution Engine

A real-time **Market Order** execution engine with DEX routing (Raydium & Meteora) and WebSocket status updates.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Why Market Orders?

**Market Orders** were chosen for this implementation because they:
- Provide **immediate execution** at current market prices
- Focus on the **core DEX routing logic** without additional complexity
- Represent the **most common trading pattern** in DeFi
- Allow clear demonstration of **concurrent processing** and **WebSocket streaming**

### Extension to Other Order Types

- **Limit Orders**: Add a `PriceMonitorService` that continuously checks current prices against target prices and triggers market order execution when conditions are met.
- **Sniper Orders**: Implement a `PoolMonitorService` listening to new pool creation events on Raydium/Meteora, then auto-execute market orders on first block with priority fees.

---

## 🏗️ Architecture

```
Client Request
      ↓
  Fastify API (HTTP → WebSocket)
      ↓
  BullMQ Queue (Redis-backed)
      ↓
  Worker (10 concurrent, 100/min)
      ↓
  DEX Router → [Raydium, Meteora]
      ↓
  Execution Result
      ↓
  WebSocket Status Updates
```

### Order Lifecycle States

```
pending → routing → building → submitted → confirmed
                                     ↓
                                  failed (with retry)
```

### Order Submission Flow

1. **Client submits order** via `POST /api/orders/execute` with order details in request body
2. **Server validates** the order request (token pair, amount, slippage)
3. **Server returns** `orderId` and WebSocket upgrade URL immediately in HTTP response
4. **Client upgrades connection** to WebSocket at same endpoint: `GET /api/orders/execute?orderId={id}`
5. **Order is queued** in BullMQ for asynchronous processing
6. **Status updates** stream back through the upgraded WebSocket as the order progresses through 6 states

**HTTP → WebSocket Pattern:**  
This implementation uses a **single endpoint** (`/api/orders/execute`) that handles both HTTP POST for order creation and WebSocket upgrade for streaming. The client first POSTs to create the order, receives the orderId, then immediately upgrades to WebSocket on the same endpoint with the orderId as a query parameter. This provides a clean separation while maintaining endpoint consistency.

---

## 🎨 Web Interface

**Access the UI**: Open http://localhost:3000 in your browser after starting the server.

### Features:
- 📝 **Interactive Order Form** - Submit orders with dropdown token selection and quick amount buttons
- 📊 **Real-Time Dashboard** - Watch orders progress through all 6 states live
- 📈 **Live Statistics** - Track total, active, and completed orders
- 🔍 **Detailed Timeline** - See complete history for each order
- 💡 **Connection Status** - Visual indicator showing server connectivity
- 🎯 **Multiple Concurrent Orders** - Submit multiple orders and watch them process simultaneously

The web UI uses WebSocket connections just like the API, providing a visual demonstration of the entire order lifecycle.

---

## 🚀 Features

- ✅ **Market Order Execution** - Immediate swap at current prices
- ✅ **DEX Routing** - Compares Raydium & Meteora quotes in parallel
- ✅ **Best Price Selection** - Routes to DEX with highest output after fees
- ✅ **WebSocket Streaming** - Real-time status updates for order lifecycle
- ✅ **Concurrent Processing** - 10 concurrent workers, 100 orders/minute
- ✅ **Retry Logic** - Exponential backoff (max 3 attempts)
- ✅ **Mock Implementation** - Realistic DEX behavior without blockchain dependency
- ✅ **PostgreSQL** - Persistent order history
- ✅ **Redis** - Queue management & caching

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Fastify |
| WebSocket | @fastify/websocket |
| Queue | BullMQ |
| Database | PostgreSQL + Prisma |
| Cache | Redis |
| Testing | Jest |
| Validation | Zod |

---

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### 1. Clone Repository

```bash
git clone <repository-url>
cd dex-order-engine
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for local development).

### 4. Start Infrastructure

```bash
npm run docker:up
```

This starts PostgreSQL and Redis in Docker containers.

### 5. Setup Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 6. Start Application

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

Server runs on `http://localhost:3000`

---

## 📡 API Endpoints

### Submit Order & Stream Updates (Single Endpoint)

**HTTP POST:** `POST /api/orders/execute`

**Request Body:**
```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 1.5,
  "slippage": 0.01
}
```

**Response:**
```json
{
  "orderId": "ord_abc123",
  "status": "pending",
  "websocketUrl": "/api/orders/execute?orderId=ord_abc123",
  "message": "Order created. Upgrade connection to WebSocket for live updates."
}
```

**WebSocket Upgrade:** `ws://localhost:3000/api/orders/execute?orderId=ord_abc123`

**WebSocket Messages:**
```json
// Initial status
{
  "orderId": "ord_abc123",
  "status": "pending",
  "timestamp": "2025-11-19T10:30:00.123Z"
}

// Routing status
{
  "orderId": "ord_abc123",
  "status": "routing",
  "data": {
    "selectedDex": "meteora",
    "price": "181.20",
    "estimatedAmountOut": "271.43"
  }
}

// Confirmed
{
  "orderId": "ord_abc123",
  "status": "confirmed",
  "data": {
    "txHash": "5kP7j...",
    "dex": "meteora",
    "executedPrice": "181.18",
    "actualAmountOut": "271.40",
    "explorerUrl": "https://solscan.io/tx/..."
  }
}
```

**Pattern:** Same endpoint handles both HTTP POST and WebSocket upgrade - true HTTP → WebSocket pattern!

### Get Order Status

```bash
GET /api/orders/:orderId
```

**Response:**
```json
{
  "order": {
    "id": "ord_abc123",
    "status": "confirmed",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 1.5,
    "dex": "meteora",
    "txHash": "5kP7j...",
    "executedPrice": 181.18,
    "actualAmountOut": 271.40
  }
}
```

### Health Check

```bash
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "services": {
    "database": "connected",
    "redis": "connected",
    "queue": "operational"
  },
  "queue": {
    "waiting": 2,
    "active": 5,
    "completed": 143,
    "failed": 3
  }
}
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:watch
```

### Test Coverage

- ✅ DEX routing logic
- ✅ Quote comparison
- ✅ Order validation
- ✅ Mock DEX services
- ✅ Helper functions
- ✅ Error handling

**Target:** >70% coverage across all files

---

## 📝 Postman Collection

Import `postman/dex-order-engine.postman_collection.json` into Postman.

### Example: Submit Order

1. Open WebSocket request in Postman
2. Connect to `ws://localhost:3000/api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=1.5&slippage=0.01`
3. Watch real-time status updates

### Example: Submit 5 Orders Concurrently

Use Postman Runner with the provided collection to submit multiple orders simultaneously and observe concurrent processing.

---

## 🎬 Demo Video

**Video Link:** [YouTube Demo](YOUR_VIDEO_LINK_HERE)

**What's Shown:**
- Order submission via WebSocket
- DEX routing decision logs
- Real-time status updates (pending → routing → confirmed)
- Queue processing 5 concurrent orders
- Transaction hash and explorer links

---

## 🚀 Deployment

### Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL and Redis
railway add postgresql
railway add redis

# Deploy
railway up
```

### Deploy to Render

1. Create new Web Service
2. Connect GitHub repository
3. Add PostgreSQL and Redis add-ons
4. Set environment variables
5. Deploy

**Public URL:** https://your-app.onrender.com

---

## 🔍 DEX Routing Logic

### Quote Comparison Example

```
Order: 1.5 SOL → USDC

Raydium Quote:
  Price: $180.15
  Fee: 0.3%
  Amount Out: $269.61

Meteora Quote:
  Price: $181.20
  Fee: 0.2%
  Amount Out: $271.43

✅ Selected: Meteora (+0.68% improvement)
```

### Logging Output

```
[INFO] DEX Routing Decision:
  raydium: { price: '180.15', fee: '0.30%', amountOut: '269.61', liquidity: '$5.23M' }
  meteora: { price: '181.20', fee: '0.20%', amountOut: '271.43', liquidity: '$4.87M' }
  selected: 'meteora'
  improvement: '+0.68%'
```

---

## 🏗️ Project Structure

```
dex-order-engine/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── orders.route.ts      # Order submission & WebSocket
│   │   │   └── health.route.ts      # Health check
│   │   └── server.ts                # Fastify setup
│   ├── services/
│   │   ├── raydium.service.ts       # Mock Raydium DEX
│   │   ├── meteora.service.ts       # Mock Meteora DEX
│   │   ├── dex-router.service.ts    # Quote comparison
│   │   ├── websocket.service.ts     # WebSocket manager
│   │   └── order.service.ts         # Order business logic
│   ├── queue/
│   │   ├── order.queue.ts           # BullMQ setup
│   │   └── order.worker.ts          # Order processor
│   ├── db/
│   │   ├── prisma.ts                # Prisma client
│   │   └── redis.ts                 # Redis client
│   ├── utils/
│   │   ├── logger.ts                # Winston logger
│   │   └── helpers.ts               # Utilities
│   ├── types/
│   │   └── index.ts                 # TypeScript types
│   ├── config/
│   │   └── index.ts                 # Configuration
│   └── index.ts                     # Entry point
├── prisma/
│   └── schema.prisma                # Database schema
├── postman/
│   └── collection.json              # API collection
└── __tests__/                       # Test files
```

---

## 🤝 Design Decisions

### 1. Mock vs Real Implementation

**Choice:** Mock DEX implementation

**Why:**
- Faster development and testing
- No blockchain dependency
- Reliable execution without network failures
- Focus on architecture and routing logic

### 2. Market Order First

**Why:**
- Simplest order type to demonstrate core concepts
- Clear execution flow
- Foundation for extending to limit/sniper orders

### 3. BullMQ Queue System

**Why:**
- Built-in retry logic with exponential backoff
- Rate limiting support
- Redis-backed for persistence
- Concurrent worker support

### 4. WebSocket for Status Updates

**Why:**
- Real-time updates without polling
- Efficient for concurrent orders
- Better UX than REST endpoints

---

## 📊 Performance Metrics

- **Latency:** 2-4 seconds per order (mocked network delays)
- **Throughput:** 100 orders/minute
- **Concurrency:** 10 concurrent workers
- **Retry:** Up to 3 attempts with exponential backoff
- **Success Rate:** ~95% (5% simulated failures)

---

## 📜 License

MIT

---

## 👤 Author

Your Name - [GitHub](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Raydium DEX Documentation
- Meteora DEX Documentation
- Solana Web3.js
- Fastify Community
