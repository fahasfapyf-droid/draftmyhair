import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, UserRound, Users } from "lucide-react";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SalonDashboardSidebar } from "@/components/salon-dashboard/SalonDashboardSidebar";

export default async function SalonClientsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/salon/dashboard/clients");
  }

  if (session.user.role !== "SALON") {
    redirect(session.user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard");
  }

  return (
    <DashboardLayout title="Clients" description="Prepare and manage the client workspace for repeat salon consultations." sidebar={<SalonDashboardSidebar />}>
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-8 shadow-sm md:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-border bg-brand-canvas"><Users className="h-6 w-6 text-brand-ink" /></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Client workspace</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-editorial text-brand-ink">Built for repeat consultations.</h2>
          <p className="mt-5 text-base leading-7 text-brand-muted">The dashboard navigation and workspace are ready. Persistent salon clients require a dedicated salon/client data model so client records, consent, consultation history and ownership are not mixed with consumer accounts.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-3">
          <Feature title="Client profiles" /><Feature title="Consultation history" /><Feature title="Saved previews" />
        </div>
        <div className="mx-auto mt-10 flex max-w-2xl flex-col justify-center gap-3 sm:flex-row">
          <Link href="/upload?source=salon" className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-ink px-5 py-3 text-sm font-semibold text-white hover:opacity-90"><UserRound className="h-4 w-4" />Start a client preview</Link>
          <Link href="/salon/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-border px-5 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-canvas">Back to overview <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
      <Link href="/salon/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-ink"><ArrowLeft className="h-4 w-4" />Back to salon overview</Link>
    </DashboardLayout>
  );
}

function Feature({ title }: { title: string }) {
  return <div className="rounded-xl border border-brand-border bg-brand-canvas p-5 text-center"><p className="text-sm font-semibold text-brand-ink">{title}</p><p className="mt-2 text-xs leading-5 text-brand-muted">Next data layer</p></div>;
}
