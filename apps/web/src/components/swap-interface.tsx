'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ArrowDown, Settings, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import TokenDisplay from './token-display';
import TokenSelectModal from './token-select-modal'; // Assuming this component accepts a 'tokens' prop now
// -----------------------
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@project-serum/anchor";
import { submitIntent } from '@/lib/submitIntent';
import { getAssociatedTokenAddress } from '@solana/spl-token';
// -----------------------
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
// --- Define Token Interface ---
// export interface Token {
//   symbol: string;
//   name: string;
//   logo: string;
//   mintAddress: string; // Added: Mint address as string
//   decimals: number;    // Added: Token decimals
// }
const sol = {
  "id": "So11111111111111111111111111111111111111112",
  "name": "Wrapped SOL",
  "symbol": "SOL",
  "icon": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  "decimals": 9,
  "circSupply": 518188878.169535,
  "totalSupply": 600060916.579771,
  "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "firstPool": {
    "id": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    "createdAt": "2021-03-29T10:05:48Z"
  },
  "holderCount": 1722427,
  "fdv": 88192180547.5792,
  "mcap": 76159279564.0772,
  "usdPrice": 146.972045855373,
  "liquidity": 89631689.5018421,
  "stats5m": {
    "priceChange": 0.130851429171843,
    "liquidityChange": 0.0440949745714994,
    "volumeChange": 26.0051224058945,
    "buyVolume": 5695741.65475385,
    "sellVolume": 5014462.76278622,
    "buyOrganicVolume": 452973.505001058,
    "sellOrganicVolume": 380469.304261223,
    "numBuys": 47283,
    "numSells": 56068,
    "numTraders": 18031,
    "numOrganicBuyers": 1923,
    "numNetBuyers": 3483
  },
  "stats1h": {
    "priceChange": 0.947661991136875,
    "liquidityChange": 0.606136898112973,
    "volumeChange": -10.0242845983694,
    "buyVolume": 66177878.9735862,
    "sellVolume": 63013329.7180116,
    "buyOrganicVolume": 5029487.06396439,
    "sellOrganicVolume": 6168450.48016921,
    "numBuys": 577401,
    "numSells": 661142,
    "numTraders": 84249,
    "numOrganicBuyers": 4633,
    "numNetBuyers": 14566
  },
  "stats6h": {
    "priceChange": 2.35362703655033,
    "liquidityChange": 1.59089816130321,
    "volumeChange": -10.9995394166084,
    "buyVolume": 621506649.679709,
    "sellVolume": 606624520.154976,
    "buyOrganicVolume": 37112293.2290698,
    "sellOrganicVolume": 40191296.0515757,
    "numBuys": 3528777,
    "numSells": 4026997,
    "numTraders": 324817,
    "numOrganicBuyers": 16168,
    "numNetBuyers": 67557
  },
  "stats24h": {
    "priceChange": 0.0276721342124773,
    "liquidityChange": 0.744628411909294,
    "volumeChange": 51.8676875683889,
    "buyVolume": 2222883687.74327,
    "sellVolume": 2221745712.39999,
    "buyOrganicVolume": 119819305.562336,
    "sellOrganicVolume": 135170928.951341,
    "numBuys": 11496045,
    "numSells": 13611193,
    "numTraders": 1109844,
    "numOrganicBuyers": 32588,
    "numNetBuyers": 149126
  },
  "audit": {
    "mintAuthorityDisabled": true,
    "freezeAuthorityDisabled": true,
    "topHoldersPercentage": 1.21177063810937
  },
  "organicScore": 99.4045065714971,
  "organicScoreLabel": "high",
  "ctLikes": 2129,
  "smartCtLikes": 178,
  "isVerified": true,
  "cexes": [
    "Binance",
    "Bybit",
    "OKX",
    "Upbit",
    "Bitget",
    "Kraken",
    "KuCoin",
    "MEXC",
    "Gate.io"
  ],
  "tags": [
    "community",
    "strict",
    "verified"
  ],
  "updatedAt": "2025-05-05T21:55:22.173401082Z"
};
const usdc = {
  "id": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "name": "USD Coin",
  "symbol": "USDC",
  "icon": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  "decimals": 6,
  "circSupply": 10387657805.6465,
  "totalSupply": 10387657805.6465,
  "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
  "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
  "firstPool": {
    "id": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    "createdAt": "2021-03-29T10:05:48Z"
  },
  "holderCount": 4197146,
  "fdv": 10387626196.0422,
  "mcap": 10387626196.0422,
  "usdPrice": 0.999996957003698,
  "liquidity": 25241539.3744423,
  "stats5m": {
    "priceChange": 0.000290280704090347,
    "liquidityChange": 0.0028059617210213,
    "volumeChange": -47.6232295136619,
    "buyVolume": 1692595.51384691,
    "sellVolume": 2484649.21373966,
    "buyOrganicVolume": 253153.836310557,
    "sellOrganicVolume": 256577.244380071,
    "numBuys": 3937,
    "numSells": 4570,
    "numTraders": 1841,
    "numOrganicBuyers": 202,
    "numNetBuyers": 375
  },
  "stats1h": {
    "priceChange": -0.00053378899727243,
    "liquidityChange": -0.000721860632847708,
    "volumeChange": -19.7055323938324,
    "buyVolume": 27902759.0471133,
    "sellVolume": 33144325.4503506,
    "buyOrganicVolume": 2396983.48167611,
    "sellOrganicVolume": 2697956.71886538,
    "numBuys": 59834,
    "numSells": 66181,
    "numTraders": 11744,
    "numOrganicBuyers": 649,
    "numNetBuyers": 1765
  },
  "stats6h": {
    "priceChange": -0.000801579956202279,
    "liquidityChange": -0.0136029703424509,
    "volumeChange": -26.9164284049193,
    "buyVolume": 397751408.830487,
    "sellVolume": 402160935.469638,
    "buyOrganicVolume": 18632856.8478432,
    "sellOrganicVolume": 17602802.2345145,
    "numBuys": 423648,
    "numSells": 453349,
    "numTraders": 45913,
    "numOrganicBuyers": 3448,
    "numNetBuyers": 7395
  },
  "stats24h": {
    "priceChange": 0.00288391287721556,
    "liquidityChange": 1.38508217115761,
    "volumeChange": 91.855427166696,
    "buyVolume": 1536269995.04792,
    "sellVolume": 1528228432.16562,
    "buyOrganicVolume": 72625078.32887,
    "sellOrganicVolume": 67297123.944984,
    "numBuys": 2045547,
    "numSells": 2119116,
    "numTraders": 123111,
    "numOrganicBuyers": 10824,
    "numNetBuyers": 20153
  },
  "audit": {
    "topHoldersPercentage": 42.1893635408922
  },
  "organicScore": 100,
  "organicScoreLabel": "high",
  "ctLikes": 14,
  "smartCtLikes": 3,
  "isVerified": true,
  "cexes": [
    "Binance",
    "Bybit",
    "OKX",
    "Upbit",
    "Bitget",
    "Kraken",
    "KuCoin",
    "MEXC",
    "Gate.io"
  ],
  "tags": [
    "community",
    "strict",
    "verified"
  ],
  "updatedAt": "2025-05-05T21:50:25.173880359Z"
};
export type Token = typeof sol | typeof usdc;

// --- Define Common Solana Tokens ---
// (Replace placeholders and add more tokens as needed)
const SOLANA_DEFAULT_TOKENS: Token[] = [
  {
    "id": "So11111111111111111111111111111111111111112",
    "name": "Wrapped SOL",
    "symbol": "SOL",
    "icon": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    "decimals": 9,
    "circSupply": 518188878.169535,
    "totalSupply": 600060916.579771,
    "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "firstPool": {
      "id": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
      "createdAt": "2021-03-29T10:05:48Z"
    },
    "holderCount": 1722427,
    "fdv": 88192180547.5792,
    "mcap": 76159279564.0772,
    "usdPrice": 146.972045855373,
    "liquidity": 89631689.5018421,
    "stats5m": {
      "priceChange": 0.130851429171843,
      "liquidityChange": 0.0440949745714994,
      "volumeChange": 26.0051224058945,
      "buyVolume": 5695741.65475385,
      "sellVolume": 5014462.76278622,
      "buyOrganicVolume": 452973.505001058,
      "sellOrganicVolume": 380469.304261223,
      "numBuys": 47283,
      "numSells": 56068,
      "numTraders": 18031,
      "numOrganicBuyers": 1923,
      "numNetBuyers": 3483
    },
    "stats1h": {
      "priceChange": 0.947661991136875,
      "liquidityChange": 0.606136898112973,
      "volumeChange": -10.0242845983694,
      "buyVolume": 66177878.9735862,
      "sellVolume": 63013329.7180116,
      "buyOrganicVolume": 5029487.06396439,
      "sellOrganicVolume": 6168450.48016921,
      "numBuys": 577401,
      "numSells": 661142,
      "numTraders": 84249,
      "numOrganicBuyers": 4633,
      "numNetBuyers": 14566
    },
    "stats6h": {
      "priceChange": 2.35362703655033,
      "liquidityChange": 1.59089816130321,
      "volumeChange": -10.9995394166084,
      "buyVolume": 621506649.679709,
      "sellVolume": 606624520.154976,
      "buyOrganicVolume": 37112293.2290698,
      "sellOrganicVolume": 40191296.0515757,
      "numBuys": 3528777,
      "numSells": 4026997,
      "numTraders": 324817,
      "numOrganicBuyers": 16168,
      "numNetBuyers": 67557
    },
    "stats24h": {
      "priceChange": 0.0276721342124773,
      "liquidityChange": 0.744628411909294,
      "volumeChange": 51.8676875683889,
      "buyVolume": 2222883687.74327,
      "sellVolume": 2221745712.39999,
      "buyOrganicVolume": 119819305.562336,
      "sellOrganicVolume": 135170928.951341,
      "numBuys": 11496045,
      "numSells": 13611193,
      "numTraders": 1109844,
      "numOrganicBuyers": 32588,
      "numNetBuyers": 149126
    },
    "audit": {
      "mintAuthorityDisabled": true,
      "freezeAuthorityDisabled": true,
      "topHoldersPercentage": 1.21177063810937
    },
    "organicScore": 99.4045065714971,
    "organicScoreLabel": "high",
    "ctLikes": 2129,
    "smartCtLikes": 178,
    "isVerified": true,
    "cexes": [
      "Binance",
      "Bybit",
      "OKX",
      "Upbit",
      "Bitget",
      "Kraken",
      "KuCoin",
      "MEXC",
      "Gate.io"
    ],
    "tags": [
      "community",
      "strict",
      "verified"
    ],
    "updatedAt": "2025-05-05T21:55:22.173401082Z"
  },
  {
    "id": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "name": "USD Coin",
    "symbol": "USDC",
    "icon": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    "decimals": 6,
    "circSupply": 10387657805.6465,
    "totalSupply": 10387657805.6465,
    "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "mintAuthority": "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
    "freezeAuthority": "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
    "firstPool": {
      "id": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
      "createdAt": "2021-03-29T10:05:48Z"
    },
    "holderCount": 4197146,
    "fdv": 10387626196.0422,
    "mcap": 10387626196.0422,
    "usdPrice": 0.999996957003698,
    "liquidity": 25241539.3744423,
    "stats5m": {
      "priceChange": 0.000290280704090347,
      "liquidityChange": 0.0028059617210213,
      "volumeChange": -47.6232295136619,
      "buyVolume": 1692595.51384691,
      "sellVolume": 2484649.21373966,
      "buyOrganicVolume": 253153.836310557,
      "sellOrganicVolume": 256577.244380071,
      "numBuys": 3937,
      "numSells": 4570,
      "numTraders": 1841,
      "numOrganicBuyers": 202,
      "numNetBuyers": 375
    },
    "stats1h": {
      "priceChange": -0.00053378899727243,
      "liquidityChange": -0.000721860632847708,
      "volumeChange": -19.7055323938324,
      "buyVolume": 27902759.0471133,
      "sellVolume": 33144325.4503506,
      "buyOrganicVolume": 2396983.48167611,
      "sellOrganicVolume": 2697956.71886538,
      "numBuys": 59834,
      "numSells": 66181,
      "numTraders": 11744,
      "numOrganicBuyers": 649,
      "numNetBuyers": 1765
    },
    "stats6h": {
      "priceChange": -0.000801579956202279,
      "liquidityChange": -0.0136029703424509,
      "volumeChange": -26.9164284049193,
      "buyVolume": 397751408.830487,
      "sellVolume": 402160935.469638,
      "buyOrganicVolume": 18632856.8478432,
      "sellOrganicVolume": 17602802.2345145,
      "numBuys": 423648,
      "numSells": 453349,
      "numTraders": 45913,
      "numOrganicBuyers": 3448,
      "numNetBuyers": 7395
    },
    "stats24h": {
      "priceChange": 0.00288391287721556,
      "liquidityChange": 1.38508217115761,
      "volumeChange": 91.855427166696,
      "buyVolume": 1536269995.04792,
      "sellVolume": 1528228432.16562,
      "buyOrganicVolume": 72625078.32887,
      "sellOrganicVolume": 67297123.944984,
      "numBuys": 2045547,
      "numSells": 2119116,
      "numTraders": 123111,
      "numOrganicBuyers": 10824,
      "numNetBuyers": 20153
    },
    "audit": {
      "topHoldersPercentage": 42.1893635408922
    },
    "organicScore": 100,
    "organicScoreLabel": "high",
    "ctLikes": 14,
    "smartCtLikes": 3,
    "isVerified": true,
    "cexes": [
      "Binance",
      "Bybit",
      "OKX",
      "Upbit",
      "Bitget",
      "Kraken",
      "KuCoin",
      "MEXC",
      "Gate.io"
    ],
    "tags": [
      "community",
      "strict",
      "verified"
    ],
    "updatedAt": "2025-05-05T21:50:25.173880359Z"
  },
];


interface SwapInterfaceProps {
  className?: string;
};
const slippageOptions = ['0.1%', '0.5%', '1%'];
const priorityOptions = ['Low', 'Medium', 'High'];
const DEFAULT_CONFIG = {
  maxSlippage: slippageOptions[1],
  priority: priorityOptions[1],
  maxFee: '10000',
}
export type Config = typeof DEFAULT_CONFIG;
const SwapInterface: React.FC<SwapInterfaceProps> = ({ className }) => {
  const { connection } = useConnection();
  const [activeTab, setActiveTab] = useState('swap');
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState(''); // Note: Buy amount is often calculated, not input directly in simple swaps
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceImpact, setPriceImpact] = useState<string>('0.00%');
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [fromTokenBalance, setFromTokenBalance] = useState<string>('0.00');
  const [tokenList, setTokenList] = useState<Token[]>([]);
  const [toTokenBalance, setToTokenBalance] = useState<string>('0.00');
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const wallet = useAnchorWallet();
  const publicKey = wallet?.publicKey;

  // Token states - Initialize with default Solana tokens
  const [fromToken, setFromToken] = useState<Token>(SOLANA_DEFAULT_TOKENS[0]); // Default to SOL
  const [toToken, setToToken] = useState<Token>(SOLANA_DEFAULT_TOKENS[1]); // Default to USDC

  // Modal states
  const [isSelectingFrom, setIsSelectingFrom] = useState(false);
  const [isSelectingTo, setIsSelectingTo] = useState(false);

  // Add function to validate amount against balance
  const validateAmount = (amount: string) => {
    const numAmount = parseFloat(amount);
    const numBalance = parseFloat(fromTokenBalance);
    if (numAmount > numBalance) {
      setError(`Insufficient balance. You only have ${fromTokenBalance} ${fromToken.symbol}`);
      return false;
    }
    setError(null);
    return true;
  };

  // --- Handlers ---
  const handleFromTokenSelect = (token: Token) => {
    // Prevent selecting the same token for both fields
    if (toToken?.id === token.id) {
      setToToken(fromToken); // Swap if the user selects the token already in the 'to' field
    }
    setFromToken(token);
    setIsSelectingFrom(false); // Close modal after selection
  };

  const handleToTokenSelect = (token: Token) => {
    // Prevent selecting the same token for both fields
    if (fromToken?.id === token.id) {
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

  const fetchTokenBalance = useCallback(async (token: Token) => {
    if (!wallet || !token) return '0.00';

    try {
      setIsBalanceLoading(true);
      if (token.id === 'So11111111111111111111111111111111111111112') {
        // For SOL
        const balance = await connection.getBalance(wallet.publicKey);
        console.log(balance);
        return (balance / 10 ** token.decimals).toFixed(2);
      } else {
        // For SPL tokens
        const ata = await getAssociatedTokenAddress(
          new PublicKey(token.id),
          wallet.publicKey
        );
        const balance = await connection.getTokenAccountBalance(ata);
        console.log(balance);
        return (Number(balance.value.amount) / 10 ** token.decimals).toFixed(2);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0.00';
    } finally {
      setIsBalanceLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    const updateBalances = async () => {
      if (!wallet || !fromToken || !toToken) return;

      const fromBalance = await fetchTokenBalance(fromToken);
      const toBalance = await fetchTokenBalance(toToken);

      setFromTokenBalance(fromBalance);
      setToTokenBalance(toBalance);
    };

    updateBalances();
  }, [fromToken, toToken, fetchTokenBalance, wallet]);
  useEffect(() => {
    (async () => {
      const controller = new AbortController();
      setIsLoading(true);
      const tokenList = await fetch(`https://datapi.jup.ag/v1/assets/search?query=`, { signal: controller.signal })
      const data = await tokenList.json();
      setFromToken(data[0]);
      setToToken(data[1]);
      setIsLoading(false);
      return () => {
        controller.abort();
      }
    })();
  }, [])
  const handleSubmitIntent = useCallback(async () => {
    if (!publicKey || !wallet || !provider || !wallet.signTransaction) {
      setError("Wallet not connected or cannot sign transactions");
      return;
    }
    if (!fromToken || !toToken) {
      setError("Please select both tokens");
      return;
    }
    const sellAmountFloat = parseFloat(sellAmount);
    if (!sellAmount || isNaN(sellAmountFloat) || sellAmountFloat <= 0) {
      setError("Please enter a valid amount to sell");
      return;
    }
    if (!validateAmount(sellAmount)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsPriceLoading(true);

    const inputMint = new PublicKey(fromToken.id);
    const outputMint = new PublicKey(toToken.id);
    try {
      const { success, txid } = await submitIntent(inputMint.toBase58(), outputMint.toBase58(), sellAmountFloat, connection, wallet, config);
      console.log(txid);
      console.log(`https://explorer.solana.com/tx/${txid}`);
      // Update price impact and buy amount based on quote
      if (success) {
        // setPriceImpact(quote.priceImpactPct);
        // setBuyAmount(quote.outAmount);
      }
    } catch (error) {
      console.error("Error fetching Jupiter quote:", error);
      setError("Failed to fetch quote. Please try again.");
    } finally {
      setIsLoading(false);
      setIsPriceLoading(false);
    }
  }, [publicKey, wallet, provider, fromToken, toToken, sellAmount]);

  // Determine Button State
  const getButtonState = () => {
    if (!publicKey || !wallet) {
      return {
        text: "Connect Wallet",
        action: () => {
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
    if (parseFloat(sellAmount) > parseFloat(fromTokenBalance)) {
      return { text: "Insufficient Balance", action: () => { }, disabled: true };
    }
    if (isLoading) {
      return { text: "Processing...", action: () => { }, disabled: true };
    }
    return { text: "Try Swap", action: handleSubmitIntent, disabled: false };
  };

  const buttonState = getButtonState();
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="bg-card/20 backdrop-blur-sm rounded-3xl border border-secondary p-6">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center bg-secondary/30 p-1 rounded-xl">
            {['swap', 'limit', 'send', 'buy'].map((tab) => (
              <button
                key={tab}
                className={cn(
                  "swap-tab capitalize px-4 py-2 text-sm rounded-lg transition-all duration-200",
                  activeTab === tab
                    ? "bg-cyan-500 text-black font-medium shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-secondary/50"
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <SettingsPopover config={config} setConfig={setConfig} />

        </div>

        {/* Sell section */}
        <div className="bg-secondary/30 rounded-2xl p-4 mb-3 slide-in">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-400">Sell</span>
            <span className="text-sm text-zinc-400">
              {isBalanceLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                `Balance: ${fromTokenBalance}`
              )}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <input
              type="number"
              placeholder="0"
              value={sellAmount}
              onChange={(e) => {
                const newAmount = e.target.value;
                setSellAmount(newAmount);
                validateAmount(newAmount);
              }}
              className="token-input bg-transparent text-3xl font-medium outline-none w-full mr-2 remove-arrow"
            />
            <TokenDisplay
              type="selected"
              token={fromToken}
              onClick={() => setIsSelectingFrom(true)}
            />
          </div>

          <div className="flex justify-between mt-2">
            <span className="text-xs text-zinc-500">
              {isPriceLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                `$${(parseFloat(sellAmount || '0') * fromToken.usdPrice).toFixed(2)}`
              )}
            </span>
          </div>
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            className="bg-secondary rounded-xl p-2 hover:bg-secondary/80 transition-colors disabled:opacity-50 shadow-sm"
            onClick={handleSwapTokens}
            disabled={!fromToken || !toToken}
          >
            <ArrowDown className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Buy section */}
        <div className="bg-secondary/30 rounded-2xl p-4 mt-3 slide-in">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-400">Buy (Estimated)</span>
          </div>

          <div className="flex justify-between items-center">
            <input
              type="number"
              placeholder="0"
              value={buyAmount}
              readOnly
              className="token-input bg-transparent text-3xl font-medium outline-none w-full mr-2 remove-arrow opacity-70"
            />
            <TokenDisplay
              type="selected"
              token={toToken}
              onClick={() => setIsSelectingTo(true)}
            />
          </div>

          <div className="flex justify-between mt-2">
            <span className="text-xs text-zinc-500">
              {isPriceLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                `$${(parseFloat(buyAmount || '0') * toToken.usdPrice).toFixed(2)}`
              )}
            </span>
          </div>
        </div>

        {/* Price Impact and Slippage */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {/* <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Price Impact</span>
            <span className={parseFloat(priceImpact) > 1 ? "text-red-500" : "text-zinc-400"}>
              {priceImpact}
            </span>
          </div> */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Slippage Tolerance</span>
            <span className="text-zinc-400">{config.maxSlippage}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Priority</span>
            <span className="text-zinc-400">{config.priority}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Max Fee</span>
            <span className="text-zinc-400">{config.maxFee}</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        <Button
          className={cn(
            "w-full mt-6 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-medium py-3 rounded-xl transition-all duration-200",
            "hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-sm hover:shadow-md"
          )}
          onClick={buttonState.action}
          disabled={buttonState.disabled || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            buttonState.text
          )}
        </Button>
      </div>

      {/* Token Selection Modals */}
      <div className="relative">
        {isSelectingFrom && (
          <TokenSelectModal
            isOpen={isSelectingFrom}
            onClose={() => setIsSelectingFrom(false)}
            onSelect={handleFromTokenSelect}
            tokens={tokenList}
            currentToken={toToken}
          />
        )}

        {isSelectingTo && (
          <TokenSelectModal
            isOpen={isSelectingTo}
            onClose={() => setIsSelectingTo(false)}
            onSelect={handleToTokenSelect}
            tokens={tokenList}
            currentToken={fromToken}
          />
        )}
      </div>
    </div>
  );
};

export default SwapInterface;


export function SettingsPopover({ config, setConfig }: { config: any, setConfig: (config: any) => void }) {



  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className='bg-transparent cursor-pointer' variant="outline">
          <Settings className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={8} alignOffset={0} className="w-80 bg-zinc-900/95 border border-zinc-700 shadow-xl rounded-2xl p-4">
        <div className="grid gap-3">
          {/* Max Slippage Section */}
          <div className="space-y-3">
            <h4 className="font-semibold leading-none text-base text-white flex justify-between">
              <span className="text-zinc-400">Max Slippage</span>
              <button onClick={() => setConfig(DEFAULT_CONFIG)} className="text-xs text-zinc-400 hover:text-white cursor-pointer">
                <RotateCcw className="h-4 w-4" />
              </button>
            </h4>
            <p className="text-xs text-zinc-400 mb-2">Set the maximum slippage tolerance for your swap.</p>
            <div className="flex gap-2 bg-zinc-800/70 p-1 rounded-xl w-fit">
              {slippageOptions.map((option) => (
                <button
                  key={option}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none',
                    config.maxSlippage === option
                      ? 'gradient-button text-black shadow-lg scale-105'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-700/70 active:scale-95'
                  )}
                  onClick={() => setConfig({ ...config, maxSlippage: option })}
                  type="button"
                  style={{ boxShadow: config.maxSlippage === option ? '0 2px 8px 0 rgba(34,197,94,0.15)' : undefined }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-700" />

          {/* Priority Fee Section */}
          <div className="space-y-3">
            <h4 className="font-semibold leading-none text-base text-white">Priority Fee</h4>
            <p className="text-xs text-zinc-400 mb-1">Choose your transaction priority and set a max lamports fee.</p>
            <div className="flex gap-2 bg-zinc-800/70 p-1 rounded-xl w-fit mb-2">
              {priorityOptions.map((option) => (
                <button
                  key={option}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none',
                    config.priority === option
                      ? 'gradient-button text-black shadow-lg scale-105'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-700/70 active:scale-95'
                  )}
                  onClick={() => setConfig({ ...config, priority: option })}
                  type="button"
                  style={{ boxShadow: config.priority === option ? '0 2px 8px 0 rgba(34,197,246,0.15)' : undefined }}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxFee" className="text-sm text-zinc-300">Max Lamports</Label>
              <Input
                id="maxFee"
                type="number"
                min={DEFAULT_CONFIG.maxFee}
                placeholder="e.g. 10000"
                value={config.maxFee}
                onChange={e => setConfig({ ...config, maxFee: e.target.value })}
                className="h-8 w-32 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-md px-2 focus:ring-2 focus:ring-cyan-400 remove-arrow"
              />
            </div>
            <span className="text-xs text-zinc-500">Maximum fee in lamports for this transaction.</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
