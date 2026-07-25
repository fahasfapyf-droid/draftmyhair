import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
      isActive: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayout
      title="Profile"
      description="Manage your account information."
    >
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-brand-ink">
          Account Information
        </h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <ProfileField
            label="Full Name"
            value={user.name ?? "Not provided"}
          />

          <ProfileField
            label="Email Address"
            value={user.email ?? "Not provided"}
          />

          <ProfileField
            label="Role"
            value={user.role?.toString() ?? "Unknown"}
          />

          <ProfileField
            label="Email Verified"
            value={
              user.emailVerified
                ? "Verified"
                : "Not Verified"
            }
          />

          <ProfileField
            label="Member Since"
            value={user.createdAt.toLocaleDateString()}
          />

          <ProfileField
            label="Last Login"
            value={
              user.lastLoginAt
                ? user.lastLoginAt.toLocaleString()
                : "Unknown"
            }
          />

          <ProfileField
            label="Account Status"
            value={
              user.isActive
                ? "Active"
                : "Inactive"
            }
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

interface ProfileFieldProps {
  label: string;
  value: string;
}

function ProfileField({
  label,
  value,
}: ProfileFieldProps) {
  return (
    <div>
      <p className="text-sm text-brand-muted">
        {label}
      </p>

      <p className="mt-1 text-base font-medium text-brand-ink">
        {value}
      </p>
    </div>
  );
}