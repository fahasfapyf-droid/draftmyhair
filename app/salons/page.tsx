import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default function SalonsPage() {
  return (
    <main className="bg-brand-canvas">

      {/* Hero */}

      <section className="py-24 border-b border-brand-border">
        <Container className="max-w-5xl">

          <p className="text-sm uppercase tracking-[0.2em] text-brand-muted">
            Draft My Hair for Salons
          </p>

          <h1 className="mt-6 text-5xl md:text-6xl font-semibold tracking-editorial text-brand-ink">
            Help clients decide before the first cut.
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-brand-muted">
            Draft My Hair enables salons to show realistic hairstyle, beard and
            hair colour previews before treatment begins, helping clients make
            confident decisions while reducing uncertainty.
          </p>

          <div className="mt-12 flex flex-wrap gap-4">

            <Button asChild variant="primary" size="lg">
              <Link href="/contact">
                Contact Us
              </Link>
            </Button>

            <Button asChild variant="secondary" size="lg">
              <Link href="/gallery">
                View Gallery
              </Link>
            </Button>

          </div>

        </Container>
      </section>

      {/* Benefits */}

      <section className="py-24">
        <Container>

          <h2 className="text-4xl font-semibold">
            Why salons use Draft My Hair
          </h2>

          <div className="grid gap-8 mt-16 md:grid-cols-2 lg:grid-cols-3">

            <div className="rounded-xl border border-brand-border p-8">
              <h3 className="text-xl font-semibold">
                Better Consultations
              </h3>

              <p className="mt-4 text-brand-muted leading-7">
                Show realistic hairstyle previews before the consultation
                becomes a commitment.
              </p>
            </div>

            <div className="rounded-xl border border-brand-border p-8">
              <h3 className="text-xl font-semibold">
                Increased Client Confidence
              </h3>

              <p className="mt-4 text-brand-muted leading-7">
                Clients make decisions with greater confidence after seeing
                realistic previews.
              </p>
            </div>

            <div className="rounded-xl border border-brand-border p-8">
              <h3 className="text-xl font-semibold">
                Identity Preservation
              </h3>

              <p className="mt-4 text-brand-muted leading-7">
                Every preview is designed to preserve facial identity while
                changing only the requested hairstyle.
              </p>
            </div>

            <div className="rounded-xl border border-brand-border p-8">
              <h3 className="text-xl font-semibold">
                Faster Decisions
              </h3>

              <p className="mt-4 text-brand-muted leading-7">
                Reduce consultation time by allowing clients to compare
                different styles visually.
              </p>
            </div>

            <div className="rounded-xl border border-brand-border p-8">
              <h3 className="text-xl font-semibold">
                Premium Experience
              </h3>

              <p className="mt-4 text-brand-muted leading-7">
                Offer a modern digital consultation experience that helps
                distinguish your salon.
              </p>
            </div>

            <div className="rounded-xl border border-brand-border p-8">
              <h3 className="text-xl font-semibold">
                Future Ready
              </h3>

              <p className="mt-4 text-brand-muted leading-7">
                Built to evolve into a complete salon platform with workflow
                tools and client management.
              </p>
            </div>

          </div>

        </Container>
      </section>

      {/* Process */}

      <section className="py-24 border-t border-brand-border">
        <Container className="max-w-5xl">

          <h2 className="text-4xl font-semibold">
            How it works
          </h2>

          <div className="mt-16 space-y-10">

            <div>
              <h3 className="font-semibold text-xl">
                1. Capture a client photo
              </h3>

              <p className="mt-3 text-brand-muted">
                Use a clear front-facing photograph.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-xl">
                2. Choose a hairstyle
              </h3>

              <p className="mt-3 text-brand-muted">
                Select the desired hairstyle, beard or colour preview.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-xl">
                3. Review together
              </h3>

              <p className="mt-3 text-brand-muted">
                Compare realistic previews before beginning the appointment.
              </p>
            </div>

          </div>

        </Container>
      </section>

      {/* CTA */}

      <section className="py-24 border-t border-brand-border">
        <Container className="max-w-4xl text-center">

          <h2 className="text-4xl font-semibold">
            Interested in partnering with Draft My Hair?
          </h2>

          <p className="mt-6 text-lg text-brand-muted">
            We're preparing the next generation of salon consultation tools.
          </p>

          <div className="mt-10">

            <Button asChild size="lg">
              <Link href="/contact">
                Contact Us
              </Link>
            </Button>

          </div>

        </Container>
      </section>

    </main>
  );
}