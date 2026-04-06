import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { candidates: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    name,
    description,
    theme,
    widthMm,
    heightMm,
    thicknessMinMm,
    thicknessMaxMm,
  } = body;

  if (!name || widthMm == null || heightMm == null) {
    return NextResponse.json(
      { error: "name, widthMm, and heightMm are required" },
      { status: 400 }
    );
  }

  const project = await db.project.create({
    data: {
      name,
      description,
      theme,
      widthMm: Number(widthMm),
      heightMm: Number(heightMm),
      ...(thicknessMinMm != null && { thicknessMinMm: Number(thicknessMinMm) }),
      ...(thicknessMaxMm != null && { thicknessMaxMm: Number(thicknessMaxMm) }),
    },
  });

  return NextResponse.json(project, { status: 201 });
}
