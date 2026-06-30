import { Suspense } from "react";
import ResultContent from "./ResultContent";

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