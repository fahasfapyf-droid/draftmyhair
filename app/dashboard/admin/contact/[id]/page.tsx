import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { ContactActions } from "@/components/dashboard/admin/ContactActions";
import { ContactReplyForm } from "@/components/dashboard/admin/ContactReplyForm";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { ContactStatusBadge } from "@/components/dashboard/admin/ContactStatusBadge";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { prisma } from "@/lib/prisma";

interface ContactDetailsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reply?: string }>;
}

export default async function ContactDetailsPage({
  params,
  searchParams,
}: ContactDetailsPageProps) {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const { reply } = await searchParams;

  const message = await prisma.contactMessage.findUnique({
    where: { id },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!message) notFound();

  // Opening a conversation counts as the admin reading the customer's unread replies.
  await prisma.contactMessageReply.updateMany({
    where: {
      contactMessageId: id,
      senderRole: "USER",
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return (
    <DashboardLayout
      title="Contact Message"
      description={`Submitted ${message.createdAt.toLocaleString()}`}
      sidebar={<AdminSidebar />}
    >
      <Link
        href="/dashboard/admin/contact"
        className="mb-6 inline-flex items-center text-sm font-medium text-brand-muted transition-colors hover:text-brand-ink"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Contact Messages
      </Link>

      {reply === "sent" ? (
        <div className="mb-6 rounded-editorial border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          Reply saved and sent successfully to {message.email}.
        </div>
      ) : null}

      {reply === "saved-email-failed" ? (
        <div className="mb-6 rounded-editorial border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Reply was saved to the customer&apos;s Draft My Hair Inbox, but the email notification could not be sent.
        </div>
      ) : null}

      <div className="rounded-editorial border border-brand-border bg-brand-surface p-8 shadow-sm">
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Name</h2>
            <p className="mt-2 text-lg text-brand-ink">{message.name}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Email</h2>
            <p className="mt-2 text-brand-ink">{message.email}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Subject</h2>
            <p className="mt-2 text-brand-ink">{message.subject || "No subject"}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Status</h2>
            <div className="mt-3">
              <ContactStatusBadge status={message.status} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">IP Address</h2>
            <p className="mt-2 text-brand-muted">{message.ipAddress ?? "Unavailable"}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">User Agent</h2>
            <p className="mt-2 break-all text-brand-muted">{message.userAgent ?? "Unavailable"}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Conversation</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-editorial border border-brand-border bg-brand-background p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Customer</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brand-ink">{message.message}</p>
                <p className="mt-3 text-xs text-brand-muted">{message.createdAt.toLocaleString()}</p>
              </div>

              {message.replies.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.senderRole === "ADMIN"
                      ? "rounded-editorial bg-brand-ink p-6 text-white"
                      : "rounded-editorial border border-brand-border bg-brand-canvas p-6"
                  }
                >
                  <p className={item.senderRole === "ADMIN" ? "text-xs font-semibold uppercase tracking-wide text-white/70" : "text-xs font-semibold uppercase tracking-wide text-brand-muted"}>
                    {item.senderRole === "ADMIN" ? "Draft My Hair Support" : "Customer"}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{item.message}</p>
                  <p className={item.senderRole === "ADMIN" ? "mt-3 text-xs text-white/60" : "mt-3 text-xs text-brand-muted"}>
                    {item.createdAt.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-brand-border pt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-muted">Reply to Customer</h2>
            <ContactReplyForm contactId={message.id} />
          </div>

          <div className="border-t border-brand-border pt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-muted">Actions</h2>
            <ContactActions contactId={message.id} status={message.status} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
