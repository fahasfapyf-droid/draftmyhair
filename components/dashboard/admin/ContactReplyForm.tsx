"use client";

import { useFormStatus } from "react-dom";

import { replyToContact } from "@/app/actions/contact/contact-actions";

interface ContactReplyFormProps {
  contactId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-editorial bg-brand-ink px-5 py-2.5 text-sm font-medium text-brand-canvas transition hover:bg-brand-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send Reply"}
    </button>
  );
}

export function ContactReplyForm({ contactId }: ContactReplyFormProps) {
  const action = replyToContact.bind(null, contactId);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="contact-reply" className="mb-2 block text-sm font-medium text-brand-ink">
          Reply
        </label>
        <textarea
          id="contact-reply"
          name="reply"
          required
          maxLength={5000}
          rows={8}
          placeholder="Write your reply to the customer…"
          className="w-full rounded-editorial border border-brand-border bg-brand-canvas px-4 py-3 text-sm leading-relaxed text-brand-ink outline-none transition placeholder:text-brand-muted/70 focus:border-brand-ink"
        />
        <p className="mt-2 text-xs text-brand-muted">
          The reply will be sent to the customer&apos;s email address.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
