import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";
import { UserActions } from "./UserActions";

export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isDeleted: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="Users"
      description="Manage customer accounts, including bans and account deletion."
    >
      <div className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-brand-border text-brand-muted">
            <tr>
              <th className="px-5 py-4 font-medium">Name</th>
              <th className="px-5 py-4 font-medium">Email</th>
              <th className="px-5 py-4 font-medium">Role</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Created</th>
              <th className="px-5 py-4 font-medium">Last login</th>
              <th className="px-5 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-brand-border last:border-0">
                <td className="px-5 py-4 text-brand-ink">{user.name || "—"}</td>
                <td className="px-5 py-4 text-brand-muted">{user.email || "—"}</td>
                <td className="px-5 py-4 text-brand-ink">{user.role}</td>
                <td className="px-5 py-4 text-brand-ink">{user.isActive ? "Active" : "Banned"}</td>
                <td className="px-5 py-4 text-brand-muted">{user.createdAt.toLocaleDateString()}</td>
                <td className="px-5 py-4 text-brand-muted">
                  {user.lastLoginAt ? user.lastLoginAt.toLocaleDateString() : "Never"}
                </td>
                <td className="px-5 py-4">
                  {user.role === "ADMIN" ? (
                    <span className="text-xs text-brand-muted">Admin account</span>
                  ) : (
                    <UserActions userId={user.id} isActive={user.isActive} isDeleted={user.isDeleted} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-6 text-sm text-brand-muted">No users found.</p>}
      </div>
    </DashboardLayout>
  );
}
