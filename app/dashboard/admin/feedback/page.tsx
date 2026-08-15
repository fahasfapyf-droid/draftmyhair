import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";

export default async function AdminFeedbackPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const feedback = await prisma.feedback.findMany({
    select: {
      id: true,
      overallRating: true,
      identityRating: true,
      realismRating: true,
      decisionConfidence: true,
      issues: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      hairstyle: { select: { name: true } },
      generation: {
        select: {
          id: true,
          status: true,
          provider: true,
          providerModel: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="Customer Feedback"
      description="Review ratings and quality feedback submitted for completed generations."
    >
      <div className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full min-w-[1300px] text-left text-sm">
          <thead className="border-b border-brand-border text-brand-muted">
            <tr>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Style</th>
              <th className="px-5 py-4 font-medium">Overall</th>
              <th className="px-5 py-4 font-medium">Identity</th>
              <th className="px-5 py-4 font-medium">Realism</th>
              <th className="px-5 py-4 font-medium">Decision</th>
              <th className="px-5 py-4 font-medium">Issues</th>
              <th className="px-5 py-4 font-medium">Comment</th>
              <th className="px-5 py-4 font-medium">Generation</th>
              <th className="px-5 py-4 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((item) => (
              <tr key={item.id} className="border-b border-brand-border align-top last:border-0">
                <td className="px-5 py-4 text-brand-ink">
                  {item.user?.name || item.user?.email || "Deleted account"}
                </td>
                <td className="px-5 py-4 text-brand-ink">{item.hairstyle?.name || "—"}</td>
                <td className="px-5 py-4 font-medium text-brand-ink">{item.overallRating}/5</td>
                <td className="px-5 py-4 text-brand-ink">{item.identityRating}/5</td>
                <td className="px-5 py-4 text-brand-ink">{item.realismRating}/5</td>
                <td className="px-5 py-4 text-brand-muted">{formatDecision(item.decisionConfidence)}</td>
                <td className="px-5 py-4 text-brand-muted">
                  {item.issues.length > 0 ? item.issues.join(", ") : "None"}
                </td>
                <td className="max-w-xs px-5 py-4 whitespace-pre-wrap text-brand-muted">
                  {item.comment || "—"}
                </td>
                <td className="px-5 py-4 text-brand-muted">
                  <div className="font-mono text-xs">{item.generation?.id || "—"}</div>
                  <div className="mt-1">{item.generation?.status || "—"}</div>
                </td>
                <td className="px-5 py-4 text-brand-muted">{item.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {feedback.length === 0 && (
          <p className="p-6 text-sm text-brand-muted">No customer feedback has been submitted yet.</p>
        )}
      </div>
    </DashboardLayout>
  );
}

function formatDecision(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
