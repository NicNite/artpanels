import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { readImageFile } from "@/lib/storage";
import { quantizeAndMatch, type Pixel } from "@/lib/color/quantize";

type RouteContext = { params: Promise<{ id: string; cid: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const mappings = await db.colorMapping.findMany({
    where: { candidateId: cid },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(mappings);
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
    include: { image: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const numColors: number = body.numColors ?? 4;
  const ownedOnly: boolean = body.ownedOnly !== false;

  // Read image file and extract pixel data via sharp
  const imageBuffer = await readImageFile(candidate.image.filePath);
  const { data, info } = await sharp(imageBuffer)
    .resize(256, 256, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: Pixel[] = [];
  const channels = info.channels; // 3 (RGB) or 4 (RGBA)
  for (let i = 0; i < data.length; i += channels) {
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }

  // Fetch filaments
  const filaments = await db.filament.findMany({
    where: ownedOnly ? { owned: true } : {},
  });

  const filamentRefs = filaments.map((f) => ({
    id: f.id,
    hexColor: f.hexColor,
  }));

  // Quantize and match
  const result = quantizeAndMatch(pixels, numColors, filamentRefs);

  // Persist ColorMapping record
  const colorMapping = await db.colorMapping.create({
    data: {
      candidateId: cid,
      algorithm: "kmeans",
      numColors,
      mappings: result.mappings as unknown as import("@/generated/prisma").Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(colorMapping, { status: 201 });
}
