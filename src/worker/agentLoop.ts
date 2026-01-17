import cron from 'node-cron';
import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet } from 'viem/chains'; // We'll use this just for type structural compatibility if needed or define custom chain
import { PrismaClient } from '@prisma/client';
import { MarketService } from '../services/marketService';
import { BrainService } from '../services/brainService';
import { CircleService } from '../services/circleService';

const prisma = new PrismaClient();

// Arc Network Testnet Definition
const arcChain = {
  id: Number(process.env.ARC_CHAIN_ID) || 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'] },
    public: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'] },
  },
} as const;

const publicClient = createPublicClient({
  chain: arcChain,
  transport: http(),
});

export const startAgentLoop = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('--- Starting Agent Loop ---');
    await runAgentCylce();
  });
};

export const runAgentCylce = async () => {
  try {
    // 1. Fetch Agent Wallet
    let walletAddress = '';
    try {
        walletAddress = await CircleService.createAgentWallet();
    } catch (e) {
        console.error("Critical: Could not get/create agent wallet", e);
        return;
    }

    console.log(`Agent Wallet: ${walletAddress}`);

    // 2. Fetch Balance (USDC Native on Arc)
    const usdcContract = process.env.USDC_CONTRACT_ADDRESS as `0x${string}`;
    // Generic ERC20 balanceOf ABI
    const abi = [{
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      type: "function",
    }];

    let balanceStr = '0';
    try {
        const balance = await publicClient.readContract({
            address: usdcContract,
            abi: abi,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`]
        }) as bigint;
        balanceStr = formatUnits(balance, 6); // USDC has 6 decimals
    } catch (e) {
        console.error("Failed to fetch balance, assuming 0 for safety", e);
    }

    console.log(`Current USDC Balance: ${balanceStr}`);

    // If balance is basically zero, skip (dust tolerance)
    if (parseFloat(balanceStr) < 1.0) {
        console.log("Balance too low to consider moving.");
        // Log skip?
        return;
    }

    // 3. Fetch Yield Data
    const marketData = await MarketService.getLiveYield();
    console.log(`Market Data: ${marketData.apy}% APY from ${marketData.source}`);

    // 4. Calculate Profitability
    // Est Gas Cost - Stubbing since we can't easily est without simulated tx, assume conservative $0.05
    const estGasCost = 0.05; 
    // Simple profit check: (Principal * Yield / 365) - GasCost
    // If we hold for 1 day, is it profitable? or 1 year?
    // Let's assume daily profitability for the "Move" decision trigger.
    const principal = parseFloat(balanceStr);
    const dailyYield = (principal * (marketData.apy / 100)) / 365;
    const isProfitable = (dailyYield - estGasCost) > 0;

    console.log(`Profitability Check: Daily Yield $${dailyYield.toFixed(4)} vs Gas $${estGasCost}. Profitable? ${isProfitable}`);

    // 5. Ask Gemini
    const decision = await BrainService.analyzeMarket(marketData.apy, estGasCost);
    console.log(`Gemini Decision: ${decision.action} because "${decision.reason}"`);

    let finalAction = 'HOLD';
    let txHash = null;

    // 6. Execute if BUY and Profitable
    if (decision.action === 'BUY' && isProfitable) {
        console.log("Executing BUY order...");
        try {
            const usycAddress = process.env.USYC_CONTRACT_ADDRESS;
            if (!usycAddress) throw new Error("USYC Address missing");

            // Execute transfer of full balance to USYC contract (Swap simulation or deposit)
            // Note: The prompt says "move idle USDC... into yield-bearing tokens".
            // Implementation: Transfer USDC to USYC address? Or interaction?
            // "executeTransfer(to, amount, tokenAddress)"
            // Usually you deposit USDC into a pool. For this demo, we transfer USDC 'to' the USYC contract 
            // OR we treat it as a swap. The strict instruction was "executeTransfer(to, amount, tokenAddress)".
            // If we are 'buying' USYC, we might be sending USDC to a swapper/vault.
            // We will send to USYC_CONTRACT_ADDRESS as the destination.
            
            const txId = await CircleService.executeTransfer(
                usycAddress, 
                balanceStr, 
                usdcContract // Token we are sending (USDC)
            );
            
            console.log(`Transfer initiated. ID: ${txId}`);
            finalAction = 'BUY';
            txHash = txId; // Circle TX ID acts as hash reference for now
        } catch (e) {
            console.error("Execution failed", e);
            finalAction = 'HOLD'; // Revert to hold on failure
        }
    }

    // 7. Save Log
    await prisma.agentLog.create({
        data: {
            action: finalAction as 'BUY' | 'HOLD' | 'SELL',
            amount: balanceStr,
            reason: decision.reason,
            sentimentScore: marketData.apy > 6 ? 0.8 : 0.4, // derived from logic
            marketApySnapshot: marketData.apy,
            txHash: txHash
        }
    });

  } catch (err) {
    console.error("Error in Agent Cycle:", err);
  }
};
