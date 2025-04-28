
"use client";
import React, { useState } from "react";
import { Search, Menu } from "lucide-react";
import Logo from "./logo";
import { cn } from "@/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import ClientOnly from "./client-only";

interface HeaderProps {
  className?: string;
};

const Header: React.FC<HeaderProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState("trade");



  return (
    <header
      className={cn(
        "flex items-center justify-between w-full px-4 py-3 border-b-gray-800 border-b-2 ",
        className
      )}
    >
      <div className="flex items-center space-x-6">
        <Logo />

        <nav className="hidden md:flex items-center space-x-1">
          <button
            className={cn(
              "nav-item",
              activeTab === "trade" ? "nav-item-active" : "nav-item-inactive"
            )}
            onClick={() => setActiveTab("trade")}
          >
            Trade
          </button>
          <button
            className={cn(
              "nav-item",
              activeTab === "explore" ? "nav-item-active" : "nav-item-inactive"
            )}
            onClick={() => setActiveTab("explore")}
          >
            Explore
          </button>
          <button
            className={cn(
              "nav-item",
              activeTab === "pool" ? "nav-item-active" : "nav-item-inactive"
            )}
            onClick={() => setActiveTab("pool")}
          >
            Pool
          </button>
        </nav>
      </div>

      <div className="flex items-center space-x-3">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 text-zinc-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search tokens"
            className="h-10 pl-9 pr-4 bg-secondary/30 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 w-[300px]"
          />
          <span className="absolute right-3 text-zinc-400 text-xs">/</span>
        </div>
        {/* <ClientOnly> */}
        <div suppressHydrationWarning={true}>
          <WalletMultiButton />
        </div>
        {/* </ClientOnly> */}
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
