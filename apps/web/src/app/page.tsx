'use client';
import React, { useEffect } from 'react'
import Header from '@/components/header'
import Footer from '@/components/footer'
import SwapInterface from '@/components/swap-interface'
import { submitIntent } from '@/lib/submitIntent'
// ---------------
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
// -------------------
const BONK_MINT = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'); // Replace with real BONK mint
const SOL_AS_INPUT = SystemProgram.programId;
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112"); // Standard WSOL

const Hompage = () => {


  const wallet = useAnchorWallet();
  useEffect(()=>{
    console.log("useEffect");
    if(!wallet?.publicKey) return;
    console.log("wallet.publicKey");
    try {
      submitIntent({
        intentId:Date.now() , // or any unique number
        category: 1,
        inputAmount: 1_000_000_000, // 1 SOL in lamports
        inputMint: SOL_AS_INPUT,
        outputMint: BONK_MINT,
        wallet
      });
    } catch (error) {
    }

  },[wallet?.publicKey])

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background to-background/95 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-background/5 to-transparent pointer-events-none"></div>

      <div className="relative z-10 mx-auto fade-in">
        <Header className="animate-in slide-down" />

        <main className="mt-16 px-4 flex flex-col items-center justify-center animate-in slide-in">
          <SwapInterface />
        </main>

        <Footer className="animate-in fade-in" />
      </div>
    </div>
  )
}

export default Hompage
