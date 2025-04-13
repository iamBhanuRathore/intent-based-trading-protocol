// Make sure your package.json has "type": "module"
import { Connection, BPF_LOADER_PROGRAM_ID, PublicKey, clusterApiUrl } from '@solana/web3.js';

const checkProgramDeployment = async () => {
  const programId = new PublicKey('AJiU2A3GBcVwP8o9tmKPYW6tVWESgrNtKcHqfoDGVkZ6'); // Your Program ID
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  console.log(`Checking for Program ID: ${programId.toBase58()} on Devnet...`);

  try {
    const accountInfo = await connection.getAccountInfo(programId);

    if (accountInfo === null) {
      console.log("❌ Program not found at this address on Devnet.");
      return;
    }

    console.log("✅ Account found!");
    console.log(`   Executable: ${accountInfo.executable}`);
    console.log(`   Owner: ${accountInfo.owner.toBase58()}`); // Log the actual owner
    console.log(`   Lamports: ${accountInfo.lamports}`);
    console.log(`   Data Length: ${accountInfo.data.length}`);

    // Check against the owner ID
    if (accountInfo.executable) {
        // Check against the CURRENT BPF Upgradeable Loader V2
        console.log("   Checking program owner...",BPF_LOADER_PROGRAM_ID);
        if (accountInfo.owner.equals(BPF_LOADER_PROGRAM_ID.toBase58())) {
             console.log("   ✅ Program owner is the current BPF Upgradeable Loader (Correct for Anchor).");
        }
        // Optional: Check against the DEPRECATED loader as well
        else if (accountInfo.owner.equals(new PublicKey("BPFLoader1111111111111111111111111111111111"))) { // BPF_LOADER_DEPRECATED_PROGRAM_ID
            console.log("   ⚠️ Program owner is the DEPRECATED BPF Loader.");
        }
        else {
             console.log("   ❓ Program is executable but owner is NEITHER the deprecated nor the current BPF Upgradeable Loader.");
        }
    } else {
       console.log("   ❌ Account exists but is not executable.");
    }

  } catch (error) {
    console.error("🚨 Error fetching account info:", error);
  }
};

checkProgramDeployment();
