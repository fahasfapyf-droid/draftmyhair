"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface GenerationCardProps {
  generation: {
    id: string;
    status: string;
    createdAt: Date;
    outputImageUrl: string | null;
    hairstyle: { id: string; name: string };
    userFeedback: {
      overallRating: number;
      identityRating: number;
      realismRating: number;
    } | null;
  };
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-brand-ink" aria-label={`${rating} out of 5 stars`}>
      <span aria-hidden="true">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>
      <span className="text-xs text-brand-muted">{rating}.0</span>
    </span>
  );
}

export function GenerationCard({ generation }: GenerationCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting) return;
    const confirmed = window.confirm("Delete this hairstyle preview? This action cannot be undone.");
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/generations/${generation.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to delete generation.");
      }
      router.refresh();
    } catch (error) {
      console.error("Delete failed:", error);
      alert(error instanceof Error ? error.message : "Unable to delete generation.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded border border-brand-border p-4 transition-colors hover:border-brand-ink">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded border border-brand-border bg-brand-canvas">
            {generation.outputImageUrl ? (
              <img src={generation.outputImageUrl} alt={generation.hairstyle.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">Pending</div>
            )}
          </div>

          <div>
            <p className="font-medium text-brand-ink">{generation.hairstyle.name}</p>
            <p className="mt-1 text-sm text-brand-muted">{generation.status}</p>
            <p className="mt-1 text-sm text-brand-muted">{generation.createdAt.toLocaleDateString()}</p>
            <div className="mt-2">
              {generation.userFeedback ? <RatingStars rating={generation.userFeedback.overallRating} /> : <span className="text-xs text-brand-muted">Not rated yet</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Link href={`/dashboard/generations/${generation.id}`} className="rounded border border-brand-border px-3 py-2 text-center text-sm transition-colors hover:bg-brand-canvas">View</Link>
          <button type="button" onClick={handleDelete} disabled={isDeleting} className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
