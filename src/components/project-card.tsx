import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProjectCardProps {
  id: string;
  name: string;
  theme?: string | null;
  description?: string | null;
  widthMm: number;
  heightMm: number;
  status: "exploring" | "active";
  candidateCount: number;
}

export function ProjectCard({
  id,
  name,
  theme,
  description,
  widthMm,
  heightMm,
  status,
  candidateCount,
}: ProjectCardProps) {
  return (
    <Link href={`/projects/${id}`} className="block hover:opacity-90 transition-opacity">
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant={status === "active" ? "default" : "secondary"}>
              {status}
            </Badge>
          </div>
          {theme && (
            <p className="text-sm text-muted-foreground italic">{theme}</p>
          )}
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {widthMm} × {heightMm} mm
            </span>
            <span>{candidateCount} candidate{candidateCount !== 1 ? "s" : ""}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
