import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ContactMessagesTable } from "@/components/dashboard/admin/ContactMessagesTable";
import { getContactMessages } from "@/lib/services/contact.service";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";

export default async function ContactMessagesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const messages = await getContactMessages();

  return (
    <DashboardLayout
  sidebar={<AdminSidebar />}
      title="Contact Messages"
      description="Manage customer enquiries."
    >
      <ContactMessagesTable
        messages={messages}
      />
    </DashboardLayout>
  );
}