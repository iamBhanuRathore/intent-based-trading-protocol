
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Token } from './swap-interface';
// import { Token } from './token-select-modal';

interface TokenDisplayProps {
  type: 'select' | 'selected';
  token?: Token;
  className?: string;
  onClick?: () => void;
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({
  type,
  token,
  className,
  onClick
}) => {
  if (type === 'select') {
    return (
      <button
        className={cn(
          "flex items-center justify-self-end w-fit space-x-1 bg-cyan-500 text-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity",
          className
        )}
        onClick={onClick}
      >
        <span className="font-medium">Select token</span>
        <ChevronDown className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      className={cn(
        "flex items-center space-x-2 bg-secondary/50 hover:bg-secondary/70 px-3 py-2 rounded-full transition-colors",
        className
      )}
      onClick={onClick}
    >
      <div className="h-6 w-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
        {token?.icon ? (
          <img src={token.icon} alt={token?.symbol} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold">?</span>
        )}
      </div>
      <span className="font-medium">{token?.symbol || 'ETH'}</span>
      <ChevronDown className="h-4 w-4" />
    </button>
  );
};

export default TokenDisplay;
