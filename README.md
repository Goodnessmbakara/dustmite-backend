# DustMite Backend

An autonomous treasury agent that moves idle USDC into yield-bearing tokens (USYC) on the Arc Network using AI decision-making.

## Tech Stack

- **Runtime**: Node.js v20+
- **Framework**: Fastify
- **Language**: TypeScript (Strict Mode)
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Circle Developer-Controlled Wallets + viem (Arc Network)
- **AI**: Google Gemini 2.0 Flash

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your actual keys
```

3. Initialize database:
```bash
npx prisma db push
```

4. Build:
```bash
npm run build
```

5. Start:
```bash
npm start
```

## API Endpoints

- `GET /health` - Health check
- `GET /agent/status` - Current wallet status and recent activity
- `POST /agent/chat` - Ask the agent about its decisions
- `POST /admin/trigger` - Manually trigger the agent loop

## How It Works

The agent runs every 5 minutes and:
1. Checks wallet balance on Arc Network
2. Fetches current yield APY
3. Calculates profitability
4. Asks Gemini AI for decision
5. Executes transfer if profitable
6. Logs all decisions to database

## Environment Variables

See `.env.example` for required configuration.
