interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({
  title,
  description,
}: ComingSoonProps) {
  return (
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-10 shadow-sm">
      <h2 className="text-2xl font-semibold text-brand-ink">
        {title}
      </h2>

      <p className="mt-4 max-w-xl text-brand-muted">
        {description}
      </p>

      <div className="mt-8 rounded-editorial border border-dashed border-brand-border bg-brand-canvas p-8 text-center">
        <p className="font-medium text-brand-ink">
          Coming Soon
        </p>

        <p className="mt-2 text-sm text-brand-muted">
          This section will be implemented in its
          scheduled milestone.
        </p>
      </div>
    </div>
  );
}