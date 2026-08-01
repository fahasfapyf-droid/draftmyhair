import Link from "next/link";
import { ContactMessage, ContactStatus } from "@prisma/client";

type ContactMessagesTableProps = {
  messages: ContactMessage[];
};

export function ContactMessagesTable({
  messages,
}: ContactMessagesTableProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-12 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-brand-ink">
          No contact messages
        </h2>

        <p className="mt-2 text-brand-muted">
          Customer enquiries will appear here.
        </p>
      </div>
    );
  }

  function getStatusClass(status: ContactStatus) {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-700";

      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-700";

      case "RESOLVED":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  return (
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
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                    message.status
                  )}`}
                >
                  {message.status}
                </span>
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
  );
}