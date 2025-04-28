// solver.ts (or your main bot file)
import {
	Connection,
	PublicKey,
	Keypair,
	SystemProgram,
	// LAMPORTS_PER_SOL,
	Transaction,
	// TransactionInstruction, // Import TransactionInstruction
	// ComputeBudgetProgram // Import if adding compute budget manually later
} from "@solana/web3.js";
import type { TransactionSignature, Commitment } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN, utils, ProgramError } from "@project-serum/anchor";
import type { IdlAccounts, Idl } from "@project-serum/anchor";
import {
	TOKEN_PROGRAM_ID,
	getAssociatedTokenAddress,
	AccountLayout,
	// getMint // Already imported in utils
} from "@solana/spl-token";
// Import Jupiter API utilities
import { getJupiterQuote, getJupiterSwapInstructions, deserializeJupiterInstructions } from "./lib/utils"; // Adjust path
import type { QuoteResponse } from "@jup-ag/api"; // Import type

const {
	bytes: { bs58 },
} = utils;

// --- Environment Variable Validation --- (Keep as is)
// --- Environment Variable Validation ---
const requiredEnvVars = ["SOLVER_BOT_PRIVATE_KEY", "SOLANA_CONTRACT_PUBLIC_KEY", "SOLANA_RPC_URL", "JUPITER_URL"];

for (const varName of requiredEnvVars) {
	if (!process.env[varName]) {
		throw new Error(`Missing required environment variable: ${varName}`);
	}
}

// --- Type Definitions --- (Keep as is)
import idl from "./idl.json";
const IDL = idl as Idl;
type IntentAccount = IdlAccounts<typeof IDL>["intent"];
interface IntentWithPubkey {
	publicKey: PublicKey;
	account: IntentAccount;
}

// --- Constants and Configuration --- (Keep as is)
const PROGRAM_ID: PublicKey = new PublicKey(process.env.SOLANA_CONTRACT_PUBLIC_KEY!);
const INTENT_AUTHORITY_SEED: Buffer = Buffer.from("intent_authority");
const connection: Connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
const MIN_SOLVER_PROFIT_PERCENTAGE = new BN(1); // Example: Solver wants at least 1% profit margin
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
const provider: AnchorProvider = new AnchorProvider(connection, wallet, {
	commitment: "confirmed" as Commitment,
});
const program: Program<typeof IDL> = new Program(IDL, PROGRAM_ID, provider); // Use the imported IDL type
// --- Calculate Offset --- (Keep as is, VERIFY THIS VALUE)
const FULFILLED_OFFSET = 145;

// --- fetchAvailableIntents Function --- (Keep as is)
async function fetchAvailableIntents(): Promise<IntentWithPubkey[]> {
	// ... (implementation remains the same)
	try {
		console.log("Fetching intents...");

		// Calculate the expected size using the program's coder if available
		let intentAccountSize: number | undefined;
		try {
			intentAccountSize = program?.account?.intent?.size;
			console.log(`Expected Intent account size: ${intentAccountSize}`);
		} catch (e) {
			console.warn(
				"Could not determine intent account size from program coder. Falling back to manual calculation (ensure FULFILLED_OFFSET is correct)."
			);
			// You might need a fallback size if the above fails, e.g. based on InitSpace + 8 discriminator
			// intentAccountSize = 8 + 32 + 8 + 32 + 32 + 8 + 8 + 8 + 9 + 1 + 33 + 9 + 9 + 1; // Example manual calc
		}
		if (!intentAccountSize) {
			throw new Error("Cannot determine intent account size.");
		}

		// Get all program accounts of type Intent that are not fulfilled
		const accounts = await connection.getProgramAccounts(program.programId, {
			commitment: "confirmed",
			filters: [
				{ dataSize: intentAccountSize }, // Filter by size
				{
					memcmp: {
						offset: FULFILLED_OFFSET,
						bytes: bs58.encode(Buffer.from([0])), // Base58 encoded 'false' (0x00)
					},
				},
				// Optional: Filter by discriminator if needed (usually handled by Anchor's fetch methods)
				// { memcmp: { offset: 0, bytes: bs58.encode(program.account.intent.coder.sighash('intent')) } }
			],
		});

		console.log(`Found ${accounts.length} accounts matching size and fulfilled=false filter.`);

		const intents: IntentWithPubkey[] = [];
		for (const acc of accounts) {
			try {
				// Manually decode if program.account.intent.all() isn't used or reliable
				const decoded = program.coder.accounts.decode<IntentAccount>("Intent", acc.account.data);
				intents.push({ publicKey: acc.pubkey, account: decoded });
			} catch (decodeError) {
				console.warn(`Failed to decode account ${acc.pubkey.toBase58()}:`, decodeError);
			}
		}

		console.log(`Successfully decoded ${intents.length} potentially available intents (pre-filter).`);

		// Additional client-side filtering (e.g., expiry)
		const currentTime: number = Math.floor(Date.now() / 1000);
		const validIntents: IntentWithPubkey[] = intents.filter((intent) => {
			// Already filtered by memcmp, but double-check doesn't hurt
			if (intent.account.fulfilled) {
				// This shouldn't happen if memcmp filter worked
				console.log(`Intent ${intent.publicKey.toBase58()} skipped (already fulfilled - client filter).`);
				return false;
			}

			// Skip if expired (if expiryTs is set)
			if (intent.account.expiryTs && intent.account.expiryTs.lt(new BN(currentTime))) {
				// Use .lt() for BN comparison
				console.log(`Intent ${intent.publicKey.toBase58()} skipped (expired at ${intent.account.expiryTs.toString()}).`);
				return false;
			}

			// Add any other preliminary client-side filters here

			return true;
		});

		console.log(`Found ${validIntents.length} valid intents after filtering.`);
		return validIntents;
	} catch (error) {
		console.error("Error fetching intents:", error);
		return [];
	}
}
// --- checkUserDelegation Function --- (Keep as is)
async function checkUserDelegation(intent: IntentWithPubkey, intentAuthorityPDA: PublicKey): Promise<boolean> {
	// ... (implementation remains the same)
	try {
		const userInputTokenAccountPubkey = await getAssociatedTokenAddress(intent.account.inputMint, intent.account.user);
		const tokenAccountInfo = await connection.getAccountInfo(userInputTokenAccountPubkey);

		if (!tokenAccountInfo) {
			console.warn(
				`User input token account ${userInputTokenAccountPubkey.toBase58()} not found for intent ${intent.publicKey.toBase58()}.`
			);
			return false;
		}

		const accountData = AccountLayout.decode(tokenAccountInfo.data);

		if (!accountData.delegate || !accountData.delegate.equals(intentAuthorityPDA)) {
			console.log(
				`Delegation not set correctly for intent ${intent.publicKey.toBase58()}. Expected delegate: ${intentAuthorityPDA.toBase58()}, Found: ${
					accountData.delegate?.toBase58() || "None"
				}`
			);
			return false;
		}

		const delegatedAmount = new BN(accountData.delegatedAmount.toString()); // Convert Buffer to BN

		if (delegatedAmount.lt(intent.account.inputAmount)) {
			console.log(
				`Insufficient delegated amount for intent ${intent.publicKey.toBase58()}. Required: ${intent.account.inputAmount.toString()}, Delegated: ${delegatedAmount.toString()}`
			);
			return false;
		}

		console.log(`User delegation check passed for intent ${intent.publicKey.toBase58()}.`);
		return true;
	} catch (error) {
		console.error(`Error checking user delegation for intent ${intent.publicKey.toBase58()}:`, error);
		return false; // Assume failure on error
	}
}

/**
 * Evaluates an intent using Jupiter quotes to determine if it's processable and profitable.
 * @param intent The intent to evaluate.
 * @returns Promise describing processability, profitability, quote, and amount to send user.
 */
async function evaluateIntentWithJupiter(intent: IntentWithPubkey): Promise<{
	processable: boolean;
	isProfitable?: boolean;
	quoteResponse?: QuoteResponse;
	profitableSendAmount?: BN;
}> {
	const intentIdStr = intent.publicKey.toBase58();
	try {
		console.log(`Evaluating intent ${intentIdStr} with Jupiter...`);

		// 1. Get Jupiter Quote
		const quoteResponse = await getJupiterQuote(
			intent.account.inputMint.toBase58(),
			intent.account.outputMint.toBase58(),
			intent.account.inputAmount.toString(), // Pass BN as string or ensure conversion
			connection, // Pass connection for fetching decimals
			wallet
		);

		if (!quoteResponse) {
			console.log(`Could not get Jupiter quote for intent ${intentIdStr}.`);
			return { processable: false }; // Cannot process without a quote
		}
		
		// Use outAmount from the quote (amount AFTER swap, before fees/slippage considered here)
		const totalExpectedOutput = new BN(quoteResponse.outAmount); // outAmount is string in smallest unit

		if (totalExpectedOutput.isZero() || totalExpectedOutput.isNeg()) {
			console.log(`Jupiter quote resulted in zero or negative output for intent ${intentIdStr}.`);
			return { processable: true, isProfitable: false, quoteResponse }; // Processable but not profitable
		}

		// 2. Calculate Profitability
		const oneHundred = new BN(100);
		// Calculate the maximum amount the solver is WILLING to send the user
		// to achieve their minimum profit margin on the *total output*.
		// amountToSendUser = totalExpectedOutput * (100 - MIN_SOLVER_PROFIT_PERCENTAGE) / 100
		const amountToSendUserMax = totalExpectedOutput.mul(oneHundred.sub(MIN_SOLVER_PROFIT_PERCENTAGE)).div(oneHundred);

		// Ensure the amount to send is positive
		if (amountToSendUserMax.isNeg() || amountToSendUserMax.isZero()) {
			console.log(`Calculated amount to send user is zero or negative for intent ${intentIdStr}.`);
			return { processable: true, isProfitable: false, quoteResponse };
		}

		// Calculate the actual profit the solver would make with this amount
		const solverProfitActual = totalExpectedOutput.sub(amountToSendUserMax);
		// Simple check: is profit > 0? More complex checks could be added.
		const meetsMinProfitRequirement = solverProfitActual.gt(new BN(0)); // Basic check

		console.log(`Jupiter evaluation for intent ${intentIdStr}:`);
		console.log(`  Input Amount: ${intent.account.inputAmount.toString()} (${intent.account.inputMint.toBase58()})`);
		console.log(`  Jupiter Estimated Output: ${totalExpectedOutput.toString()} (${intent.account.outputMint.toBase58()})`);
		console.log(`  Max Amount to Send User (for ${MIN_SOLVER_PROFIT_PERCENTAGE}% target): ${amountToSendUserMax.toString()}`);
		console.log(`  Solver's Estimated Profit: ${solverProfitActual.toString()}`);
		console.log(`  Meets Min Profit Requirement (>0): ${meetsMinProfitRequirement}`);

		if (meetsMinProfitRequirement) {
			return {
				processable: true,
				isProfitable: true,
				quoteResponse: quoteResponse,
				profitableSendAmount: amountToSendUserMax,
			};
		} else {
			return { processable: true, isProfitable: false, quoteResponse };
		}
	} catch (error) {
		console.error(`Error evaluating profitability for intent ${intentIdStr}:`, error);
		return { processable: false }; // Mark as unprocessable on error
	}
}

/**
 * Builds and sends the transaction containing Jupiter swap instructions
 * and the fulfillIntent instruction.
 * @param intent The intent to fulfill.
 * @param quoteResponse The Jupiter quote response used for evaluation.
 * @param outputAmountToSendUser The exact amount to send to the user.
 * @returns Promise<TransactionSignature | null> The signature or null on failure.
 */
async function buildAndSendFulfillTransaction(
	intent: IntentWithPubkey,
	quoteResponse: QuoteResponse,
	outputAmountToSendUser: BN
): Promise<TransactionSignature | null> {
	const intentIdStr = intent.publicKey.toBase58();
	try {
		console.log(`\n🏗️ Building transaction for intent ${intentIdStr}...`);

		// 1. Get Jupiter Swap Instructions
		const swapInstructionsResponse = await getJupiterSwapInstructions(quoteResponse, solverPublicKey);
		if (!swapInstructionsResponse) {
			console.error(`Failed to get Jupiter swap instructions for intent ${intentIdStr}.`);
			return null;
		}
		if (!program.methods.fulfillIntent) {
			throw new Error("Program method 'fulfillIntent' not found. Check IDL or program initialization.");
		}
		// 2. Deserialize Jupiter Instructions
		const jupiterInstructions = deserializeJupiterInstructions(swapInstructionsResponse);
		if (jupiterInstructions.length === 0) {
			console.error(`No Jupiter instructions were deserialized for intent ${intentIdStr}.`);
			// This might happen if only compute budget was returned, check Jupiter response
			// For now, let's assume we need at least a swap instruction.
			return null;
		}
		console.log(`Deserialized ${jupiterInstructions.length} instructions from Jupiter.`);

		// 3. Prepare fulfillIntent Instruction
		const [intentAuthorityPDA] = PublicKey.findProgramAddressSync([INTENT_AUTHORITY_SEED], program.programId);
		const userInputTokenAccount = await getAssociatedTokenAddress(intent.account.inputMint, intent.account.user);
		const userOutputTokenAccount = await getAssociatedTokenAddress(intent.account.outputMint, intent.account.user);
		const solverInputTokenAccount = await getAssociatedTokenAddress(intent.account.inputMint, solverPublicKey); // Where solver receives user input
		const solverOutputTokenAccount = await getAssociatedTokenAddress(intent.account.outputMint, solverPublicKey); // Where solver sends output from

		const fulfillAccounts = {
			intent: intent.publicKey,
			user: intent.account.user,
			solver: solverPublicKey,
			intentAuthority: intentAuthorityPDA,
			userInputTokenAccount: userInputTokenAccount,
			userOutputTokenAccount: userOutputTokenAccount,
			solverInputTokenAccount: solverInputTokenAccount,
			solverOutputTokenAccount: solverOutputTokenAccount,
			tokenProgram: TOKEN_PROGRAM_ID,
			systemProgram: SystemProgram.programId,
		};

		const fulfillInstruction = await program.methods
			.fulfillIntent(intent.account.intentId, outputAmountToSendUser)
			.accounts(fulfillAccounts)
			.instruction(); // Get the instruction object

		// 4. Build the Transaction
		// Decide Transaction Type (Legacy or Versioned)
		// For simplicity, we use Legacy here. For Versioned, you'd use Address Lookup Tables
		// provided in swapInstructionsResponse.addressLookupTableAddresses
		const transaction = new Transaction();

		// Add Instructions in Order: Jupiter -> fulfillIntent
		jupiterInstructions.forEach((instruction) => transaction.add(instruction));
		transaction.add(fulfillInstruction);

		// Set Fee Payer and Recent Blockhash
		transaction.feePayer = solverPublicKey;
		transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

		// 5. Simulate Transaction (Highly Recommended!)
		console.log(`Simulating transaction for intent ${intentIdStr}...`);
		try {
			const simulationResult = await connection.simulateTransaction(transaction, [solverKeypair] /* Signers */);
			if (simulationResult.value.err) {
				// Inside catch block for simulation failure in buildAndSendFulfillTransaction
				console.error(`Simulation failed for intent ${intentIdStr}:`, simulationResult.value.err);
				console.error("Simulation Logs:", simulationResult.value.logs);
				// Attempt to parse Anchor error (Example, may need adjustment based on Anchor version/setup)
				if (simulationResult.value.err && simulationResult.value.logs) {
					try {
						const anchorError = ProgramError.parse(
							simulationResult.value.err, // Pass the error object
							// Create a map from Anchor error codes to messages if possible (often from IDL)
							// Or rely on Anchor's default parsing if available in your version
							new Map<number, string>() // Placeholder: Populate this if needed
						);
						if (anchorError) {
							console.error(`Parsed Anchor Error: ${anchorError.msg} (Code: ${anchorError.code})`);
						} else {
							console.error("Could not parse Anchor error from logs.");
						}
					} catch (parseError) {
						console.error("Error attempting to parse Anchor error:", parseError);
					}
				}
				return null; // Don't send if simulation fails
			} else {
				console.log("Transaction simulation successful.");
				// console.log("Simulation Logs:", simulationResult.value.logs); // Uncomment for detailed logs
			}
		} catch (simError) {
			console.error(`Error during simulation for intent ${intentIdStr}:`, simError);
			return null;
		}

		// 6. Sign and Send Transaction
		console.log(`Sending transaction for intent ${intentIdStr}...`);
		// Sign with the solver's keypair
		// Note: signTransaction is usually for client-side wallets. For backend, sign directly.
		// The Anchor provider handles signing when using .rpc(), but here we build manually.
		transaction.sign(solverKeypair); // Sign with the actual keypair

		// Send raw transaction
		const rawTransaction = transaction.serialize();
		const signature = await connection.sendRawTransaction(rawTransaction, {
			skipPreflight: false, // Keep preflight enabled unless debugging specific issues
			preflightCommitment: "confirmed",
		});

		// 7. Confirm Transaction
		console.log(`Transaction sent with signature: ${signature}. Confirming...`);
		const confirmation = await connection.confirmTransaction(
			{
				signature: signature,
				blockhash: transaction.recentBlockhash,
				lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
			},
			"confirmed"
		);

		if (confirmation.value.err) {
			console.error(`Transaction confirmation failed for intent ${intentIdStr}:`, confirmation.value.err);
			// Consider fetching transaction details for more info if needed
			return null;
		}

		console.log(`✅ Intent ${intentIdStr} (ID: ${intent.account.intentId.toString()}) fulfilled! Transaction confirmed: ${signature}`);
		return signature;
	} catch (error) {
		console.error(`❌ Error building/sending transaction for intent ${intentIdStr}:`, error);
		if (error instanceof Error) {
			console.error(`Error Name: ${error.name}`);
			console.error(`Error Message: ${error.message}`);
			if ("logs" in error && error.logs) {
				console.error("Transaction Logs:", error.logs);
			}
			const anchorError = error as ProgramError;
			if (anchorError?.code) {
				console.error(`Anchor Error: ${anchorError.msg} (Code: ${anchorError.code})`);
			}
		}
		return null;
	}
}

// --- Main Bot Loop (`runSolverBot`) ---
async function runSolverBot(): Promise<void> {
	console.log("🚀 Starting solver bot with Jupiter integration...");
	console.log(`Solver Public Key: ${solverPublicKey.toBase58()}`);
	// ... (Initial balance check remains the same) ...

	while (true) {
		try {
			console.log(`\n--- ${new Date().toISOString()} Scanning for intents ---`);
			const availableIntents: IntentWithPubkey[] = await fetchAvailableIntents();

			if (availableIntents.length === 0) {
				console.log("No available intents found in this scan.");
			} else {
				console.log(`Processing ${availableIntents.length} available intents...`);
			}

			for (const intent of availableIntents) {
				const intentIdStr = intent.publicKey.toBase58();
				// console.log(
				// 	`\n🔎 Evaluating intent ${intentIdStr} (creation Ts:${intent.account.creationTs} -  ${new Date(intent.account.creationTs * 1000)})`
				// );
				// Ts: 1745265510;
				// console.log(`\n🔎 Evaluating intent ${intentIdStr} (ID: ${intent.account.creationTs}),intent: ${JSON.stringify(intent)}`);
				// continue;
				if (intent.account.creationTs < 1745353940) {
					// console.log(`Skipping intent ${intentIdStr} (creation Ts:${intent.account.creationTs})`);
					console.log(`-------------------------`);
					continue;
				}
				try {
					// 1. Check Delegation (Pre-computation check)
					const [intentAuthorityPDA] = PublicKey.findProgramAddressSync([INTENT_AUTHORITY_SEED], program.programId);
					const delegationOk = await checkUserDelegation(intent, intentAuthorityPDA);
					if (!delegationOk) {
						console.warn(`Skipping intent ${intentIdStr} due to delegation issues.`);
						continue; // Move to the next intent
					}

					// 2. Evaluate with Jupiter
					const evaluation = await evaluateIntentWithJupiter(intent);

					if (!evaluation.processable) {
						console.log(`Intent ${intentIdStr} skipped (not processable by Jupiter or error).`);
						continue;
					}
					if (!evaluation.isProfitable || !evaluation.quoteResponse || !evaluation.profitableSendAmount) {
						console.log(`Intent ${intentIdStr} skipped (not profitable based on Jupiter quote).`);
						continue;
					}

					console.log(
						`Intent ${intentIdStr} deemed profitable. Amount to send user: ${evaluation.profitableSendAmount.toString()}`
					);

					// 3. Fulfill the Intent (Build, Simulate, Send)
					console.log(`Attempting fulfillment for intent ${intentIdStr}...`);
					const signature = await buildAndSendFulfillTransaction(
						intent,
						evaluation.quoteResponse,
						evaluation.profitableSendAmount
					);

					if (signature) {
						console.log(`Successfully submitted fulfillment for intent ${intentIdStr}.`);
						await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay
					} else {
						console.log(`Failed to submit fulfillment for intent ${intentIdStr} (check logs).`);
					}
				} catch (processingError) {
					console.error(
						`❗️ Failed processing intent ${intentIdStr}: ${
							processingError instanceof Error ? processingError.message : String(processingError)
						}`
					);
					if (processingError instanceof Error && processingError.stack) {
						console.error(processingError.stack);
					}
				}
			} // End of intent loop

			// Wait before next scan
			const delaySeconds = 15;
			console.log(`\nScan complete. Waiting ${delaySeconds} seconds before next scan...`);
			await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
		} catch (loopError) {
			console.error("‼️ Error in main bot loop:", loopError instanceof Error ? loopError.message : String(loopError));
			if (loopError instanceof Error && loopError.stack) {
				console.error(loopError.stack);
			}
			await new Promise((resolve) => setTimeout(resolve, 30000)); // Longer delay on loop error
		}
	} // End of while(true)
}

// --- REMOVED `checkSolverOutputTokenBalance` ---
// The atomic transaction handles the flow, making this check less critical beforehand.
// Ensure the solver has *some* necessary base tokens (e.g., SOL for gas, maybe some USDC if initiating swaps)
// But checking the exact output amount isn't needed *before* the combined TX.

// --- REMOVED `simulateMarketRate` --- (Replaced by actual Jupiter calls)

// --- Start the Bot --- (Keep as is)
runSolverBot().catch((error: unknown) => {
	console.error("💥 Fatal error encountered in solver bot. Exiting.", error instanceof Error ? error.message : String(error));
	if (error instanceof Error && error.stack) {
		console.error(error.stack);
	}
	process.exit(1);
});
