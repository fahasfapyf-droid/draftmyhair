"use client";

import { Button } from "@/components/ui/button";
import type { CreditPackage } from "@/lib/payments/packages";

type CreditPackageCardProps = {
  pkg: CreditPackage;
};

export function CreditPackageCard({
  pkg,
}: CreditPackageCardProps) {
  return (
    <article className="relative flex flex-col rounded-3xl border border-brand-border bg-white p-8 transition-all duration-300 hover:border-brand-ink/20">
      {pkg.popular && (
        <div className="absolute -top-3 left-8">
          <span className="rounded-full bg-brand-ink px-3 py-1 text-xs font-medium text-white">
            Most Popular
          </span>
        </div>
      )}

      <h3 className="text-2xl font-semibold text-brand-ink">
        {pkg.name}
      </h3>

      <p className="mt-2 text-brand-muted">
        {pkg.credits} AI Preview
        {pkg.credits > 1 ? "s" : ""}
      </p>

      <div className="mt-6 flex items-end">
        <span className="text-5xl font-semibold text-brand-ink">
          ${pkg.priceUsd}
        </span>

        <span className="mb-1 ml-2 text-sm text-brand-muted">
          one-time
        </span>
      </div>

      <div className="mt-8 rounded-2xl bg-brand-canvas p-5">
        <p className="text-sm text-brand-muted">
          Credits Included
        </p>

        <p className="mt-1 text-xl font-semibold text-brand-ink">
          {pkg.credits}
        </p>
      </div>

      <Button
        className="mt-10 w-full"
        size="lg"
        disabled
      >
        Coming Soon
      </Button>
    </article>
  );
}