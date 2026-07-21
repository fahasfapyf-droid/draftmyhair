import {
  PrismaClient,
  HairstyleCategory,
  HairstyleStatus,
  GenderTarget,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hairstyles = [
    {
      slug: "butterfly-cut",
      name: "Butterfly Cut",
      category: HairstyleCategory.LONG_HAIR,
      description: "Modern butterfly cut with cascading layers.",
      shortDescription: "Soft cascading layers with face-framing volume.",
      thumbnailImage: "/images/styles/butterfly-cut.jpg",
      heroImage: "/images/styles/butterfly-cut.jpg",
      promptKey: "butterfly-cut",
      gender: GenderTarget.UNISEX,
      isFeatured: true,
      displayOrder: 1,
      status: HairstyleStatus.ACTIVE,
    },
    {
      slug: "italian-bob",
      name: "Italian Bob",
      category: HairstyleCategory.BOB,
      description: "Classic Italian bob.",
      shortDescription: "Elegant chin-length Italian bob.",
      thumbnailImage: "/images/styles/italian-bob.jpg",
      heroImage: "/images/styles/italian-bob.jpg",
      promptKey: "italian-bob",
      gender: GenderTarget.UNISEX,
      isFeatured: true,
      displayOrder: 2,
      status: HairstyleStatus.ACTIVE,
    },
    {
      slug: "french-bob",
      name: "French Bob",
      category: HairstyleCategory.BOB,
      description: "Short Parisian-inspired bob.",
      shortDescription: "Timeless Parisian-inspired bob.",
      thumbnailImage: "/images/styles/french-bob.jpg",
      heroImage: "/images/styles/french-bob.jpg",
      promptKey: "french-bob",
      gender: GenderTarget.UNISEX,
      isFeatured: true,
      displayOrder: 3,
      status: HairstyleStatus.ACTIVE,
    },
    {
      slug: "wolf-cut",
      name: "Wolf Cut",
      category: HairstyleCategory.LONG_HAIR,
      description: "Layered wolf cut.",
      shortDescription: "Modern textured wolf cut.",
      thumbnailImage: "/images/styles/wolf-cut.jpg",
      heroImage: "/images/styles/wolf-cut.jpg",
      promptKey: "wolf-cut",
      gender: GenderTarget.UNISEX,
      isFeatured: true,
      displayOrder: 4,
      status: HairstyleStatus.ACTIVE,
    },
    {
      slug: "buzz-cut",
      name: "Buzz Cut",
      category: HairstyleCategory.BUZZ,
      description: "Close cropped buzz cut.",
      shortDescription: "Ultra-short precision buzz cut.",
      thumbnailImage: "/images/styles/buzz-cut.jpg",
      heroImage: "/images/styles/buzz-cut.jpg",
      promptKey: "buzz-cut",
      gender: GenderTarget.UNISEX,
      isFeatured: true,
      displayOrder: 5,
      status: HairstyleStatus.ACTIVE,
    },
    {
      slug: "bald",
      name: "Bald",
      category: HairstyleCategory.BALD,
      description: "Clean shaved head.",
      shortDescription: "Completely clean shaved look.",
      thumbnailImage: "/images/styles/bald.jpg",
      heroImage: "/images/styles/bald.jpg",
      promptKey: "bald",
      gender: GenderTarget.UNISEX,
      isFeatured: true,
      displayOrder: 6,
      status: HairstyleStatus.ACTIVE,
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