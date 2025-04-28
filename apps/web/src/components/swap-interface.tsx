'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { ArrowDown, Settings, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import TokenDisplay from './token-display';
import TokenSelectModal from './token-select-modal'; // Assuming this component accepts a 'tokens' prop now
// -----------------------
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@project-serum/anchor";
import { getJupiterQuote } from '@/lib/submitIntent';
// -----------------------

// --- Define Token Interface ---
export interface Token {
  symbol: string;
  name: string;
  logo: string;
  mintAddress: string; // Added: Mint address as string
  decimals: number;    // Added: Token decimals
}

// --- Define Common Solana Tokens ---
// (Replace placeholders and add more tokens as needed)
const SOLANA_TOKENS: Token[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    logo: '/tokens/sol.png',
    mintAddress: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    logo: '/tokens/usdc.png',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    logo: '/tokens/usdt.png',
    mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    logo: '/tokens/jup.png',
    mintAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    logo: '/tokens/eth.png',
    mintAddress: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    decimals: 6,
  },
];


interface SwapInterfaceProps {
  className?: string;
}

const SwapInterface: React.FC<SwapInterfaceProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('swap');
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState(''); // Note: Buy amount is often calculated, not input directly in simple swaps
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = new Connection(process.env.RPC_URL!);
  const wallet = useAnchorWallet();
  const publicKey = wallet?.publicKey;

  // Token states - Initialize with default Solana tokens
  const [fromToken, setFromToken] = useState<Token>(SOLANA_TOKENS[0]); // Default to SOL
  const [toToken, setToToken] = useState<Token>(SOLANA_TOKENS[1]); // Default to USDC

  // Modal states
  const [isSelectingFrom, setIsSelectingFrom] = useState(false);
  const [isSelectingTo, setIsSelectingTo] = useState(false);

  // --- Handlers ---
  const handleFromTokenSelect = (token: Token) => {
    // Prevent selecting the same token for both fields
    if (toToken?.mintAddress === token.mintAddress) {
      setToToken(fromToken); // Swap if the user selects the token already in the 'to' field
    }
    setFromToken(token);
    setIsSelectingFrom(false); // Close modal after selection
  };

  const handleToTokenSelect = (token: Token) => {
    // Prevent selecting the same token for both fields
    if (fromToken?.mintAddress === token.mintAddress) {
      setFromToken(toToken); // Swap if the user selects the token already in the 'from' field
    }
    setToToken(token);
    setIsSelectingTo(false); // Close modal after selection
  };

  const handleSwapTokens = () => {
    if (fromToken && toToken) {
      const tempToken = fromToken;
      setFromToken(toToken);
      setToToken(tempToken);

      const tempAmount = sellAmount;
      setSellAmount(buyAmount);
      setBuyAmount(tempAmount);
    }
  };

  // Memoize the provider to avoid recreation on every render
  const provider = useMemo(() => {
    if (!connection || !wallet) return null;
    return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
  }, [connection, wallet]);


  const handleSubmitIntent = useCallback(async () => {
    if (!publicKey || !wallet || !provider || !wallet.signTransaction) { // Add signTransaction check
      setError("Wallet not connected, program not initialized, or wallet cannot sign.");
      console.error("Pre-check failed:", { publicKey, wallet, provider });
      return;
    }
    if (!fromToken || !toToken) {
      setError("Please select both tokens.");
      return;
    }
    const sellAmountFloat = parseFloat(sellAmount);
    if (!sellAmount || isNaN(sellAmountFloat) || sellAmountFloat <= 0) {
      setError("Please enter a valid amount to sell.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const inputMint = new PublicKey(fromToken.mintAddress);
    const outputMint = new PublicKey(toToken.mintAddress);
    try {
      const quote = await getJupiterQuote(inputMint.toBase58(), outputMint.toBase58(), sellAmountFloat, connection, wallet);
      console.log(quote);
    } catch (error) {
      console.error("Error fetching Jupiter quote:", error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, wallet, provider, fromToken, toToken, sellAmount]); // Add dependencies

  // Determine Button State
  const getButtonState = () => {
    if (!publicKey || !wallet) {
      // In a real app, you'd likely use WalletMultiButton here
      // For this example, we just change the text/action
      return {
        text: "Connect Wallet",
        action: () => {
          // Ideally trigger wallet modal, e.g., using useWalletModal() from adapter-react-ui
          // Or just inform the user they need to connect via their extension/button
          alert("Please connect your wallet using the wallet adapter button/extension.");
        },
        disabled: false
      };
    }
    if (!fromToken || !toToken) {
      return { text: "Select Tokens", action: () => { }, disabled: true };
    }
    if (!sellAmount || isNaN(parseFloat(sellAmount)) || parseFloat(sellAmount) <= 0) {
      return { text: "Enter Amount", action: () => { }, disabled: true };
    }
    if (isLoading) {
      return { text: "Processing...", action: () => { }, disabled: true };
    }
    return { text: "Submit Intent", action: handleSubmitIntent, disabled: false };
  };

  const buttonState = getButtonState();
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="bg-card/20 backdrop-blur-sm rounded-3xl border border-secondary p-4">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center bg-secondary/30 p-1 rounded-xl">
            {['swap', 'limit', 'send', 'buy'].map((tab) => (
              <button
                key={tab}
                className={cn(
                  "swap-tab capitalize px-3 py-1 text-sm rounded-lg", // Adjusted styling
                  activeTab === tab
                    ? "bg-cyan-500 text-black font-medium" // Active style
                    : "text-zinc-400 hover:text-white" // Inactive style
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Sell section */}
        <div className="bg-secondary/30 rounded-2xl p-4 mb-1 slide-in">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-400">Sell</span>
            {/* Optionally show balance here */}
          </div>

          <div className="flex justify-between items-center">
            <input
              type="number" // Use number type for better input handling
              placeholder="0"
              value={sellAmount}
              onChange={(e) => {
                setSellAmount(e.target.value);
                setError(null); // Clear error on input change
              }}
              className="token-input bg-transparent text-2xl font-medium outline-none w-full mr-2" // Basic input styling
            />
            <TokenDisplay
              type="selected"
              token={fromToken}
              onClick={() => {
                console.log('Opening token select modal');
                setIsSelectingFrom(true);
              }}
            />
          </div>

          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-500">$0.00</span> {/* TODO: Add price fetching */}
          </div>
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center -my-3 relative ">
          <button
            className="bg-secondary rounded-xl p-2 hover:bg-secondary/80 transition-colors disabled:opacity-50"
            onClick={handleSwapTokens}
            disabled={!fromToken || !toToken} // Disable if tokens aren't set
          >
            <ArrowDown className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Buy section */}
        <div className="bg-secondary/30 rounded-2xl p-4 mt-1 slide-in">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-400">Buy (Estimated)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 items-center">
            <input
              type="number" // Use number type
              placeholder="0"
              value={buyAmount} // This might be calculated based on sellAmount and market rate
              onChange={(e) => setBuyAmount(e.target.value)} // Or just display calculated value
              readOnly // Often, the buy amount is calculated, not set by user directly in simple swaps
              className="token-input bg-transparent text-2xl font-medium outline-none w-full opacity-70" // Indicate it's estimated/read-only
            />
            {toToken ? (
              <TokenDisplay
                type="selected"
                token={toToken}
                onClick={() => setIsSelectingTo(true)}
              />
            ) : (
              <TokenDisplay
                type="select"
                onClick={() => setIsSelectingTo(true)}
              />
            )}
          </div>

          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-500">$0.00</span> {/* TODO: Add price fetching */}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        {/* Action Button */}
        <Button
          className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-medium py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" // Adjusted padding
          onClick={buttonState.action}
          disabled={buttonState.disabled || isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {buttonState.text}
        </Button>
      </div>

      <div className="relative">
        {isSelectingFrom && (
          <TokenSelectModal
            isOpen={isSelectingFrom}
            onClose={() => setIsSelectingFrom(false)}
            onSelect={handleFromTokenSelect}
            tokens={SOLANA_TOKENS}
            currentToken={toToken}
          />
        )}

        {isSelectingTo && (
          <TokenSelectModal
            isOpen={isSelectingTo}
            onClose={() => setIsSelectingTo(false)}
            onSelect={handleToTokenSelect}
            tokens={SOLANA_TOKENS}
            currentToken={fromToken}
          />
        )}
      </div>
    </div>
  );
};

export default SwapInterface;
