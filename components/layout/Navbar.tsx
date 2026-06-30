"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-border/40 bg-brand-canvas/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex flex-col group transition-opacity hover:opacity-70 shrink-0">
            <span className="text-base font-semibold tracking-tight text-brand-ink">Draft My Hair</span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-brand-muted hidden sm:block">Same Face. New Hair.</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-muted">
            <Link href="#technology" className="hover:text-brand-ink transition-colors">Gallery</Link>
            <Link href="#results" className="hover:text-brand-ink transition-colors">For Salons</Link>
            <Link href="#pricing" className="hover:text-brand-ink transition-colors">How It Works</Link>
          </nav>

          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            {/* CTA scales down padding on mobile to prevent crowding */}
            <Button variant="primary" className="px-4 text-xs md:px-6 md:text-sm">
              Start Preview
            </Button>
            {/* Mobile Menu Trigger */}
            <button 
              className="md:hidden flex items-center justify-center p-2 -mr-2 text-brand-ink hover:text-brand-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink rounded-editorial"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
};