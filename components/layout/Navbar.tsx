"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-border/40 bg-brand-canvas/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            onClick={closeMenu}
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
              <Link href="/gallery">View Gallery</Link>
            </Button>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="-mr-2 flex items-center justify-center rounded-editorial p-2 transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand-canvas md:hidden"
              aria-label={mobileOpen ? "Close Menu" : "Open Menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
  id="mobile-navigation"
  className="md:hidden border-t border-brand-border/40 py-6 flex flex-col gap-5 text-center"
>
            <Link
              href="/gallery"
              onClick={closeMenu}
              className="text-brand-ink"
            >
              Gallery
            </Link>

            <Link
              href="/salons"
              onClick={closeMenu}
              className="text-brand-ink"
            >
              For Salons
            </Link>

            <Link
              href="/faq"
              onClick={closeMenu}
              className="text-brand-ink"
            >
              FAQ
            </Link>

            <Link
              href="/contact"
              onClick={closeMenu}
              className="text-brand-ink"
            >
              Contact
            </Link>
          </nav>
        )}
      </Container>
    </header>
  );
};
