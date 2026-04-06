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
  settings: { resolution?: number } | null;
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
        body: JSON.stringify({ resolution }),
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
                  {exp.settings?.resolution ?? "—"}px &middot;{" "}
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
