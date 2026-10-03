import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TOKEN = "DMH-CATALOG-20261003-7f4c9e2a";
const catalog = [["Curtain Layers","LAYERS","HAIRSTYLE","FEMALE"],["Face-Framing Layers","LAYERS","HAIRSTYLE","FEMALE"],["U-Cut","LAYERS","HAIRSTYLE","FEMALE"],["V-Cut","LAYERS","HAIRSTYLE","FEMALE"],["C-Cut","LAYERS","HAIRSTYLE","FEMALE"],["Korean Layer Cut","LAYERS","HAIRSTYLE","FEMALE"],["Rachel Cut","LAYERS","HAIRSTYLE","FEMALE"],["Modern Shag","SHAG","HAIRSTYLE","FEMALE"],["Hush Cut","LAYERS","HAIRSTYLE","FEMALE"],["French Bob (No Bangs)","BOB","HAIRSTYLE","FEMALE"],["French Bob (With Bangs)","BOB","HAIRSTYLE","FEMALE"],["Classic Bob","BOB","HAIRSTYLE","FEMALE"],["Blunt Bob","BOB","HAIRSTYLE","FEMALE"],["Textured Bob","BOB","HAIRSTYLE","FEMALE"],["Layered Bob","BOB","HAIRSTYLE","FEMALE"],["Chin-Length Bob","BOB","HAIRSTYLE","FEMALE"],["Jaw-Length Bob","BOB","HAIRSTYLE","FEMALE"],["Classic Rounded Precision Bob with Full Blunt Fringe","BOB","HAIRSTYLE","FEMALE"],["Pixie","PIXIE","HAIRSTYLE","FEMALE"],["Bixie","BIXIE","HAIRSTYLE","FEMALE"],["Boyish Pixie","PIXIE","HAIRSTYLE","FEMALE"],["Buzz Cut","BUZZ_CUT","BUZZ_CUT","UNISEX"],["Crew Cut","CREW","HAIRSTYLE","MALE"],["Ivy League","CREW","HAIRSTYLE","MALE"],["Side Part","SIDE_PART","HAIRSTYLE","MALE"],["Textured Crop","CROP","HAIRSTYLE","MALE"],["French Crop","CROP","HAIRSTYLE","MALE"],["Pompadour","POMPADOUR","HAIRSTYLE","MALE"],["Slick Back","HAIRSTYLE","HAIRSTYLE","MALE"],["Quiff","QUIFF","HAIRSTYLE","MALE"],["Middle Part","SIDE_PART","HAIRSTYLE","UNISEX"],["Curtains","SIDE_PART","HAIRSTYLE","UNISEX"],["Bald","BALD","BALD","UNISEX"],["Mullet","MULLET","HAIRSTYLE","UNISEX"],["Beard Addition","BEARD","BEARD","MALE"],["Beard Removal","BEARD_REMOVAL","BEARD_REMOVAL","MALE"],["Short Beard","BEARD","BEARD","MALE"],["Stubble","BEARD","BEARD","MALE"],["Full Beard","BEARD","BEARD","MALE"],["Goatee","BEARD","BEARD","MALE"],["Octopus Cut","LAYERS","HAIRSTYLE","FEMALE"],["Jellyfish Cut","LAYERS","HAIRSTYLE","FEMALE"],["Hime Cut","LAYERS","HAIRSTYLE","FEMALE"],["Pageboy","BOB","HAIRSTYLE","UNISEX"],["Bowl Cut","CROP","HAIRSTYLE","UNISEX"],["Asymmetrical Bob","BOB","HAIRSTYLE","FEMALE"],["Shaggy Bob","BOB","HAIRSTYLE","FEMALE"],["Undercut Bob","BOB","HAIRSTYLE","FEMALE"],["Micro Bob","BOB","HAIRSTYLE","FEMALE"],["Modern Mullet","MULLET","HAIRSTYLE","UNISEX"],["Chelsea Cut","CROP","HAIRSTYLE","UNISEX"],["Mohawk","MOHAWK","HAIRSTYLE","UNISEX"],["Faux Hawk","MOHAWK","HAIRSTYLE","UNISEX"]] as const;

function norm(v: string) {
  return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}
function slug(v: string) {
  return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  if (request.headers.get("x-dmh-import-token") !== TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.hairstyle.findMany({ select: { name: true, slug: true, promptKey: true } });
  const names = new Set(existing.map(x => norm(x.name)));
  const slugs = new Set(existing.flatMap(x => [x.slug, x.promptKey].filter(Boolean).map(norm)));
  const created: string[] = [];
  const skipped: string[] = [];
  for (const [name, category, serviceType, gender] of catalog) {
    const s = slug(name);
    if (names.has(norm(name)) || slugs.has(norm(s))) { skipped.push(name); continue; }
    const collision = await prisma.hairstyle.findFirst({ where: { OR: [{ slug: s }, { promptKey: s }] }, select: { id: true } });
    if (collision) { skipped.push(name); continue; }
    await prisma.hairstyle.create({ data: { name, slug: s, promptKey: s, description: null, thumbnailUrl: null, serviceType, category, gender, displayOrder: 0 } });
    names.add(norm(name)); slugs.add(norm(s)); created.push(name);
  }
  return NextResponse.json({ created, skipped, createdCount: created.length, skippedCount: skipped.length });
}
