import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownedParam = searchParams.get("owned");

  const where =
    ownedParam === "true"
      ? { owned: true }
      : ownedParam === "false"
        ? { owned: false }
        : undefined;

  const filaments = await db.filament.findMany({
    where,
    orderBy: [{ brand: "asc" }, { colorName: "asc" }],
  });

  return NextResponse.json(filaments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    brand,
    name,
    colorName,
    hexColor,
    material = "PLA",
    translucent = false,
    owned = true,
    notes,
  } = body;

  if (!brand || !name || !colorName || !hexColor) {
    return NextResponse.json(
      { error: "brand, name, colorName, and hexColor are required" },
      { status: 400 }
    );
  }

  const filament = await db.filament.create({
    data: {
      brand,
      name,
      colorName,
      hexColor,
      material,
      translucent,
      owned,
      notes,
    },
  });

  return NextResponse.json(filament, { status: 201 });
}
