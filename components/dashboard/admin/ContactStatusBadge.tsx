import { ContactStatus } from "@prisma/client";

type ContactStatusBadgeProps = {
  status: ContactStatus;
};

const statusClasses: Record<ContactStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-700",
};

export function ContactStatusBadge({ status }: ContactStatusBadgeProps) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}
