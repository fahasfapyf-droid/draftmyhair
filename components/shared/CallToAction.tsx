import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

interface CallToActionProps {
  title: string;
  description: string;
}

export function CallToAction({
  title,
  description,
}: CallToActionProps) {
  return (
    <section className="py-24 border-t border-brand-border bg-brand-canvas">
      <Container className="max-w-4xl text-center">

        <h2 className="text-4xl font-semibold tracking-editorial text-brand-ink">
          {title}
        </h2>

        <p className="mt-6 text-lg leading-8 text-brand-muted">
          {description}
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">

          <Button asChild size="lg">
            <Link href="/gallery">
              View Gallery
            </Link>
          </Button>

          <Button asChild variant="secondary" size="lg">
            <Link href="/contact">
              Contact Us
            </Link>
          </Button>

        </div>

      </Container>
    </section>
  );
}