"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SalonSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/salon/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Salon registration failed.");
        return;
      }

      router.push(
        `/salon/signup/success?email=${encodeURIComponent(email)}&verificationEmailSent=${data.verificationEmailSent !== false}`
      );
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
          Draft My Hair for Salons
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-editorial">
          Create your salon workspace
        </h1>
        <p className="mt-4 leading-7 text-brand-muted">
          Create a dedicated salon account for client consultations, previews and
          preview history.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            Your name or salon name
          </label>
          <input
            id="name"
            className="w-full rounded-editorial border border-brand-border px-4 py-3"
            placeholder="Salon name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            className="w-full rounded-editorial border border-brand-border px-4 py-3"
            type="email"
            placeholder="you@salon.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            className="w-full rounded-editorial border border-brand-border px-4 py-3"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-editorial bg-brand-ink p-3 font-medium text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating workspace..." : "Create Salon Workspace"}
        </button>

        {message && (
          <p className="rounded-editorial border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </p>
        )}
      </form>

      <div className="mt-6 space-y-3 text-center text-sm text-brand-muted">
        <p>
          Already have a salon account?{" "}
          <Link
            href="/login?callbackUrl=/salon/dashboard"
            className="font-medium text-brand-ink hover:underline"
          >
            Sign in
          </Link>
        </p>
        <Link href="/salons" className="font-medium text-brand-ink hover:underline">
          Back to salon information
        </Link>
      </div>
    </main>
  );
}
