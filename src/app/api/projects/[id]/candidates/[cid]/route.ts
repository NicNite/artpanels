import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
    include: {
      image: true,
      colorMappings: { orderBy: { createdAt: "desc" } },
      exports: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json(candidate);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;

  const existing = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, notes, status } = body;

  const updated = await db.candidate.update({
    where: { id: cid },
    data: {
      ...(name != null && { name }),
      ...(notes !== undefined && { notes }),
      ...(status != null && { status }),
    },
    include: { image: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;

  const existing = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  await db.candidate.delete({ where: { id: cid } });

  return new NextResponse(null, { status: 204 });
}
