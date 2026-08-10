import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Images, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SalonDashboardSidebar } from "@/components/salon-dashboard/SalonDashboardSidebar";
import { getUserGenerations } from "@/lib/services/generation.service";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function SalonHistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/salon/dashboard/history");
  }

  if (session.user.role !== "SALON") {
    redirect(session.user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard");
  }

  const generations = await getUserGenerations(session.user.id);

  return (
    <DashboardLayout title="Preview History" description="Review the hairstyle previews created from this salon workspace." sidebar={<SalonDashboardSidebar />}>
      <div className="rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <div className="border-b border-brand-border p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Consultation archive</p><h2 className="mt-2 text-2xl font-semibold tracking-editorial text-brand-ink">All previews</h2></div>
            <Link href="/upload?source=salon" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-ink px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">New preview <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
        {generations.length === 0 ? (
          <div className="p-12 text-center"><Images className="mx-auto h-8 w-8 text-brand-muted" /><h3 className="mt-4 font-semibold text-brand-ink">No preview history</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">Your first client consultation preview will appear here after generation begins.</p><Link href="/upload?source=salon" className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-canvas">Start a preview <ArrowRight className="h-4 w-4" /></Link></div>
        ) : (
          <div className="divide-y divide-brand-border">{generations.map((generation) => <Link key={generation.id} href={`/dashboard/generations/${generation.id}`} className="flex flex-col gap-4 p-6 transition hover:bg-brand-canvas/60 md:flex-row md:items-center md:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-canvas"><Sparkles className="h-5 w-5 text-brand-ink" /></div><div className="min-w-0"><p className="truncate font-semibold text-brand-ink">{generation.hairstyle.name}</p><p className="mt-1 text-sm text-brand-muted">{generation.providerModel} · {formatDate(generation.createdAt)}</p></div></div><div className="flex items-center gap-4 md:shrink-0"><span className="rounded-full border border-brand-border px-3 py-1 text-xs font-semibold text-brand-muted">{generation.status.charAt(0) + generation.status.slice(1).toLowerCase()}</span><ArrowRight className="h-4 w-4 text-brand-muted" /></div></Link>)}</div>
        )}
      </div>
      <Link href="/salon/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-ink"><ArrowLeft className="h-4 w-4" />Back to salon overview</Link>
    </DashboardLayout>
  );
}
