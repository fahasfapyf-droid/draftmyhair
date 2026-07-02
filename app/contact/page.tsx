import { Container } from "@/components/ui/container";

export default function ContactPage() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container className="max-w-3xl">
        <h1 className="text-5xl font-semibold tracking-editorial text-brand-ink">
          Contact
        </h1>

        <p className="mt-6 text-lg leading-8 text-brand-muted">
          Whether you're considering a new hairstyle, exploring salon
          partnerships, or have questions about Draft My Hair, we'd be happy to
          hear from you.
        </p>

        <div className="mt-16 space-y-8">

          <div>
            <h2 className="text-xl font-semibold text-brand-ink">
              General Enquiries
            </h2>

            <p className="mt-2 text-brand-muted">
              hello@draftmyhair.com
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-brand-ink">
              Business & Salon Partnerships
            </h2>

            <p className="mt-2 text-brand-muted">
              business@draftmyhair.com
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-brand-ink">
              Response Time
            </h2>

            <p className="mt-2 text-brand-muted">
              We typically respond within 1–2 business days.
            </p>
          </div>

        </div>
      </Container>
    </section>
  );
}