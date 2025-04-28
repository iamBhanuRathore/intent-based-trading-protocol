// src/components/token-select-modal.tsx (adjust path as necessary)
'use client'; // Keep this if it's a client component

import React, { useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@repo/ui/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
// Use the same Token interface as SwapInterface
// If Token is defined in a shared location, import it instead.
// Otherwise, define it consistently here.
export interface Token {
  symbol: string;
  name: string;
  logo: string;
  mintAddress: string; // Crucial for comparison/filtering
  decimals: number;    // Keep consistent if needed elsewhere, though not strictly used in this modal display
}

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  tokens: Token[]; // Accept the list of tokens from parent
  currentToken?: Token | null; // Accept the token currently selected in the *other* field (optional)
}

const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  tokens,
  currentToken,
}) => {
  console.log('TokenSelectModal props:', { isOpen, tokens, currentToken });
  // Memoize the filtered list to avoid recalculation on every render
  const filteredTokens = useMemo(() => {
    if (!currentToken) {
      return tokens; // If no token is currently selected in the other slot, show all
    }
    // Filter out the token that is already selected in the other input field
    return tokens.filter(token => token.mintAddress !== currentToken.mintAddress);
  }, [tokens, currentToken]); // Dependencies for the memoization

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-secondary p-0 overflow-hidden">
        <DialogHeader className="px-4 py-4 flex justify-between flex-row items-center border-b border-secondary">
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>

        <Command className="rounded-lg border-none">
          <CommandInput placeholder="Search token name or paste address" className="h-12 border-none focus:ring-0" />
          <CommandList className="max-h-[400px] p-2">
            <CommandEmpty>No tokens found.</CommandEmpty>
            <CommandGroup>
              {filteredTokens.map((token) => (
                <CommandItem
                  key={token.mintAddress}
                  value={`${token.symbol} ${token.name} ${token.mintAddress}`}
                  onSelect={() => onSelect(token)}
                  className="py-3 px-2 rounded-lg hover:bg-secondary/50 flex items-center cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center mr-3 shrink-0">
                    <img
                      src={token.logo}
                      alt={token.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-sm text-muted-foreground">{token.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default TokenSelectModal;
