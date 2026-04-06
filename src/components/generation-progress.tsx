"use client";

export interface ProgressEvent {
  index: number;
  step: number;
  totalSteps: number;
}

interface GenerationProgressProps {
  events: ProgressEvent[];
  totalImages: number;
  completedImages: number;
}

export function GenerationProgress({
  events,
  totalImages,
  completedImages,
}: GenerationProgressProps) {
  if (totalImages === 0) return null;

  // Build a map of the latest progress per image index
  const progressMap = new Map<number, ProgressEvent>();
  for (const evt of events) {
    progressMap.set(evt.index, evt);
  }

  const bars = Array.from({ length: totalImages }, (_, i) => {
    const completed = i < completedImages;
    const progress = progressMap.get(i);
    const pct = completed
      ? 100
      : progress
      ? Math.round((progress.step / progress.totalSteps) * 100)
      : 0;
    return { index: i, pct, completed };
  });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Generating {completedImages} / {totalImages} images...
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {bars.map(({ index, pct, completed }) => (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Image {index + 1}</span>
              <span>{completed ? "Done" : `${pct}%`}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
