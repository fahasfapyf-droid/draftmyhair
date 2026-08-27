"use client";

import Link from "next/link";
import { Container } from "@/components/ui/container";

const productLinks = [
  { label: "Examples", href: "/gallery" },
  { label: "For Salons", href: "/salons" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-canvas">
      <Container>
        <div className="py-16 grid gap-12 md:grid-cols-3">
          <div>
            <h3 className="text-xl font-semibold text-brand-ink">Draft My Hair</h3>
            <p className="mt-4 text-sm leading-7 text-brand-muted">Photorealistic hairstyle, beard and hair colour previews built around identity preservation and realism.</p>
          </div>
          <div>
            <h4 className="font-semibold text-brand-ink">Explore</h4>
            <ul className="mt-5 space-y-3">{productLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-brand-muted hover:text-brand-ink transition-colors">{link.label}</Link></li>)}</ul>
          </div>
          <div>
            <h4 className="font-semibold text-brand-ink">Legal</h4>
            <ul className="mt-5 space-y-3">{legalLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-brand-muted hover:text-brand-ink transition-colors">{link.label}</Link></li>)}</ul>
          </div>
        </div>
        <div className="border-t border-brand-border py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-brand-muted">© 2026 Draft My Hair. All rights reserved.</p>
          <p className="text-sm text-brand-muted">Same Face. New Hair.</p>
        </div>
      </Container>
    </footer>
  );
}
