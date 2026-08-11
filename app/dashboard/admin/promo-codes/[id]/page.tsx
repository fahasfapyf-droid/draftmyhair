import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { getPromoRedemptions } from "@/lib/services/promo-code.service";
import { prisma } from "@/lib/prisma";

export default async function PromoCodeUsagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) notFound();
  const redemptions = await getPromoRedemptions(id);
  return (
    <DashboardLayout sidebar={<AdminSidebar />} title={`Promo Code: ${promo.code}`} description="View redemption usage and customers.">
      <div className="mb-6"><Link href="/dashboard/admin/promo-codes" className="text-sm text-brand-muted hover:text-brand-ink">← Back to Promo Codes</Link></div>
      <div className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-brand-border text-brand-muted"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Credits</th><th className="px-5 py-4">Redeemed</th></tr></thead><tbody>{redemptions.map((item) => <tr key={item.id} className="border-b border-brand-border last:border-0"><td className="px-5 py-4">{item.user.name || "—"}</td><td className="px-5 py-4 text-brand-muted">{item.user.email || "—"}</td><td className="px-5 py-4">{item.creditsGranted}</td><td className="px-5 py-4 text-brand-muted">{item.redeemedAt.toLocaleString()}</td></tr>)}</tbody></table>
        {redemptions.length === 0 && <p className="p-6 text-sm text-brand-muted">No redemptions yet.</p>}
      </div>
    </DashboardLayout>
  );
}
