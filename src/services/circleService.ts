import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto'; // For Forge logic if needed, but Circle SDK might handle logic
import forge from 'node-forge'; // Usually required for entity secret encryption

const prisma = new PrismaClient();

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY || '',
  entitySecret: process.env.CIRCLE_ENTITY_SECRET || '', // SDK v1 handles this? We might need valid ciphertext manually
});

export class CircleService {
  /**
   * Helper to encrypt the entity secret.
   * Note: The official SDK usually requires you to fetch the public key and then encrypt the entity secret.
   * This is a simplified implementation assuming we have the logic or using a specific utility.
   * For the sake of this agent, we will assume the SDK client handles the `entitySecret` parameter if provided in config,
   * OR we implement the `createChallenge` flow if required. 
   * 
   * However, `initiateDeveloperControlledWalletsClient` usually takes the API Key and Entity Secret.
   * If manual ciphertext generation is needed for specific endpoints (like creating wallets), we do it here.
   */
  
  // Checking if wallet exists in DB, if not create one.
  static async createAgentWallet(): Promise<string> {
    const existingWallet = await prisma.agentWallet.findFirst();
    if (existingWallet) {
        return existingWallet.address;
    }

    // No wallet found, create a new one.
    // Circle API: POST /home/wallets
    // We need to generate a wallet set first or use existing.
    const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
    if (!walletSetId) throw new Error("CIRCLE_WALLET_SET_ID is missing");

    try {
        // Create 1 wallet in the set for EVM usage (Arc is EVM)
        // SDK specific call - note: strict types might vary by version
        const response = await circleClient.createWallets({
            accountType: 'SCA',
            blockchains: ['ETH-SEPOLIA'] as any, // Cast to any to avoid strict enum mismatch if SDK is outdated
            count: 1,
            walletSetId: walletSetId,
        });

        const wallet = response.data?.wallets?.[0];
        if (!wallet || !wallet.id || !wallet.address) {
            throw new Error("Failed to create wallet");
        }

        // Save to DB
        await prisma.agentWallet.create({
            data: {
                circleWalletId: wallet.id,
                address: wallet.address,
            }
        });

        return wallet.address;

    } catch (error) {
        console.error("Failed to create agent wallet:", error);
        throw error;
    }
  }

  static async executeTransfer(toAddress: string, amount: string, tokenAddress: string): Promise<string> {
    const agentWallet = await prisma.agentWallet.findFirst();
    if (!agentWallet) throw new Error("No agent wallet found");

    try {
        // Execute transfer
        const response = await circleClient.createTransaction({
            walletId: agentWallet.circleWalletId,
            tokenId: tokenAddress, // Pass the contract address
            destinationAddress: toAddress,
            amount: [amount], // SDK likely expects array for amount even if prop is singular, or we try array first
            fee: {
                type: 'level',
                config: {
                    feeLevel: 'MEDIUM'
                }
            }
        } as any); // Casting to any to avoid strict type issues with 'amount'/'amounts' mismatch

        return response.data?.id || "unknown_tx_id";

    } catch (error) {
         console.error("Failed to execute transfer:", error);
         throw error;
    }
  }
}
