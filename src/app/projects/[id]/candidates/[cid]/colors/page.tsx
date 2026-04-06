import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ColorMapper } from "@/components/color-mapper";

export default async function ColorsPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
    include: { image: true },
  });
  if (!candidate) notFound();

  const filaments = await db.filament.findMany({
    where: { owned: true },
    orderBy: [{ brand: "asc" }, { colorName: "asc" }],
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Color Mapping &mdash; {candidate.name}
      </h2>
      <ColorMapper
        projectId={id}
        candidateId={cid}
        imagePath={candidate.image.filePath}
        filaments={filaments.map((f) => ({
          id: f.id,
          brand: f.brand,
          colorName: f.colorName,
          hexColor: f.hexColor,
        }))}
      />
    </div>
  );
}
