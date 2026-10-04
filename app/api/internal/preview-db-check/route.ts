import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REPAIRS = {
  "TWA": ["HAIRSTYLE", "AFRO", "FEMALE"],
  "Knotless Braids": ["HAIRSTYLE", "BRAIDS", "FEMALE"],
  "Box Braids": ["HAIRSTYLE", "BRAIDS", "FEMALE"],
  "Silk Press": ["HAIRSTYLE", "AFRO", "FEMALE"],
  "Starter Locs": ["HAIRSTYLE", "LOCS", "FEMALE"],
  "Tapered Natural": ["HAIRSTYLE", "AFRO", "FEMALE"],
  "Rounded Afro": ["HAIRSTYLE", "AFRO", "FEMALE"],
  "Senegalese Twists": ["HAIRSTYLE", "BRAIDS", "FEMALE"],
  "Passion Twists": ["HAIRSTYLE", "BRAIDS", "FEMALE"],
  "Faux Locs": ["HAIRSTYLE", "LOCS", "FEMALE"],
  "Low Taper": ["HAIRSTYLE", "TAPER", "MALE"],
  "Low Fade": ["HAIRSTYLE", "FADE", "MALE"],
  "Mid Fade": ["HAIRSTYLE", "FADE", "MALE"],
  "Drop Fade": ["HAIRSTYLE", "FADE", "MALE"],
  "Burst Fade": ["HAIRSTYLE", "FADE", "MALE"],
  "Caesar Cut": ["HAIRSTYLE", "CROP", "MALE"],
  "Temple Fade": ["HAIRSTYLE", "FADE", "MALE"],
  "Comb Over": ["HAIRSTYLE", "COMB_OVER", "MALE"],
  "Disconnected Undercut": ["HAIRSTYLE", "UNDERCUT", "MALE"],
  "High-Top Fade": ["HAIRSTYLE", "FADE", "MALE"],
  "Wine Brunette": ["HAIR_COLOR", null, "UNISEX"],
  "Caramel Bronde": ["HAIR_COLOR", null, "UNISEX"],
  "Tuscan Leather": ["HAIR_COLOR", null, "UNISEX"],
  "Amber Glow": ["HAIR_COLOR", null, "UNISEX"],
  "Golden Hour Brunette": ["HAIR_COLOR", null, "UNISEX"],
  "Auburn": ["HAIR_COLOR", null, "UNISEX"],
  "Platinum Blonde": ["HAIR_COLOR", null, "UNISEX"],
  "Ash Blonde": ["HAIR_COLOR", null, "UNISEX"],
  "Chocolate Brown": ["HAIR_COLOR", null, "UNISEX"],
  "Rose Gold": ["HAIR_COLOR", null, "UNISEX"],
  "Short Boxed Beard": ["BEARD", null, "MALE"],
  "Tapered Beard": ["BEARD", null, "MALE"],
  "Faded Beard": ["BEARD", null, "MALE"],
  "Full Shaped Beard": ["BEARD", null, "MALE"],
  "Beardstache": ["BEARD", null, "MALE"],
  "Van Dyke": ["BEARD", null, "MALE"],
  "Chin Strap": ["BEARD", null, "MALE"],
  "Balbo Beard": ["BEARD", null, "MALE"],
  "Anchor Beard": ["BEARD", null, "MALE"],
  "Mutton Chops": ["BEARD", null, "MALE"],
  "Low Tapered Buzz": ["BUZZ_CUT", "TAPER", "MALE"],
  "Fade Buzz": ["BUZZ_CUT", "FADE", "MALE"],
  "High-and-Tight Buzz": ["BUZZ_CUT", "FADE", "MALE"],
  "Butch Cut": ["BUZZ_CUT", "CROP", "MALE"],
  "Burr Cut": ["BUZZ_CUT", "CROP", "MALE"],
  "Temple Recession": ["BALD", null, "MALE"],
  "Crown Thinning": ["BALD", null, "MALE"],
  "Diffuse Thinning": ["BALD", null, "MALE"],
  "Receding Hairline": ["BALD", null, "MALE"],
  "Norwood 3 Receding Hairline": ["BALD", null, "MALE"]
} as const;

function authorized() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "chore/verify-preview-db-dmh"
  );
}

export async function GET() {
  if (!authorized()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const names = Object.keys(REPAIRS);
  const records = await prisma.hairstyle.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, serviceType: true, category: true, gender: true },
  });

  return NextResponse.json({
    total: await prisma.hairstyle.count(),
    matched: records.length,
    records,
  });
}

export async function POST() {
  if (!authorized()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const names = Object.keys(REPAIRS);
  const records = await prisma.hairstyle.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, serviceType: true, category: true, gender: true },
  });

  if (records.length !== names.length || new Set(records.map((r) => r.name)).size !== names.length) {
    return NextResponse.json(
      { error: "Safety check failed: expected exactly 50 uniquely matched records", matched: records.length },
      { status: 409 }
    );
  }

  await prisma.$transaction(
    records.map((record) => {
      const [serviceType, category, gender] = REPAIRS[record.name as keyof typeof REPAIRS];
      return prisma.hairstyle.update({
        where: { id: record.id },
        data: { serviceType, category, gender },
      });
    })
  );

  const verified = await prisma.hairstyle.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, serviceType: true, category: true, gender: true },
  });

  const failures = verified.filter((record) => {
    const [serviceType, category, gender] = REPAIRS[record.name as keyof typeof REPAIRS];
    return (
      record.serviceType !== serviceType ||
      record.category !== category ||
      record.gender !== gender
    );
  });

  const total = await prisma.hairstyle.count();

  return NextResponse.json({
    total,
    repaired: names.length - failures.length,
    failed: failures.length,
    failures,
    verified,
  });
}
