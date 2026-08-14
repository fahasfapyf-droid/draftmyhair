import { redirect } from "next/navigation";
import { ContactStatus } from "@prisma/client";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ContactMessagesTable } from "@/components/dashboard/admin/ContactMessagesTable";
import { getContactMessages } from "@/lib/services/contact.service";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";

export const dynamic = "force-dynamic";

interface ContactMessagesPageProps {
  searchParams: Promise<{
    page?: string | string[];
    search?: string | string[];
    status?: string | string[];
  }>;
}

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ContactMessagesPage({
  searchParams,
}: ContactMessagesPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const search = getSearchParam(params.search)?.trim().slice(0, 100);
  const requestedStatus = getSearchParam(params.status);
  const status = Object.values(ContactStatus).includes(
    requestedStatus as ContactStatus
  )
    ? (requestedStatus as ContactStatus)
    : undefined;
  const requestedPage = Number(getSearchParam(params.page));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const { messages, hasNextPage } = await getContactMessages({
    page,
    search,
    status,
  });

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="Contact Messages"
      description="Manage customer enquiries and support conversations."
    >
      <ContactMessagesTable
        messages={messages}
        search={search ?? ""}
        status={status}
        page={page}
        hasNextPage={hasNextPage}
        statuses={Object.values(ContactStatus)}
      />
    </DashboardLayout>
  );
}
