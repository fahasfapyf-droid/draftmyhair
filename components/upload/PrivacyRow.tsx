// components/upload/PrivacyRow.tsx
"use client";

import React from "react";
import { Check } from "lucide-react";

export const PrivacyRow: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-widest font-semibold text-brand-muted">
      <span className="flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-brand-ink" /> Private
      </span>
      <span
  aria-hidden="true"
  className="w-1 h-1 rounded-full bg-brand-border"
/>
      <span className="flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-brand-ink" /> Secure
      </span>
      <span
  aria-hidden="true"
  className="w-1 h-1 rounded-full bg-brand-border"
/>
      <span className="flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-brand-ink" /> Deleted After Processing
      </span>
    </div>
  );
};