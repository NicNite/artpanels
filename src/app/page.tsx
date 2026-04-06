import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";

export default async function DashboardPage() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { candidates: true } },
    },
  });

  return (
    <main className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">ArtPanels</h1>
        <Link href="/projects/new">
          <Button>New Project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <p className="text-xl mb-4">No projects yet.</p>
          <Link href="/projects/new">
            <Button variant="outline">Create your first project</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              theme={project.theme}
              description={project.description}
              widthMm={project.widthMm}
              heightMm={project.heightMm}
              status={project.status}
              candidateCount={project._count.candidates}
            />
          ))}
        </div>
      )}
    </main>
  );
}
