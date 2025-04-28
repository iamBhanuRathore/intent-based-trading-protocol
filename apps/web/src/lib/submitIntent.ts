import { PublicKey, Connection, clusterApiUrl, SystemProgram, Keypair, VersionedTransaction, Transaction } from "@solana/web3.js";
import { AnchorProvider, BN, Program, Idl, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import IDL from "./idl.json";
import { getMint } from "@solana/spl-token";
// import BN from 'bn.js';
import {
	createJupiterApiClient,
	Configuration,
	SwapApi,
	type QuoteResponse,
	type SwapInstructionsResponse,
	type Instruction,
	type SwapResponse,
} from "@jup-ag/api";

const PROGRAM_ID = new PublicKey("2BuUyefg81u1iaYrRMQ9hM3Wsn9iYVY3JWTjWrnA6Mev");
const NETWORK = "https://api.devnet.solana.com"; // or mainnet-beta
// const connection = new Connection(clusterApiUrl("devnet"),'confirmed');
const getProgram = (wallet: AnchorWallet, connection: Connection) => {
	console.log("Attempting to create Program with IDL:", IDL);
	try {
		const provider = new AnchorProvider(connection, wallet, { commitment: "processed" });
		return new Program(IDL, provider);
	} catch (error) {
		console.error("Error creating Program instance:", error);
		console.error("IDL at time of error:", IDL);
		throw error;
	}
};

const getIntentPDA = async (intentId: number, user: PublicKey) => {
	return PublicKey.findProgramAddressSync(
		[Buffer.from("intent"), user.toBuffer(), new BN(intentId).toArrayLike(Buffer, "le", 8)],
		PROGRAM_ID
	);
};

export const submitIntent = async ({
	intentId,
	inputMint,
	outputMint,
	inputAmount,
	expiryTs,
	category,
	wallet,
	connection,
}: {
	intentId: number;
	inputMint: PublicKey;
	outputMint: PublicKey;
	inputAmount: number;
	expiryTs?: number;
	category: number;
	wallet: AnchorWallet;
	connection: Connection;
}) => {
	const program = getProgram(wallet, connection);
	const user = wallet.publicKey!;
	console.log(`Submitting Intent - ID: ${intentId}, User: ${user.toBase58()}`, program);

	const [intentPda, intentBump] = await getIntentPDA(intentId, user);
	console.log(`   Calculated Intent PDA: ${intentPda.toBase58()} (Bump: ${intentBump})`);
	try {
		``;
		// Send transaction
		const text = "2ZHiX2bfCkt6wzwYsHYMt59D284j9L5oBGDzKztaKFpEh8mr9j5Jyxcn68remn8zjjDk9QBay6uKMkXQPwAGC2q";
		const secretKeyBytes = anchor.utils.bytes.bs58.decode(text);
		let solver = Keypair.fromSecretKey(secretKeyBytes);
		const data = new BN(42);
		const txHash = await program.methods
			.initialize(data)
			.accounts({
				newAccount: solver.publicKey,
				signer: wallet.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.signers([solver])
			.rpc();
		console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
		await connection.confirmTransaction(txHash);
		// const txSignature = await program.methods.submitIntent(
		//   new BN(intentId),
		//   inputMint,
		//   outputMint,
		//   new BN(inputAmount),
		//   expiryTs ? new BN(expiryTs) : null,
		//   new BN(category)
		// )
		// .accounts({
		//   intent: intentPda,
		//   user,
		//   systemProgram: PublicKey.default,
		// })
		// .rpc();
		// --- SUCCESS LOGGING ---
		//  console.log("✅ Intent submitted successfully!");
		//  console.log(`   Intent ID Used: ${intentId}`);
		//  console.log(`   Intent Account Address (PDA): ${intentPda.toBase58()}`);
		//  console.log(`   Transaction Signature: ${txSignature}`);
		//  console.log(`   View on Solana Explorer: https://explorer.solana.com/tx/${txSignature}`);

		//  // You can also return the signature and PDA if needed by the calling code
		//  return { txSignature, intentPda };
	} catch (error) {
		console.error("❌ Error submitting intent transaction:", error);
		// Optionally, parse AnchorError for more specific messages
		const anchorError = anchor.AnchorError.parse((error as any).logs);
		if (anchorError) {
			console.error("Anchor Error Code:", anchorError.error.errorCode.code);
			console.error("Anchor Error Message:", anchorError.error.errorMessage);
			const idlError = program.idl.errors?.find((e: any) => e.code === anchorError.error.errorCode.code);
			if (idlError) {
				console.error("IDL Error:", idlError.msg);
				throw new Error(`Submit Intent Failed: ${idlError.msg} (Code: ${idlError.code})`);
			}
		}
		// Re-throw the error so the calling component knows it failed
		throw error;
	}
};
const jupiterApi = createJupiterApiClient({
	basePath: "https://lite-api.jup.ag/swap/v1",
	// basePath: "https://quote-api.jup.ag/v6",
});
export const getJupiterQuote = async (
	inputMintStr: string,
	outputMintStr: string,
	amountInSmallestUnit: number, // Accept number/string/bigint
	connection: Connection,
	wallet: AnchorWallet
): Promise<QuoteResponse | null> => {
	console.log(`Getting Jupiter quote for ${inputMintStr} -> ${outputMintStr} (Amount: ${amountInSmallestUnit.toString()})`);
	try {
		const inputMintInfo = await getMint(connection, new PublicKey(inputMintStr));
		// const inputMintInfo = await getMint(connection, new PublicKey(inputMintStr));
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
		console.log("3");
		swapTransaction.feePayer = wallet.publicKey;
		console.log("4");
		const signedTx = await wallet.signTransaction(swapTransaction);
		console.log("5");
		const txid = await connection.sendRawTransaction(signedTx.serialize());
		console.log("6");
		console.log(`Swap TX: https://explorer.solana.com/tx/${txid}`);

		return quoteResponse;
	} catch (error) {
		console.error("Error fetching Jupiter quote:", error);
		return null;
	}
};
