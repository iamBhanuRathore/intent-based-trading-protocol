
import React from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@repo/ui/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';

export interface Token {
  symbol: string;
  name: string;
  logo: string;
}

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
}

const TokenSelectModal: React.FC<TokenSelectModalProps> = ({ 
  isOpen, 
  onClose,
  onSelect
}) => {
  // Mock token data - in a real app, this would come from an API or state
  const tokens: Token[] = [
    { symbol: 'ETH', name: 'Ethereum', logo: '/placeholder.svg' },
    { symbol: 'BTC', name: 'Bitcoin', logo: '/placeholder.svg' },
    { symbol: 'USDT', name: 'Tether', logo: '/placeholder.svg' },
    { symbol: 'USDC', name: 'USD Coin', logo: '/placeholder.svg' },
    { symbol: 'DAI', name: 'Dai', logo: '/placeholder.svg' },
    { symbol: 'FLOW', name: 'Flow', logo: '/placeholder.svg' },
  ];
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border border-secondary p-0">
        <DialogHeader className="px-4 pt-4 flex justify-between flex-row items-center">
          <DialogTitle>Select a token</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <Command className="bg-transparent">
          <CommandInput placeholder="Search token name or paste address" className="border-b border-secondary h-14" />
          <CommandList className="max-h-[300px] p-2">
            <CommandEmpty>No tokens found.</CommandEmpty>
            <CommandGroup>
              {tokens.map((token) => (
                <CommandItem
                  key={token.symbol}
                  onSelect={() => {
                    onSelect(token);
                    onClose();
                  }}
                  className="py-3 px-2 rounded-lg hover:bg-secondary flex items-center cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center mr-3">
                    <img src={token.logo} alt={token.name} className="h-full w-full object-cover" />
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