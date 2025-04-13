export const IDL = {
  "version": "0.1.0",
  "name": "intent_protocol",
  "instructions": [
    {
      "name": "submitIntent",
      "accounts": [
        { "name": "intent", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "intentId", "type": { "defined": "u64" } },
        { "name": "inputMint", "type": { "defined": "publicKey" } },
        { "name": "outputMint", "type": { "defined": "publicKey" } },
        { "name": "inputAmount", "type": { "defined": "u64" } },
        { "name": "expiryTs", "type": { "option": { "defined": "i64" } } },
        { "name": "category", "type": { "defined": "u64" } }
      ]
    },
    {
      "name": "cancelIntent",
      "accounts": [
        { "name": "intent", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true }
      ],
      "args": [{ "name": "intentId", "type": { "defined": "u64" } }]
    },
    {
      "name": "fulfillIntent",
      "accounts": [
        { "name": "intent", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": false, "isSigner": false },
        { "name": "solver", "isMut": true, "isSigner": true },
        { "name": "intentAuthority", "isMut": false, "isSigner": false },
        { "name": "userInputTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userOutputTokenAccount", "isMut": true, "isSigner": false },
        { "name": "solverInputTokenAccount", "isMut": true, "isSigner": false },
        {
          "name": "solverOutputTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "intentId", "type": { "defined": "u64" } },
        { "name": "outputAmountToUser", "type": { "defined": "u64" } }
      ]
    }
  ],

  "accounts": [
    {
      "name": "Intent",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "user", "type": { "defined": "publicKey" } },
          { "name": "intentId", "type": { "defined": "u64" } },
          { "name": "inputMint", "type": { "defined": "publicKey" } },
          { "name": "outputMint", "type": { "defined": "publicKey" } },
          { "name": "inputAmount", "type": { "defined": "u64" } },
          { "name": "category", "type": { "defined": "u64" } },
          { "name": "creationTs", "type": { "defined": "i64" } },
          { "name": "expiryTs", "type": { "option": { "defined": "i64" } } },
          { "name": "fulfilled", "type": { "defined": "bool" } },
          { "name": "solver", "type": { "option": { "defined": "publicKey" } } },
          { "name": "outputAmountFulfilled", "type": { "option": { "defined": "u64" } } },
          { "name": "fulfilledTimestamp", "type": { "option": { "defined": "i64" } } },
          { "name": "bump", "type": { "defined": "u8" } }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "IntentSubmittedEvent",
      "fields": [
        { "name": "intentPda", "type": "publicKey", "index": false },
        { "name": "user", "type": "publicKey", "index": false },
        { "name": "intentId", "type": "u64", "index": false },
        { "name": "inputMint", "type": "publicKey", "index": false },
        { "name": "outputMint", "type": "publicKey", "index": false },
        { "name": "inputAmount", "type": "u64", "index": false },
        { "name": "expiryTs", "type": { "option": "i64" }, "index": false },
        { "name": "category", "type": "u64", "index": false },
        { "name": "creationTs", "type": "i64", "index": false }
      ]
    },
    {
      "name": "IntentCancelledEvent",
      "fields": [
        { "name": "intentPda", "type": "publicKey", "index": false },
        { "name": "user", "type": "publicKey", "index": false },
        { "name": "intentId", "type": "u64", "index": false }
      ]
    },
    {
      "name": "IntentFulfilledEvent",
      "fields": [
        { "name": "intentPda", "type": "publicKey", "index": false },
        { "name": "user", "type": "publicKey", "index": false },
        { "name": "intentId", "type": "u64", "index": false },
        { "name": "solver", "type": "publicKey", "index": false },
        { "name": "inputMint", "type": "publicKey", "index": false },
        { "name": "outputMint", "type": "publicKey", "index": false },
        { "name": "inputAmount", "type": "u64", "index": false },
        { "name": "outputAmountFulfilled", "type": "u64", "index": false },
        { "name": "fulfilledTimestamp", "type": "i64", "index": false },
        { "name": "category", "type": "u64", "index": false }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Unauthorized: Signer is not the intent owner."
    },
    {
      "code": 6001,
      "name": "IntentAlreadyFulfilled",
      "msg": "Intent has already been fulfilled."
    },
    {
      "code": 6002,
      "name": "InputMintMismatch",
      "msg": "Provided token account does not match the intent's input mint."
    },
    {
      "code": 6003,
      "name": "OutputMintMismatch",
      "msg": "Provided token account does not match the intent's output mint."
    },
    {
      "code": 6004,
      "name": "UserTokenAccountMismatch",
      "msg": "Provided user token account owner does not match the intent creator."
    },
    {
      "code": 6005,
      "name": "SolverTokenAccountMismatch",
      "msg": "Provided solver token account owner does not match the solver signer."
    },
    {
      "code": 6006,
      "name": "DelegateNotSet",
      "msg": "User's input token account does not have delegate set to the program authority."
    },
    {
      "code": 6007,
      "name": "InsufficientDelegatedAmount",
      "msg": "User's input token account has insufficient delegated amount."
    },
    {
      "code": 6008,
      "name": "InvalidOutputAmount",
      "msg": "Output amount provided by solver must be greater than zero."
    },
    { "code": 6009, "name": "IntentExpired", "msg": "Intent has expired." },
    {
      "code": 6010,
      "name": "ExpiryInPast",
      "msg": "Expiry timestamp must be in the future."
    },
    {
      "code": 6011,
      "name": "InvalidAuthorityPDA",
      "msg": "Provided authority PDA derived address is incorrect."
    },
    {
      "code": 6012,
      "name": "UserAccountMismatch",
      "msg": "The user AccountInfo provided does not match the user stored in the intent."
    },
    {
      "code": 6013,
      "name": "BumpMismatch",
      "msg": "Bump seed mismatch between context and derivation."
    }
  ]
}

export const IDL_JSON = JSON.stringify(IDL, null, 2);
