import React from 'react';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={cn("fixed bottom-4 left-4 text-right text-lg text-zinc-200", className)}> 
      Flow Swap
    </footer>
  );
};

export default Footer;