import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Separator } from "@/components/ui/separator";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{project.name}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <span className="text-sm text-muted-foreground">
              {project.widthMm} × {project.heightMm} mm
            </span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="container mx-auto px-4">
          <nav className="flex gap-1">
            <Link
              href={`/projects/${id}`}
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-primary hover:text-primary transition-colors"
            >
              Overview
            </Link>
            <Link
              href={`/projects/${id}/explore`}
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-primary hover:text-primary transition-colors"
            >
              Explore
            </Link>
          </nav>
        </div>
      </header>

      <Separator />

      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
