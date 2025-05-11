'use client';

import React, { useEffect, useState } from 'react';
import { Command, CommandGroup, CommandInput, CommandItem } from '@repo/ui/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Token } from './swap-interface';
import { ScrollArea } from './ui/scroll-area';
import { useDebouncedState } from './use-debounced';
// Use the same Token interface as SwapInterface
// If Token is defined in a shared location, import it instead.
// Otherwise, define it consistently here.


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
  const [loading, setLoading] = useState(false);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [search, debouncedSearch, setSearch] = useDebouncedState("", 500);
  useEffect(() => {
    (async () => {
      const controller = new AbortController();
      setLoading(true);
      const tokenList = await fetch(`https://datapi.jup.ag/v1/assets/search?query=${debouncedSearch ? `${debouncedSearch}&sortBy=verified` : ""}`, { signal: controller.signal })
      const data = await tokenList.json();
      setFilteredTokens(data);
      setLoading(false);
      return () => {
        controller.abort();
      }
    })();
  }, [debouncedSearch]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-secondary p-0 overflow-hidden">
        <DialogHeader className="px-4 py-4 flex justify-between flex-row items-center border-b border-secondary">
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>

        <Command className="rounded-lg border-none bg-transparent">
          <CommandInput value={search} onValueChange={(e) => setSearch(e)} placeholder="Search token name or paste address" className="h-12 border-none focus:ring-0 " />
          {/* <CommandList className="max-h-[400px] p-2"> */}
          <ScrollArea className="min-h-[200px] max-h-[400px] p-2">

            {/* <CommandEmpty>No tokens found.</CommandEmpty> */}
            <CommandGroup>
              {loading ? <div className="flex items-center justify-center h-20">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div> :
                filteredTokens.map((token) => (
                  <CommandItem
                    key={token.id}
                    value={`${token.symbol} ${token.name} ${token.id}`}
                    onSelect={() => onSelect(token)} className="flex h-full w-full items-center gap-x-3">
                    <div className="flex-shrink-0">
                      <div className="rounded-full bg-neutral-800">
                        <span className="relative">
                          <img src={token.icon} alt={token.symbol} width="32" height="32" className="rounded-full object-cover max-w-8 max-h-8" />
                        </span></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-x-1">
                        <p className="truncate text-sm font-semibold">{token.symbol}</p>
                        <div className="flex items-center fill-current text-primary">

                          {/* <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.8179 4.54512L13.6275 4.27845C12.8298 3.16176 11.1702 3.16176 10.3725 4.27845L10.1821 4.54512C9.76092 5.13471 9.05384 5.45043 8.33373 5.37041L7.48471 5.27608C6.21088 5.13454 5.13454 6.21088 5.27608 7.48471L5.37041 8.33373C5.45043 9.05384 5.13471 9.76092 4.54512 10.1821L4.27845 10.3725C3.16176 11.1702 3.16176 12.8298 4.27845 13.6275L4.54512 13.8179C5.13471 14.2391 5.45043 14.9462 5.37041 15.6663L5.27608 16.5153C5.13454 17.7891 6.21088 18.8655 7.48471 18.7239L8.33373 18.6296C9.05384 18.5496 9.76092 18.8653 10.1821 19.4549L10.3725 19.7215C11.1702 20.8382 12.8298 20.8382 13.6275 19.7215L13.8179 19.4549C14.2391 18.8653 14.9462 18.5496 15.6663 18.6296L16.5153 18.7239C17.7891 18.8655 18.8655 17.7891 18.7239 16.5153L18.6296 15.6663C18.5496 14.9462 18.8653 14.2391 19.4549 13.8179L19.7215 13.6275C20.8382 12.8298 20.8382 11.1702 19.7215 10.3725L19.4549 10.1821C18.8653 9.76092 18.5496 9.05384 18.6296 8.33373L18.7239 7.48471C18.8655 6.21088 17.7891 5.13454 16.5153 5.27608L15.6663 5.37041C14.9462 5.45043 14.2391 5.13471 13.8179 4.54512Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9 12L10.8189 13.8189V13.8189C10.9189 13.9189 11.0811 13.9189 11.1811 13.8189V13.8189L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg> */}
                        </div>
                        <div className="">
                          <div className="flex items-center text-emerald">
                            {/* <svg xmlns="http://www.w3.org/2000/svg" width="17" height="14" viewBox="0 0 17 14" fill="currentColor"><path d="M14.874 4.01409C13.7888 5.37804 13.6899 7.38783 12.8594 8.97522C11.6361 11.3139 8.61014 12.5553 6.07434 11.7591C5.71935 11.6476 5.34387 11.4724 5.19459 11.1346C5.01572 10.7297 5.23167 10.2666 5.46713 9.89101C6.31224 8.54364 7.97253 7.01614 9.64795 5.99378C9.82016 5.88866 9.71283 5.62675 9.51526 5.66941C7.57657 6.08875 5.51966 7.48635 4.57975 8.86978C4.45779 9.04927 4.33859 9.23535 4.22313 9.42724C3.82408 10.0906 3.47088 10.8219 3.20989 11.5776C3.06012 12.0109 2.49682 12.1344 2.17859 11.8018C2.17485 11.7978 2.17094 11.7937 2.1672 11.7899C1.99906 11.6135 1.95353 11.3543 2.04979 11.1313C2.5952 9.86992 3.20826 9.07663 3.61431 8.6399C3.06678 5.05754 5.02629 3.22257 7.70942 2.38389C9.92114 1.6925 12.7579 1.92639 14.7222 3.15561C15.0191 3.34137 15.0913 3.74108 14.874 4.01409Z" fill="currentColor"></path></svg> */}

                            <p className="text-xxs">92</p>
                          </div>
                        </div><div className="pointer-events-none fixed left-0 top-0 z-[-1] h-full w-full opacity-0 transition-all">
                        </div>
                      </div><p className="text-xxs text-neutral-500">{token.name}</p><div className="text-xxs font-semibold text-neutral-600"><p className="whitespace-nowrap" title={token.id}>{token.id.slice(0, 4)}...{token.id.slice(-4)}</p>
                      </div>
                    </div><div className="flex h-full flex-col justify-start gap-y-1 pt-2 text-right text-xs font-medium text-neutral-200"><span translate="no">0.00008297</span><p className="text-neutral-500">$0.15</p><div className="flex justify-end gap-x-1">
                    </div>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </ScrollArea>
          {/* </CommandList> */}
        </Command>
      </DialogContent>
    </Dialog >
  );
};

export default TokenSelectModal;
