'use client'
import React, { useState } from 'react';
import { ArrowDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import { IDL } from '@repo/common/index';
import TokenDisplay from './token-display';
import TokenSelectModal, { Token } from './token-select-modal';

interface SwapInterfaceProps {
  className?: string;
}

const SwapInterface: React.FC<SwapInterfaceProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('swap');
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');

  // Token states
  const [fromToken, setFromToken] = useState<Token>({
    symbol: 'ETH',
    name: 'Ethereum',
    logo: '/placeholder.svg',
  });

  const [toToken, setToToken] = useState<Token | undefined>();

  // Modal states
  const [isSelectingFrom, setIsSelectingFrom] = useState(false);
  const [isSelectingTo, setIsSelectingTo] = useState(false);

  const handleFromTokenSelect = (token: Token) => {
    setFromToken(token);
  };

  const handleToTokenSelect = (token: Token) => {
    setToToken(token);
  };

  const handleSwapTokens = () => {
    if (toToken) {
      const temp = fromToken;
      setFromToken(toToken);
      setToToken(temp);

      // Also swap amounts
      const tempAmount = sellAmount;
      setSellAmount(buyAmount);
      setBuyAmount(tempAmount);
    }
  };

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
                  "swap-tab capitalize",
                  activeTab === tab ? "swap-tab-active" : "swap-tab-inactive"
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
          </div>

          <div className="flex justify-between items-center">
            <input
              type="text"
              placeholder="0"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="token-input"
            />
            <TokenDisplay
              type="selected"
              token={fromToken}
              onClick={() => setIsSelectingFrom(true)}
            />
          </div>

          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-500">$0.00</span>
          </div>
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            className="bg-secondary rounded-xl p-2 hover:bg-secondary/80 transition-colors"
            onClick={handleSwapTokens}
          >
            <ArrowDown className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Buy section */}
        <div className="bg-secondary/30 rounded-2xl p-4 mt-1 slide-in">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-400">Buy</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="0"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="token-input"
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
            <span className="text-xs text-zinc-500">$0.00</span>
          </div>
        </div>

        {/* Connect wallet button */}
        <Button
          className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-medium py-6 rounded-xl hover:opacity-90 transition-opacity"
        >
          Connect wallet
        </Button>
      </div>

      {/* Token selection modals */}
      <TokenSelectModal
        isOpen={isSelectingFrom}
        onClose={() => setIsSelectingFrom(false)}
        onSelect={handleFromTokenSelect}
      />

      <TokenSelectModal
        isOpen={isSelectingTo}
        onClose={() => setIsSelectingTo(false)}
        onSelect={handleToTokenSelect}
      />
        </div>
    );
};

export default SwapInterface;
