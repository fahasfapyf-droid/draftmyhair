import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { getActivePromoCodes } from "@/lib/services/promo-code.service";
import { PromoCodeAdminPanel } from "./PromoCodeAdminPanel";

export default async function AdminPromoCodesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const promos = await getActivePromoCodes();
  return <DashboardLayout sidebar={<AdminSidebar />} title="Promo Codes" description="Issue and manage promotional credit codes."><PromoCodeAdminPanel promos={promos} /></DashboardLayout>;
}
