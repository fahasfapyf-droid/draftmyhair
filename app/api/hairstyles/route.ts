import { GenderTarget, HairstyleCategory, ServiceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHairstyles } from "@/lib/services/hairstyle.service";

function isGenderTarget(value: string | null): value is GenderTarget {
  return value !== null && Object.values(GenderTarget).includes(value as GenderTarget);
}

function isServiceType(value: string | null): value is ServiceType {
  return value !== null && Object.values(ServiceType).includes(value as ServiceType);
}

function isHairstyleCategory(value: string | null): value is HairstyleCategory {
  return value !== null && Object.values(HairstyleCategory).includes(value as HairstyleCategory);
}

export async function GET(request: NextRequest) {
  try {
    const gender = request.nextUrl.searchParams.get("gender");
    const serviceType = request.nextUrl.searchParams.get("serviceType");
    const category = request.nextUrl.searchParams.get("category");

    if (gender !== null && !isGenderTarget(gender)) {
      return NextResponse.json({ error: "Invalid gender filter" }, { status: 400 });
    }

    if (serviceType !== null && !isServiceType(serviceType)) {
      return NextResponse.json({ error: "Invalid service type filter" }, { status: 400 });
    }

    if (category !== null && !isHairstyleCategory(category)) {
      return NextResponse.json({ error: "Invalid category filter" }, { status: 400 });
    }

    const hairstyles = await getActiveHairstyles({
      gender: gender ?? undefined,
      serviceType: serviceType ?? undefined,
      category: category ?? undefined,
    });

    return NextResponse.json(hairstyles);
  } catch (error) {
    console.error("Failed to fetch hairstyles:", error);

    return NextResponse.json(
      { error: "Failed to fetch hairstyles" },
      { status: 500 },
    );
  }
}
