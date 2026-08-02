import Link from "next/link";
import { ContactMessage, ContactStatus } from "@prisma/client";

import { ContactStatusBadge } from "./ContactStatusBadge";

type ContactMessagesTableProps = {
  messages: ContactMessage[];
  search: string;
  status?: ContactStatus;
  page: number;
  hasNextPage: boolean;
  statuses: ContactStatus[];
};

export function ContactMessagesTable({
  messages,
  search,
  status,
  page,
  hasNextPage,
  statuses,
}: ContactMessagesTableProps) {
  function getPageHref(nextPage: number) {
    const params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    if (status) {
      params.set("status", status);
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const query = params.toString();

    return query
      ? `/dashboard/admin/contact?${query}`
      : "/dashboard/admin/contact";
  }

  const hasActiveFilters = Boolean(search || status);

  if (messages.length === 0) {
    return (
      <div className="space-y-6">
        <ContactMessageFilters search={search} status={status} statuses={statuses} />

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-12 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-brand-ink">
            {hasActiveFilters
              ? "No contact messages match your search."
              : "No contact messages"}
          </h2>

          <p className="mt-2 text-brand-muted">
            {hasActiveFilters
              ? "Try adjusting your search or status filter."
              : "Customer enquiries will appear here."}
          </p>

          {page > 1 ? (
            <Link
              href={getPageHref(page - 1)}
              className="mt-6 inline-flex rounded-editorial border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-background"
            >
              Previous Page
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContactMessageFilters search={search} status={status} statuses={statuses} />

      <div className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="min-w-full">
          <thead className="border-b border-brand-border bg-brand-background">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                Status
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                Name
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                Email
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                Subject
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                Submitted
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {messages.map((message) => (
              <tr
                key={message.id}
                className="border-b border-brand-border last:border-0 hover:bg-brand-background"
              >
                <td className="px-6 py-4">
                  <ContactStatusBadge status={message.status} />
                </td>

                <td className="px-6 py-4 text-sm font-medium text-brand-ink">
                  {message.name}
                </td>

                <td className="px-6 py-4 text-sm text-brand-muted">
                  {message.email}
                </td>

                <td className="px-6 py-4 text-sm text-brand-muted">
                  {message.subject}
                </td>

                <td className="px-6 py-4 text-sm text-brand-muted">
                  {message.createdAt.toLocaleString()}
                </td>

                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/admin/contact/${message.id}`}
                    className="inline-flex rounded-editorial border border-brand-border px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-background"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        {page > 1 ? (
          <Link
            href={getPageHref(page - 1)}
            className="inline-flex rounded-editorial border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-background"
          >
            Previous
          </Link>
        ) : (
          <span className="inline-flex rounded-editorial border border-brand-border px-4 py-2 text-sm font-medium text-brand-muted opacity-50">
            Previous
          </span>
        )}

        <p className="text-sm text-brand-muted">Page {page}</p>

        {hasNextPage ? (
          <Link
            href={getPageHref(page + 1)}
            className="inline-flex rounded-editorial border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-background"
          >
            Next
          </Link>
        ) : (
          <span className="inline-flex rounded-editorial border border-brand-border px-4 py-2 text-sm font-medium text-brand-muted opacity-50">
            Next
          </span>
        )}
      </div>
    </div>
  );
}

type ContactMessageFiltersProps = {
  search: string;
  status?: ContactStatus;
  statuses: ContactStatus[];
};

function ContactMessageFilters({
  search,
  status,
  statuses,
}: ContactMessageFiltersProps) {
  return (
    <form
      action="/dashboard/admin/contact"
      className="flex flex-col gap-4 rounded-editorial border border-brand-border bg-brand-surface p-4 shadow-sm sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label
          htmlFor="contact-search"
          className="mb-2 block text-sm font-medium text-brand-ink"
        >
          Search messages
        </label>
        <input
          id="contact-search"
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search name, email, or subject"
          className="h-10 w-full rounded-editorial border border-brand-border bg-brand-canvas px-3 text-sm text-brand-ink outline-none transition focus:border-brand-ink"
        />
      </div>

      <div className="sm:w-48">
        <label
          htmlFor="contact-status"
          className="mb-2 block text-sm font-medium text-brand-ink"
        >
          Status
        </label>
        <select
          id="contact-status"
          name="status"
          defaultValue={status ?? ""}
          className="h-10 w-full rounded-editorial border border-brand-border bg-brand-canvas px-3 text-sm text-brand-ink outline-none transition focus:border-brand-ink"
        >
          <option value="">All</option>
          {statuses.map((contactStatus) => (
            <option key={contactStatus} value={contactStatus}>
              {contactStatus}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="h-10 rounded-editorial bg-brand-ink px-5 text-sm font-medium text-brand-canvas transition hover:bg-brand-ink/90"
      >
        Apply
      </button>
    </form>
  );
}
