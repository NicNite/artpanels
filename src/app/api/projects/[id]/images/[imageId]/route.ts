import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;

  const body = await request.json();
  const { starred, notes } = body;

  // Verify image belongs to this project via its generation
  const image = await db.image.findFirst({
    where: {
      id: imageId,
      generation: { projectId: id },
    },
  });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const updated = await db.image.update({
    where: { id: imageId },
    data: {
      ...(starred !== undefined && { starred: Boolean(starred) }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(
    JSON.parse(JSON.stringify(updated, (_, v) => typeof v === "bigint" ? Number(v) : v))
  );
}
