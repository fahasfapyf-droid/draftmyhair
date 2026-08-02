"use client";

import { useState } from "react";
import { ContactStatus } from "@prisma/client";

import {
  deleteContact,
  markContactInProgress,
  markContactResolved,
} from "@/app/actions/contact/contact-actions";

type ContactActionsProps = {
  contactId: string;
  status: ContactStatus;
};

export function ContactActions({ contactId, status }: ContactActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const inProgressAction = markContactInProgress.bind(null, contactId);
  const resolvedAction = markContactResolved.bind(null, contactId);
  const deleteAction = deleteContact.bind(null, contactId);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <form action={inProgressAction}>
          <button
            type="submit"
            disabled={status === "IN_PROGRESS"}
            className="rounded-editorial bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark In Progress
          </button>
        </form>

        <form action={resolvedAction}>
          <button
            type="submit"
            disabled={status === "RESOLVED"}
            className="rounded-editorial bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark Resolved
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsDeleteDialogOpen(true)}
          className="rounded-editorial bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Delete Message
        </button>
      </div>

      {isDeleteDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-contact-title"
          aria-describedby="delete-contact-description"
        >
          <div className="w-full max-w-md rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-editorial">
            <h3
              id="delete-contact-title"
              className="text-lg font-semibold text-brand-ink"
            >
              Delete contact message?
            </h3>

            <p
              id="delete-contact-description"
              className="mt-2 text-sm leading-relaxed text-brand-muted"
            >
              This permanently deletes the message and cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="rounded-editorial border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-background"
              >
                Cancel
              </button>

              <form action={deleteAction}>
                <button
                  type="submit"
                  className="rounded-editorial bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
