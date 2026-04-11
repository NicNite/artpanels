import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const candidates = await db.candidate.findMany({
    where: { projectId: id },
    include: { image: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    JSON.parse(JSON.stringify(candidates, (_, v) => typeof v === "bigint" ? Number(v) : v))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { imageId, name, notes } = body;

  if (!imageId || !name) {
    return NextResponse.json(
      { error: "imageId and name are required" },
      { status: 400 }
    );
  }

  // Verify image belongs to this project
  const image = await db.image.findFirst({
    where: {
      id: imageId,
      generation: { projectId: id },
    },
  });

  if (!image) {
    return NextResponse.json(
      { error: "Image not found in this project" },
      { status: 404 }
    );
  }

  // Create candidate and update project status to "active" in a transaction
  const [candidate] = await db.$transaction([
    db.candidate.create({
      data: {
        projectId: id,
        imageId,
        name,
        notes,
      },
      include: { image: true },
    }),
    db.project.update({
      where: { id },
      data: { status: "active" },
    }),
  ]);

  return NextResponse.json(
    JSON.parse(JSON.stringify(candidate, (_, v) => typeof v === "bigint" ? Number(v) : v)),
    { status: 201 }
  );
}
