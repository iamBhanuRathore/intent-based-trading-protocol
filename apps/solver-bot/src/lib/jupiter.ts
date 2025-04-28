// import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
// import type { TransactionSignature, Commitment } from "@solana/web3.js";
// import { Program, AnchorProvider, Wallet, BN, utils, ProgramError } from "@project-serum/anchor";
// import type { IdlAccounts, Idl } from "@project-serum/anchor";
// import {
// 	TOKEN_PROGRAM_ID,
// 	getAssociatedTokenAddress,
// 	AccountLayout, // Import AccountLayout for decoding token accounts
// } from "@solana/spl-token";
// // --- Utility: Import ProgramError if needed for parsing Anchor errors ---
// import { getJupiterQuote } from "./lib/utils";
// const {
// 	bytes: { bs58 },
// } = utils;

// // --- Environment Variable Validation ---
// const requiredEnvVars = ["SOLVER_BOT_PRIVATE_KEY", "SOLANA_CONTRACT_PUBLIC_KEY", "SOLANA_RPC_URL", "JUPITER_URL"];

// for (const varName of requiredEnvVars) {
// 	if (!process.env[varName]) {
// 		throw new Error(`Missing required environment variable: ${varName}`);
// 	}
// }

// // --- Type Definitions ---
// // Assuming your IDL file is correctly named and located
// import idl from "./idl.json"; // Adjust path if needed
// const IDL = idl as Idl;
// type IntentAccount = IdlAccounts<typeof IDL>["intent"]; // Adjust if your account name is different in IDL

// interface IntentWithPubkey {
// 	publicKey: PublicKey;
// 	account: IntentAccount;
// }

// // --- Constants and Configuration ---
// const PROGRAM_ID: PublicKey = new PublicKey(process.env.SOLANA_CONTRACT_PUBLIC_KEY!);
// const INTENT_AUTHORITY_SEED: Buffer = Buffer.from("intent_authority");
// const connection: Connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");

// // Define minimum acceptable profit percentage for the *solver*
// const MIN_SOLVER_PROFIT_PERCENTAGE = new BN(1); // Example: Solver wants at least 1% profit margin

// // --- Solver Wallet Setup ---
// let solverKeypair: Keypair;
// try {
// 	solverKeypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLVER_BOT_PRIVATE_KEY!));
// } catch (error) {
// 	console.error("Failed to decode SOLVER_BOT_PRIVATE_KEY. Ensure it's a valid base58 encoded private key.");
// 	throw error;
// }
// const solverPublicKey: PublicKey = solverKeypair.publicKey;
// const wallet = new Wallet(solverKeypair);

// // --- Anchor Setup ---
// const provider: AnchorProvider = new AnchorProvider(connection, wallet, {
// 	commitment: "confirmed" as Commitment,
// });

// // Initialize the program instance
// const program: Program<typeof IDL> = new Program(IDL, PROGRAM_ID, provider); // Use the imported IDL type

// // --- Calculate Offset for 'fulfilled' field based on the actual IDL structure ---
// // Re-calculate this carefully based on your FINAL `Intent` struct in Rust AND InitSpace usage
// // Discriminator (8) + user (32) + intent_id (8) + input_mint (32) + output_mint (32) +
// // input_amount (8) + category (8) + creation_ts (8) + Option<i64> expiry_ts (1+8=9)
// // = 8 + 32 + 8 + 32 + 32 + 8 + 8 + 8 + 9 = 145
// const FULFILLED_OFFSET = 145; // Adjust this based on your final struct layout!

// /**
//  * Fetches available intents that can be fulfilled
//  * @returns Promise<IntentWithPubkey[]> Array of available intents
//  */
// async function fetchAvailableIntents(): Promise<IntentWithPubkey[]> {
// 	try {
// 		console.log("Fetching intents...");

// 		// Calculate the expected size using the program's coder if available
// 		let intentAccountSize: number | undefined;
// 		try {
// 			intentAccountSize = program?.account?.intent?.size;
// 			console.log(`Expected Intent account size: ${intentAccountSize}`);
// 		} catch (e) {
// 			console.warn(
// 				"Could not determine intent account size from program coder. Falling back to manual calculation (ensure FULFILLED_OFFSET is correct)."
// 			);
// 			// You might need a fallback size if the above fails, e.g. based on InitSpace + 8 discriminator
// 			// intentAccountSize = 8 + 32 + 8 + 32 + 32 + 8 + 8 + 8 + 9 + 1 + 33 + 9 + 9 + 1; // Example manual calc
// 		}
// 		if (!intentAccountSize) {
// 			throw new Error("Cannot determine intent account size.");
// 		}

// 		// Get all program accounts of type Intent that are not fulfilled
// 		const accounts = await connection.getProgramAccounts(program.programId, {
// 			commitment: "confirmed",
// 			filters: [
// 				{ dataSize: intentAccountSize }, // Filter by size
// 				{
// 					memcmp: {
// 						offset: FULFILLED_OFFSET,
// 						bytes: bs58.encode(Buffer.from([0])), // Base58 encoded 'false' (0x00)
// 					},
// 				},
// 				// Optional: Filter by discriminator if needed (usually handled by Anchor's fetch methods)
// 				// { memcmp: { offset: 0, bytes: bs58.encode(program.account.intent.coder.sighash('intent')) } }
// 			],
// 		});

// 		console.log(`Found ${accounts.length} accounts matching size and fulfilled=false filter.`);

// 		const intents: IntentWithPubkey[] = [];
// 		for (const acc of accounts) {
// 			try {
// 				// Manually decode if program.account.intent.all() isn't used or reliable
// 				const decoded = program.coder.accounts.decode<IntentAccount>("Intent", acc.account.data);
// 				intents.push({ publicKey: acc.pubkey, account: decoded });
// 			} catch (decodeError) {
// 				console.warn(`Failed to decode account ${acc.pubkey.toBase58()}:`, decodeError);
// 			}
// 		}

// 		console.log(`Successfully decoded ${intents.length} potentially available intents (pre-filter).`);

// 		// Additional client-side filtering (e.g., expiry)
// 		const currentTime: number = Math.floor(Date.now() / 1000);
// 		const validIntents: IntentWithPubkey[] = intents.filter((intent) => {
// 			// Already filtered by memcmp, but double-check doesn't hurt
// 			if (intent.account.fulfilled) {
// 				// This shouldn't happen if memcmp filter worked
// 				console.log(`Intent ${intent.publicKey.toBase58()} skipped (already fulfilled - client filter).`);
// 				return false;
// 			}

// 			// Skip if expired (if expiryTs is set)
// 			if (intent.account.expiryTs && intent.account.expiryTs.lt(new BN(currentTime))) {
// 				// Use .lt() for BN comparison
// 				console.log(`Intent ${intent.publicKey.toBase58()} skipped (expired at ${intent.account.expiryTs.toString()}).`);
// 				return false;
// 			}

// 			// Add any other preliminary client-side filters here

// 			return true;
// 		});

// 		console.log(`Found ${validIntents.length} valid intents after filtering.`);
// 		return validIntents;
// 	} catch (error) {
// 		console.error("Error fetching intents:", error);
// 		return [];
// 	}
// }

// /**
//  * Checks if the user has delegated enough tokens to the intent authority PDA.
//  * @param intent The intent to check delegation for.
//  * @param intentAuthorityPDA The authority PDA address.
//  * @returns Promise<boolean> True if delegation is sufficient, false otherwise.
//  */
// async function checkUserDelegation(intent: IntentWithPubkey, intentAuthorityPDA: PublicKey): Promise<boolean> {
// 	try {
// 		const userInputTokenAccountPubkey = await getAssociatedTokenAddress(intent.account.inputMint, intent.account.user);
// 		const tokenAccountInfo = await connection.getAccountInfo(userInputTokenAccountPubkey);

// 		if (!tokenAccountInfo) {
// 			console.warn(
// 				`User input token account ${userInputTokenAccountPubkey.toBase58()} not found for intent ${intent.publicKey.toBase58()}.`
// 			);
// 			return false;
// 		}

// 		const accountData = AccountLayout.decode(tokenAccountInfo.data);

// 		if (!accountData.delegate || !accountData.delegate.equals(intentAuthorityPDA)) {
// 			console.log(
// 				`Delegation not set correctly for intent ${intent.publicKey.toBase58()}. Expected delegate: ${intentAuthorityPDA.toBase58()}, Found: ${
// 					accountData.delegate?.toBase58() || "None"
// 				}`
// 			);
// 			return false;
// 		}

// 		const delegatedAmount = new BN(accountData.delegatedAmount.toString()); // Convert Buffer to BN

// 		if (delegatedAmount.lt(intent.account.inputAmount)) {
// 			console.log(
// 				`Insufficient delegated amount for intent ${intent.publicKey.toBase58()}. Required: ${intent.account.inputAmount.toString()}, Delegated: ${delegatedAmount.toString()}`
// 			);
// 			return false;
// 		}

// 		console.log(`User delegation check passed for intent ${intent.publicKey.toBase58()}.`);
// 		return true;
// 	} catch (error) {
// 		console.error(`Error checking user delegation for intent ${intent.publicKey.toBase58()}:`, error);
// 		return false; // Assume failure on error
// 	}
// }

// /**
//  * Fulfills an intent by sending the transaction to the Solana program.
//  * @param intent The intent to fulfill.
//  * @param outputAmountToSendUser The exact amount of output tokens (as BN) to send to the user.
//  * @returns Promise<TransactionSignature | null> The signature of the fulfilled transaction, or null if it fails pre-flight.
//  */
// async function fulfillIntent(intent: IntentWithPubkey, outputAmountToSendUser: BN): Promise<TransactionSignature | null> {
// 	try {
// 		console.log(`\nAttempting to fulfill intent ${intent.publicKey.toBase58()} (ID: ${intent.account.intentId.toString()})`);
// 		console.log(`  User: ${intent.account.user.toBase58()}`);
// 		console.log(`  Input: ${intent.account.inputAmount.toString()} of ${intent.account.inputMint.toBase58()}`);
// 		console.log(`  Output to User: ${outputAmountToSendUser.toString()} of ${intent.account.outputMint.toBase58()}`);
// 		console.log(`  Category: ${intent.account.category.toString()}`);

// 		// Derive the intent authority PDA (used for the delegated transfer)
// 		const [intentAuthorityPDA, authorityBump] = PublicKey.findProgramAddressSync([INTENT_AUTHORITY_SEED], program.programId);
// 		console.log(`Derived Intent Authority PDA: ${intentAuthorityPDA.toBase58()} (Bump: ${authorityBump})`);

// 		// Pre-check: Verify user delegation (optional but recommended)
// 		const delegationOk = await checkUserDelegation(intent, intentAuthorityPDA);
// 		if (!delegationOk) {
// 			console.warn(`Skipping fulfillment for intent ${intent.publicKey.toBase58()} due to delegation issues.`);
// 			return null; // Don't proceed if delegation is wrong
// 		}

// 		// Get user's token accounts
// 		const userInputTokenAccount: PublicKey = await getAssociatedTokenAddress(intent.account.inputMint, intent.account.user);
// 		const userOutputTokenAccount: PublicKey = await getAssociatedTokenAddress(intent.account.outputMint, intent.account.user);

// 		// Get solver's token accounts
// 		const solverInputTokenAccount: PublicKey = await getAssociatedTokenAddress(intent.account.inputMint, solverPublicKey);
// 		const solverOutputTokenAccount: PublicKey = await getAssociatedTokenAddress(intent.account.outputMint, solverPublicKey);

// 		console.log("Derived ATAs:");
// 		console.log(`  User Input ATA: ${userInputTokenAccount.toBase58()}`);
// 		console.log(`  User Output ATA: ${userOutputTokenAccount.toBase58()}`);
// 		console.log(`  Solver Input ATA: ${solverInputTokenAccount.toBase58()}`);
// 		console.log(`  Solver Output ATA: ${solverOutputTokenAccount.toBase58()}`);

// 		// Ensure program methods are available
// 		if (!program.methods.fulfillIntent) {
// 			throw new Error("Program method 'fulfillIntent' not found. Check IDL or program initialization.");
// 		}

// 		console.log("Sending fulfillIntent transaction...");

// 		// Create and send the transaction using Anchor's methods builder
// 		const signature: TransactionSignature = await program.methods
// 			.fulfillIntent(intent.account.intentId, outputAmountToSendUser) // Pass intentId and the calculated output amount
// 			.accounts({
// 				intent: intent.publicKey, // The PDA address of the intent account
// 				user: intent.account.user, // The user who created the intent (must match intent.user)
// 				solver: solverPublicKey, // The solver executing the transaction (signer)
// 				intentAuthority: intentAuthorityPDA, // The PDA derived from seeds
// 				userInputTokenAccount: userInputTokenAccount,
// 				userOutputTokenAccount: userOutputTokenAccount,
// 				solverInputTokenAccount: solverInputTokenAccount,
// 				solverOutputTokenAccount: solverOutputTokenAccount,
// 				tokenProgram: TOKEN_PROGRAM_ID,
// 				systemProgram: SystemProgram.programId, // Needed potentially for rent exemption on account creation during CPI
// 			})
// 			// Optionally add compute unit limits if needed, especially when using Jupiter
// 			// .postInstructions([
// 			//     ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), // Example
// 			//     ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }), // Example
// 			// ])
// 			.rpc({ commitment: "confirmed", skipPreflight: false }); // Set skipPreflight to true if you encounter issues, but be cautious

// 		console.log(
// 			`✅ Intent ${intent.publicKey.toBase58()} (ID: ${intent.account.intentId.toString()}) fulfilled! Transaction signature: ${signature}`
// 		);
// 		return signature;
// 	} catch (error) {
// 		console.error(`❌ Error fulfilling intent ${intent.publicKey.toBase58()} (ID: ${intent.account.intentId.toString()}):`, error);
// 		// Log specific details if available (e.g., AnchorError, SolanaJSONRPCError)
// 		if (error instanceof Error) {
// 			console.error(`Error Name: ${error.name}`);
// 			console.error(`Error Message: ${error.message}`);
// 			if ("logs" in error && error.logs) {
// 				console.error("Transaction Logs:", error.logs);
// 			}
// 			// Try to parse AnchorError specifically
// 			// const anchorError = ProgramError.parse(error);
// 			const anchorError = error as ProgramError;
// 			if (anchorError) {
// 				console.error(`Anchor Error: ${anchorError?.msg} (Code: ${anchorError?.code})`);
// 				// Potentially log the specific file and line from anchorError.error.origin
// 			}
// 		}
// 		return null; // Indicate failure
// 	}
// }

// /**
//  * Main function that runs the solver bot
//  */
// async function runSolverBot(): Promise<void> {
// 	console.log("🚀 Starting solver bot...");
// 	console.log(`Solver Public Key: ${solverPublicKey.toBase58()}`);

// 	// Initial check for SOL balance
// 	try {
// 		const balance = await connection.getBalance(solverPublicKey);
// 		console.log(`Solver SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
// 		if (balance < 0.01 * LAMPORTS_PER_SOL) {
// 			// Adjust threshold as needed
// 			console.warn("⚠️ Warning: Solver SOL balance is low. Transactions might fail.");
// 		}
// 	} catch (error) {
// 		console.error("Failed to fetch initial SOL balance:", error);
// 	}

// 	// Main loop
// 	while (true) {
// 		try {
// 			console.log(`\n--- ${new Date().toISOString()} Scanning for intents ---`);
// 			const availableIntents: IntentWithPubkey[] = await fetchAvailableIntents();

// 			if (availableIntents.length === 0) {
// 				console.log("No available intents found in this scan.");
// 			} else {
// 				console.log(`Processing ${availableIntents.length} available intents...`);
// 			}
// 			for (const intent of availableIntents) {
// 				const intentIdStr = intent.publicKey.toBase58();
// 				console.log(`\n🔎 Evaluating intent ${intentIdStr} (ID: ${intent.account.intentId.toString()})`);
// 				try {
// 					// 1. Check Profitability (using placeholder/simulation for now)
// 					const { isProfitable, profitableSendAmount } = await checkIfProfitable(intent);
// 					if (!isProfitable || !profitableSendAmount) {
// 						console.log(`Intent ${intentIdStr} skipped (not profitable based on current evaluation).`);
// 						continue; // Move to the next intent
// 					}

// 					console.log(
// 						`Intent ${intentIdStr} deemed potentially profitable. Amount to send user: ${profitableSendAmount.toString()}`
// 					);

// 					// 2. Check if Solver has enough Output Tokens
// 					const hasRequiredTokens = await checkSolverOutputTokenBalance(intent, profitableSendAmount);
// 					if (!hasRequiredTokens) {
// 						console.log(`Skipping intent ${intentIdStr} - insufficient solver output token balance.`);
// 						continue; // Move to the next intent
// 					}

// 					// 3. Fulfill the Intent
// 					console.log(`Attempting fulfillment for intent ${intentIdStr}...`);
// 					const signature = await fulfillIntent(intent, profitableSendAmount);

// 					if (signature) {
// 						console.log(`Successfully submitted fulfillment for intent ${intentIdStr}.`);
// 						// Optional: Add a small delay after successful submission before processing next
// 						await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
// 					} else {
// 						console.log(`Failed to submit fulfillment for intent ${intentIdStr} (check logs for details).`);
// 						// Optional: Implement backoff or blacklist mechanism for persistently failing intents
// 					}
// 				} catch (processingError) {
// 					// Catch errors specific to processing a single intent
// 					console.error(
// 						`❗️ Failed processing intent ${intentIdStr}: ${
// 							processingError instanceof Error ? processingError.message : String(processingError)
// 						}`
// 					);
// 					// Log stack trace if available
// 					if (processingError instanceof Error && processingError.stack) {
// 						console.error(processingError.stack);
// 					}
// 				}
// 			} // End of intent loop

// 			// Wait before next scan
// 			const delaySeconds = 15; // Adjust as needed
// 			console.log(`\nScan complete. Waiting ${delaySeconds} seconds before next scan...`);
// 			await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
// 		} catch (loopError) {
// 			// Catch errors in the main loop (e.g., fetching intents failed)
// 			console.error("‼️ Error in main bot loop:", loopError instanceof Error ? loopError.message : String(loopError));
// 			if (loopError instanceof Error && loopError.stack) {
// 				console.error(loopError.stack);
// 			}
// 			// Wait longer on general loop errors before retrying
// 			await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 second delay
// 		}
// 	} // End of while(true)
// }

// /**
//  * Check if solver has sufficient output token balance for the intent.
//  * Checks against the *exact* amount needed.
//  * @param intent The intent to check
//  * @param amountNeeded The exact amount of output token the solver needs to send.
//  * @returns Promise<boolean> Whether solver has sufficient balance
//  */
// async function checkSolverOutputTokenBalance(intent: IntentWithPubkey, amountNeeded: BN): Promise<boolean> {
// 	if (amountNeeded.isNeg() || amountNeeded.isZero()) {
// 		console.warn(`checkSolverOutputTokenBalance called with zero or negative amountNeeded (${amountNeeded.toString()})`);
// 		return false; // Cannot send zero or negative tokens
// 	}
// 	try {
// 		// Get solver's output token account
// 		const solverOutputAta = await getAssociatedTokenAddress(intent.account.outputMint, solverPublicKey);

// 		try {
// 			const balanceResponse = await connection.getTokenAccountBalance(solverOutputAta);
// 			if (!balanceResponse?.value?.amount) {
// 				throw new Error("Invalid balance response");
// 			}
// 			const balanceAmount = new BN(balanceResponse.value.amount);

// 			if (balanceAmount.lt(amountNeeded)) {
// 				console.log(
// 					`Insufficient solver balance for output token ${intent.account.outputMint.toBase58()}. Have: ${balanceAmount.toString()}, Need: ${amountNeeded.toString()}`
// 				);
// 				return false;
// 			}
// 			console.log(
// 				`Solver balance check passed for output token ${intent.account.outputMint.toBase58()}. Have: ${balanceAmount.toString()}, Need: ${amountNeeded.toString()}`
// 			);
// 			return true;
// 		} catch (e: any) {
// 			// Handle cases where the account doesn't exist (error code -32602 usually contains 'could not find account')
// 			// or other RPC errors
// 			if (e.message?.includes("could not find account") || (e.code && e.code === -32602)) {
// 				console.log(`Solver output token account ${solverOutputAta.toBase58()} does not exist.`);
// 			} else {
// 				console.error(`Failed to fetch balance for ${solverOutputAta.toBase58()}:`, e);
// 			}
// 			return false; // Account doesn't exist or failed to fetch balance
// 		}
// 	} catch (error) {
// 		console.error("Error checking solver output token balance:", error);
// 		return false;
// 	}
// }

// // --- Profitability & Market Rate Simulation (PLACEHOLDER) ---
// // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// // !! IMPORTANT: Replace `simulateMarketRate` with actual Jupiter API calls !!
// // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// // Example using @jup-ag/api v6:
// // 1. Install: npm install @jup-ag/api cross-fetch
// // 2. Import: import { JupiterApi, RouteInfo } from '@jup-ag/api';
// // 3. Use: const jupiterApi = new JupiterApi({ connection });
// //         const routes = await jupiterApi.v6RoutesGet({ inputMint, outputMint, amount: inputAmount.toString(), slippage: 50 /* 0.5% */ });
// //         const bestRoute = routes.routesInfos[0]; // Example: pick best route
// //         const expectedOutAmount = new BN(bestRoute.outAmount); // Use the actual amount from the API
// // Read Jupiter API docs for details: https://docs.jup.ag/

// /**
//  * Determines if fulfilling an intent would be profitable FOR THE SOLVER.
//  * **Uses a PLACEHOLDER simulation.** Replace with real DEX/Aggregator calls.
//  * @param intent The intent to check
//  * @returns Promise<{isProfitable: boolean, profitableSendAmount?: BN}> Whether fulfilling the intent is profitable and the amount to send the user.
//  */
// async function checkIfProfitable(intent: IntentWithPubkey): Promise<{ isProfitable: boolean; profitableSendAmount?: BN }> {
// 	const intentIdStr = intent.publicKey.toBase58();
// 	try {
// 		console.log(`Evaluating profitability for intent ${intentIdStr} (Simulation)`);
// 		const marketRateSim = await getJupiterQuote(
// 			intent.account.inputMint.toBase58(),
// 			intent.account.outputMint.toBase58(),
// 			intent.account.inputAmount.toNumber()
// 		);
// 		if (!marketRateSim) {
// 			return {
// 				isProfitable: false,
// 			};
// 		}
// 		if ( !marketRateSim.) {
// 			console.log(`Failed to get simulated market rate for intent ${intentIdStr}`);
// 			return { isProfitable: false };
// 		}
// 		const totalExpectedOutput = marketRateSim.expectedTotalOutputAmount;
// 		// --- !!! END OF REPLACEMENT SECTION !!! ---

// 		// Calculate solver's profit based on the *total output* generated by the swap
// 		// Solver keeps the difference between total output and amount sent to user.
// 		// Example: Solver aims for a 5% profit margin on the *total output*.
// 		const solverProfitPercent = new BN(5); // Example: 5% desired profit margin
// 		const oneHundred = new BN(100);

// 		// Calculate the maximum amount the solver is WILLING to send the user to achieve their profit margin
// 		// amountToSendUser = totalExpectedOutput * (100 - solverProfitPercent) / 100
// 		const amountToSendUserMax = totalExpectedOutput.mul(oneHundred.sub(solverProfitPercent)).div(oneHundred);

// 		// Calculate the actual profit the solver would make with this amount
// 		const solverProfitActual = totalExpectedOutput.sub(amountToSendUserMax);

// 		// Check if this profit meets the *minimum* required profit percentage
// 		const actualProfitPercentage = solverProfitActual.mul(oneHundred).div(totalExpectedOutput); // Profit % relative to total output

// 		const meetsMinProfitRequirement = actualProfitPercentage.gte(MIN_SOLVER_PROFIT_PERCENTAGE);

// 		console.log(`Market evaluation for intent ${intentIdStr}:`);
// 		console.log(`  Input Amount: ${intent.account.inputAmount.toString()} (${intent.account.inputMint.toBase58()})`);
// 		console.log(`  Simulated Total Output: ${totalExpectedOutput.toString()} (${intent.account.outputMint.toBase58()})`);
// 		console.log(`  Max Amount to Send User (for ${solverProfitPercent}% target): ${amountToSendUserMax.toString()}`);
// 		console.log(`  Solver's Actual Profit: ${solverProfitActual.toString()}`);
// 		console.log(`  Actual Profit Percentage: ${actualProfitPercentage.toString()}%`);
// 		console.log(`  Meets Min Profit Requirement (${MIN_SOLVER_PROFIT_PERCENTAGE}%): ${meetsMinProfitRequirement}`);

// 		if (meetsMinProfitRequirement && amountToSendUserMax.gt(new BN(0))) {
// 			// We are profitable AND the amount to send is positive
// 			return {
// 				isProfitable: true,
// 				profitableSendAmount: amountToSendUserMax, // Send this calculated amount
// 			};
// 		} else {
// 			// Not profitable enough or calculation resulted in zero/negative send amount
// 			return { isProfitable: false };
// 		}
// 	} catch (error) {
// 		console.error(`Error checking profitability for intent ${intentIdStr}:`, error);
// 		return { isProfitable: false };
// 	}
// }

// /**
//  * **PLACEHOLDER:** Simulates getting market rate from a DEX.
//  * Replace with actual Jupiter API calls.
//  * @param inputMint Input token mint
//  * @param outputMint Output token mint
//  * @param inputAmount Amount of input tokens
//  * @returns Promise<{success: boolean, expectedTotalOutputAmount?: BN}> Simulated market rate result
//  */
// async function simulateMarketRate(
// 	inputMint: PublicKey,
// 	outputMint: PublicKey,
// 	inputAmount: BN
// ): Promise<{ success: boolean; expectedTotalOutputAmount?: BN }> {
// 	// In a real implementation, call Jupiter API /quote endpoint
// 	console.log(`--- SIMULATING Market Rate: ${inputMint.toBase58()} → ${outputMint.toBase58()} ---`);
// 	if (inputAmount.isZero()) return { success: true, expectedTotalOutputAmount: new BN(0) };

// 	try {
// 		// Simulate a vaguely realistic swap rate (e.g., 90-99% efficiency)
// 		const baseRate = new BN(90); // 90% base
// 		const randomVariance = Math.floor(Math.random() * 10); // 0-9% random variance
// 		const effectiveRate = baseRate.add(new BN(randomVariance)); // Rate between 90-99%

// 		const expectedOutput = inputAmount.mul(effectiveRate).div(new BN(100));

// 		console.log(`  Simulated Input amount: ${inputAmount.toString()}`);
// 		console.log(`  Simulated Effective Rate: ${effectiveRate.toString()}%`);
// 		console.log(`  Simulated Expected Total Output: ${expectedOutput.toString()}`);
// 		console.log(`--- END SIMULATION ---`);

// 		await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate network delay

// 		return {
// 			success: true,
// 			expectedTotalOutputAmount: expectedOutput,
// 		};
// 	} catch (error) {
// 		console.error("Error simulating market rate:", error);
// 		return { success: false };
// 	}
// }

// // --- Start the Bot ---
// runSolverBot().catch((error: unknown) => {
// 	console.error("💥 Fatal error encountered in solver bot. Exiting.", error instanceof Error ? error.message : String(error));
// 	if (error instanceof Error && error.stack) {
// 		console.error(error.stack);
// 	}
// 	process.exit(1);
// });
