import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const filament = await db.filament.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(filament);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.filament.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
