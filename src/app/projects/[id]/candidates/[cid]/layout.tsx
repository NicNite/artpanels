import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

interface CandidateLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string; cid: string }>;
}

export default async function CandidateLayout({ children, params }: CandidateLayoutProps) {
  const { id, cid } = await params;

  const candidate = await db.candidate.findFirst({ where: { id: cid, projectId: id } });
  if (!candidate) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All Candidates
        </Link>
      </div>

      <h2 className="text-lg font-semibold mb-4">{candidate.name}</h2>

      <div className="flex gap-1 mb-6 border-b">
        <Link
          href={`/projects/${id}/candidates/${cid}/colors`}
          className="px-4 py-2 text-sm hover:bg-muted rounded-t-md"
        >
          Colors
        </Link>
        <Link
          href={`/projects/${id}/candidates/${cid}/preview`}
          className="px-4 py-2 text-sm hover:bg-muted rounded-t-md"
        >
          3D Preview
        </Link>
        <Link
          href={`/projects/${id}/candidates/${cid}/export`}
          className="px-4 py-2 text-sm hover:bg-muted rounded-t-md"
        >
          Export
        </Link>
      </div>

      {children}
    </div>
  );
}
