"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-border/40 bg-brand-canvas/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">

          <Link
            href="/"
            className="flex flex-col group transition-opacity hover:opacity-70 shrink-0"
          >
            <span className="text-base font-semibold tracking-tight text-brand-ink">
              Draft My Hair
            </span>

            <span className="hidden sm:block text-[10px] uppercase tracking-widest text-brand-muted">
              Same Face. New Hair.
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-muted">

            <Link
              href="/gallery"
              className="hover:text-brand-ink transition-colors"
            >
              Gallery
            </Link>

            <Link
              href="/salons"
              className="hover:text-brand-ink transition-colors"
            >
              For Salons
            </Link>

            <Link
              href="/faq"
              className="hover:text-brand-ink transition-colors"
            >
              FAQ
            </Link>

            <Link
              href="/contact"
              className="hover:text-brand-ink transition-colors"
            >
              Contact
            </Link>

          </nav>

          <div className="flex items-center gap-3 shrink-0">

            <Button asChild variant="primary">
              <Link href="/gallery">
                View Gallery
              </Link>
            </Button>

            <button
              className="md:hidden flex items-center justify-center p-2 -mr-2 rounded-editorial"
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