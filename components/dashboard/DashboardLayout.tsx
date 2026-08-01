import { ReactNode } from "react";

import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";

interface DashboardLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

export function DashboardLayout({
  title,
  description,
  children,
  sidebar,
}: DashboardLayoutProps) {
  return (
    <main className="mx-auto flex max-w-7xl gap-8 px-6 py-10">
      {sidebar ?? <DashboardSidebar />}

      <section className="min-w-0 flex-1">
        <DashboardHeader
          title={title}
          description={description}
        />

        <div className="mt-8">
          {children}
        </div>
      </section>
    </main>
  );
}