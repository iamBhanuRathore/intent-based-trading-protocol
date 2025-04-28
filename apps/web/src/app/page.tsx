'use client';
import React from 'react'
import Header from '@/components/header'
import Footer from '@/components/footer'
import SwapInterface from '@/components/swap-interface'
const Hompage = () => {

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
