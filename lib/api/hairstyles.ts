export interface HairStyle {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  promptKey: string | null;
  gender: string;
  displayOrder: number;
}

export async function getHairstyles(): Promise<HairStyle[]> {
  const response = await fetch("/api/hairstyles", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch hairstyles.");
  }

  return response.json();
}