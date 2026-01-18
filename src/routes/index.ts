import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { BrainService } from '../services/brainService';
import { runAgentCylce } from '../worker/agentLoop';
import { createPublicClient, http, formatUnits } from 'viem';

const prisma = new PrismaClient();

// Re-using the client strictly for read-only balance checks in API
const arcChain = {
  id: Number(process.env.ARC_CHAIN_ID) || 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'] },
    public: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'] },
  },
} as const;

const publicClient = createPublicClient({
  chain: arcChain,
  transport: http(),
});

export default async function routes(fastify: FastifyInstance) {
  // GET /health
  fastify.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      description: 'Returns the health status of the API',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async () => {
    return { status: 'ok', timestamp: new Date() };
  });

  // GET /agent/status
  fastify.get('/agent/status', {
    schema: {
      tags: ['agent'],
      summary: 'Get agent status',
      description: 'Returns the current wallet address, balance, and recent activity logs',
      response: {
        200: {
          type: 'object',
          properties: {
            walletAddress: { type: 'string' },
            currentBalance: { type: 'string' },
            lastActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  action: { type: 'string', enum: ['BUY', 'SELL', 'HOLD'] },
                  amount: { type: 'string' },
                  reason: { type: 'string' },
                  sentimentScore: { type: 'number' },
                  marketApySnapshot: { type: 'number' },
                  txHash: { type: 'string', nullable: true }
                }
              }
            }
          }
        }
      }
    }
  }, async () => {
    const wallet = await prisma.agentWallet.findFirst();
    let balance = '0';
    
    if (wallet) {
       try {
         const usdcContract = process.env.USDC_CONTRACT_ADDRESS as `0x${string}`;
         const abi = [{ constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }];
         
         const rawBalance = await publicClient.readContract({
             address: usdcContract,
             abi: abi,
             functionName: 'balanceOf',
             args: [wallet.address as `0x${string}`]
         }) as bigint;
         balance = formatUnits(rawBalance, 6);
       } catch (e) {
         console.error("Status balance fetch error", e);
       }
    }

    const lastLogs = await prisma.agentLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' }
    });

    return {
      walletAddress: wallet?.address || 'Not Created',
      currentBalance: balance,
      lastActivity: lastLogs
    };
  });

  // POST /agent/chat
  fastify.post<{ Body: { message: string } }>('/agent/chat', {
    schema: {
      tags: ['agent'],
      summary: 'Chat with the agent',
      description: 'Ask the agent questions about its decisions and reasoning',
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { 
            type: 'string',
            description: 'Your question for the agent'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            reply: { type: 'string', description: 'Agent\'s response' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { message } = request.body;
    
    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    const logs = await prisma.agentLog.findMany({
      take: 3,
      orderBy: { timestamp: 'desc' }
    });
    
    const contextJson = JSON.stringify(logs, null, 2);
    const answer = await BrainService.explainDifference(contextJson, message);

    return { reply: answer };
  });

  // POST /admin/trigger
  fastify.post('/admin/trigger', {
    schema: {
      tags: ['admin'],
      summary: 'Manually trigger agent loop',
      description: 'Forces the agent to run its decision cycle immediately instead of waiting for the scheduled cron job',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async () => {
    console.log("Admin triggered agent loop");
    await runAgentCylce();
    return { status: 'triggered', timestamp: new Date() };
  });
}
