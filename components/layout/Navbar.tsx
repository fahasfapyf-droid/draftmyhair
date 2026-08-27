"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./LogoutButton";

export const Navbar = () => {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);
  const isAuthenticated = status === "authenticated" && !!session;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-border/40 bg-brand-canvas/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" onClick={closeMenu} className="flex flex-col shrink-0 transition-opacity group hover:opacity-70">
            <span className="text-base font-semibold tracking-tight text-brand-ink">Draft My Hair</span>
            <span className="hidden text-[10px] uppercase tracking-widest text-brand-muted sm:block">Same Face. New Hair.</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-brand-muted md:flex">
            <Link href="/gallery" className="transition-colors hover:text-brand-ink">Examples</Link>
            <Link href="/salons" className="transition-colors hover:text-brand-ink">For Salons</Link>
            <Link href="/faq" className="transition-colors hover:text-brand-ink">FAQ</Link>
            <Link href="/contact" className="transition-colors hover:text-brand-ink">Contact</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? <><Button asChild variant="secondary"><Link href="/dashboard">Dashboard</Link></Button><LogoutButton /></> : <><Button asChild variant="ghost"><Link href="/login">Login</Link></Button><Button asChild variant="primary"><Link href="/register">Register</Link></Button></>}
          </div>

          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="-mr-2 flex items-center justify-center rounded-editorial p-2 transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand-canvas md:hidden" aria-label={mobileOpen ? "Close Menu" : "Open Menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && <nav id="mobile-navigation" className="border-t border-brand-border/40 py-6 md:hidden">
          <div className="flex flex-col gap-5 text-center">
            <Button asChild variant="primary"><Link href="/upload" onClick={closeMenu}>Try it on your photo</Link></Button>
            <Link href="/gallery" onClick={closeMenu} className="text-brand-ink transition-colors hover:text-brand-muted">Examples</Link>
            <Link href="/salons" onClick={closeMenu} className="text-brand-ink transition-colors hover:text-brand-muted">For Salons</Link>
            <Link href="/faq" onClick={closeMenu} className="text-brand-ink transition-colors hover:text-brand-muted">FAQ</Link>
            <Link href="/contact" onClick={closeMenu} className="text-brand-ink transition-colors hover:text-brand-muted">Contact</Link>
            <div className="mt-2 flex flex-col gap-3">
              {isAuthenticated ? <><Button asChild variant="secondary"><Link href="/dashboard" onClick={closeMenu}>Dashboard</Link></Button><LogoutButton mobile onLogout={closeMenu} /></> : <><Button asChild variant="ghost"><Link href="/login" onClick={closeMenu}>Login</Link></Button><Button asChild variant="secondary"><Link href="/register" onClick={closeMenu}>Register</Link></Button></>}
            </div>
          </div>
        </nav>}
      </Container>
    </header>
  );
};
