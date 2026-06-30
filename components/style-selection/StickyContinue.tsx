"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyContinueProps {
  disabled: boolean;
  onContinue: () => void;
}

export const StickyContinue: React.FC<StickyContinueProps> = ({ disabled, onContinue }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-brand-canvas via-brand-canvas/95 to-transparent pt-16 pb-8 px-4 md:px-8 pointer-events-none">
      <div className="max-w-6xl mx-auto flex justify-center sm:justify-end pointer-events-auto">
        <Button
          variant="primary"
          size="lg"
          disabled={disabled}
          onClick={onContinue}
          className="w-full sm:w-auto min-w-[240px] group shadow-editorial transition-all duration-300"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </div>
    </div>
  );
};