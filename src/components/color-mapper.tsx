"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ColorSwatch } from "@/components/color-swatch";

type Mapping = {
  sourceRgb: string;
  filamentId: string;
  targetRgb: string;
  deltaE: number;
};

type ColorMappingRecord = {
  id: string;
  numColors: number;
  mappings: Mapping[];
  isFinal: boolean;
};

type FilamentInfo = {
  id: string;
  brand: string;
  colorName: string;
  hexColor: string;
};

interface ColorMapperProps {
  projectId: string;
  candidateId: string;
  imagePath: string;
  filaments: FilamentInfo[];
}

export function ColorMapper({
  projectId,
  candidateId,
  imagePath,
  filaments,
}: ColorMapperProps) {
  const [numColors, setNumColors] = useState(4);
  const [mapping, setMapping] = useState<ColorMappingRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLatest = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/candidates/${candidateId}/color-mappings`
    );
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      setMapping(data[0]);
    }
  }, [projectId, candidateId]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  async function quantize() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/candidates/${candidateId}/color-mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numColors }),
        }
      );
      const data = await res.json();
      setMapping(data);
    } finally {
      setLoading(false);
    }
  }

  const filamentMap = Object.fromEntries(
    filaments.map((f) => [f.id, f])
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        <div className="flex-1">
          <h3 className="text-sm font-medium mb-2">Original</h3>
          <Image
            src={imagePath}
            alt="Original"
            width={400}
            height={400}
            className="rounded-lg border w-full"
          />
        </div>
        {mapping && (
          <div className="flex-1">
            <h3 className="text-sm font-medium mb-2">Mapped to Filaments</h3>
            <div className="rounded-lg border aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm">
              Preview rendering coming soon
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Label htmlFor="numColors">Colors (CMS slots)</Label>
        <Input
          id="numColors"
          type="number"
          min={2}
          max={16}
          value={numColors}
          onChange={(e) => setNumColors(Number(e.target.value))}
          className="w-20"
        />
        <Button onClick={quantize} disabled={loading}>
          {loading
            ? "Analyzing..."
            : mapping
              ? "Re-analyze"
              : "Auto-match Colors"}
        </Button>
      </div>

      {mapping && (
        <div className="space-y-2">
          <h3 className="font-medium">Color Assignments</h3>
          {(mapping.mappings as Mapping[]).map((m, i) => {
            const fil = filamentMap[m.filamentId];
            return (
              <ColorSwatch
                key={i}
                sourceColor={m.sourceRgb}
                targetColor={m.targetRgb}
                filamentName={
                  fil ? `${fil.brand} ${fil.colorName}` : "Unknown"
                }
                deltaE={m.deltaE}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
