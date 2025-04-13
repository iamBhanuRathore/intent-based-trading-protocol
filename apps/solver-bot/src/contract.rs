use anchor_lang::prelude::*;
// Removed unused 'Mint' import
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("G2JErrgFrc845jbxeLvKTP5LP8SQxgtqShsuiF3NZ8SC"); // Replace with your actual Program ID

// --- MOVE CONSTANTS HERE ---
// Seed for the PDA that will have delegated authority over user's input tokens
const INTENT_AUTHORITY_SEED: &[u8] = b"intent_authority";
// Seed prefix for the Intent PDA account
const INTENT_PDA_SEED: &[u8] = b"intent";
// --- END OF MOVED CONSTANTS ---

#[program]
pub mod intent_protocol {
    use super::*; // Use super to access items defined outside this module (like the constants now)

    pub fn submit_intent(
        ctx: Context<SubmitIntent>,
        intent_id: u64, // User-provided or client-generated unique ID for this intent for this user
        input_mint: Pubkey,
        output_mint: Pubkey,
        input_amount: u64,
        expiry_ts: Option<i64>, // Optional expiry timestamp
        category: u64,          // Optional category tag
    ) -> Result<()> {
        let intent = &mut ctx.accounts.intent;
        let clock = Clock::get()?;
        let intent_pda_key = intent.key(); // Store key before mutating intent

        // Validate expiry if provided
        if let Some(expiry) = expiry_ts {
            require!(expiry > clock.unix_timestamp, CustomError::ExpiryInPast);
        }

        intent.user = ctx.accounts.user.key();
        intent.intent_id = intent_id; // Store the ID used in seeds
        intent.input_mint = input_mint;
        intent.output_mint = output_mint;
        intent.input_amount = input_amount;
        intent.fulfilled = false;
        intent.solver = None;
        intent.output_amount_fulfilled = None;
        intent.fulfilled_timestamp = None;
        intent.creation_ts = clock.unix_timestamp;
        intent.expiry_ts = expiry_ts;
        intent.category = category;

        // --- FIX: Access bump directly using the field name ---
        // The `intent` field on `ctx.bumps` corresponds to the `pub intent: Account<'info, Intent>`
        // where `bump` was specified in the #[account] macro.
        intent.bump = ctx.bumps.intent;
        // No need for .ok_or() here, as direct field access will fail compilation
        // if the bump wasn't correctly defined/derived by Anchor.

        msg!("Intent submitted (PDA: {})", intent_pda_key);

        // FIX: Fixed formatting specifiers and argument alignment
        msg!(
            "User: {}, Intent ID: {}, Input: {}, Output: {}, Amount: {}, Expiry: {:?}, Category: {}",
            intent.user,
            intent.intent_id,
            intent.input_mint,
            intent.output_mint,
            intent.input_amount,
            intent.expiry_ts, // Using {:?} for Option<i64>
            intent.category
        );

        // --- Emit Event ---
        emit!(IntentSubmittedEvent {
            intent_pda: intent_pda_key,
            user: intent.user,
            intent_id: intent.intent_id,
            input_mint: intent.input_mint,
            output_mint: intent.output_mint,
            input_amount: intent.input_amount,
            expiry_ts: intent.expiry_ts,
            category: intent.category,
            creation_ts: intent.creation_ts,
        });

        // REMINDER: Client needs to derive the `intent_authority` PDA and
        // have the user 'approve' delegation after this transaction confirms.

        Ok(())
    }

    pub fn cancel_intent(ctx: Context<CancelIntent>, _intent_id: u64) -> Result<()> {
        // _intent_id is passed via #[instruction] and used in #[account(seeds/bump)]
        // Authorization check is implicitly done by the PDA derivation using user.key()
        // and the `close = user` constraint ensures only the user gets the rent back.

        let intent = &ctx.accounts.intent; // Borrow immutably for event
        let intent_pda_key = intent.key(); // Store key for later use

        msg!(
            "Intent {} cancelled by user {}.",
            intent_pda_key,
            ctx.accounts.user.key()
        );

        // --- Emit Event ---
        // Emit *before* the account is closed by the `close = user` constraint
        emit!(IntentCancelledEvent {
            intent_pda: intent_pda_key,
            user: intent.user,
            intent_id: intent.intent_id,
        });

        Ok(())
    }

    pub fn fulfill_intent(
        ctx: Context<FulfillIntent>,
        _intent_id: u64, // Passed via #[instruction] and used in #[account(seeds/bump)]
        output_amount_to_user: u64,
    ) -> Result<()> {
        let intent = &mut ctx.accounts.intent;
        let clock = Clock::get()?;
        let intent_pda_key = intent.key(); // Store the key before mutable operations

        // --- Validation Checks ---
        require!(!intent.fulfilled, CustomError::IntentAlreadyFulfilled);
        require!(output_amount_to_user > 0, CustomError::InvalidOutputAmount);

        // Check expiry
        if let Some(expiry) = intent.expiry_ts {
            require!(clock.unix_timestamp < expiry, CustomError::IntentExpired);
        }

        // Check delegate on user's input token account
        require!(
            ctx.accounts
                .user_input_token_account
                .delegate
                .contains(&ctx.accounts.intent_authority.key()),
            CustomError::DelegateNotSet
        );
        require!(
            ctx.accounts.user_input_token_account.delegated_amount >= intent.input_amount,
            CustomError::InsufficientDelegatedAmount
        );

        // --- Define PDA Signer Seeds for Token Transfer Authority ---
        // We need the bump for the authority PDA to sign the transfer.
        // Access it directly via the field name `intent_authority` on ctx.bumps.
        let authority_bump = ctx.bumps.intent_authority;
        let authority_seeds = &[&INTENT_AUTHORITY_SEED[..], &[authority_bump]];
        let signer_seeds = &[&authority_seeds[..]];

        // Sanity check the derived address (optional but good practice)
        let (_intent_authority_pda, derived_bump) =
            Pubkey::find_program_address(&[INTENT_AUTHORITY_SEED], ctx.program_id);
        require!(derived_bump == authority_bump, CustomError::BumpMismatch); // Use a more specific error if desired
        require!(
            ctx.accounts.intent_authority.key() == _intent_authority_pda,
            CustomError::InvalidAuthorityPDA
        );

        // --- Perform Token Transfers via CPI ---

        // 1. Transfer User's Input Tokens -> Solver's Input Account (using delegate PDA)
        msg!(
            "Transferring {} from user {} (account {}) (via PDA {}) to solver {} (account {})",
            intent.input_amount,
            intent.user,
            ctx.accounts.user_input_token_account.key(),
            ctx.accounts.intent_authority.key(),
            ctx.accounts.solver.key(),
            ctx.accounts.solver_input_token_account.key()
        );
        let transfer_user_to_solver_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_input_token_account.to_account_info(),
                to: ctx.accounts.solver_input_token_account.to_account_info(),
                authority: ctx.accounts.intent_authority.to_account_info(),
            },
            signer_seeds, // Use the seeds derived above
        );
        token::transfer(transfer_user_to_solver_ctx, intent.input_amount)?;
        msg!("User -> Solver transfer complete.");

        // 2. Transfer Solver's Output Tokens -> User's Output Account (using solver signature)
        msg!(
            "Transferring {} from solver {} (account {}) to user {} (account {})",
            output_amount_to_user,
            ctx.accounts.solver.key(),
            ctx.accounts.solver_output_token_account.key(),
            intent.user,
            ctx.accounts.user_output_token_account.key()
        );
        let transfer_solver_to_user_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.solver_output_token_account.to_account_info(),
                to: ctx.accounts.user_output_token_account.to_account_info(),
                authority: ctx.accounts.solver.to_account_info(), // Solver signs
            },
        );
        token::transfer(transfer_solver_to_user_ctx, output_amount_to_user)?;
        msg!("Solver -> User transfer complete.");

        // --- Update Intent State ---
        intent.fulfilled = true;
        intent.solver = Some(ctx.accounts.solver.key());
        intent.output_amount_fulfilled = Some(output_amount_to_user);
        intent.fulfilled_timestamp = Some(clock.unix_timestamp);

        // Store the solver and timestamp before unwrapping so we don't borrow after move
        let solver_key = intent.solver.unwrap();
        let fulfilled_ts = intent.fulfilled_timestamp.unwrap();

        msg!(
            "Intent {} fulfilled by solver {} at timestamp {}",
            intent_pda_key,
            solver_key,
            fulfilled_ts
        );

        // --- Emit Event ---
        emit!(IntentFulfilledEvent {
            intent_pda: intent_pda_key,
            user: intent.user,
            intent_id: intent.intent_id,
            solver: solver_key,
            input_mint: intent.input_mint,
            output_mint: intent.output_mint,
            input_amount: intent.input_amount,
            output_amount_fulfilled: intent.output_amount_fulfilled.unwrap(),
            fulfilled_timestamp: fulfilled_ts,
            category: intent.category,
        });

        // Optional: Could close the intent account here returning rent to solver,
        // but keeping it allows fetching history. Closing would need `close = solver` constraint.

        Ok(())
    }
}

// --- Account Structs ---

#[derive(Accounts)]
#[instruction(
    intent_id: u64,
    input_mint: Pubkey,
    output_mint: Pubkey,
    input_amount: u64,
    expiry_ts: Option<i64>,
    category: u64
)]
pub struct SubmitIntent<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Intent::INIT_SPACE, // FIX: Changed LEN to INIT_SPACE
        seeds = [INTENT_PDA_SEED, user.key().as_ref(), &intent_id.to_le_bytes()],
        bump // Anchor makes the bump available as ctx.bumps.intent
    )]
    pub intent: Account<'info, Intent>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(intent_id: u64)] // Need ID to find the PDA
pub struct CancelIntent<'info> {
    #[account(
        mut,
        seeds = [INTENT_PDA_SEED, user.key().as_ref(), &intent_id.to_le_bytes()],
        bump = intent.bump, // Use stored bump for verification when closing
        close = user // Rent refund to original user
    )]
    pub intent: Account<'info, Intent>,
    #[account(mut)] // User needs lamports back
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(intent_id: u64, output_amount_to_user: u64)]
pub struct FulfillIntent<'info> {
    #[account(
        mut,
        seeds = [INTENT_PDA_SEED, user.key().as_ref(), &intent_id.to_le_bytes()],
        bump = intent.bump, // Validate bump stored in the intent account
        // Ensure intent mints match the passed token account mints
        constraint = intent.input_mint == user_input_token_account.mint @ CustomError::InputMintMismatch,
        constraint = intent.output_mint == user_output_token_account.mint @ CustomError::OutputMintMismatch,
        constraint = intent.input_mint == solver_input_token_account.mint @ CustomError::InputMintMismatch, // Also check solver accounts match intent
        constraint = intent.output_mint == solver_output_token_account.mint @ CustomError::OutputMintMismatch,
        constraint = !intent.fulfilled @ CustomError::IntentAlreadyFulfilled,
        // Check token account ownership matches intent owner derived from PDA seed check
        constraint = intent.user == user_input_token_account.owner @ CustomError::UserTokenAccountMismatch,
        constraint = intent.user == user_output_token_account.owner @ CustomError::UserTokenAccountMismatch,
    )]
    pub intent: Account<'info, Intent>,

    /// CHECK: User account is validated via PDA seeds/constraints on intent & token accounts.
    /// Does not need to be a signer for fulfillment. Its key is part of intent PDA seeds.
    #[account(address = intent.user @ CustomError::UserAccountMismatch)]
    // Ensure this AccountInfo matches the user stored in the intent derived from seeds
    pub user: AccountInfo<'info>,

    #[account(mut)] // Solver pays transaction fees & signs for their token transfer
    pub solver: Signer<'info>,

    /// CHECK: Authority PDA derived from fixed seed, used for delegated transfer authority.
    #[account(
        seeds = [INTENT_AUTHORITY_SEED],
        bump // Anchor makes bump available as ctx.bumps.intent_authority
    )]
    pub intent_authority: AccountInfo<'info>, // Should be AccountInfo<'info> or UncheckedAccount<'info>

    // User's Token Accounts
    #[account(
        mut,
        // Add constraint to ensure ATA or provided account belongs to the correct user and mint
        constraint = user_input_token_account.owner == user.key() @ CustomError::UserTokenAccountMismatch,
        constraint = user_input_token_account.mint == intent.input_mint @ CustomError::InputMintMismatch
    )]
    pub user_input_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        // Add constraint to ensure ATA or provided account belongs to the correct user and mint
        constraint = user_output_token_account.owner == user.key() @ CustomError::UserTokenAccountMismatch,
        constraint = user_output_token_account.mint == intent.output_mint @ CustomError::OutputMintMismatch
    )]
    pub user_output_token_account: Account<'info, TokenAccount>,

    // Solver's Token Accounts
    #[account(
        mut,
        constraint = solver_input_token_account.owner == solver.key() @ CustomError::SolverTokenAccountMismatch,
        constraint = solver_input_token_account.mint == intent.input_mint @ CustomError::InputMintMismatch // Ensure solver is using correct mint
    )]
    pub solver_input_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = solver_output_token_account.owner == solver.key() @ CustomError::SolverTokenAccountMismatch,
        constraint = solver_output_token_account.mint == intent.output_mint @ CustomError::OutputMintMismatch // Ensure solver is using correct mint
    )]
    pub solver_output_token_account: Account<'info, TokenAccount>,

    // Programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>, // Needed if closing account, otherwise optional if no rent transfers needed
}

// --- Data Structures ---

#[account]
#[derive(InitSpace)] // Use InitSpace to automatically calculate size if preferred
pub struct Intent {
    pub user: Pubkey,        // 32 - The user who created the intent
    pub intent_id: u64,      // 8  - ID (used in PDA seed) provided by user
    pub input_mint: Pubkey,  // 32 - Token user wants to give
    pub output_mint: Pubkey, // 32 - Token user wants to receive
    pub input_amount: u64,   // 8  - Amount of input token
    pub category: u64,       // 8  - Simple category tag
    pub creation_ts: i64,    // 8  - Timestamp when created
    #[max_len(1)] // For Option<i64> space calculation with InitSpace
    pub expiry_ts: Option<i64>, // 1 + 8 = 9 - Optional expiry timestamp
    pub fulfilled: bool,     // 1  - Has the intent been processed?
    #[max_len(1)] // For Option<Pubkey> space calculation with InitSpace
    pub solver: Option<Pubkey>, // 1 + 32 = 33 - Who fulfilled the intent
    #[max_len(1)] // For Option<u64> space calculation with InitSpace
    pub output_amount_fulfilled: Option<u64>, // 1 + 8 = 9 - Actual output amount received
    #[max_len(1)] // For Option<i64> space calculation with InitSpace
    pub fulfilled_timestamp: Option<i64>, // 1 + 8 = 9 - When it was fulfilled
    pub bump: u8,            // 1 - Bump seed used for the Intent PDA
}

// --- Events ---
// (Events remain the same)
#[event]
pub struct IntentSubmittedEvent {
    pub intent_pda: Pubkey, // Address of the created intent account
    pub user: Pubkey,
    pub intent_id: u64,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub input_amount: u64,
    pub expiry_ts: Option<i64>,
    pub category: u64,
    pub creation_ts: i64,
}

#[event]
pub struct IntentCancelledEvent {
    pub intent_pda: Pubkey,
    pub user: Pubkey,
    pub intent_id: u64,
}

#[event]
pub struct IntentFulfilledEvent {
    pub intent_pda: Pubkey,
    pub user: Pubkey,
    pub intent_id: u64,
    pub solver: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub input_amount: u64,
    pub output_amount_fulfilled: u64,
    pub fulfilled_timestamp: i64,
    pub category: u64,
}

// --- Error Codes ---

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized: Signer is not the intent owner.")]
    Unauthorized,
    #[msg("Intent has already been fulfilled.")]
    IntentAlreadyFulfilled,
    #[msg("Provided token account does not match the intent's input mint.")]
    InputMintMismatch,
    #[msg("Provided token account does not match the intent's output mint.")]
    OutputMintMismatch,
    #[msg("Provided user token account owner does not match the intent creator.")]
    UserTokenAccountMismatch,
    #[msg("Provided solver token account owner does not match the solver signer.")]
    SolverTokenAccountMismatch,
    #[msg("User's input token account does not have delegate set to the program authority.")]
    DelegateNotSet,
    #[msg("User's input token account has insufficient delegated amount.")]
    InsufficientDelegatedAmount,
    #[msg("Output amount provided by solver must be greater than zero.")]
    InvalidOutputAmount,
    #[msg("Intent has expired.")]
    IntentExpired,
    #[msg("Expiry timestamp must be in the future.")]
    ExpiryInPast,
    #[msg("Provided authority PDA derived address is incorrect.")]
    InvalidAuthorityPDA,
    #[msg("The user AccountInfo provided does not match the user stored in the intent.")]
    UserAccountMismatch,
    #[msg("Bump seed mismatch between context and derivation.")] // Added specific error
    BumpMismatch,
    // Removed BumpSeedNotInHashMap as direct access makes it less likely/needed
}
