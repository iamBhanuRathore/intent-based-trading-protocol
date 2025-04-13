import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionSignature,
  Commitment,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {  
  Program,
  AnchorProvider,
  Wallet,
  web3,
  BN,
  IdlAccounts,
  Idl
} from '@project-serum/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token';
// import dotenv from 'dotenv';
const dotenv = require('dotenv');

import { utils } from '@coral-xyz/anchor';
const { bytes: { bs58 } } = utils;
// Load environment variables
dotenv.config();

// --- Environment Variable Validation ---
const requiredEnvVars = [
  'SOLVER_BOT_PRIVATE_KEY',
  'SOLANA_CONTRACT_PUBLIC_KEY',
  'SOLANA_RPC_URL',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

// --- Type Definitions ---
type IntentAccount = IdlAccounts<typeof IDL>['intent'];
import { IDL as idl } from "./idl";
interface IntentWithPubkey {
  publicKey: PublicKey;
  account: IntentAccount;
}
const IDL = idl as Idl;
// --- Constants and Configuration ---
const PROGRAM_ID: PublicKey = new PublicKey(process.env.SOLANA_CONTRACT_PUBLIC_KEY!);
const INTENT_AUTHORITY_SEED: Buffer = Buffer.from('intent_authority');
const connection: Connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

// Define minimum acceptable profit percentage
const MIN_PROFIT_PERCENTAGE = 1; // 1% minimum profit

// --- Solver Wallet Setup ---
let solverKeypair: Keypair;
try {
  solverKeypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLVER_BOT_PRIVATE_KEY!));
} catch (error) {
  console.error("Failed to decode SOLVER_BOT_PRIVATE_KEY. Ensure it's a valid base58 encoded private key.");
  throw error;
}
const solverPublicKey: PublicKey = solverKeypair.publicKey;
const wallet = new Wallet(solverKeypair);

// --- Anchor Setup ---
const provider: AnchorProvider = new AnchorProvider(
  connection,
  wallet,
  { commitment: 'confirmed' as Commitment }
);

// Initialize the program instance
const program: Program = new Program(IDL, PROGRAM_ID, provider);

// --- Calculate Offset for 'fulfilled' field based on the actual IDL structure ---
// 8 (discriminator) + 32 (user) + 8 (intentId) + 32 (inputMint) + 32 (outputMint) +
// 8 (inputAmount) + 8 (category) + 8 (creationTs) + 9 (Option<i64> expiryTs)
const FULFILLED_OFFSET = 8 + 32 + 8 + 32 + 32 + 8 + 8 + 8 + 9;

/**
 * Fetches available intents that can be fulfilled
 * @returns Promise<IntentWithPubkey[]> Array of available intents
 */
async function fetchAvailableIntents(): Promise<IntentWithPubkey[]> {
  try {
    console.log("Fetching intents...");
    // Get all program accounts of type Intent that are not fulfilled
    const intents: IntentWithPubkey[] = await program.account.intent.all([
      { dataSize: program.account.intent.size },
      {
        memcmp: {
          offset: FULFILLED_OFFSET,
          bytes: bs58.encode(Buffer.from([0])) // Base58 encoded 'false' (0x00)
        }
      }
    ]);
    console.log(`Found ${intents.length} potentially available intents (pre-filter).`);

    // Additional client-side filtering (e.g., expiry)
    const currentTime: number = Math.floor(Date.now() / 1000);
    const validIntents: IntentWithPubkey[] = intents.filter(intent => {
      // Already filtered by memcmp, but double-check doesn't hurt
      if (intent.account.fulfilled) {
        console.log(`Intent ${intent.account.intentId.toString()} skipped (already fulfilled - client filter).`);
        return false;
      }

      // Skip if expired (if expiryTs is set)
      if (intent.account.expiryTs && intent.account.expiryTs.toNumber() < currentTime) {
        console.log(`Intent ${intent.account.intentId.toString()} skipped (expired).`);
        return false;
      }

      return true;
    });

    console.log(`Found ${validIntents.length} valid intents after filtering.`);
    return validIntents;
  } catch (error) {
    console.error('Error fetching intents:', error);
    return [];
  }
}

/**
 * Calculates the minimum acceptable output amount based on intent parameters
 * @param intent The intent to calculate for
 * @returns BN The minimum acceptable output amount
 */
function calculateMinimumOutputAmount(intent: IntentWithPubkey): BN {
  // For demonstration, use a simple approach: 90% of input amount
  // In a real implementation, this would consider market rates, token decimals, etc.
  const inputAmount = intent.account.inputAmount;
  return inputAmount.mul(new BN(90)).div(new BN(100));
}

/**
 * Fulfills an intent by sending input tokens and receiving output tokens
 * @param intent The intent to fulfill
 * @param outputAmount The amount of output tokens (as BN) to send to the user
 * @returns Promise<TransactionSignature> The signature of the fulfilled transaction
 */
async function fulfillIntent(
  intent: IntentWithPubkey,
  outputAmount: BN
): Promise<TransactionSignature> {
  try {
    console.log(`Attempting to fulfill intent ID: ${intent.account.intentId.toString()} for user ${intent.account.user.toBase58()}`);
    console.log(`  Input: ${intent.account.inputAmount.toString()} of ${intent.account.inputMint.toBase58()}`);
    console.log(`  Output: ${outputAmount.toString()} of ${intent.account.outputMint.toBase58()}`);
    console.log(`  Category: ${intent.account.category.toString()}`);

    // Derive the intent authority PDA (used for the delegated transfer)
    const [intentAuthorityPDA] = await PublicKey.findProgramAddress(
      [INTENT_AUTHORITY_SEED],
      program.programId
    );

    // Get user's token accounts
    const userInputTokenAccount: PublicKey = await getAssociatedTokenAddress(
      intent.account.inputMint,
      intent.account.user
    );
    const userOutputTokenAccount: PublicKey = await getAssociatedTokenAddress(
      intent.account.outputMint,
      intent.account.user
    );

    // Get solver's token accounts
    const solverInputTokenAccount: PublicKey = await getAssociatedTokenAddress(
      intent.account.inputMint,
      solverPublicKey
    );
    const solverOutputTokenAccount: PublicKey = await getAssociatedTokenAddress(
      intent.account.outputMint,
      solverPublicKey
    );

    console.log("Derived PDAs and ATAs:");
    console.log(`  Intent Authority PDA: ${intentAuthorityPDA.toBase58()}`);
    console.log(`  User Input ATA: ${userInputTokenAccount.toBase58()}`);
    console.log(`  User Output ATA: ${userOutputTokenAccount.toBase58()}`);
    console.log(`  Solver Input ATA: ${solverInputTokenAccount.toBase58()}`);
    console.log(`  Solver Output ATA: ${solverOutputTokenAccount.toBase58()}`);

    // Create and send the transaction using Anchor's rpc() method
    const signature: TransactionSignature = await program.methods.fulfillIntent(
      intent.account.intentId,
      outputAmount
    )
      .accounts({
        intent: intent.publicKey,
        user: intent.account.user,
        solver: solverPublicKey,
        intentAuthority: intentAuthorityPDA,
        userInputTokenAccount,
        userOutputTokenAccount,
        solverInputTokenAccount,
        solverOutputTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc({ commitment: 'confirmed' });

    console.log(`Intent ${intent.account.intentId.toString()} fulfilled! Transaction signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error(`Error fulfilling intent ${intent.account.intentId.toString()}:`, error);
    // Log specific details if available (e.g., AnchorError)
    if (error instanceof Error && 'logs' in error) {
      console.error("Transaction Logs:", (error as any).logs);
    }
    throw error; // Re-throw error to be caught by the main loop
  }
}

/**
 * Main function that runs the solver bot
 */
async function runSolverBot(): Promise<void> {
  console.log("Starting solver bot...");
  console.log(`Solver Public Key: ${solverPublicKey.toBase58()}`);

  // Initial check for SOL balance
  try {
    const balance = await connection.getBalance(solverPublicKey);
    console.log(`Solver SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      console.warn("Warning: Solver SOL balance is low. Transactions might fail.");
    }
  } catch (error) {
    console.error("Failed to fetch initial SOL balance:", error);
  }

  // Main loop
  while (true) {
    try {
      console.log("\n--- Scanning for intents ---");
      const availableIntents: IntentWithPubkey[] = await fetchAvailableIntents();

      if (availableIntents.length === 0) {
        console.log("No available intents found in this scan.");
      } else {
        console.log(`Processing ${availableIntents.length} available intents...`);
      }

      for (const intent of availableIntents) {
        console.log(`\nEvaluating intent ID: ${intent.account.intentId.toString()}`);
        try {
          // Check if we have the required output token
          const hasRequiredTokens = await checkOutputTokenBalance(intent);
          if (!hasRequiredTokens) {
            console.log(`Skipping intent ${intent.account.intentId.toString()} - insufficient output token balance.`);
            continue;
          }

          // Determine if this intent is profitable to fulfill
          const { isProfitable, profitableSendAmount } = await checkIfProfitable(intent);

          if (isProfitable && profitableSendAmount) {
            console.log(`Intent ${intent.account.intentId.toString()} deemed profitable.`);

            // Calculate minimum required output amount
            const minRequiredOutput = calculateMinimumOutputAmount(intent);

            // Ensure profitable amount meets minimum requirement
            if (profitableSendAmount.lt(minRequiredOutput)) {
              console.warn(`Profitable output ${profitableSendAmount.toString()} is LESS than minimum acceptable ${minRequiredOutput.toString()}. Skipping intent ${intent.account.intentId.toString()}.`);
              continue; // Skip this intent
            }

            console.log(`Attempting to fulfill intent ${intent.account.intentId.toString()} with output amount ${profitableSendAmount.toString()}`);
            await fulfillIntent(intent, profitableSendAmount);
            console.log(`Intent ${intent.account.intentId.toString()} fulfilled successfully!`);
            // Optional: Add a small delay after successful fulfillment
            await new Promise(resolve => setTimeout(resolve, 1000));

          } else {
            console.log(`Intent ${intent.account.intentId.toString()} skipped (not profitable).`);
          }
        } catch (error) {
          console.error(`Failed processing intent ${intent.account.intentId.toString()}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Wait before next scan
      const delaySeconds = 15;
      console.log(`\nScan complete. Waiting ${delaySeconds} seconds before next scan...`);
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

    } catch (error) {
      console.error("Error in main bot loop:", error instanceof Error ? error.message : String(error));
      // Wait longer on general loop errors
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay on error
    }
  }
}

/**
 * Check if solver has sufficient output token balance for the intent
 * @param intent The intent to check
 * @returns Promise<boolean> Whether solver has sufficient balance
 */
async function checkOutputTokenBalance(intent: IntentWithPubkey): Promise<boolean> {
  try {
    // Get solver's output token account
    const solverOutputAta = await getAssociatedTokenAddress(
      intent.account.outputMint,
      solverPublicKey
    );

    // Minimum output amount needed (for this example, using same calculation as minimum acceptable)
    const minOutputNeeded = calculateMinimumOutputAmount(intent);

    try {
      const balance = await connection.getTokenAccountBalance(solverOutputAta);
      const balanceAmount = new BN(balance.value.amount);

      if (balanceAmount.lt(minOutputNeeded)) {
        console.log(`Insufficient solver balance for output token. Have: ${balanceAmount.toString()}, Need: ${minOutputNeeded.toString()}`);
        return false;
      }
      return true;
    } catch (e) {
      console.log("Solver output token account does not exist or failed to fetch balance.");
      return false;
    }
  } catch (error) {
    console.error("Error checking output token balance:", error);
    return false;
  }
}

/**
 * Determines if fulfilling an intent would be profitable
 * @param intent The intent to check
 * @returns Promise<{isProfitable: boolean, profitableSendAmount?: BN}> Whether fulfilling the intent would be profitable and the amount to send
 */
async function checkIfProfitable(intent: IntentWithPubkey): Promise<{isProfitable: boolean, profitableSendAmount?: BN}> {
  try {
    // In a real implementation, you would:
    // 1. Query DEX for current market rate between inputMint and outputMint
    // 2. Calculate expected profit considering fees, slippage, etc.

    // For this example, simulate checking market rates
    const marketRateSim = await simulateMarketRate(
      intent.account.inputMint,
      intent.account.outputMint,
      intent.account.inputAmount
    );

    if (!marketRateSim.success) {
      console.log(`Failed to get market rate for intent ${intent.account.intentId.toString()}`);
      return { isProfitable: false };
    }

    // Calculate profitable amount to send to user
    // In this example: we take 5% as our fee
    const profitPercent = new BN(5);
    const totalExpectedOutput = marketRateSim.expectedOutputAmount;
    const ourFee = totalExpectedOutput.mul(profitPercent).div(new BN(100));
    const amountToSendUser = totalExpectedOutput.sub(ourFee);

    // Check if our profit percentage meets minimum threshold
    const actualProfitPercentage = ourFee.mul(new BN(100)).div(totalExpectedOutput);
    const isProfitable = actualProfitPercentage.gte(new BN(MIN_PROFIT_PERCENTAGE));

    console.log(`Market evaluation for intent ${intent.account.intentId.toString()}:`);
    console.log(`  Expected output for ${intent.account.inputAmount.toString()} input: ${totalExpectedOutput.toString()}`);
    console.log(`  Amount to send user: ${amountToSendUser.toString()}`);
    console.log(`  Our fee (${profitPercent.toString()}%): ${ourFee.toString()}`);
    console.log(`  Profit percentage: ${actualProfitPercentage.toString()}%`);
    console.log(`  Is profitable: ${isProfitable}`);

    return {
      isProfitable,
      profitableSendAmount: amountToSendUser
    };
  } catch (error) {
    console.error(`Error checking profitability for intent ${intent.account.intentId.toString()}:`, error);
    return { isProfitable: false };
  }
}

/**
 * Simulates getting market rate from a DEX (in real implementation, would call Jupiter API, etc.)
 * @param inputMint Input token mint
 * @param outputMint Output token mint
 * @param inputAmount Amount of input tokens
 * @returns Promise<{success: boolean, expectedOutputAmount?: BN}> Simulated market rate result
 */
async function simulateMarketRate(
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: BN
): Promise<{success: boolean, expectedOutputAmount?: BN}> {
  try {
    // In a real implementation, this would call Jupiter API or similar DEX aggregator
    // For simulation purposes, just use a simple rate calculation

    // Simple simulation - varies by token pair and adds some randomness
    // In real implementation, this would be a proper API call to get real market rates
    const baseRate = new BN(95); // 95% conversion rate base
    const randomVariance = Math.floor(Math.random() * 10); // 0-10 random variance
    const effectiveRate = baseRate.add(new BN(randomVariance));

    // Calculate expected output with the simulated rate
    const expectedOutput = inputAmount.mul(effectiveRate).div(new BN(100));

    console.log(`Simulated market rate check for ${inputMint.toBase58()} → ${outputMint.toBase58()}`);
    console.log(`  Input amount: ${inputAmount.toString()}`);
    console.log(`  Simulated rate: ${effectiveRate.toString()}%`);
    console.log(`  Expected output: ${expectedOutput.toString()}`);

    return {
      success: true,
      expectedOutputAmount: expectedOutput
    };
  } catch (error) {
    console.error("Error simulating market rate:", error);
    return { success: false };
  }
}

// --- Start the Bot ---
runSolverBot().catch((error: unknown) => {
  console.error("Fatal error encountered. Exiting.", error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
