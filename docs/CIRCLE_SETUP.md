# Circle Developer-Controlled Wallets Setup Guide

This guide will walk you through setting up Circle's Developer-Controlled Wallets for the DustMite backend.

## Overview

You need **3 keys** from Circle to use developer-controlled wallets:

1. **`CIRCLE_API_KEY`** - Your API authentication key (from Circle Console)
2. **`CIRCLE_ENTITY_SECRET`** - A 32-byte hex string you generate locally
3. **`CIRCLE_WALLET_SET_ID`** - ID of your wallet set (created via API)

## Step-by-Step Setup

### Step 1: Get Your Circle API Key

1. Go to [Circle Developer Console](https://console.circle.com/)
2. Sign up or log in to your account
3. Navigate to **API Keys** section
4. Create a new API key or copy your existing one
5. Save it securely - you'll need it for the next steps

### Step 2: Generate and Configure Entity Secret

Run the interactive setup script:

```bash
npm run setup:circle
```

This script will:
- Prompt you for your Circle API Key
- Generate a random 32-byte entity secret
- Test the configuration
- Display the values to add to your `.env` file

**Important:** 
- The entity secret is generated **locally** and never sent to Circle in plain text
- The SDK automatically encrypts it for each API call
- Store it securely in a password manager

### Step 3: Create a Wallet Set

After adding the API key and entity secret to your `.env` file, create a wallet set:

```bash
npm run create:wallet-set
```

This script will:
- Read your credentials from `.env`
- Create a new wallet set in Circle
- Display the `CIRCLE_WALLET_SET_ID` to add to your `.env` file

### Step 4: Update Your .env File

Your `.env` file should now have all three values:

```env
CIRCLE_API_KEY="your-api-key-here"
CIRCLE_ENTITY_SECRET="your-64-char-hex-string-here"
CIRCLE_WALLET_SET_ID="your-wallet-set-id-here"
```

### Step 5: Verify Setup

Start your development server:

```bash
npm run dev
```

The application will automatically create an agent wallet on first run using your Circle configuration.

## How It Works

### Developer-Controlled vs User-Controlled

**Your backend uses Developer-Controlled Wallets:**
- ✅ Backend holds the entity secret
- ✅ Backend controls all wallets
- ✅ Backend signs all transactions
- ❌ Frontend has NO access to Circle credentials
- ❌ Users don't control their own wallets directly

This is the correct approach for an autonomous agent that manages funds on behalf of users.

### Architecture

```
Frontend → Backend API → Circle API (with entity secret)
                ↓
         Agent Wallet (controlled by backend)
```

### Security Notes

1. **Never commit `.env` to version control** - it's already in `.gitignore`
2. **Store entity secret in a password manager** - it's required for all API calls
3. **The SDK handles encryption automatically** - you just provide the plain entity secret
4. **Each API request gets a fresh ciphertext** - the SDK does this automatically

## Troubleshooting

### "Missing CIRCLE_API_KEY"
- Verify you've added the API key to your `.env` file
- Check that the `.env` file is in the project root
- Restart your development server after adding environment variables

### "Failed to create wallet set"
- Verify your API key is correct
- Verify your entity secret is a 64-character hex string
- Check your Circle account status at https://console.circle.com/

### "Entity secret must be 32 bytes"
- The entity secret should be exactly 64 hexadecimal characters
- Run `npm run setup:circle` again to generate a new one

## API Reference

- [Circle Developer Docs](https://developers.circle.com/wallets/dev-controlled)
- [Register Entity Secret](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)
- [Create Wallet Set](https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet)
- [Node.js SDK](https://developers.circle.com/sdks/developer-controlled-wallets-nodejs-sdk)

## Next Steps

Once setup is complete:
1. Your backend will automatically create an agent wallet on first run
2. The wallet will be stored in your database
3. You can use the `CircleService` to execute transfers
4. Fund your agent wallet with USDC/USYC for testing
