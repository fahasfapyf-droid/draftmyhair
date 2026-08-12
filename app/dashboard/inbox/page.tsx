import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox as InboxIcon } from "lucide-react";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getUserContactInbox } from "@/lib/services/contact.service";

export default async function InboxPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "USER") redirect("/dashboard");

  const conversations = await getUserContactInbox(session.user.id);

  return (
    <DashboardLayout
      title="Inbox"
      description="View and reply to your Draft My Hair support conversations."
    >
      <div className="space-y-4">
        {conversations.length === 0 ? (
          <div className="rounded-editorial border border-brand-border bg-brand-surface p-10 text-center shadow-sm">
            <InboxIcon className="mx-auto h-10 w-10 text-brand-muted" />
            <h2 className="mt-4 text-lg font-semibold text-brand-ink">
              Your inbox is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">
              When you contact Draft My Hair, your support conversation and replies will appear here.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-brand-ink px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Contact Us
            </Link>
          </div>
        ) : (
          conversations.map((conversation) => {
            const latestReply = conversation.replies[0];
            const unread = latestReply?.senderRole === "ADMIN" && !latestReply.readAt;

            return (
              <Link
                key={conversation.id}
                href={`/dashboard/inbox/${conversation.id}`}
                className="block rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm transition hover:border-brand-ink"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="truncate font-semibold text-brand-ink">
                        {conversation.subject || "Support conversation"}
                      </h2>
                      {unread ? (
                        <span className="shrink-0 rounded-full bg-brand-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          New reply
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-brand-muted">
                      {latestReply?.message ?? conversation.message}
                    </p>
                    <p className="mt-3 text-xs text-brand-muted">
                      Updated {conversation.updatedAt.toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand-muted" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
