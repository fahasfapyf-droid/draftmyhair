"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/components/forms/PasswordInput";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
const [resending, setResending] = useState(false);

const [error, setError] = useState("");
const [success, setSuccess] = useState("");
const [cooldown, setCooldown] = useState(0);

useEffect(() => {
  if (!error && !success) return;

  const timer = setTimeout(() => {
    setError("");
    setSuccess("");
  }, 5000);

  return () => clearTimeout(timer);
}, [error, success]);

useEffect(() => {
  if (cooldown <= 0) return;

  const timer = setInterval(() => {
    setCooldown((value) => value - 1);
  }, 1000);

  return () => clearInterval(timer);
}, [cooldown]);  
async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  )
   {
    e.preventDefault();

    setLoading(true);
setError("");
setSuccess("");

    try {
      // Check credentials before calling Auth.js
      const response = await fetch("/api/login-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.status === "EMAIL_NOT_VERIFIED") {
        setLoading(false);
        setError(
          "Please verify your email before signing in."
        );
        return;
      }

      if (data.status === "INVALID_CREDENTIALS") {
        setLoading(false);
        setError("Invalid email or password.");
        return;
      }

      if (data.status === "ERROR") {
        setLoading(false);
        setError("Something went wrong. Please try again.");
        return;
      }

      // Credentials are valid. Now create the session.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (result?.error) {
        setError("Unable to sign in.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);

      setLoading(false);

      setError("Something went wrong. Please try again.");
    }
  }
async function handleResendVerification() {
  if (!email) {
    setError("Please enter your email address first.");
    return;
  }

  setResending(true);
  setError("");
  setSuccess("");

  try {
    const response = await fetch(
      "/api/resend-verification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
    setSuccess(data.message);
    setCooldown(300);
}
    else {
      setError(
        data.message ??
          "Unable to resend verification email."
      );
    }
  } catch {
    setError(
      "Unable to resend verification email."
    );
  } finally {
    setResending(false);
  }
}
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        Sign In
      </h1>

      <p className="mb-8 text-brand-muted">
        Sign in to your Draft My Hair account.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium"
          >
            Email Address
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Enter your email"
            autoComplete="email"
            required
            className="w-full rounded-editorial border border-brand-border px-4 py-3"
          />
        </div>

        <PasswordInput
          id="password"
          name="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-ink transition-opacity hover:opacity-70"
          >
            Forgot your password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-editorial bg-brand-ink px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Signing In..."
            : "Sign In"}
        </button>

{error && (
  <>
    <div className="rounded-editorial border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>

    {error ===
  "Please verify your email before signing in." &&
  !success && (
      <div className="text-center">
        <button
          type="button"
          onClick={handleResendVerification}
          disabled={resending || cooldown > 0}
          className="text-sm font-medium text-brand-ink underline hover:opacity-70 disabled:opacity-50"
        >
          {resending
  ? "Sending..."
  : cooldown > 0
    ? `Resend available in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`
    : "Resend verification email"}
        </button>
      </div>
    )}
  </>
)}

{success && (
  <div className="rounded-editorial border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
    {success}
  </div>
)}
        <div className="pt-2 text-center text-sm text-brand-muted">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-brand-ink hover:underline"
          >
            Register
          </Link>
        </div>
      </form>
    </main>
  );
}