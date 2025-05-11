"use server";

import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { QuoteResponse } from "@jup-ag/api";
import { createJupiterApiClient } from "@jup-ag/api";
import { getMint, Mint } from "@solana/spl-token";
import { Config } from "@/components/swap-interface";
class JupiterError extends Error {
	constructor(
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = "JupiterError";
	}
}

const JUPITER_CONFIG = {
	basePath: "https://lite-api.jup.ag/swap/v1",
	slippageBps: 100, // 1% slippage
	priorityLevel: "medium" as const,
	maxLamports: 10000,
} as const;
const jupiterApi = createJupiterApiClient({
	basePath: JUPITER_CONFIG.basePath,
	// basePath: "https://quote-api.jup.ag/v6",
});

const getJupiterQuote = async (inputMintStr: string, inputMintInfo: Mint, outputMintStr: string, amountInNormalUnit: number) => {
	console.log(`Getting Jupiter quote for ${inputMintStr} -> ${outputMintStr} (Amount: ${amountInNormalUnit.toString()})`);
	try {
		const amount = Number(amountInNormalUnit) * 10 ** inputMintInfo.decimals;
		if (amount <= 0) {
			throw new JupiterError("Input amount must be greater than zero");
		}
		const quoteResponse = await jupiterApi.quoteGet({
			inputMint: inputMintStr,
			outputMint: outputMintStr,
			amount,
			slippageBps: JUPITER_CONFIG.slippageBps,
			restrictIntermediateTokens: true,
			// onlyDirectRoutes: false, // Consider performance vs best price
			// asLegacyTransaction: true, // Request instructions for legacy Transaction if needed
		});
		if (!quoteResponse) {
			throw new JupiterError("No quote received from Jupiter");
		}
		return quoteResponse;
	} catch (error) {
		if (error instanceof JupiterError) {
			throw error;
		}
		throw new JupiterError("Failed to fetch Jupiter quote", error);
	}
};

async function executeSwap(quoteResponse: QuoteResponse, wallet: AnchorWallet, config: Config) {
	try {
		// const txid = await executeJupiterSwap(quoteResponse, connection, wallet);
		const swapResult = await jupiterApi.swapPost({
			swapRequest: {
				userPublicKey: wallet.publicKey.toString(),
				quoteResponse,
				wrapAndUnwrapSol: true, // Needed for SOL swaps
				asLegacyTransaction: true, // Use legacy TX (easier for testing)
				dynamicComputeUnitLimit: true,
				dynamicSlippage: true,
				prioritizationFeeLamports: {
					priorityLevelWithMaxLamports: {
						maxLamports: Number(config.maxFee),
						priorityLevel: config.priority,
					},
				},
			},
		});
		return { success: true, swapResult };
	} catch (error) {
		console.error("Error executing swap:", error);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}

export async function submitSwap(
	inputMintStr: string,
	inputMintInfo: Mint,
	outputMintStr: string,
	amountInNormalUnit: number,
	wallet: AnchorWallet,
	config: Config
) {
	try {
		const quoteResponse = await getJupiterQuote(inputMintStr, inputMintInfo, outputMintStr, amountInNormalUnit);
		const result = await executeSwap(quoteResponse, wallet, config);
		return result;
	} catch (error) {
		console.error("Error submitting swap intent:", error);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}
