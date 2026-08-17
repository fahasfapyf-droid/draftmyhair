import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { NewHairstyleForm } from "@/components/dashboard/admin/NewHairstyleForm";

export default async function NewHairstylePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return <DashboardLayout title="Add Hairstyle" description="Create a new customer-selectable hairstyle." sidebar={<AdminSidebar />}><NewHairstyleForm /></DashboardLayout>;
}
