
import * as React from "react";
import { Container } from "@/components/ui/container";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-border dark:border-neutral-800 bg-brand-canvas">
      <Container>
        <div className="py-12 md:py-16 flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex flex-col max-w-xs">
            <span className="text-lg font-semibold tracking-tight mb-4">Draft My Hair</span>
            <p className="text-brand-muted">
              Photorealistic hairstyle, beard and hair color previews that preserve your identity before you make a real-world change.. 
            </p>
          </div>
          
          <div className="flex gap-12 sm:gap-24">
            <div className="flex flex-col gap-3">
              <span className="font-medium text-sm">Platform</span>
              <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors">Gallery</a>
              <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors">For Salons</a>
              <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors">How It Works</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-medium text-sm">Legal</span>
              <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors">Privacy</a>
              <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors">Terms</a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-brand-border dark:border-neutral-800 py-6 flex items-center justify-between text-xs text-neutral-500">
          <span>&copy; {currentYear} Draft My Hair. All rights reserved.</span>
          <span>Same Face. New Hair.</span>
        </div>
      </Container>
    </footer>
  );
};