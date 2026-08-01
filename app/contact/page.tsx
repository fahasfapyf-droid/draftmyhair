import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { createPageMetadata } from "../metadata";
import { ContactForm } from "@/components/contact/ContactForm";
export const metadata: Metadata = createPageMetadata({
  title: "Contact Draft My Hair",
  description:
    "Contact Draft My Hair for preview support, feature suggestions, partnership enquiries or general questions.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container className="max-w-3xl">
        <h1 className="text-5xl font-semibold tracking-editorial text-brand-ink">
          Contact Us
        </h1>

        <p className="mt-6 text-lg leading-8 text-brand-muted">
          Whether you have a question about a hairstyle preview, want to suggest
          a new feature, report an issue, or discuss a business partnership,
          We&apos;d love to hear from you.
        </p>

        <div className="mt-16 rounded-editorial border border-brand-border bg-brand-surface shadow-editorial p-8 md:p-12">
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
