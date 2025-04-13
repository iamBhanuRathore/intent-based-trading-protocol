'use client';
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletProviderLayout = ({children}: {children: React.ReactNode}) => {
    const endpoint = clusterApiUrl("devnet");
    const wallets = [new PhantomWalletAdapter()];
    return (
        <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
            {children}
        </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    )
}
export default WalletProviderLayout;