export interface HairStyle {
  id: string;
  name: string;
  imageUrl: string;
}

export const freshStartStyles: HairStyle[] = [
  {
    id: "french-bob",
    name: "French Bob",
    imageUrl: "/images/styles/french-bob-placeholder.jpg",
  },
  {
    id: "italian-bob",
    name: "Italian Bob",
    imageUrl: "/images/styles/italian-bob-placeholder.jpg",
  },
  {
    id: "classic-bob",
    name: "Classic Bob",
    imageUrl: "/images/styles/classic-bob-placeholder.jpg",
  },
  {
    id: "soft-bob",
    name: "Soft Bob",
    imageUrl: "/images/styles/soft-bob-placeholder.jpg",
  },
  {
    id: "long-bob",
    name: "Long Bob",
    imageUrl: "/images/styles/long-bob-placeholder.jpg",
  },
];