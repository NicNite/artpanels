"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ImageItem {
  id: string;
  filePath: string;
  starred: boolean;
  generationId: string;
}

interface ImageGridProps {
  images: ImageItem[];
  projectId: string;
  filter: "all" | "starred";
  onFilterChange: (filter: "all" | "starred") => void;
  onUpdate: () => void;
}

export function ImageGrid({
  images,
  projectId,
  filter,
  onFilterChange,
  onUpdate,
}: ImageGridProps) {
  const [promoteTarget, setPromoteTarget] = useState<ImageItem | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const starredCount = images.filter((img) => img.starred).length;
  const displayed = filter === "starred" ? images.filter((img) => img.starred) : images;

  async function handleToggleStar(image: ImageItem) {
    setTogglingId(image.id);
    try {
      await fetch(`/api/projects/${projectId}/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: !image.starred }),
      });
      onUpdate();
    } finally {
      setTogglingId(null);
    }
  }

  async function handlePromote() {
    if (!promoteTarget || !candidateName.trim()) return;
    setPromoting(true);
    try {
      await fetch(`/api/projects/${projectId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: promoteTarget.id, name: candidateName.trim() }),
      });
      setPromoteTarget(null);
      setCandidateName("");
      onUpdate();
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("all")}
        >
          All ({images.length})
        </Button>
        <Button
          variant={filter === "starred" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("starred")}
        >
          Starred ({starredCount})
        </Button>
      </div>

      {/* Image grid */}
      {displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          {filter === "starred" ? "No starred images yet." : "No images yet. Generate some above."}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayed.map((image) => (
            <div key={image.id} className="relative group aspect-square rounded-md overflow-hidden bg-muted">
              <Image
                src={image.filePath}
                alt="Generated design"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center gap-2 p-2">
                <Button
                  size="sm"
                  variant={image.starred ? "default" : "outline"}
                  disabled={togglingId === image.id}
                  onClick={() => handleToggleStar(image)}
                  className="flex-1 text-xs"
                >
                  {image.starred ? "Unstar" : "Star"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPromoteTarget(image);
                    setCandidateName("");
                  }}
                  className="flex-1 text-xs"
                >
                  Promote
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promote dialog */}
      <Dialog
        open={promoteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPromoteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Candidate</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="candidate-name">Candidate Name</Label>
            <Input
              id="candidate-name"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Forest Variant A"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteTarget(null)} disabled={promoting}>
              Cancel
            </Button>
            <Button
              onClick={handlePromote}
              disabled={!candidateName.trim() || promoting}
            >
              {promoting ? "Promoting..." : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
