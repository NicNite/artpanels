import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CandidateCardProps {
  projectId: string;
  id: string;
  name: string;
  status: "exploring_colors" | "previewing" | "exported";
  imagePath: string;
}

const STATUS_LABELS: Record<CandidateCardProps["status"], string> = {
  exploring_colors: "Exploring Colors",
  previewing: "Previewing",
  exported: "Exported",
};

export function CandidateCard({ projectId, id, name, status, imagePath }: CandidateCardProps) {
  return (
    <Link href={`/projects/${projectId}/candidates/${id}/colors`} className="block hover:opacity-90 transition-opacity">
      <Card className="overflow-hidden">
        <div className="relative aspect-square bg-muted">
          <Image
            src={imagePath}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        </div>
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {STATUS_LABELS[status]}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
