import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CandidateCard } from "@/components/candidate-card";

type CandidateWithImage = {
  id: string;
  name: string;
  status: "exploring_colors" | "previewing" | "exported";
  image: { filePath: string };
};

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      candidates: {
        include: { image: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* Project info */}
      <section className="flex flex-col gap-1">
        {project.theme && (
          <p className="text-sm text-muted-foreground italic">{project.theme}</p>
        )}
        {project.description && (
          <p className="text-base text-foreground">{project.description}</p>
        )}
        {!project.theme && !project.description && (
          <p className="text-sm text-muted-foreground">No theme or description set.</p>
        )}
      </section>

      {/* Candidates */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Candidates</h2>

        {project.candidates.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <p className="text-muted-foreground">No candidates yet.</p>
            <p className="text-sm text-muted-foreground">
              Generate designs in the Explore tab and promote your favourites.
            </p>
            <Link
              href={`/projects/${id}/explore`}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted px-3 h-8 text-sm font-medium transition-colors"
            >
              Go to Explore
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {(project.candidates as CandidateWithImage[]).map((candidate) => (
              <CandidateCard
                key={candidate.id}
                projectId={id}
                id={candidate.id}
                name={candidate.name}
                status={candidate.status}
                imagePath={candidate.image.filePath}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
