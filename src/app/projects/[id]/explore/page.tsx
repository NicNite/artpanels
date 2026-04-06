"use client";

import { use, useState, useCallback } from "react";
import { PromptBar } from "@/components/prompt-bar";
import { GenerationProgress, type ProgressEvent } from "@/components/generation-progress";
import { ImageGrid, type ImageItem } from "@/components/image-grid";

interface ExplorePageProps {
  params: Promise<{ id: string }>;
}

interface ProjectData {
  generations: Array<{
    id: string;
    images: Array<{
      id: string;
      filePath: string;
      starred: boolean;
      generationId: string;
    }>;
  }>;
}

function extractImages(data: ProjectData): ImageItem[] {
  const images: ImageItem[] = [];
  for (const gen of data.generations) {
    for (const img of gen.images) {
      images.push({
        id: img.id,
        filePath: img.filePath,
        starred: img.starred,
        generationId: img.generationId ?? gen.id,
      });
    }
  }
  return images;
}

export default function ExplorePage({ params }: ExplorePageProps) {
  const { id } = use(params);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [filter, setFilter] = useState<"all" | "starred">("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [completedImages, setCompletedImages] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const loadImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const data: ProjectData = await res.json();
      setImages(extractImages(data));
      setLoaded(true);
    } catch {
      // ignore
    }
  }, [id]);

  // Load on first render
  if (!loaded) {
    loadImages();
  }

  async function handleGenerate(prompt: string, count: number) {
    setIsGenerating(true);
    setProgressEvents([]);
    setTotalImages(count);
    setCompletedImages(0);

    try {
      const res = await fetch(`/api/projects/${id}/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count }),
      });

      if (!res.ok || !res.body) {
        setIsGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.trim().split("\n");
          let eventType = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventType === "progress") {
              setProgressEvents((prev) => {
                const next = prev.filter((e) => e.index !== data.index);
                return [...next, { index: data.index, step: data.step, totalSteps: data.totalSteps }];
              });
            } else if (eventType === "image") {
              setCompletedImages((n) => n + 1);
            } else if (eventType === "done") {
              await loadImages();
              setIsGenerating(false);
              setProgressEvents([]);
              setTotalImages(0);
              setCompletedImages(0);
            } else if (eventType === "error") {
              console.error("Generation error:", data.message);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PromptBar onGenerate={handleGenerate} isGenerating={isGenerating} />

      {isGenerating && (
        <GenerationProgress
          events={progressEvents}
          totalImages={totalImages}
          completedImages={completedImages}
        />
      )}

      <ImageGrid
        images={images}
        projectId={id}
        filter={filter}
        onFilterChange={setFilter}
        onUpdate={loadImages}
      />
    </div>
  );
}
