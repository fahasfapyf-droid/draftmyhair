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
    description: "Look directly at the camera with a neutral or natural expression.",
  },
  {
    id: "req-lighting",
    icon: Sun,
    title: "Good Lighting",
    description: "Use natural, even lighting without harsh shadows across your face.",
  },
  {
    id: "req-hair",
    icon: Scissors,
    title: "Hair Visible",
    description: "Ensure your current hair or beard is clearly visible without hats.",
  },
  {
    id: "req-filters",
    icon: ImageIcon,
    title: "No Filters",
    description: "Upload an untouched, original photograph for accurate preservation.",
  },
];

export const PhotoRequirements: React.FC = () => {
  return (
    <section className="w-full mb-16">
      <div className="text-center mb-8">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-ink block mb-2">
          Photo Guidelines
        </span>
        <h3 className="text-xl font-medium tracking-tight text-brand-ink">
          For the best identity preservation
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {requirements.map((req) => {
          const Icon = req.icon;
          return (
            <div 
              key={req.id}
              className="flex flex-col p-6 rounded-editorial bg-brand-surface border border-brand-border/60 shadow-sm"
            >
              <Icon
  aria-hidden="true"
  className="w-5 h-5 text-brand-ink mb-4 opacity-70"
/>
              <h4 className="text-sm font-semibold text-brand-ink mb-1.5">
                {req.title}
              </h4>
              <p className="text-xs leading-relaxed text-brand-muted">
                {req.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};