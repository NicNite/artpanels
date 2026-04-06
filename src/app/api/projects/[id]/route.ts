import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      candidates: {
        include: { image: true },
      },
      generations: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const {
    name,
    description,
    theme,
    widthMm,
    heightMm,
    thicknessMinMm,
    thicknessMaxMm,
    status,
  } = body;

  const project = await db.project.update({
    where: { id },
    data: {
      ...(name != null && { name }),
      ...(description !== undefined && { description }),
      ...(theme !== undefined && { theme }),
      ...(widthMm != null && { widthMm: Number(widthMm) }),
      ...(heightMm != null && { heightMm: Number(heightMm) }),
      ...(thicknessMinMm != null && { thicknessMinMm: Number(thicknessMinMm) }),
      ...(thicknessMaxMm != null && { thicknessMaxMm: Number(thicknessMaxMm) }),
      ...(status != null && { status }),
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.project.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
