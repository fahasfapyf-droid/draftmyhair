import type { Metadata } from "next";
import { StyleSelectionPage } from "@/components/style-selection";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Choose Your Style",
  description:
    "Choose your audience, service, category, and style for a realistic Draft My Hair preview.",
  path: "/style-selection",
});

type PageProps = {
  searchParams: Promise<{
    category?: string | string[];
    gender?: string | string[];
    styleCategory?: string | string[];
  }>;
};

function getFirstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <StyleSelectionPage
      category={getFirstValue(params.category)}
      gender={getFirstValue(params.gender)}
      styleCategory={getFirstValue(params.styleCategory)}
    />
  );
}
