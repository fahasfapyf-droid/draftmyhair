"use client";

import React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PricingPlan } from "@/lib/pricing";

type PricingCardProps = {
  plan: PricingPlan;
  onSelect?: (plan: PricingPlan) => void;
};

export function PricingCard({
  plan,
  onSelect,
}: PricingCardProps) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-3xl border bg-white p-8 transition-all duration-300",
        plan.popular
          ? "border-brand-ink shadow-sm"
          : "border-brand-border hover:border-brand-ink/20"
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-8">
          <span className="rounded-full bg-brand-ink px-3 py-1 text-xs font-medium text-white">
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}

      <div className="mb-8">
        <h3 className="text-2xl font-semibold tracking-tight text-brand-ink">
          {plan.name}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
          {plan.description}
        </p>

        <div className="mt-6 flex items-end">
          <span className="text-5xl font-semibold tracking-tight text-brand-ink">
            ${plan.price}
          </span>

          <span className="mb-1 ml-2 text-sm text-brand-muted">
            one-time
          </span>
        </div>
      </div>

      {/* Preview Count */}

      <div className="mb-8 rounded-2xl bg-brand-canvas px-5 py-4">
        <p className="text-sm text-brand-muted">
          Includes
        </p>

        <p className="mt-1 text-xl font-semibold text-brand-ink">
          {plan.previews} Premium Preview
          {plan.previews > 1 ? "s" : ""}
        </p>
      </div>

      {/* Features */}

      <ul className="flex-1 space-y-4">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3"
          >
            <Check
              size={18}
              className="mt-0.5 shrink-0 text-brand-ink"
            />

            <span className="text-sm leading-relaxed text-brand-muted">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}

      <Button
        variant={plan.popular ? "primary" : "secondary"}
        size="lg"
        className="mt-10 w-full"
        onClick={() => onSelect?.(plan)}
      >
        Continue
      </Button>
    </article>
  );
}
