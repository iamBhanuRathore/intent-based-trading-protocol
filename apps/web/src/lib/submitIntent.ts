import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { submitSwap } from "@/app/actions/jupiter";
import { getMint } from "@solana/spl-token";
import { Config } from "@/components/swap-interface";

export const submitIntent = async (
	inputMintStr: string,
	outputMintStr: string,
	amountInNormalUnit: number,
	connection: Connection,
	wallet: AnchorWallet,
	config: Config
) => {
	const inputMintInfo = await getMint(connection, new PublicKey(inputMintStr));
	const result = await submitSwap(inputMintStr, inputMintInfo, outputMintStr, amountInNormalUnit, wallet, config);
	if (!result.success) {
		throw new Error("Failed to submit swap");
	}
	if (!result.swapResult) {
		throw new Error("No swap result");
	}

	const swapTransaction = Transaction.from(Buffer.from(result.swapResult.swapTransaction, "base64"));
	swapTransaction.feePayer = wallet.publicKey;
	const signedTx = await wallet.signTransaction(swapTransaction);
	const txid = await connection.sendRawTransaction(signedTx.serialize());
	console.log(`Swap TX: https://explorer.solana.com/tx/${txid}`);
	return { success: true, txid };
};
