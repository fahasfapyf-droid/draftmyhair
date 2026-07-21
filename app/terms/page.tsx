import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Terms of Service",
  description:
    "Read the Draft My Hair terms of service for using AI-powered hairstyle previews.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container className="max-w-4xl">

        <h1 className="text-5xl font-semibold tracking-editorial">
          Terms of Service
        </h1>

        <div className="mt-10 space-y-8 text-brand-muted leading-8">

          <section>
            <h2 className="text-2xl font-semibold text-brand-ink">
              Use of Service
            </h2>

            <p>
              Draft My Hair provides visual hairstyle simulations only and does
              not guarantee real-world salon results.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-brand-ink">
              Intellectual Property
            </h2>

            <p>
              All website content, branding and software remain the property of
              Draft My Hair.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-brand-ink">
              Limitation of Liability
            </h2>

            <p>
              Users remain responsible for personal hairstyle decisions based on
              preview results.
            </p>
          </section>

        </div>

      </Container>
    </section>
  );
}
