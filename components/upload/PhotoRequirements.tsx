// components/upload/PhotoRequirements.tsx
"use client";

import React from "react";
import { UserRound, Sun, Scissors, Image as ImageIcon } from "lucide-react";

interface Requirement {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

const requirements: Requirement[] = [
  {
    id: "req-front",
    icon: UserRound,
    title: "Front Facing",
    description: "Look directly at the camera with a natural expression.",
  },
  {
    id: "req-lighting",
    icon: Sun,
    title: "Good Lighting",
    description: "Use natural, even lighting without harsh facial shadows.",
  },
  {
    id: "req-hair",
    icon: Scissors,
    title: "Hair Visible",
    description: "Keep your current hair or beard visible and uncovered.",
  },
  {
    id: "req-filters",
    icon: ImageIcon,
    title: "No Filters",
    description: "Use an untouched original photo for accurate preservation.",
  },
];

export const PhotoRequirements: React.FC = () => {
  return (
    <section className="w-full mb-0">
      <div className="text-center mb-4">
        <span className="text-[9px] uppercase tracking-widest font-semibold text-brand-ink block mb-1">
          Photo Guidelines
        </span>
        <h3 className="text-base md:text-lg font-medium tracking-tight text-brand-ink">
          For the best identity preservation
        </h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
        {requirements.map((req) => {
          const Icon = req.icon;
          return (
            <div
              key={req.id}
              className="flex flex-col p-3.5 md:p-4 rounded-editorial bg-brand-surface border border-brand-border/60 shadow-sm"
            >
              <Icon
                aria-hidden="true"
                className="w-4 h-4 text-brand-ink mb-2 opacity-70"
              />
              <h4 className="text-xs font-semibold text-brand-ink mb-1">
                {req.title}
              </h4>
              <p className="text-[10px] md:text-[11px] leading-relaxed text-brand-muted">
                {req.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
