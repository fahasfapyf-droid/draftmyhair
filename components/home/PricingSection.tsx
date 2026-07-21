"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { pricingPlans, type PricingPlan } from "@/lib/pricing";
import { PricingCard } from "./PricingCard";

export function PricingSection() {
  const handleSelect = (plan: PricingPlan) => {
    // Checkout will be connected in Milestone 11
    console.log("Selected plan:", plan.id);
  };

  return (
    <section className="bg-brand-canvas py-24 md:py-32">
      <Container>
        {/* Section Heading */}
        <motion.div
          className="mx-auto mb-16 max-w-3xl text-center md:mb-24"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{
            duration: 1,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-muted">
            Pricing
          </p>

          <h2 className="text-3xl font-semibold tracking-editorial text-brand-ink md:text-5xl">
            Simple Pricing.
            <br />
            No Subscriptions.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-muted">
            Pay only when you need a preview. Every plan preserves your
            identity while generating realistic hairstyle transformations.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          className="grid grid-cols-1 gap-8 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            staggerChildren: 0.15,
          }}
        >
          {pricingPlans.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <PricingCard
                plan={plan}
                onSelect={handleSelect}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Trust Message */}
        <motion.div
          className="mx-auto mt-20 max-w-3xl border-t border-brand-border pt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.8,
          }}
        >
          <p className="text-lg leading-relaxed text-brand-muted">
            Every preview is generated individually using our identity-first
            workflow. Your face remains recognisably yours — only the selected
            hairstyle changes.
          </p>
        </motion.div>
      </Container>
    </section>
  );
}