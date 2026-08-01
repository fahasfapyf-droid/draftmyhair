import { CreditPackageCard } from "@/components/payments/CreditPackageCard";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CREDIT_PACKAGES } from "@/lib/payments/packages";

export default function BuyCreditsPage() {
  return (
    <DashboardLayout
      title="Buy Credits"
      description="Purchase credits for AI hairstyle generations."
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <CreditPackageCard
            key={pkg.id}
            pkg={pkg}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}