import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 mr-2">
        <span className="text-white font-bold text-lg">F</span>
      </div>
      <span className="text-white font-bold text-xl">FlowSwap</span>
    </div>
  );
};

export default Logo;
