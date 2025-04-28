// Make sure your package.json has "type": "module"
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

const BPF_UPGRADEABLE_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

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
    console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
    console.log(`   Lamports: ${accountInfo.lamports}`);
    console.log(`   Data Length: ${accountInfo.data.length}`);

    // Check against the owner ID
    if (accountInfo.executable) {
        // Check against the BPF Upgradeable Loader
        if (accountInfo.owner.equals(BPF_UPGRADEABLE_LOADER_ID)) {
             console.log("   ✅ Program owner is the BPF Upgradeable Loader (Correct for Anchor).");
        } else {
             console.log("   ❓ Program is executable but owner is not the BPF Upgradeable Loader.");
        }
    } else {
       console.log("   ❌ Account exists but is not executable.");
    }

  } catch (error) {
    console.error("🚨 Error fetching account info:", error);
  }
};

checkProgramDeployment();
