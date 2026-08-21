import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { PosePromptManager } from "@/components/dashboard/admin/PosePromptManager";

export default async function AdminPosePromptsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardLayout
      title="Pose Prompts"
      description="Manage versioned pose and camera preservation prompts used by the generation engine."
      sidebar={<AdminSidebar />}
    >
      <PosePromptManager />
    </DashboardLayout>
  );
}
