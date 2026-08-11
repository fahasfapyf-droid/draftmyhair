import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SalonDashboardSidebar } from "@/components/salon-dashboard/SalonDashboardSidebar";
import { SalonClientsWorkspace } from "@/components/salon-dashboard/SalonClientsWorkspace";

export default async function SalonClientsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/salon/dashboard/clients");
  }

  if (session.user.role !== "SALON") {
    redirect(session.user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard");
  }

  const clients = await prisma.salonClient.findMany({
    where: { salonId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { generations: true } } },
  });

  return (
    <DashboardLayout
      title="Clients"
      description="Manage client profiles and keep every salon preview attached to the correct consultation."
      sidebar={<SalonDashboardSidebar />}
    >
      <SalonClientsWorkspace initialClients={clients} />
    </DashboardLayout>
  );
}
