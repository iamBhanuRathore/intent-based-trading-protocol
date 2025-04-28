import {
	Connection,
	Keypair,
	PublicKey,
	Transaction,
	TransactionInstruction,
	VersionedTransaction,
	//  Transaction, VersionedTransaction
} from "@solana/web3.js";
import {
	createJupiterApiClient,
	Configuration,
	SwapApi,
	type QuoteResponse,
	type SwapInstructionsResponse,
	type Instruction,
	type SwapResponse,
} from "@jup-ag/api";
import {
	//  TOKEN_PROGRAM_ID,
	getMint,
} from "@solana/spl-token"; // Need getMint for decimals
import type { Wallet } from "@project-serum/anchor";

// Initialize Jupiter Client (do this once)
const jupiterApi = createJupiterApiClient({
	basePath: "https://lite-api.jup.ag/swap/v1",
	// basePath: "https://quote-api.jup.ag/v6",
});
/**
 * Fetches a quote from the Jupiter API.
 * @param inputMintStr Address of the input token mint.
 * @param outputMintStr Address of the output token mint.
 * @param amountInSmallestUnit Amount of input tokens in the smallest unit (e.g., lamports).
 * @param connection Solana connection object to fetch decimals.
 * @returns Promise<QuoteResponse | null> The Jupiter quote response or null on error.
 */
export const getJupiterQuote = async (
	inputMintStr: string,
	outputMintStr: string,
	amountInSmallestUnit: number | string | bigint, // Accept number/string/bigint
	connection: Connection,
	wallet: Wallet
): Promise<QuoteResponse | null> => {
	console.log(`Getting Jupiter quote for ${inputMintStr} -> ${outputMintStr} (Amount: ${amountInSmallestUnit.toString()})`);
	try {
		// Jupiter API expects amount in UI units, so we need decimals
		const inputMintInfo = await getMint(connection, new PublicKey(inputMintStr));
		const amountInBaseUnits = BigInt(amountInSmallestUnit); // Ensure it's BigInt
		const amount = Number(amountInBaseUnits) / 10 ** inputMintInfo.decimals; // Convert to float for API

		if (amount <= 0) {
			console.warn("Input amount is zero or negative, skipping Jupiter quote.");
			return null;
		}
		// Note: Jupiter amount is in float units, not smallest units
		const quoteResponse = await jupiterApi.quoteGet({
			inputMint: inputMintStr,
			outputMint: outputMintStr,
			amount: Number(amountInBaseUnits), // In Lamports or smallest units
			// Optional: Add slippage, platform fee, etc.
			slippageBps: 100, // Example: 1% slippage
			restrictIntermediateTokens: true,
			// onlyDirectRoutes: false, // Consider performance vs best price
			// asLegacyTransaction: true, // Request instructions for legacy Transaction if needed
		});
		console.log(quoteResponse);

		if (!quoteResponse) {
			console.warn("No quote received from Jupiter.");
			return null;
		}

		// Signing the transanction as well in here only
		console.log(`Signing the transaction as well in here only`);
		const apiCall = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				quoteResponse,
				userPublicKey: wallet.publicKey.toString(),
				// ADDITIONAL PARAMETERS TO OPTIMIZE FOR TRANSACTION LANDING
				// See next guide to optimize for transaction landing
				dynamicComputeUnitLimit: true,
				dynamicSlippage: true,
				prioritizationFeeLamports: {
					priorityLevelWithMaxLamports: {
						maxLamports: 1000000,
						priorityLevel: "veryHigh",
					},
				},
			}),
		});
		console.log("1");

		const swapResult = (await apiCall.json()) as SwapResponse;

		console.log("2");
		// const swapResult = await jupiterApi.swapPost({
		// 	swapRequest: {
		// 		userPublicKey: wallet.publicKey.toString(),
		// 		quoteResponse: quoteResponse,
		// 		wrapAndUnwrapSol: true, // Needed for SOL swaps
		// 		asLegacyTransaction: true, // Use legacy TX (easier for testing)
		// 	},
		// });
		// const swapTransaction = Transaction.from(Buffer.from(swapResult.swapTransaction, "base64"));
		// console.log("3");
		// swapTransaction.feePayer = wallet.publicKey;
		// console.log("4");
		// const signedTx = await wallet.signTransaction(swapTransaction);
		// console.log("5");
		// const txid = await connection.sendRawTransaction(signedTx.serialize());
		// console.log("6");
		const transactionBase64 = swapResult.swapTransaction;
		const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
		console.log(transaction);
		transaction.sign([wallet.payer]);
		const transactionBinary = transaction.serialize();
		// console.log(`Swap TX: https://explorer.solana.com/tx/?cluster=devnet`);
		console.log(`Jupiter Quote: ${quoteResponse.inAmount} ${inputMintStr} -> ${quoteResponse.outAmount} ${outputMintStr}`);
		return quoteResponse;
	} catch (error) {
		console.error("Error fetching Jupiter quote:", error);
		return null;
	}
};

/**
 * Fetches swap instructions from the Jupiter API based on a quote.
 * @param quoteResponse The QuoteResponse obtained from getJupiterQuote.
 * @param solverPublicKey The public key of the (solver) executing the swap.
 * @returns Promise<SwapInstructionsResponse | null> The Jupiter swap instructions or null on error.
 */
export const getJupiterSwapInstructions = async (
	quoteResponse: QuoteResponse,
	solverPublicKey: PublicKey // This is the SOLVER's public key
): Promise<SwapInstructionsResponse | null> => {
	try {
		console.log(
			`Getting Jupiter swap instructions for ${JSON.stringify(quoteResponse)}, solverPublicKey: ${solverPublicKey.toString()}`
		);

		// Ensure the quote response is properly formatted
		if (!quoteResponse || !quoteResponse.inAmount || !quoteResponse.outAmount) {
			console.error("Invalid quote response format");
			return null;
		}

		const swapInstructionsResponse = await jupiterApi.swapInstructionsPost({
			swapRequest: {
				userPublicKey: solverPublicKey.toString(),
				quoteResponse: quoteResponse,
				dynamicComputeUnitLimit: true,
				wrapAndUnwrapSol: true, // Enable SOL wrapping/unwrapping
				// Remove any undefined or null values from the request
				...(quoteResponse.otherAmountThreshold && { otherAmountThreshold: quoteResponse.otherAmountThreshold }),
				...(quoteResponse.priceImpactPct && { priceImpactPct: quoteResponse.priceImpactPct }),
			},
		});

		if (!swapInstructionsResponse) {
			console.error("Failed to get swap instructions from Jupiter.");
			return null;
		}

		// Validate the response structure
		if (!swapInstructionsResponse.swapInstruction || !swapInstructionsResponse.swapInstruction.programId) {
			console.error("Invalid swap instructions response format");
			return null;
		}

		return swapInstructionsResponse;
	} catch (error) {
		console.error("Error fetching Jupiter swap instructions:", error);
		if (error instanceof Error) {
			console.error("Error details:", error.message);
		}
		return null;
	}
};

/**
 * Deserializes instructions from Jupiter's SwapInstructionsResponse into web3.js TransactionInstruction objects.
 * NOTE: This is a basic implementation. Real-world usage might need more robust handling,
 * especially for versioned transactions and lookup tables.
 * @param swapInstructions The SwapInstructionsResponse from Jupiter.
 * @returns An array of TransactionInstruction objects.
 */
export function deserializeJupiterInstructions(swapInstructions: SwapInstructionsResponse): TransactionInstruction[] {
	const instructions: TransactionInstruction[] = [];

	const deserializeInstruction = (instruction: Instruction | undefined): TransactionInstruction | null => {
		if (!instruction) return null;
		return new TransactionInstruction({
			programId: new PublicKey(instruction.programId),
			keys: instruction.accounts.map((key) => ({
				pubkey: new PublicKey(key.pubkey),
				isSigner: key.isSigner,
				isWritable: key.isWritable,
			})),
			data: Buffer.from(instruction.data, "base64"),
		});
	};

	// Order matters: Compute Budget -> Setup -> Swap -> Cleanup
	swapInstructions.computeBudgetInstructions?.forEach((ix) => {
		const instruction = deserializeInstruction(ix);
		if (instruction) instructions.push(instruction);
	});
	swapInstructions.setupInstructions?.forEach((ix) => {
		const instruction = deserializeInstruction(ix);
		if (instruction) instructions.push(instruction);
	});

	const swapInstruction = deserializeInstruction(swapInstructions.swapInstruction);
	if (swapInstruction) instructions.push(swapInstruction);

	const cleanupInstruction = deserializeInstruction(swapInstructions.cleanupInstruction);
	if (cleanupInstruction) instructions.push(cleanupInstruction);

	// Note: This basic deserializer ignores otherInstructions and addressLookupTableAddresses
	// For versioned transactions, you would need to handle lookup tables.

	return instructions;
}

// USDC Devnet : Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
