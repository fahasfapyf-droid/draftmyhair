import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  deleteContact,
  markContactInProgress,
  markContactResolved,
} from "@/app/actions/contact/contact-actions";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { prisma } from "@/lib/prisma";

interface ContactDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getStatusClass(status: string) {
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

export default async function ContactDetailsPage({
  params,
}: ContactDetailsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;

  const message = await prisma.contactMessage.findUnique({
    where: {
      id,
    },
  });

  if (!message) {
    notFound();
  }

  return (
    <DashboardLayout
      title="Contact Message"
      description={`Submitted ${message.createdAt.toLocaleString()}`}
      sidebar={<AdminSidebar />}
    >
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-8 shadow-sm">
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Name
            </h2>

            <p className="mt-2 text-lg text-brand-ink">
              {message.name}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Email
            </h2>

            <p className="mt-2 text-brand-ink">
              {message.email}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Subject
            </h2>

            <p className="mt-2 text-brand-ink">
              {message.subject}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Status
            </h2>

            <div className="mt-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                  message.status
                )}`}
              >
                {message.status}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              IP Address
            </h2>

            <p className="mt-2 text-brand-muted">
              {message.ipAddress ?? "Unavailable"}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              User Agent
            </h2>

            <p className="mt-2 break-all text-brand-muted">
              {message.userAgent ?? "Unavailable"}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Message
            </h2>

            <div className="mt-3 min-h-[180px] whitespace-pre-wrap rounded-editorial border border-brand-border bg-brand-background p-6">
              {message.message}
            </div>
          </div>

          <div className="border-t border-brand-border pt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Actions
            </h2>

            <div className="flex flex-wrap gap-3">
              <form
                action={async () => {
                  "use server";
                  await markContactInProgress(message.id);
                }}
              >
                <button
                  type="submit"
                  className="rounded-editorial bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600"
                >
                  Mark In Progress
                </button>
              </form>

              <form
                action={async () => {
                  "use server";
                  await markContactResolved(message.id);
                }}
              >
                <button
                  type="submit"
                  className="rounded-editorial bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  Mark Resolved
                </button>
              </form>

              <form
                action={async () => {
                  "use server";
                  await deleteContact(message.id);
                }}
              >
                <button
                  type="submit"
                  className="rounded-editorial bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  Delete Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}