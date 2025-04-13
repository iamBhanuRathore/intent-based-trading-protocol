import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN, Idl } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import {  AnchorWallet } from '@solana/wallet-adapter-react';
import { IDL } from './idl';
// import BN from 'bn.js';

const PROGRAM_ID = new PublicKey('AJiU2A3GBcVwP8o9tmKPYW6tVWESgrNtKcHqfoDGVkZ6');
const NETWORK = 'https://api.devnet.solana.com'; // or mainnet-beta
const connection = new Connection(clusterApiUrl("devnet"),'confirmed');

const getProgram = (wallet: AnchorWallet): Program<Idl> => { // Or use your specific IDL type
  // --- Add this log ---
  console.log("Attempting to create Program with IDL:", IDL);
  try {
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
    // Ensure IDL (the imported object) is passed here
    const program = new Program(IDL, provider);
    console.log("Program created successfully.");
    return program;
  } catch (error) {
     console.error("Error creating Program instance:", error);
     // Log the IDL again here if it fails, just in case
     console.error("IDL at time of error:", IDL);
     throw error; // Re-throw after logging
  }
};


const getIntentPDA = async (intentId: number, user: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('intent')),
      user.toBuffer(),
      new BN(intentId).toArrayLike(Buffer, 'le', 8),
    ],
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
  wallet
}: {
  intentId: number;
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputAmount: number;
  expiryTs?: number;
  category: number;
  wallet: AnchorWallet
}) => {

  const program = getProgram(wallet);
  const user = wallet.publicKey!;
  console.log(`Submitting Intent - ID: ${intentId}, User: ${user.toBase58()}`,program);

  const [intentPda, intentBump] = await getIntentPDA(intentId, user);
  console.log(`   Calculated Intent PDA: ${intentPda.toBase58()} (Bump: ${intentBump})`);
  try {

    const txSignature = await program.methods
    .submitIntent(
      new BN(intentId),
      inputMint,
      outputMint,
      new BN(inputAmount),
      expiryTs ? new BN(expiryTs) : null,
      new BN(category)
    )
    .accounts({
      intent: intentPda,
      user,
      systemProgram: program.programId,
    })
    .rpc();
     // --- SUCCESS LOGGING ---
     console.log("✅ Intent submitted successfully!");
     console.log(`   Intent ID Used: ${intentId}`);
     console.log(`   Intent Account Address (PDA): ${intentPda.toBase58()}`);
     console.log(`   Transaction Signature: ${txSignature}`);
     console.log(`   View on Solana Explorer: https://explorer.solana.com/tx/${txSignature}`);

     // You can also return the signature and PDA if needed by the calling code
     return { txSignature, intentPda };

   } catch (error) {
     console.error("❌ Error submitting intent transaction:", error);
     // Optionally, parse AnchorError for more specific messages
     const anchorError = anchor.AnchorError.parse((error as any).logs);
     if (anchorError) {
         console.error("Anchor Error Code:", anchorError.error.errorCode.code);
         console.error("Anchor Error Message:", anchorError.error.errorMessage);
         const idlError = program.idl.errors?.find((e:any) => e.code === anchorError.error.errorCode.code);
          if (idlError) {
              console.error("IDL Error:", idlError.msg);
              throw new Error(`Submit Intent Failed: ${idlError.msg} (Code: ${idlError.code})`);
          }
     }
     // Re-throw the error so the calling component knows it failed
     throw error;
   }
};
