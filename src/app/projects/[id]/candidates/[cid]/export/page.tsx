"use client";

import { use, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ExportRecord = {
  id: string;
  filePath: string;
  format: string;
  settings: {
    resolution?: number;
    dither?: {
      enabled: boolean;
      blockSizeMm: number;
      zEnabled: boolean;
      xyEnabled: boolean;
    };
    cost?: {
      filamentSwaps: number;
      purgeWasteGrams: number;
      timeOverheadMinutes: number;
    };
  } | null;
  createdAt: string;
};

export default function ExportPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = use(params);

  const [resolution, setResolution] = useState(128);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ditherEnabled, setDitherEnabled] = useState(false);
  const [blockSize, setBlockSize] = useState(3);
  const [zEnabled, setZEnabled] = useState(true);
  const [xyEnabled, setXYEnabled] = useState(true);
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [nozzleWidth, setNozzleWidth] = useState(0.4);

  const fetchExports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/candidates/${cid}/exports`);
      if (!res.ok) throw new Error("Failed to load exports");
      const data = await res.json();
      setExports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id, cid]);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/candidates/${cid}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          dither: ditherEnabled
            ? {
                enabled: true,
                blockSizeMm: blockSize,
                zEnabled,
                xyEnabled,
                layerHeightMm: layerHeight,
                nozzleWidthMm: nozzleWidth,
              }
            : { enabled: false },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate export");
      }
      await fetchExports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Export 3MF</h2>

      <Card>
        <CardHeader>
          <CardTitle>Generate New Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution (px)</Label>
            <Input
              id="resolution"
              type="number"
              min={32}
              max={512}
              step={32}
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Image will be resized to this square resolution before meshing.
            </p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ditherEnabled"
                checked={ditherEnabled}
                onChange={(e) => setDitherEnabled(e.target.checked)}
              />
              <Label htmlFor="ditherEnabled">Enable Color Dithering</Label>
            </div>

            {ditherEnabled && (
              <div className="space-y-3 pl-6">
                <div className="space-y-1">
                  <Label htmlFor="blockSize">
                    Dot Size: {blockSize}mm
                  </Label>
                  <input
                    id="blockSize"
                    type="range"
                    min={0.8}
                    max={10}
                    step={0.1}
                    value={blockSize}
                    onChange={(e) => setBlockSize(Number(e.target.value))}
                    className="w-48"
                  />
                  <p className="text-xs text-muted-foreground">
                    Min 0.8mm (2× nozzle width). Below 2mm is experimental — may show color bleed at boundaries.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="zEnabled"
                      checked={zEnabled}
                      onChange={(e) => setZEnabled(e.target.checked)}
                    />
                    <Label htmlFor="zEnabled">Z-axis dithering</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="xyEnabled"
                      checked={xyEnabled}
                      onChange={(e) => setXYEnabled(e.target.checked)}
                    />
                    <Label htmlFor="xyEnabled">XY block dithering</Label>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="layerHeight">Layer Height (mm)</Label>
                    <Input
                      id="layerHeight"
                      type="number"
                      min={0.08}
                      max={0.4}
                      step={0.04}
                      value={layerHeight}
                      onChange={(e) => setLayerHeight(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nozzleWidth">Nozzle Width (mm)</Label>
                    <Input
                      id="nozzleWidth"
                      type="number"
                      min={0.2}
                      max={0.8}
                      step={0.1}
                      value={nozzleWidth}
                      onChange={(e) => setNozzleWidth(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate 3MF"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Previous Exports</h3>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && exports.length === 0 && (
          <p className="text-sm text-muted-foreground">No exports yet.</p>
        )}
        {exports.map((exp) => (
          <Card key={exp.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium uppercase">{exp.format}</p>
                <p className="text-sm text-muted-foreground">
                  Resolution:{" "}
                  {exp.settings?.resolution ?? "—"}px
                  {exp.settings?.dither?.enabled && " · Dithered"}
                  {exp.settings?.cost && (
                    <> · {exp.settings.cost.filamentSwaps} swaps · {exp.settings.cost.purgeWasteGrams.toFixed(1)}g purge · +{exp.settings.cost.timeOverheadMinutes.toFixed(1)}min</>
                  )}
                  {" "}&middot;{" "}
                  {new Date(exp.createdAt).toLocaleString()}
                </p>
              </div>
              <a href={exp.filePath} download>
                <Button variant="outline" size="sm">
                  Download
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
