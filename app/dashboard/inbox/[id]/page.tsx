import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { replyToContactFromUser } from "@/app/actions/contact/contact-actions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getUserContactConversation } from "@/lib/services/contact.service";
import { prisma } from "@/lib/prisma";

interface InboxConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function InboxConversationPage({
  params,
}: InboxConversationPageProps) {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "USER") redirect("/dashboard");

  const { id } = await params;
  const conversation = await getUserContactConversation(session.user.id, id);

  if (!conversation) notFound();

  await prisma.contactMessageReply.updateMany({
    where: {
      contactMessageId: conversation.id,
      senderRole: "ADMIN",
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  const action = replyToContactFromUser.bind(null, conversation.id);

  return (
    <DashboardLayout
      title={conversation.subject || "Support conversation"}
      description="Your conversation with Draft My Hair support."
    >
      <Link
        href="/dashboard/inbox"
        className="mb-6 inline-flex items-center text-sm font-medium text-brand-muted transition-colors hover:text-brand-ink"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inbox
      </Link>

      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm sm:p-8">
        <div className="border-b border-brand-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            You
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brand-ink">
            {conversation.message}
          </p>
          <p className="mt-3 text-xs text-brand-muted">
            {conversation.createdAt.toLocaleString()}
          </p>
        </div>

        <div className="space-y-6 py-6">
          {conversation.replies.map((reply) => (
            <div
              key={reply.id}
              className={
                reply.senderRole === "ADMIN"
                  ? "rounded-editorial border border-brand-border bg-brand-canvas p-5"
                  : "ml-auto max-w-3xl rounded-editorial bg-brand-ink p-5 text-white"
              }
            >
              <p
                className={
                  reply.senderRole === "ADMIN"
                    ? "text-xs font-semibold uppercase tracking-wide text-brand-muted"
                    : "text-xs font-semibold uppercase tracking-wide text-white/70"
                }
              >
                {reply.senderRole === "ADMIN" ? "Draft My Hair Support" : "You"}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                {reply.message}
              </p>
              <p
                className={
                  reply.senderRole === "ADMIN"
                    ? "mt-3 text-xs text-brand-muted"
                    : "mt-3 text-xs text-white/60"
                }
              >
                {reply.createdAt.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-brand-border pt-6">
          <h2 className="text-sm font-semibold text-brand-ink">Reply</h2>
          <form action={action} className="mt-4 space-y-4">
            <textarea
              name="reply"
              required
              maxLength={5000}
              rows={6}
              placeholder="Write a message to Draft My Hair support…"
              className="w-full rounded-editorial border border-brand-border bg-brand-canvas px-4 py-3 text-sm leading-relaxed text-brand-ink outline-none transition placeholder:text-brand-muted/70 focus:border-brand-ink"
            />
            <button
              type="submit"
              className="rounded-editorial bg-brand-ink px-5 py-3 text-sm font-medium text-brand-canvas transition hover:bg-brand-ink/90"
            >
              Send Reply
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
