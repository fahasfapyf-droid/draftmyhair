"use client";

import { FormEvent, useRef, useState } from "react";
import { Check, LoaderCircle, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

const DECISION_OPTIONS = [
  { value: "DEFINITELY_YES", label: "Definitely Yes" },
  { value: "PROBABLY_YES", label: "Probably Yes" },
  { value: "UNSURE", label: "Unsure" },
  { value: "PROBABLY_NOT", label: "Probably Not" },
  { value: "DEFINITELY_NOT", label: "Definitely Not" },
] as const;

const ISSUE_OPTIONS = [
  { value: "IDENTITY_DRIFT", label: "Doesn't look like me" },
  { value: "HAIRLINE", label: "Hairline or scalp looks unnatural" },
  { value: "HAIR_COLOR", label: "Hair colour is inaccurate" },
  { value: "TEXTURE", label: "Hair texture looks unrealistic" },
  { value: "BLENDING", label: "Hair blending looks unrealistic" },
  { value: "LIGHTING", label: "Lighting changed" },
  { value: "BACKGROUND", label: "Background changed" },
  { value: "OTHER", label: "Other" },
] as const;

type DecisionConfidence = (typeof DECISION_OPTIONS)[number]["value"];
type FeedbackIssue = (typeof ISSUE_OPTIONS)[number]["value"];

interface FeedbackResponse {
  error?: string;
  details?: string[];
}

interface RatingInputProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

function RatingInput({ label, value, onChange }: RatingInputProps) {
  return (
    <fieldset>
      <legend className="text-base font-medium text-brand-ink">{label}</legend>
      <div className="mt-3 flex gap-1" role="group" aria-label={label}>
        {RATING_VALUES.map((rating) => {
          const selected = value !== null && rating <= value;
          return (
            <button
              key={rating}
              type="button"
              className="rounded p-1 text-brand-muted transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
              onClick={() => onChange(rating)}
              aria-label={`${rating} out of 5 stars`}
              aria-pressed={value === rating}
            >
              <Star className={cn("h-7 w-7", selected && "fill-current text-brand-ink")} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FeedbackForm({ generationId, hairstyleId }: { generationId: string; hairstyleId: string | null }) {
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [identityRating, setIdentityRating] = useState<number | null>(null);
  const [realismRating, setRealismRating] = useState<number | null>(null);
  const [decisionConfidence, setDecisionConfidence] = useState<DecisionConfidence | null>(null);
  const [issues, setIssues] = useState<FeedbackIssue[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionLockRef = useRef(false);

  const canSubmit = Boolean(generationId && hairstyleId) && overallRating !== null && identityRating !== null && realismRating !== null && decisionConfidence !== null && !isSubmitting;

  const toggleIssue = (issue: FeedbackIssue) => {
    setIssues((current) => current.includes(issue) ? current.filter((item) => item !== issue) : [...current, issue]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !hairstyleId || decisionConfidence === null || isSubmitted || submissionLockRef.current) return;

    submissionLockRef.current = true;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          hairstyleId,
          overallRating,
          identityRating,
          realismRating,
          decisionConfidence,
          issues,
          comment,
        }),
      });

      const responseBody = (await response.json().catch(() => ({}))) as FeedbackResponse;
      if (!response.ok) {
        setError(responseBody.details?.join(" ") ?? responseBody.error ?? "We could not save your feedback. Please try again.");
        submissionLockRef.current = false;
        return;
      }

      setIsSubmitted(true);
    } catch {
      setError("We could not save your feedback. Please try again.");
      submissionLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSkipped) return null;

  if (isSubmitted) {
    return (
      <section className="mx-auto mt-16 max-w-2xl rounded-editorial border border-brand-border bg-brand-surface px-6 py-10 text-center shadow-sm sm:px-10" aria-live="polite">
        <Check className="mx-auto h-7 w-7 text-brand-ink" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold text-brand-ink">Thank you for your feedback.</h2>
        <p className="mt-3 leading-relaxed text-brand-muted">Your feedback helps us improve future hairstyle previews.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-16 max-w-2xl rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm sm:p-10" aria-labelledby="feedback-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="feedback-heading" className="text-2xl font-semibold text-brand-ink">Help us improve Draft My Hair</h2>
          <p className="mt-2 leading-relaxed text-brand-muted">Your feedback helps us improve future hairstyle previews. This takes less than 20 seconds.</p>
        </div>
        <button type="button" onClick={() => setIsSkipped(true)} className="shrink-0 text-sm font-medium text-brand-muted transition-colors hover:text-brand-ink">Not now</button>
      </div>

      <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
        <RatingInput label="Overall satisfaction" value={overallRating} onChange={setOverallRating} />
        <RatingInput label="How much does this still look like you?" value={identityRating} onChange={setIdentityRating} />
        <RatingInput label="How realistic does this hairstyle look?" value={realismRating} onChange={setRealismRating} />

        <fieldset>
          <legend className="text-base font-medium text-brand-ink">Would you consider this hairstyle in real life?</legend>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {DECISION_OPTIONS.map((option) => (
              <label key={option.value} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded border px-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-ink focus-within:ring-offset-2 focus-within:ring-offset-brand-surface", decisionConfidence === option.value ? "border-brand-ink bg-brand-ink text-brand-canvas" : "border-brand-border text-brand-muted hover:border-brand-ink/40 hover:text-brand-ink")}>
                <input type="radio" name="decision-confidence" value={option.value} checked={decisionConfidence === option.value} onChange={() => setDecisionConfidence(option.value)} className="sr-only" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {overallRating !== null && overallRating < 5 && (
          <fieldset>
            <legend className="text-base font-medium text-brand-ink">What could be improved?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ISSUE_OPTIONS.map((issue) => (
                <label key={issue.value} className="flex cursor-pointer items-start gap-3 rounded border border-brand-border px-3 py-3 text-sm text-brand-muted transition-colors hover:border-brand-ink/40 hover:text-brand-ink">
                  <input type="checkbox" checked={issues.includes(issue.value)} onChange={() => toggleIssue(issue.value)} className="mt-0.5 h-4 w-4 accent-[#181816]" />
                  <span>{issue.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="feedback-comment" className="text-base font-medium text-brand-ink">Additional comments <span className="text-brand-muted">(optional)</span></label>
          <textarea id="feedback-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={4} className="mt-3 w-full resize-y rounded border border-brand-border bg-brand-canvas px-3 py-3 text-brand-ink outline-none transition-colors placeholder:text-brand-muted focus:border-brand-ink focus:ring-1 focus:ring-brand-ink" placeholder="Tell us anything that would make this preview more useful." />
          <p className="mt-2 text-right text-xs text-brand-muted">{comment.length}/500</p>
        </div>

        {error && <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full sm:w-auto">
          {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? "Submitting feedback..." : "Submit feedback"}
        </Button>
      </form>
    </section>
  );
}
