interface DashboardHeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({
  title,
  description,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-brand-border pb-6">
      <h1 className="text-3xl font-semibold text-brand-ink">
        {title}
      </h1>

      {description && (
        <p className="mt-2 text-brand-muted">
          {description}
        </p>
      )}
    </header>
  );
}