import { Suspense } from "react";
import type { Metadata } from "next";
import ResultContent from "./ResultContent";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Your Hairstyle Preview",
  description:
    "See your personalised hairstyle preview and decide on your next look with confidence.",
  path: "/result",
});

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-brand-canvas flex items-center justify-center">
          <p className="text-brand-muted text-lg">
            Loading preview...
          </p>
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
