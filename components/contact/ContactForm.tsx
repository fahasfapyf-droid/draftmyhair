"use client";

import { ChangeEvent, FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

type ContactFormData = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const INITIAL_FORM: ContactFormData = {
  name: "",
  email: "",
  subject: "General Question",
  message: "",
  website: "",
};

export function ContactForm() {
  const [form, setForm] =
    useState<ContactFormData>(INITIAL_FORM);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  function handleChange(
    event: ChangeEvent<
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/contact",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to send your message."
        );
      }

      setSuccessMessage(
        "Your enquiry has been sent successfully."
      );

      setForm(INITIAL_FORM);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
  onSubmit={handleSubmit}
  className="space-y-8"
>
          {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-sm font-medium text-brand-ink"
        >
          Name *
        </label>

        <input
          id="name"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          placeholder="Your name"
          className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none transition-colors focus:border-brand-ink"
          required
        />
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-brand-ink"
        >
          Email *
        </label>

        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="your@email.com"
          className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none transition-colors focus:border-brand-ink"
          required
        />
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor="subject"
          className="mb-2 block text-sm font-medium text-brand-ink"
        >
          Subject *
        </label>

        <select
          id="subject"
          name="subject"
          value={form.subject}
          onChange={handleChange}
          className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none transition-colors focus:border-brand-ink"
        >
          <option>General Question</option>
          <option>Preview Support</option>
          <option>Feature Request</option>
          <option>Report a Problem</option>
          <option>Salon Partnership</option>
          <option>Business Enquiry</option>
          <option>Media / Press</option>
          <option>Other</option>
        </select>

        <p className="mt-3 text-xs text-brand-muted/80">
          We typically respond within 1–2 business days.
          For urgent issues, please mention it in your
          message.
        </p>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="message"
          className="mb-2 block text-sm font-medium text-brand-ink"
        >
          Message *
        </label>

        <textarea
          id="message"
          name="message"
          rows={7}
          value={form.message}
          onChange={handleChange}
          placeholder="Tell us how we can help. Include as much detail as you'd like."
          className="w-full resize-none rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none transition-colors focus:border-brand-ink"
          required
        />
      </div>
            {successMessage && (
        <div className="rounded-editorial border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-editorial border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      <div
  aria-hidden="true"
  className="hidden"
>
  <label htmlFor="website">
    Website
  </label>

<input
  id="website"
  name="website"
  type="text"
  value={form.website}
  onChange={handleChange}
  tabIndex={-1}
  autoComplete="off"
/>
</div>

      <div className="flex justify-center">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Sending..."
            : "Send Enquiry"}
        </Button>
      </div>

      <p className="text-center text-xs text-brand-muted">
        We respect your privacy. Your information will only be used to
        respond to your enquiry.
      </p>
    </form>
  );
}