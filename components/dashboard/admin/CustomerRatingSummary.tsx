import { prisma } from "@/lib/prisma";

const SERVICE_ORDER = [
  "HAIRSTYLE",
  "HAIR_COLOR",
  "BUZZ_CUT",
  "BALD",
  "BEARD",
  "BEARD_REMOVAL",
];

const HAIRSTYLE_CATEGORY_ORDER = [
  "BOB",
  "LOB",
  "PIXIE",
  "BIXIE",
  "LAYERS",
  "SHAG",
  "WOLF",
  "MULLET",
  "BANGS",
  "UPDO",
];

function orderedIndex(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

function label(value: string | null | undefined) {
  if (!value) return "Other";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AverageStars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-brand-muted">No ratings yet</span>;
  const rounded = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span
      className="inline-flex items-center gap-1 text-sm text-brand-ink"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      <span aria-hidden="true">{"★".repeat(rounded)}{"☆".repeat(5 - rounded)}</span>
      <span className="text-xs text-brand-muted">{value.toFixed(1)}</span>
    </span>
  );
}

export async function CustomerRatingSummary() {
  const generationCounts = await prisma.generation.groupBy({
    by: ["hairstyleId"],
    where: { status: "COMPLETED" },
    _count: { _all: true },
  });

  const hairstyleIds = generationCounts.map((row) => row.hairstyleId);
  const [styles, feedback] = await Promise.all([
    hairstyleIds.length
      ? prisma.hairstyle.findMany({
          where: { id: { in: hairstyleIds } },
          select: { id: true, name: true, category: true, serviceType: true },
        })
      : [],
    hairstyleIds.length
      ? prisma.feedback.findMany({
          where: {
            hairstyleId: { in: hairstyleIds },
            generationId: { not: null },
          },
          select: {
            hairstyleId: true,
            overallRating: true,
            identityRating: true,
            realismRating: true,
          },
        })
      : [],
  ]);

  const counts = new Map(generationCounts.map((row) => [row.hairstyleId, row._count._all]));
  const feedbackByStyle = new Map<string, typeof feedback>();

  for (const row of feedback) {
    if (!row.hairstyleId) continue;
    const current = feedbackByStyle.get(row.hairstyleId) ?? [];
    current.push(row);
    feedbackByStyle.set(row.hairstyleId, current);
  }

  const services = new Map<string, Map<string, typeof styles>>();

  for (const style of styles) {
    const service = services.get(style.serviceType) ?? new Map();
    const category = style.category ?? "OTHER";
    const group = service.get(category) ?? [];
    group.push(style);
    service.set(category, group);
    services.set(style.serviceType, service);
  }

  const serviceEntries = [...services.entries()].sort(
    ([a], [b]) => orderedIndex(a, SERVICE_ORDER) - orderedIndex(b, SERVICE_ORDER)
  );

  return (
    <section className="mb-6 rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">Customer Rating Summary</h2>
        <p className="mt-1 text-sm leading-6 text-brand-muted">
          Automatically compiled from customer feedback across all completed generations. No manual admin rating is required.
        </p>
      </div>

      {serviceEntries.length === 0 ? (
        <p className="mt-5 text-sm text-brand-muted">No completed generations are available yet.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {serviceEntries.map(([serviceType, categories]) => {
            const categoryOrder = serviceType === "HAIRSTYLE" ? HAIRSTYLE_CATEGORY_ORDER : [];
            const categoryEntries = [...categories.entries()].sort(
              ([a], [b]) => orderedIndex(a, categoryOrder) - orderedIndex(b, categoryOrder)
            );

            return (
              <div key={serviceType}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-ink">{label(serviceType)}</h3>
                <div className="mt-3 space-y-4">
                  {categoryEntries.map(([category, categoryStyles]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{label(category)}</p>
                      <div className="mt-2 overflow-x-auto rounded-editorial border border-brand-border">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead className="border-b border-brand-border bg-brand-canvas text-brand-muted">
                            <tr>
                              <th className="px-4 py-3 font-medium">Hairstyle</th>
                              <th className="px-4 py-3 font-medium">Generations</th>
                              <th className="px-4 py-3 font-medium">Ratings</th>
                              <th className="px-4 py-3 font-medium">Overall</th>
                              <th className="px-4 py-3 font-medium">Identity</th>
                              <th className="px-4 py-3 font-medium">Realism</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...categoryStyles].sort((a, b) => a.name.localeCompare(b.name)).map((style) => {
                              const ratings = feedbackByStyle.get(style.id) ?? [];
                              const count = ratings.length;
                              const overall = count ? ratings.reduce((sum, row) => sum + row.overallRating, 0) / count : null;
                              const identity = count ? ratings.reduce((sum, row) => sum + row.identityRating, 0) / count : null;
                              const realism = count ? ratings.reduce((sum, row) => sum + row.realismRating, 0) / count : null;

                              return (
                                <tr key={style.id} className="border-b border-brand-border last:border-0">
                                  <td className="px-4 py-3 font-medium text-brand-ink">{style.name}</td>
                                  <td className="px-4 py-3 text-brand-muted">{counts.get(style.id) ?? 0}</td>
                                  <td className="px-4 py-3 text-brand-muted">{count}</td>
                                  <td className="px-4 py-3"><AverageStars value={overall} /></td>
                                  <td className="px-4 py-3"><AverageStars value={identity} /></td>
                                  <td className="px-4 py-3"><AverageStars value={realism} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
