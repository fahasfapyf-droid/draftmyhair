import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { AdminContentLibrary } from "@/components/dashboard/admin/AdminContentLibrary";
import { StylePhotoManager } from "@/components/dashboard/admin/StylePhotoManager";

export default async function AdminContentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="Content Library"
      description="Manage hairstyles, hair colours, buzz cuts, bald looks, beards, clean shaves, production prompts and public transformations."
      sidebar={<AdminSidebar />}
    >
      <div className="space-y-6">
        <StylePhotoManager />
        <AdminContentLibrary />
      </div>
    </DashboardLayout>
  );
}
