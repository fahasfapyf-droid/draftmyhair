import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="py-32 bg-brand-canvas">
      <Container className="max-w-3xl text-center">

        <p className="uppercase tracking-[0.2em] text-brand-muted">
          404
        </p>

        <h1 className="mt-6 text-5xl font-semibold tracking-editorial">
          Page not found.
        </h1>

        <p className="mt-8 text-lg leading-8 text-brand-muted">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-12 flex justify-center gap-4">

          <Button asChild>
            <Link href="/">
              Go Home
            </Link>
          </Button>

          <Button asChild variant="secondary">
            <Link href="/gallery">
              View Gallery
            </Link>
          </Button>

        </div>

      </Container>
    </main>
  );
}