export type PortfolioItem = {
  id: string;
  title: string;

  category:
    | "bob"
    | "pixie"
    | "bixie"
    | "layers"
    | "buzzcut"
    | "bald"
    | "beard"
    | "natural-hair"
    | "dye-color-change";

  before: string;
  after: string;

  featured?: boolean;
};

export const portfolio: PortfolioItem[] = [
  {
  id: "french-bob",
  title: "French Bob",
  category: "bob",

  before: "/portfolio/bob/french-bob-before.webp",
  after: "/portfolio/bob/french-bob-after.webp",

  featured: true,
},

  {
    id: "old-money-bob",
    title: "Old Money Bob",
    category: "bob",

    before: "/portfolio/bob/old-money-bob-before.webp",
    after: "/portfolio/bob/old-money-bob-after.webp",
  },

  {
    id: "soft-layered-bob",
    title: "Soft Layered Bob",
    category: "bob",

    before: "/portfolio/bob/soft-layered-bob-before.webp",
    after: "/portfolio/bob/soft-layered-bob-after.webp",
  },

  {
    id: "blunt-bob",
    title: "Blunt Bob",
    category: "bob",

    before: "/portfolio/bob/blunt-bob-before.webp",
    after: "/portfolio/bob/blunt-bob-after.webp",
  },
];