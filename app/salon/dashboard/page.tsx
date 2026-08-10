import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, ImagePlus, Sparkles, Users } from "lucide-react";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SalonDashboardSidebar } from "@/components/salon-dashboard/SalonDashboardSidebar";
import { getUserGenerations } from "@/lib/services/generation.service";
import { getBalance } from "@/lib/services/credit.service";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function SalonDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/salon/dashboard");
  }

  const [generations, credits] = await Promise.all([
    getUserGenerations(session.user.id),
    getBalance(session.user.id),
  ]);

  const completed = generations.filter((item) => item.status === "COMPLETED");
  const processing = generations.filter(
    (item) => item.status === "PROCESSING" || item.status === "QUEUED"
  );
  const failed = generations.filter((item) => item.status === "FAILED");
  const processingTimes = completed
    .map((item) => item.processingTimeMs)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const averageProcessing = processingTimes.length
    ? Math.round(processingTimes.reduce((sum, value) => sum + value, 0) / processingTimes.length / 1000)
    : null;

  return (
    <DashboardLayout
      title="Salon Overview"
      description={`Welcome back, ${session.user.name ?? "Salon Partner"}. Manage client previews from one workspace.`}
      sidebar={<SalonDashboardSidebar />}
    >
      <div className="space-y-8">
        <section className="rounded-editorial border border-brand-border bg-brand-ink p-7 text-white shadow-sm md:p-9">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Client consultation workspace
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-editorial md:text-4xl">
              Show the client before the cut.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 md:text-lg">
              Start a new preview during a consultation, compare realistic options,
              and make the decision with the client before any permanent change.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/upload?source=salon"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-ink transition hover:bg-white/90"
              >
                <ImagePlus className="h-4 w-4" />
                Start client preview
              </Link>
              <Link
                href="/salon/dashboard/history"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View preview history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total previews"
            value={generations.length}
            icon={Sparkles}
            detail="All previews created from this account"
          />
          <MetricCard
            label="Completed"
            value={completed.length}
            icon={CheckCircle2}
            detail={`${failed.length} failed`}
          />
          <MetricCard
            label="In progress"
            value={processing.length}
            icon={Clock3}
            detail={processing.length ? "Awaiting completion" : "No active jobs"}
          />
          <MetricCard
            label="Credits"
            value={credits}
            icon={Sparkles}
            detail="Available for new previews"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">
                  Recent previews
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-editorial text-brand-ink">
                  Consultation activity
                </h2>
              </div>
              <Link
                href="/salon/dashboard/history"
                className="hidden items-center gap-1 text-sm font-semibold text-brand-ink hover:underline sm:flex"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {generations.length === 0 ? (
              <EmptyActivity />
            ) : (
              <div className="mt-6 divide-y divide-brand-border">
                {generations.slice(0, 6).map((generation) => (
                  <Link
                    key={generation.id}
                    href={`/dashboard/generations/${generation.id}`}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:bg-brand-canvas/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-brand-ink">
                        {generation.hairstyle.name}
                      </p>
                      <p className="mt-1 text-sm text-brand-muted">
                        {formatDate(generation.createdAt)} · {generation.providerModel}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-brand-border px-3 py-1 text-xs font-semibold text-brand-muted">
                      {statusLabel(generation.status)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm md:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">
              Workspace status
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-editorial text-brand-ink">
              Ready for consultation
            </h2>

            <div className="mt-6 space-y-5">
              <StatusRow label="Preview engine" value="Available" />
              <StatusRow label="Hairstyle catalog" value="Connected" />
              <StatusRow label="Credits" value={`${credits} available`} />
              <StatusRow
                label="Average processing"
                value={averageProcessing ? `${averageProcessing}s` : "No completed data"}
              />
            </div>

            <div className="mt-7 rounded-xl border border-brand-border bg-brand-canvas p-5">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" />
                <div>
                  <p className="font-semibold text-brand-ink">Client workspace</p>
                  <p className="mt-1 text-sm leading-6 text-brand-muted">
                    Client profiles and salon-specific history are the next data layer.
                    The dashboard currently uses the account&apos;s existing preview history.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <ActionCard
            href="/upload?source=salon"
            title="New client preview"
            description="Upload a client photo and move directly into hairstyle selection."
          />
          <ActionCard
            href="/salon/dashboard/clients"
            title="Client workspace"
            description="Prepare the client-management area for repeat consultations."
          />
          <ActionCard
            href="/dashboard/payments"
            title="Manage credits"
            description="Review your credit balance and purchase history."
          />
        </section>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
        <Icon className="h-4 w-4 text-brand-muted" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-editorial text-brand-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-brand-muted">{detail}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-brand-border pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-brand-muted">{label}</span>
      <span className="text-sm font-semibold text-brand-ink">{value}</span>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-ink"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-brand-ink">{title}</h3>
        <ArrowRight className="h-4 w-4 text-brand-muted transition group-hover:translate-x-1 group-hover:text-brand-ink" />
      </div>
      <p className="mt-3 text-sm leading-6 text-brand-muted">{description}</p>
    </Link>
  );
}

function EmptyActivity() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-brand-border p-8 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-brand-muted" />
      <p className="mt-3 font-semibold text-brand-ink">No previews yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-brand-muted">
        Start a client preview to begin building consultation history.
      </p>
      <Link
        href="/upload?source=salon"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Start first preview <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
