import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor"; // Import Program type if needed elsewhere
import * as web3 from "@solana/web3.js";    // Import web3 explicitly
import { BN } from "bn.js";                 // Import BN explicitly
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  Account, // Keep Account type
  approve,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai"; // Using chai's assert for better messages

// Assume pg is globally available from solpg environment
declare const pg: any; // Declare pg if TypeScript complains

describe("intent_protocol", () => {
  // Constants from the program
  const INTENT_AUTHORITY_SEED = Buffer.from("intent_authority");
  const INTENT_PDA_SEED = Buffer.from("intent");

  // Use anchor provider for convenience if needed, or stick with pg
  // const provider = anchor.AnchorProvider.env(); // Can use if preferred over pg directly
  // anchor.setProvider(provider);
  const program = pg.program; // Use pg's program instance

  // Common variables
  let user: pg.PgWallet; // Assuming PgWallet type from solpg
  let solver: web3.Keypair; // Use standard Keypair type
  let inputMint: web3.PublicKey;
  let outputMint: web3.PublicKey;
  let userInputTokenAccountInfo: Account; // Store the full Account info
  let userOutputTokenAccountInfo: Account;
  let solverInputTokenAccountInfo: Account;
  let solverOutputTokenAccountInfo: Account;
  let intentAuthority: web3.PublicKey;
  let intentAuthBump: number;
  let intentPda: web3.PublicKey;
  const intentId = new BN(Date.now()); // Use const if not reassigned, or let if needed
  const INPUT_AMOUNT = new BN(1000000000); // 1 token with 9 decimals
  const OUTPUT_AMOUNT = new BN(750000000); // 0.75 tokens with 9 decimals
  const CATEGORY = new BN(1); // General category

  before(async () => {
    // Initialize wallets
    user = pg.wallet;
    solver = web3.Keypair.generate(); // *** FIX: Generate a proper keypair ***

    console.log("User wallet:", user.publicKey.toString());
    console.log("Solver wallet:", solver.publicKey.toString());

    // *** FIX: Uncomment and confirm the airdrop ***
    console.log(`Requesting airdrop for solver ${solver.publicKey.toString()}...`);
    const airdropSignature = await pg.connection.requestAirdrop(
      solver.publicKey,
      1 * web3.LAMPORTS_PER_SOL // Request 1 SOL, should be enough
    );
    // *** FIX: Wait for airdrop confirmation ***
    const latestBlockhash = await pg.connection.getLatestBlockhash();
    await pg.connection.confirmTransaction({
         blockhash: latestBlockhash.blockhash,
         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
         signature: airdropSignature,
     }, 'confirmed'); // Use 'confirmed' or 'finalized'
    console.log(`Airdrop successful for solver. TX: ${airdropSignature}`);


    // Find PDA for intent authority
    [intentAuthority, intentAuthBump] =
      await web3.PublicKey.findProgramAddress(
        [INTENT_AUTHORITY_SEED],
        program.programId
      );
    console.log(
      "Intent Authority PDA:",
      intentAuthority.toString(),
      "with bump",
      intentAuthBump
    );
  });

  it("Should set up token mints and accounts", async () => {
    // Create input token mint (user is authority)
    inputMint = await createMint(
      pg.connection,
      user.keypair, // Payer
      user.publicKey, // Mint Authority
      null,           // Freeze Authority
      9
    );
    console.log("Input Mint created:", inputMint.toString());

    // Create output token mint (solver is authority)
    outputMint = await createMint(
      pg.connection,
      solver,          // Payer - *needs SOL*
      solver.publicKey, // Mint Authority
      null,           // Freeze Authority
      9
    );
    console.log("Output Mint created:", outputMint.toString());

    // Create token accounts for user
    // Pass user.keypair as payer for account creation if needed (depends on getOrCreateAssociatedTokenAccount impl)
    userInputTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      pg.connection,
      user.keypair, // Payer
      inputMint,
      user.publicKey
    );
    console.log(
      "User Input Token Account:",
      userInputTokenAccountInfo.address.toString()
    );

    userOutputTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      pg.connection,
      user.keypair, // Payer
      outputMint,
      user.publicKey
    );
    console.log(
      "User Output Token Account:",
      userOutputTokenAccountInfo.address.toString()
    );

    // Create token accounts for solver
    // Pass solver Keypair as payer
    solverInputTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      pg.connection,
      solver,       // Payer - *needs SOL*
      inputMint,
      solver.publicKey
    );
    console.log(
      "Solver Input Token Account:",
      solverInputTokenAccountInfo.address.toString()
    );

    solverOutputTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      pg.connection,
      solver,       // Payer - *needs SOL*
      outputMint,
      solver.publicKey
    );
    console.log(
      "Solver Output Token Account:",
      solverOutputTokenAccountInfo.address.toString()
    );

    // Mint some tokens to the user and solver
    await mintTo(
      pg.connection,
      user.keypair, // Payer/Authority
      inputMint,
      userInputTokenAccountInfo.address,
      user.publicKey, // Mint Authority
      INPUT_AMOUNT.toNumber() // Use toNumber() for amount if BN doesn't work directly
    );

    await mintTo(
      pg.connection,
      solver,          // Payer/Authority
      outputMint,
      solverOutputTokenAccountInfo.address,
      solver.publicKey, // Mint Authority
      OUTPUT_AMOUNT.muln(2).toNumber() // Use muln for BN multiplication
    );

    // Verify balances
    const userInputBalance = await getAccount(
      pg.connection,
      userInputTokenAccountInfo.address
    );
    assert.strictEqual(
      userInputBalance.amount.toString(),
      INPUT_AMOUNT.toString(),
      "User input balance mismatch after mint"
    );

    const solverOutputBalance = await getAccount(
      pg.connection,
      solverOutputTokenAccountInfo.address
    );
    assert.strictEqual(
      solverOutputBalance.amount.toString(),
      OUTPUT_AMOUNT.muln(2).toString(), // Use muln
      "Solver output balance mismatch after mint"
    );

    // *** Add checks to ensure accounts were actually created ***
    assert.ok(userInputTokenAccountInfo, "User input ATA missing");
    assert.ok(userOutputTokenAccountInfo, "User output ATA missing");
    assert.ok(solverInputTokenAccountInfo, "Solver input ATA missing");
    assert.ok(solverOutputTokenAccountInfo, "Solver output ATA missing");

  }); // End of setup test

  // --- Tests below depend on the setup above ---

  it("Should submit an intent", async () => {
    // Make sure mints are created before deriving PDA
    assert.ok(inputMint, "Input mint required");
    assert.ok(outputMint, "Output mint required");

    const [intentPDA, intentBump] = await web3.PublicKey.findProgramAddress(
      [
        INTENT_PDA_SEED,
        user.publicKey.toBuffer(),
        intentId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    intentPda = intentPDA; // Store globally for other tests
    console.log("Intent PDA:", intentPDA.toString(), "with bump", intentBump);

    const expiryTs = new BN(Math.floor(Date.now() / 1000) + 600);

    const txHash = await program.methods
      .submitIntent(
        intentId,
        inputMint,
        outputMint,
        INPUT_AMOUNT,
        expiryTs, // Pass BN directly
        CATEGORY
      )
      .accounts({
        intent: intentPDA,
        user: user.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" }); // Wait for confirmation

    console.log(`Submit Intent Transaction Confirmed: ${txHash}`);
    // No need to call confirmTransaction again if rpc awaits confirmation

    const intentAccount = await program.account.intent.fetch(intentPDA);
    assert.strictEqual(intentAccount.user.toString(), user.publicKey.toString());
    assert.strictEqual(intentAccount.intentId.toString(), intentId.toString());
    assert.strictEqual(intentAccount.inputMint.toString(), inputMint.toString());
    assert.strictEqual(intentAccount.outputMint.toString(), outputMint.toString());
    assert.strictEqual(intentAccount.inputAmount.toString(), INPUT_AMOUNT.toString());
    assert.strictEqual(intentAccount.category.toString(), CATEGORY.toString());
    assert.isFalse(intentAccount.fulfilled);
    assert.isNull(intentAccount.solver);
    assert.isNull(intentAccount.outputAmountFulfilled);
    assert.isNull(intentAccount.fulfilledTimestamp);
    assert.strictEqual(intentAccount.bump, intentBump);
    assert.isNotNull(intentAccount.expiryTs);
    assert.strictEqual(intentAccount.expiryTs.toString(), expiryTs.toString());
    assert.isAbove(intentAccount.expiryTs.toNumber(), Math.floor(Date.now() / 1000));
  });

  it("Should approve token delegation to intent authority", async () => {
     // Ensure user input account and intent authority are available
     assert.ok(userInputTokenAccountInfo, "User input token account required");
     assert.ok(intentAuthority, "Intent authority PDA required");

     const txHash = await approve(
        pg.connection,
        user.keypair,                      // Payer + Signer
        userInputTokenAccountInfo.address, // Account to delegate from
        intentAuthority,                   // Delegate authority
        user.publicKey,                    // Owner of the source account
        INPUT_AMOUNT.toNumber()            // Amount
     );

     console.log(`Delegation Approval TX: ${txHash}`);
     const latestBlockhash = await pg.connection.getLatestBlockhash();
     await pg.connection.confirmTransaction({
         blockhash: latestBlockhash.blockhash,
         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
         signature: txHash,
     }, 'confirmed');
     console.log(`Delegation Approval Confirmed`);


     const accountInfo = await getAccount(
        pg.connection,
        userInputTokenAccountInfo.address
     );
     assert.ok(accountInfo.delegate, "Delegate not set");
     assert.strictEqual(accountInfo.delegate.toString(), intentAuthority.toString(), "Delegate mismatch");
     assert.ok(accountInfo.delegatedAmount, "Delegated amount not set");
     assert.strictEqual(accountInfo.delegatedAmount.toString(), INPUT_AMOUNT.toString(), "Delegated amount mismatch");
  });

  it("Should fulfill an intent", async () => {
    // Ensure all accounts and intentPda are ready
    assert.ok(intentPda, "Intent PDA required");
    assert.ok(userInputTokenAccountInfo, "User input token account required");
    assert.ok(userOutputTokenAccountInfo, "User output token account required");
    assert.ok(solverInputTokenAccountInfo, "Solver input token account required");
    assert.ok(solverOutputTokenAccountInfo, "Solver output token account required");
    assert.ok(intentAuthority, "Intent authority PDA required");

    // Record balances before
    const userInputBefore = await getAccount(pg.connection, userInputTokenAccountInfo.address);
    const userOutputBefore = await getAccount(pg.connection, userOutputTokenAccountInfo.address);
    const solverInputBefore = await getAccount(pg.connection, solverInputTokenAccountInfo.address);
    const solverOutputBefore = await getAccount(pg.connection, solverOutputTokenAccountInfo.address);

    const txHash = await program.methods
      .fulfillIntent(intentId, OUTPUT_AMOUNT) // Pass intentId, output amount
      .accounts({
        intent: intentPda,
        user: user.publicKey,              // Pass user's public key (checked by program)
        solver: solver.publicKey,          // Solver is signer
        intentAuthority: intentAuthority,
        userInputTokenAccount: userInputTokenAccountInfo.address,
        userOutputTokenAccount: userOutputTokenAccountInfo.address,
        solverInputTokenAccount: solverInputTokenAccountInfo.address,
        solverOutputTokenAccount: solverOutputTokenAccountInfo.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId, // Often needed, keep it
      })
      .signers([solver]) // *** Solver MUST sign ***
      .rpc({ commitment: "confirmed" });

    console.log(`Fulfill Intent Transaction Confirmed: ${txHash}`);

    // Validate intent state
    const intentAccount = await program.account.intent.fetch(intentPda);
    assert.isTrue(intentAccount.fulfilled, "Intent should be fulfilled");
    assert.ok(intentAccount.solver, "Solver should be set");
    assert.strictEqual(intentAccount.solver.toString(), solver.publicKey.toString(), "Solver pubkey mismatch");
    assert.ok(intentAccount.outputAmountFulfilled, "Output amount should be set");
    assert.strictEqual(intentAccount.outputAmountFulfilled.toString(), OUTPUT_AMOUNT.toString(), "Fulfilled amount mismatch");
    assert.ok(intentAccount.fulfilledTimestamp, "Fulfilled timestamp should be set");

    // Check balances after
    const userInputAfter = await getAccount(pg.connection, userInputTokenAccountInfo.address);
    const userOutputAfter = await getAccount(pg.connection, userOutputTokenAccountInfo.address);
    const solverInputAfter = await getAccount(pg.connection, solverInputTokenAccountInfo.address);
    const solverOutputAfter = await getAccount(pg.connection, solverOutputTokenAccountInfo.address);

    // Use BN for comparisons
    const userInputBeforeBn = new BN(userInputBefore.amount.toString());
    const userOutputBeforeBn = new BN(userOutputBefore.amount.toString());
    const solverInputBeforeBn = new BN(solverInputBefore.amount.toString());
    const solverOutputBeforeBn = new BN(solverOutputBefore.amount.toString());

    const userInputAfterBn = new BN(userInputAfter.amount.toString());
    const userOutputAfterBn = new BN(userOutputAfter.amount.toString());
    const solverInputAfterBn = new BN(solverInputAfter.amount.toString());
    const solverOutputAfterBn = new BN(solverOutputAfter.amount.toString());

    assert.strictEqual(userInputBeforeBn.sub(userInputAfterBn).toString(), INPUT_AMOUNT.toString(), "User input decrease incorrect");
    assert.strictEqual(userOutputAfterBn.sub(userOutputBeforeBn).toString(), OUTPUT_AMOUNT.toString(), "User output increase incorrect");
    assert.strictEqual(solverInputAfterBn.sub(solverInputBeforeBn).toString(), INPUT_AMOUNT.toString(), "Solver input increase incorrect");
    assert.strictEqual(solverOutputBeforeBn.sub(solverOutputAfterBn).toString(), OUTPUT_AMOUNT.toString(), "Solver output decrease incorrect");
  });

  it("Should submit and then cancel an intent", async () => {
    const newIntentId = intentId.addn(1); // Use addn for BN addition

    const [newIntentPDA, _] = await web3.PublicKey.findProgramAddress(
      [
        INTENT_PDA_SEED,
        user.publicKey.toBuffer(),
        newIntentId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Submit a new intent (without expiry for simplicity)
    const submitTxHash = await program.methods
      .submitIntent(newIntentId, inputMint, outputMint, INPUT_AMOUNT, null, CATEGORY)
      .accounts({
        intent: newIntentPDA,
        user: user.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });
    console.log(`Submit New Intent Confirmed: ${submitTxHash}`);

    const intentBeforeCancel = await program.account.intent.fetch(newIntentPDA);
    assert.strictEqual(intentBeforeCancel.intentId.toString(), newIntentId.toString());

    const balanceBefore = await pg.connection.getBalance(user.publicKey);

    // Cancel the intent
    const cancelTxHash = await program.methods
      .cancelIntent(newIntentId)
      .accounts({
        intent: newIntentPDA,
        user: user.publicKey, // User signs to cancel and receive rent
      })
      // No extra signers needed if user is pg.wallet
      .rpc({ commitment: "confirmed" });
    console.log(`Cancel Intent Confirmed: ${cancelTxHash}`);

    // Verify intent account is closed
    try {
      await program.account.intent.fetch(newIntentPDA);
      assert.fail("Intent account should have been closed");
    } catch (e) {
      // console.log("Expected error fetching closed account:", e);
      assert.include(e.message, "Account does not exist", "Error message should indicate account closure");
    }

    const balanceAfter = await pg.connection.getBalance(user.publicKey);
    assert.isAbove(balanceAfter, balanceBefore, "User should receive rent refund");
  });

  // --- Error Handling Tests ---

  it("Should fail to fulfill an intent with incorrect output mint account", async () => {
    // Setup: Create a new intent specifically for this test
    const errorIntentId = intentId.addn(2);
    const [errorIntentPDA, _bump] = await web3.PublicKey.findProgramAddress(
      [INTENT_PDA_SEED, user.publicKey.toBuffer(), errorIntentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    await program.methods
      .submitIntent(errorIntentId, inputMint, outputMint, INPUT_AMOUNT, null, CATEGORY)
      .accounts({ intent: errorIntentPDA, user: user.publicKey, systemProgram: web3.SystemProgram.programId })
      .rpc({ commitment: "confirmed" });
    console.log(`Submitted intent for incorrect mint test: ${errorIntentPDA}`);

    // Approve delegation for this new intent (reuse existing input account)
     await approve(pg.connection, user.keypair, userInputTokenAccountInfo.address, intentAuthority, user.publicKey, INPUT_AMOUNT.toNumber());
     await pg.connection.confirmTransaction(await pg.connection.getLatestBlockhash(), 'confirmed'); // Simple confirm
     console.log(`Approved delegation for incorrect mint test`);


    // *** CRITICAL: Create a token account for the SOLVER but using the WRONG mint (inputMint) ***
    // This simulates the solver accidentally providing their input token account where their output is expected.
    const wrongSolverOutputAccount = await getOrCreateAssociatedTokenAccount(
        pg.connection,
        solver,          // Payer
        inputMint,       // *** WRONG MINT ***
        solver.publicKey // Owner
    );
    console.log(`Created wrong solver output account (using input mint): ${wrongSolverOutputAccount.address}`);


    try {
      await program.methods
        .fulfillIntent(errorIntentId, OUTPUT_AMOUNT)
        .accounts({
          intent: errorIntentPDA,
          user: user.publicKey,
          solver: solver.publicKey,
          intentAuthority: intentAuthority,
          userInputTokenAccount: userInputTokenAccountInfo.address,
          userOutputTokenAccount: userOutputTokenAccountInfo.address, // User's correct output account
          solverInputTokenAccount: solverInputTokenAccountInfo.address, // Solver's correct input account
          solverOutputTokenAccount: wrongSolverOutputAccount.address, // *** WRONG ACCOUNT ***
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([solver])
        .rpc({ commitment: "confirmed" });

      assert.fail("Transaction should have failed due to OutputMintMismatch constraint");
    } catch (e) {
      // console.error("Caught expected error:", JSON.stringify(e, null, 2)); // Log the full error structure
      assert.isTrue(e instanceof anchor.AnchorError, "Error should be an AnchorError");
      assert.strictEqual(e.error.errorCode.code, "OutputMintMismatch", "Error code mismatch");
      // Check constraints specifically if possible (might require parsing logs or specific error structure)
      // assert.include(e.toString(), "OutputMintMismatch", "Error message should contain OutputMintMismatch"); // Fallback check
    }
  });

   it("Should fail to submit an intent with expiry in the past", async () => {
    // Use intentId + 3
    const expiredIntentId = intentId.addn(3);
    const [expiredIntentPDA, _bump] = await web3.PublicKey.findProgramAddress(
      [INTENT_PDA_SEED, user.publicKey.toBuffer(), expiredIntentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // Set expiry timestamp slightly in the past
    const pastExpiry = new BN(Math.floor(Date.now() / 1000) - 10); // 10 seconds ago

    try {
      await program.methods
        .submitIntent(expiredIntentId, inputMint, outputMint, INPUT_AMOUNT, pastExpiry, CATEGORY)
        .accounts({ intent: expiredIntentPDA, user: user.publicKey, systemProgram: web3.SystemProgram.programId })
        .rpc({ commitment: "confirmed" });

      assert.fail("Submitting intent with past expiry should have failed");
    } catch (e) {
      assert.isTrue(e instanceof anchor.AnchorError, "Error should be an AnchorError");
      assert.strictEqual(e.error.errorCode.code, "ExpiryInPast", "Error code should be ExpiryInPast");
    }
  });

  it("Should fail to fulfill an intent that's already fulfilled", async () => {
    // This test depends on the successful fulfillment in "Should fulfill an intent"
    assert.ok(intentPda, "Intent PDA from successful fulfillment required");

    // Verify the intent IS fulfilled first
    const intentAccount = await program.account.intent.fetch(intentPda);
    assert.isTrue(intentAccount.fulfilled, "Intent must be fulfilled for this test to be valid");

    try {
      // Attempt to fulfill the *same* intent again
      await program.methods
        .fulfillIntent(intentId, OUTPUT_AMOUNT) // Use original intentId
        .accounts({
          intent: intentPda, // Use original intentPda
          user: user.publicKey,
          solver: solver.publicKey,
          intentAuthority: intentAuthority,
          userInputTokenAccount: userInputTokenAccountInfo.address,
          userOutputTokenAccount: userOutputTokenAccountInfo.address,
          solverInputTokenAccount: solverInputTokenAccountInfo.address,
          solverOutputTokenAccount: solverOutputTokenAccountInfo.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([solver])
        .rpc({ commitment: "confirmed" });

      assert.fail("Fulfilling an already fulfilled intent should fail");
    } catch (e) {
        assert.isTrue(e instanceof anchor.AnchorError, "Error should be an AnchorError");
        // The error might come from the constraint OR the require! inside the function
        // Anchor constraints often throw before the function body executes.
        assert.strictEqual(e.error.errorCode.code, "IntentAlreadyFulfilled", "Error code should be IntentAlreadyFulfilled");
        // Check if the error message includes the constraint name if AnchorError structure allows
        // assert.include(e.error.errorMessage, "intent.fulfilled", "Error message should mention the constraint");
    }
  });


  it("Should fail to fulfill an intent with zero output amount", async () => {
     // Setup: Create a new intent
    const zeroIntentId = intentId.addn(4);
    const [zeroIntentPDA, _bump] = await web3.PublicKey.findProgramAddress(
      [INTENT_PDA_SEED, user.publicKey.toBuffer(), zeroIntentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    await program.methods
      .submitIntent(zeroIntentId, inputMint, outputMint, INPUT_AMOUNT, null, CATEGORY)
      .accounts({ intent: zeroIntentPDA, user: user.publicKey, systemProgram: web3.SystemProgram.programId })
      .rpc({ commitment: "confirmed" });

    // Approve delegation
     await approve(pg.connection, user.keypair, userInputTokenAccountInfo.address, intentAuthority, user.publicKey, INPUT_AMOUNT.toNumber());
     await pg.connection.confirmTransaction(await pg.connection.getLatestBlockhash(), 'confirmed');

    try {
      // Attempt to fulfill with zero amount
      await program.methods
        .fulfillIntent(zeroIntentId, new BN(0)) // *** ZERO OUTPUT AMOUNT ***
        .accounts({
          intent: zeroIntentPDA,
          user: user.publicKey,
          solver: solver.publicKey,
          intentAuthority: intentAuthority,
          userInputTokenAccount: userInputTokenAccountInfo.address,
          userOutputTokenAccount: userOutputTokenAccountInfo.address,
          solverInputTokenAccount: solverInputTokenAccountInfo.address,
          solverOutputTokenAccount: solverOutputTokenAccountInfo.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([solver])
        .rpc({ commitment: "confirmed" });

      assert.fail("Fulfilling with zero output amount should fail");
    } catch (e) {
      assert.isTrue(e instanceof anchor.AnchorError, "Error should be an AnchorError");
      assert.strictEqual(e.error.errorCode.code, "InvalidOutputAmount", "Error code should be InvalidOutputAmount");
    }
  });

}); // End of describe block
