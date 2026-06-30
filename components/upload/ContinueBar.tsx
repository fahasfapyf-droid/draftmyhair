"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ContinueBarProps {
  disabled?: boolean;
  label?: string;
  onContinue: () => void;
}

export const ContinueBar: React.FC<ContinueBarProps> = ({
  disabled = false,
  label = "Continue",
  onContinue,
}) => {
  return (
    <div className="flex justify-center w-full">
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={disabled}
        onClick={onContinue}
        className="group w-full sm:w-auto min-w-[240px]"
      >
        {label}

        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Button>
    </div>
  );
};