import {
  PrismaClient,
  HairstyleCategory,
  GenderTarget,
  ServiceType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hairstyles = [
    {
      slug: "butterfly-cut",
      name: "Butterfly Cut",
      serviceType: ServiceType.HAIRSTYLE,
      category: HairstyleCategory.LAYERS,
      description: "Modern butterfly cut with cascading layers.",
      thumbnailUrl: "/images/styles/butterfly-cut.jpg",
      promptKey: "butterfly-cut",
      gender: GenderTarget.UNISEX,
      displayOrder: 1,
    },
    {
      slug: "italian-bob",
      name: "Italian Bob",
      serviceType: ServiceType.HAIRSTYLE,
      category: HairstyleCategory.BOB,
      description: "Classic Italian bob.",
      thumbnailUrl: "/images/styles/italian-bob.jpg",
      promptKey: "italian-bob",
      gender: GenderTarget.UNISEX,
      displayOrder: 2,
    },
    {
      slug: "french-bob",
      name: "French Bob",
      serviceType: ServiceType.HAIRSTYLE,
      category: HairstyleCategory.BOB,
      description: "Short Parisian-inspired bob.",
      thumbnailUrl: "/images/styles/french-bob.jpg",
      promptKey: "french-bob",
      gender: GenderTarget.UNISEX,
      displayOrder: 3,
    },
    {
      slug: "wolf-cut",
      name: "Wolf Cut",
      serviceType: ServiceType.HAIRSTYLE,
      category: HairstyleCategory.WOLF,
      description: "Modern layered wolf cut.",
      thumbnailUrl: "/images/styles/wolf-cut.jpg",
      promptKey: "wolf-cut",
      gender: GenderTarget.UNISEX,
      displayOrder: 4,
    },
    {
      slug: "buzz-cut",
      name: "Buzz Cut",
      serviceType: ServiceType.BUZZ_CUT,
      category: null,
      description: "Precision buzz cut.",
      thumbnailUrl: "/images/styles/buzz-cut.jpg",
      promptKey: "buzz-cut",
      gender: GenderTarget.UNISEX,
      displayOrder: 5,
    },
    {
      slug: "bald",
      name: "Clean Bald",
      serviceType: ServiceType.BALD,
      category: null,
      description: "Clean shaved head.",
      thumbnailUrl: "/images/styles/bald.jpg",
      promptKey: "bald",
      gender: GenderTarget.UNISEX,
      displayOrder: 6,
    },
  ];

  for (const hairstyle of hairstyles) {
    await prisma.hairstyle.upsert({
      where: { slug: hairstyle.slug },
      update: hairstyle,
      create: hairstyle,
    });
  }

  console.log(`Seeded ${hairstyles.length} hairstyles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });