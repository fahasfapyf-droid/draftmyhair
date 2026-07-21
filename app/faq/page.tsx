import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Frequently Asked Questions",
  description:
    "Find answers about Draft My Hair previews, photo requirements and identity-preserving AI hairstyle results.",
  path: "/faq",
});

export default function FAQPage() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container className="max-w-4xl">

        <h1 className="text-5xl font-semibold tracking-editorial">
          Frequently Asked Questions
        </h1>

        <div className="mt-12 space-y-10">

          <div>
            <h2 className="text-xl font-semibold">
              Does AI change my face?
            </h2>
            <p className="mt-2 text-brand-muted">
              No. Draft My Hair is designed to preserve facial identity while
              changing only the requested hairstyle, beard or hair colour.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              What photos work best?
            </h2>
            <p className="mt-2 text-brand-muted">
              A clear, front-facing photo with good lighting produces the best
              results.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              Can I preview multiple hairstyles?
            </h2>
            <p className="mt-2 text-brand-muted">
              Yes. Multiple hairstyle previews are available depending on the
              selected service.
            </p>
          </div>

        </div>

      </Container>
    </section>
  );
}
