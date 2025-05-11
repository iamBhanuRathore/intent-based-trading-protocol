'use client';
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { clusterApiUrl } from "@solana/web3.js";

// Configuration constants
const NETWORK = "mainnet-beta";
const FALLBACK_ENDPOINT = clusterApiUrl(NETWORK);

const WalletProviderLayout = ({ children }: { children: React.ReactNode }) => {
    const endpoint = process.env.NEXT_PUBLIC_RPC_URL || FALLBACK_ENDPOINT;

    const validEndpoint = endpoint.startsWith('http') ? endpoint : FALLBACK_ENDPOINT;

    const wallets = [new PhantomWalletAdapter()];

    return (
        <ConnectionProvider endpoint={validEndpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}
export default WalletProviderLayout;
