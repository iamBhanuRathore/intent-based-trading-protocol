// sol-usdc-swap.ts
import { setWhirlpoolsConfig, swap } from "@orca-so/whirlpools";
import { createSolanaRpc, address } from "@solana/kit";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

async function swapSolForUsdc() {
	try {
		// Initialize Whirlpools configuration for devnet
		await setWhirlpoolsConfig("solanaDevnet");

		// Create RPC connection to devnet
		const devnetRpc = createSolanaRpc("https://api.devnet.solana.com");

		// Load solver keypair from environment variable
		let solverKeypair: Keypair;
		try {
			solverKeypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLVER_BOT_PRIVATE_KEY!));
			console.log(`Using solver public key: ${solverKeypair.publicKey.toString()}`);
		} catch (error) {
			console.error("Failed to decode SOLVER_BOT_PRIVATE_KEY. Ensure it's a valid base58 encoded private key.");
			throw error;
		}

		// SOL mint address on devnet
		const solMintAddress = address("So11111111111111111111111111111111111111112"); // Native SOL wrapped address

		// SOL/USDC Whirlpool address on devnet
		// Note: This is an example address, you should replace with the actual SOL/USDC pool on devnet
		const whirlpoolAddress = address("3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt");

		// Amount of SOL to swap (in lamports - 0.1 SOL = 100,000,000 lamports)
		const inputAmount = 100_000_000n;

		console.log(`Attempting to swap ${Number(inputAmount) / 1e9} SOL for USDC...`);

		// Execute the swap
		const {
			instructions,
			quote,
			callback: sendTx,
		} = await swap(
			devnetRpc,
			{ inputAmount, mint: solMintAddress },
			whirlpoolAddress,
			100, // 1% slippage tolerance
			solverKeypair
		);

		// Send the transaction
		const txId = await sendTx();

		console.log(`Swap executed successfully!`);
		console.log(`Estimated USDC received: ${Number(quote.tokenEstOut) / 1e6} USDC`);
		console.log(`Number of instructions: ${instructions.length}`);
		console.log(`Transaction ID: ${txId}`);
		console.log(`Check transaction: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

		return txId;
	} catch (error) {
		console.error("Error swapping SOL for USDC:", error);
		throw error;
	}
}

// Execute the swap function
swapSolForUsdc()
	.then(() => console.log("Swap process completed"))
	.catch((err) => console.error("Swap process failed:", err));
