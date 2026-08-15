import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";

type FeedbackItem = {
  id: string;
  overallRating: number;
  identityRating: number;
  realismRating: number;
  decisionConfidence: string;
  issues: string[];
  comment: string | null;
  createdAt: Date;
  user: { name: string | null; email: string | null } | null;
  hairstyle: { id: string; name: string } | null;
  generation: {
    id: string;
    status: string;
    provider: string;
    providerModel: string;
    createdAt: Date;
  } | null;
};

export default async function AdminFeedbackPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const feedback = (await prisma.feedback.findMany({
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
      hairstyle: { select: { id: true, name: true } },
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
  })) as FeedbackItem[];

  const grouped = groupByHairstyle(feedback);

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="Customer Feedback"
      description="Compare hairstyle quality using customer-perceived identity preservation, realism, and haircut accuracy."
    >
      <div className="space-y-6">
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-ink">Hairstyle Quality</h2>
              <p className="mt-1 text-sm text-brand-muted">
                Averages are calculated from submitted customer feedback. The current Haircut Accuracy column uses the existing Overall Satisfaction rating because Version 1.0 does not store a separate haircut-accuracy score.
              </p>
            </div>
            <div className="text-sm text-brand-muted">{feedback.length} total review{feedback.length === 1 ? "" : "s"}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-brand-border text-brand-muted">
                <tr>
                  <th className="px-5 py-4 font-medium">Hairstyle</th>
                  <th className="px-5 py-4 font-medium">Reviews</th>
                  <th className="px-5 py-4 font-medium">Identity</th>
                  <th className="px-5 py-4 font-medium">Realism</th>
                  <th className="px-5 py-4 font-medium">Haircut Accuracy</th>
                  <th className="px-5 py-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <tr key={group.id} className="border-b border-brand-border align-middle last:border-0">
                    <td className="px-5 py-4 font-medium text-brand-ink">{group.name}</td>
                    <td className="px-5 py-4 text-brand-muted">{group.count}</td>
                    <td className="px-5 py-4 font-medium text-brand-ink">{formatAverage(group.identityTotal, group.count)}</td>
                    <td className="px-5 py-4 font-medium text-brand-ink">{formatAverage(group.realismTotal, group.count)}</td>
                    <td className="px-5 py-4 font-medium text-brand-ink">{formatAverage(group.haircutAccuracyTotal, group.count)}</td>
                    <td className="px-5 py-4">
                      <a
                        href={`#feedback-${group.id}`}
                        className="inline-flex rounded-full border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-canvas"
                      >
                        View reviews
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {grouped.length === 0 && (
            <p className="p-6 text-sm text-brand-muted">No customer feedback has been submitted yet.</p>
          )}
        </div>

        {grouped.map((group) => (
          <details
            key={group.id}
            id={`feedback-${group.id}`}
            className="scroll-mt-24 rounded-editorial border border-brand-border bg-brand-surface shadow-sm"
          >
            <summary className="cursor-pointer list-none px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-semibold text-brand-ink">{group.name}</span>
                  <span className="ml-2 text-sm text-brand-muted">{group.count} review{group.count === 1 ? "" : "s"}</span>
                </div>
                <span className="text-sm text-brand-muted">
                  Identity {formatAverage(group.identityTotal, group.count)} · Realism {formatAverage(group.realismTotal, group.count)} · Haircut Accuracy {formatAverage(group.haircutAccuracyTotal, group.count)}
                </span>
              </div>
            </summary>
            <div className="border-t border-brand-border">
              {group.items.map((item) => (
                <article key={item.id} className="border-b border-brand-border p-5 last:border-0">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Metric label="Identity" value={`${item.identityRating}/5`} />
                    <Metric label="Realism" value={`${item.realismRating}/5`} />
                    <Metric label="Haircut Accuracy" value={`${item.overallRating}/5`} />
                  </div>
                  <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                    <div>
                      <div className="font-medium text-brand-ink">Customer</div>
                      <div className="mt-1 text-brand-muted">{item.user?.name || item.user?.email || "Deleted account"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-brand-ink">Decision confidence</div>
                      <div className="mt-1 text-brand-muted">{formatDecision(item.decisionConfidence)}</div>
                    </div>
                    <div>
                      <div className="font-medium text-brand-ink">Issues</div>
                      <div className="mt-1 break-words text-brand-muted">{item.issues.length > 0 ? item.issues.join(", ") : "None"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-brand-ink">Comment</div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-brand-muted">{item.comment || "—"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-brand-ink">Generation</div>
                      <div className="mt-1 break-all font-mono text-xs text-brand-muted">{item.generation?.id || "—"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-brand-ink">Submitted</div>
                      <div className="mt-1 text-brand-muted">{item.createdAt.toLocaleString()}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>
    </DashboardLayout>
  );
}

function groupByHairstyle(items: FeedbackItem[]) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      count: number;
      identityTotal: number;
      realismTotal: number;
      haircutAccuracyTotal: number;
      items: FeedbackItem[];
    }
  >();

  for (const item of items) {
    const id = item.hairstyle?.id ?? "unknown";
    const name = item.hairstyle?.name ?? "Unknown hairstyle";
    const existing = groups.get(id);

    if (existing) {
      existing.count += 1;
      existing.identityTotal += item.identityRating;
      existing.realismTotal += item.realismRating;
      existing.haircutAccuracyTotal += item.overallRating;
      existing.items.push(item);
    } else {
      groups.set(id, {
        id,
        name,
        count: 1,
        identityTotal: item.identityRating,
        realismTotal: item.realismRating,
        haircutAccuracyTotal: item.overallRating,
        items: [item],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatAverage(total: number, count: number) {
  return `${(total / count).toFixed(1)}/5`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-editorial border border-brand-border bg-brand-canvas p-4">
      <div className="text-xs uppercase tracking-wide text-brand-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-brand-ink">{value}</div>
    </div>
  );
}

function formatDecision(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
