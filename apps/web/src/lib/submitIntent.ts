import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { getMint } from "@solana/spl-token";
import { createJupiterApiClient, type QuoteResponse } from "@jup-ag/api";

const jupiterApi = createJupiterApiClient({
	basePath: "https://lite-api.jup.ag/swap/v1",
	// basePath: "https://quote-api.jup.ag/v6",
});
export const getJupiterQuote = async (
	inputMintStr: string,
	outputMintStr: string,
	amountInNormalUnit: number,
	connection: Connection,
	wallet: AnchorWallet
): Promise<QuoteResponse | null> => {
	console.log(`Getting Jupiter quote for ${inputMintStr} -> ${outputMintStr} (Amount: ${amountInNormalUnit.toString()})`);
	try {
		const inputMintInfo = await getMint(connection, new PublicKey(inputMintStr));
		const amount = Number(amountInNormalUnit) * 10 ** inputMintInfo.decimals;

		if (amount <= 0) {
			console.warn("Input amount is zero or negative, skipping Jupiter quote.");
			return null;
		}
		// Note: Jupiter amount is in float units, not smallest units
		const quoteResponse = await jupiterApi.quoteGet({
			inputMint: inputMintStr,
			outputMint: outputMintStr,
			amount: amount, // In Lamports or smallest units
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
		console.log(`Signing the transaction as well in here only`);
		const swapResult = await jupiterApi.swapPost({
			swapRequest: {
				userPublicKey: wallet.publicKey.toString(),
				quoteResponse: quoteResponse,
				wrapAndUnwrapSol: true, // Needed for SOL swaps
				asLegacyTransaction: true, // Use legacy TX (easier for testing)
				dynamicComputeUnitLimit: true,
				dynamicSlippage: true,
				prioritizationFeeLamports: {
					priorityLevelWithMaxLamports: {
						maxLamports: 10000,
						priorityLevel: "medium",
					},
				},
			},
		});
		const swapTransaction = Transaction.from(Buffer.from(swapResult.swapTransaction, "base64"));
		swapTransaction.feePayer = wallet.publicKey;
		const signedTx = await wallet.signTransaction(swapTransaction);
		const txid = await connection.sendRawTransaction(signedTx.serialize());
		console.log(`Swap TX: https://explorer.solana.com/tx/${txid}`);

		return quoteResponse;
	} catch (error) {
		console.error("Error fetching Jupiter quote:", error);
		return null;
	}
};
