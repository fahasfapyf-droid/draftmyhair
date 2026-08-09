export type HairstyleGender = "FEMALE" | "MALE" | "UNISEX";
export type HairstyleServiceType =
  | "HAIRSTYLE"
  | "HAIR_COLOR"
  | "BUZZ_CUT"
  | "BALD"
  | "BEARD"
  | "BEARD_REMOVAL";

export interface HairStyle {
  id: string;
  slug: string;
  name: string;
  serviceType: HairstyleServiceType;
  category: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  promptKey: string;
  gender: HairstyleGender;
  displayOrder: number;
}

export type HairstyleFilters = {
  gender?: HairstyleGender;
  serviceType?: HairstyleServiceType;
};

export async function getHairstyles(filters: HairstyleFilters = {}): Promise<HairStyle[]> {
  const searchParams = new URLSearchParams();
  if (filters.gender) searchParams.set("gender", filters.gender);
  if (filters.serviceType) searchParams.set("serviceType", filters.serviceType);

  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  const response = await fetch(`/api/hairstyles${query}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch hairstyles.");
  }

  return response.json();
}
