import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

const PanelViewer = dynamic(
  () => import("@/components/panel-viewer").then((m) => m.PanelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] rounded-lg border bg-black animate-pulse" />
    ),
  }
);

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({
    where: { id: cid, projectId: id },
    include: {
      image: true,
      project: true,
    },
  });
  if (!candidate) notFound();

  const { project } = candidate;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">
        3D Preview &mdash; {candidate.name}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {project.widthMm}&thinsp;mm &times; {project.heightMm}&thinsp;mm
        &nbsp;&middot;&nbsp; thickness {project.thicknessMinMm}&ndash;
        {project.thicknessMaxMm}&thinsp;mm
      </p>

      <PanelViewer
        imageUrl={candidate.image.filePath}
        widthMm={project.widthMm}
        heightMm={project.heightMm}
        thicknessMinMm={project.thicknessMinMm}
        thicknessMaxMm={project.thicknessMaxMm}
      />

      <ul className="mt-4 text-sm text-muted-foreground space-y-1">
        <li>
          <kbd className="font-mono text-xs bg-muted px-1 rounded">
            Left drag
          </kbd>{" "}
          &mdash; rotate
        </li>
        <li>
          <kbd className="font-mono text-xs bg-muted px-1 rounded">Scroll</kbd>{" "}
          &mdash; zoom
        </li>
        <li>
          <kbd className="font-mono text-xs bg-muted px-1 rounded">
            Right drag
          </kbd>{" "}
          &mdash; pan
        </li>
      </ul>
    </div>
  );
}
