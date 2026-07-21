import { NextResponse } from "next/server";
import { getActiveHairstyles } from "@/lib/services/hairstyle.service";

export async function GET() {
  try {
    const hairstyles = await getActiveHairstyles();

    return NextResponse.json(hairstyles);
  } catch (error) {
    console.error("Failed to fetch hairstyles:", error);

    return NextResponse.json(
      { error: "Failed to fetch hairstyles" },
      { status: 500 }
    );
  }
}