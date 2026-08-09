"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type {
  HairstyleGender,
  HairstyleServiceType,
} from "@/lib/api/hairstyles";

const AUDIENCES: Array<{ value: HairstyleGender; label: string }> = [
  { value: "FEMALE", label: "Women" },
  { value: "MALE", label: "Men" },
  { value: "UNISEX", label: "Unisex" },
];

const SERVICES: Array<{
  value: HairstyleServiceType;
  label: string;
  slug: string;
  audiences: HairstyleGender[];
}> = [
  {
    value: "HAIRSTYLE",
    label: "Haircuts & Hairstyles",
    slug: "hairstyle",
    audiences: ["FEMALE", "MALE", "UNISEX"],
  },
  {
    value: "HAIR_COLOR",
    label: "Hair Colour",
    slug: "hair-colour",
    audiences: ["FEMALE", "MALE", "UNISEX"],
  },
  {
    value: "BUZZ_CUT",
    label: "Buzz Cut",
    slug: "buzz-cut",
    audiences: ["FEMALE", "MALE", "UNISEX"],
  },
  {
    value: "BALD",
    label: "Bald",
    slug: "bald",
    audiences: ["FEMALE", "MALE", "UNISEX"],
  },
  {
    value: "BEARD",
    label: "Beard",
    slug: "beard-style",
    audiences: ["MALE"],
  },
  {
    value: "BEARD_REMOVAL",
    label: "Beard Removal",
    slug: "beard-removal",
    audiences: ["MALE"],
  },
];

const FEMALE_CATEGORIES = [
  ["BOB", "Bob"],
  ["LOB", "Lob"],
  ["PIXIE", "Pixie"],
  ["BIXIE", "Bixie"],
  ["LAYERS", "Layers"],
  ["SHAG", "Shag"],
  ["WOLF", "Wolf"],
  ["MULLET", "Mullet"],
  ["BANGS", "Bangs"],
  ["UPDO", "Updo"],
] as const;

const MALE_CATEGORIES = [
  ["FADE", "Fade"],
  ["TAPER", "Taper"],
  ["UNDERCUT", "Undercut"],
  ["CROP", "Crop"],
  ["CREW", "Crew"],
  ["QUIFF", "Quiff"],
  ["POMPADOUR", "Pompadour"],
  ["SIDE_PART", "Side Part"],
  ["COMB_OVER", "Comb Over"],
  ["MOHAWK", "Mohawk"],
  ["MAN_BUN", "Man Bun"],
  ["BRAIDS", "Braids"],
  ["LOCS", "Locs"],
  ["AFRO", "Afro"],
  ["CURLY", "Curly"],
] as const;

function getCategories(gender: HairstyleGender) {
  if (gender === "FEMALE") return FEMALE_CATEGORIES;
  if (gender === "MALE") return MALE_CATEGORIES;
  return [...FEMALE_CATEGORIES, ...MALE_CATEGORIES];
}

function updateQuery(
  pathname: string,
  searchParams: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(searchParams);

  for (const [key, value] of Object.entries(updates)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }

  return `${pathname}?${next.toString()}`;
}

type CatalogNavigatorProps = {
  gender: HairstyleGender;
  serviceType: HairstyleServiceType;
  styleCategory?: string;
};

export const CatalogNavigator: React.FC<CatalogNavigatorProps> = ({
  gender,
  serviceType,
  styleCategory,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const currentParams = useSearchParams();

  const serviceOptions = SERVICES.filter((service) =>
    service.audiences.includes(gender),
  );
  const currentService = SERVICES.find((service) => service.value === serviceType);
  const categories = serviceType === "HAIRSTYLE" ? getCategories(gender) : [];

  const navigate = (updates: Record<string, string | null>) => {
    router.push(updateQuery(pathname, new URLSearchParams(currentParams), updates));
  };

  return (
    <div className="mb-12 space-y-8">
      <section aria-label="Audience">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-brand-muted">
          Audience
        </p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((audience) => (
            <button
              key={audience.value}
              type="button"
              onClick={() => navigate({ gender: audience.value, styleCategory: null })}
              className={`rounded-full border px-5 py-2.5 text-sm transition-colors ${
                gender === audience.value
                  ? "border-brand-ink bg-brand-ink text-white"
                  : "border-brand-border bg-brand-surface text-brand-ink hover:border-brand-ink"
              }`}
            >
              {audience.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Service">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-brand-muted">
          Service
        </p>
        <div className="flex flex-wrap gap-2">
          {serviceOptions.map((service) => (
            <button
              key={service.value}
              type="button"
              onClick={() => navigate({ category: service.slug, styleCategory: null })}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                serviceType === service.value
                  ? "border-brand-ink bg-brand-ink text-white"
                  : "border-brand-border bg-brand-surface text-brand-ink hover:border-brand-ink"
              }`}
            >
              {service.label}
            </button>
          ))}
        </div>
      </section>

      {serviceType === "HAIRSTYLE" && categories.length > 0 && (
        <section aria-label="Haircut category">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-muted">
              {gender === "MALE" ? "Haircut Categories" : "Hairstyle Categories"}
            </p>
            {styleCategory && (
              <button
                type="button"
                onClick={() => navigate({ styleCategory: null })}
                className="text-xs text-brand-muted underline underline-offset-4 hover:text-brand-ink"
              >
                Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => navigate({ styleCategory: value })}
                className={`rounded-full border px-3.5 py-2 text-xs transition-colors ${
                  styleCategory === value
                    ? "border-brand-ink bg-brand-ink text-white"
                    : "border-brand-border bg-brand-surface text-brand-ink hover:border-brand-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-brand-muted">
        {currentService?.label ?? "Choose a service"} · {gender === "FEMALE" ? "Women" : gender === "MALE" ? "Men" : "Unisex"}
      </p>
    </div>
  );
};
