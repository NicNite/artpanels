"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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

type CatalogEntry = {
  id: number;
  brand: string;
  colorName: string;
  hexColor: string;
  material: string;
  materialParent: string;
  colorFamily: string;
};

interface ColorMapperProps {
  projectId: string;
  candidateId: string;
  imagePath: string;
  filaments: FilamentInfo[];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

function computeDeltaEApprox(sourceHex: string, targetHex: string): number {
  const src = hexToRgb(sourceHex);
  const tgt = hexToRgb(targetHex);
  return Math.round(
    (Math.sqrt(colorDistance(src[0], src[1], src[2], tgt[0], tgt[1], tgt[2])) / 2.55) * 10
  ) / 10;
}

export function ColorMapper({
  projectId,
  candidateId,
  imagePath,
  filaments: initialFilaments,
}: ColorMapperProps) {
  const [numColors, setNumColors] = useState(4);
  const [mapping, setMapping] = useState<ColorMappingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [filaments, setFilaments] = useState<FilamentInfo[]>(initialFilaments);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ditherPreviewEnabled, setDitherPreviewEnabled] = useState(false);
  const [previewBlockSize, setPreviewBlockSize] = useState(3);
  const ditherCanvasRef = useRef<HTMLCanvasElement>(null);

  // Per-row override picker
  const [overrideOpen, setOverrideOpen] = useState<number | null>(null);
  const [pickerMode, setPickerMode] = useState<"library" | "catalog">("library");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-select catalog match
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [matchPanelOpen, setMatchPanelOpen] = useState(false);
  const [matchResults, setMatchResults] = useState<
    { sourceIndex: number; sourceRgb: string; matches: CatalogEntry[] }[]
  >([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");

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

  // Render mapped preview onto canvas whenever mapping changes
  useEffect(() => {
    if (!mapping || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      const colorMap = mapping.mappings.map((m) => ({
        source: hexToRgb(m.sourceRgb),
        target: hexToRgb(m.targetRgb),
      }));

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        let nearest = colorMap[0];
        let minDist = colorDistance(r, g, b, nearest.source[0], nearest.source[1], nearest.source[2]);

        for (let j = 1; j < colorMap.length; j++) {
          const d = colorDistance(r, g, b, colorMap[j].source[0], colorMap[j].source[1], colorMap[j].source[2]);
          if (d < minDist) {
            minDist = d;
            nearest = colorMap[j];
          }
        }

        pixels[i] = nearest.target[0];
        pixels[i + 1] = nearest.target[1];
        pixels[i + 2] = nearest.target[2];
      }

      ctx.putImageData(imageData, 0, 0);
    };
    img.src = imagePath;
  }, [mapping, imagePath]);

  // Dithered preview canvas
  useEffect(() => {
    if (!ditherPreviewEnabled || !mapping || !ditherCanvasRef.current) return;
    const canvas = ditherCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const blockPx = Math.max(4, Math.round(previewBlockSize * 10));
      const cols = Math.ceil(img.width / blockPx);
      const rows = Math.ceil(img.height / blockPx);

      canvas.width = img.width;
      canvas.height = img.height;

      const offscreen = document.createElement("canvas");
      offscreen.width = img.width;
      offscreen.height = img.height;
      const offCtx = offscreen.getContext("2d")!;
      offCtx.drawImage(img, 0, 0);

      const imageData = offCtx.getImageData(0, 0, img.width, img.height);
      const mappingEntries = mapping.mappings;

      // Simple 4x4 Bayer matrix (normalized)
      const bayer4 = [
        [0 / 16, 8 / 16, 2 / 16, 10 / 16],
        [12 / 16, 4 / 16, 14 / 16, 6 / 16],
        [3 / 16, 11 / 16, 1 / 16, 9 / 16],
        [15 / 16, 7 / 16, 13 / 16, 5 / 16],
      ];

      for (let br = 0; br < rows; br++) {
        for (let bc = 0; bc < cols; bc++) {
          const cx = Math.min(bc * blockPx + Math.floor(blockPx / 2), img.width - 1);
          const cy = Math.min(br * blockPx + Math.floor(blockPx / 2), img.height - 1);
          const idx = (cy * img.width + cx) * 4;
          const r = imageData.data[idx];
          const g = imageData.data[idx + 1];
          const b = imageData.data[idx + 2];

          let best1 = { hex: "#000000", dist: Infinity };
          let best2 = { hex: "#000000", dist: Infinity };
          for (const m of mappingEntries) {
            const tr = parseInt(m.targetRgb.slice(1, 3), 16);
            const tg = parseInt(m.targetRgb.slice(3, 5), 16);
            const tb = parseInt(m.targetRgb.slice(5, 7), 16);
            const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
            if (dist < best1.dist) {
              best2 = best1;
              best1 = { hex: m.targetRgb, dist };
            } else if (dist < best2.dist) {
              best2 = { hex: m.targetRgb, dist };
            }
          }

          const totalDist = best1.dist + best2.dist;
          const ratio = totalDist > 0 ? 1 - best1.dist / totalDist : 1;
          const threshold = bayer4[br % 4][bc % 4];
          const color = ratio > threshold ? best1.hex : best2.hex;

          ctx.fillStyle = color;
          ctx.fillRect(
            bc * blockPx,
            br * blockPx,
            Math.min(blockPx, img.width - bc * blockPx),
            Math.min(blockPx, img.height - br * blockPx)
          );
        }
      }
    };
    img.src = imagePath;
  }, [ditherPreviewEnabled, mapping, previewBlockSize, imagePath]);

  // Debounced catalog search for per-row picker
  useEffect(() => {
    if (pickerMode !== "catalog" || overrideOpen === null) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(async () => {
      setCatalogLoading(true);
      const params = new URLSearchParams({ pageSize: "24" });
      if (catalogSearch) params.set("q", catalogSearch);

      const res = await fetch(`/api/catalog?${params}`);
      const data = await res.json();

      if (mapping && overrideOpen !== null) {
        const src = hexToRgb(mapping.mappings[overrideOpen].sourceRgb);
        data.results.sort((a: CatalogEntry, b: CatalogEntry) => {
          const da = colorDistance(...src, ...hexToRgb(a.hexColor));
          const db = colorDistance(...src, ...hexToRgb(b.hexColor));
          return da - db;
        });
      }

      setCatalogResults(data.results);
      setCatalogLoading(false);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [catalogSearch, pickerMode, overrideOpen, mapping]);

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
      setSelectedRows(new Set());
      setMatchPanelOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleOverride(index: number, filament: FilamentInfo) {
    if (!mapping) return;
    const m = { ...mapping.mappings[index] };
    m.filamentId = filament.id;
    m.targetRgb = filament.hexColor;
    m.deltaE = computeDeltaEApprox(m.sourceRgb, filament.hexColor);

    const updatedMappings = [...mapping.mappings];
    updatedMappings[index] = m;
    setMapping({ ...mapping, mappings: updatedMappings });
    setOverrideOpen(null);
    setPickerMode("library");
    setCatalogSearch("");
  }

  async function addFromCatalog(entry: CatalogEntry): Promise<FilamentInfo> {
    const res = await fetch("/api/filaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: entry.brand,
        name: entry.material,
        colorName: entry.colorName,
        hexColor: entry.hexColor,
        material: entry.materialParent,
        translucent: entry.colorFamily === "TRN",
        owned: true,
      }),
    });
    const newFilament = await res.json();
    const fil: FilamentInfo = {
      id: newFilament.id,
      brand: newFilament.brand,
      colorName: newFilament.colorName,
      hexColor: newFilament.hexColor,
    };
    setFilaments((prev) => [...prev, fil]);
    return fil;
  }

  async function handleAddFromCatalogAndAssign(index: number, entry: CatalogEntry) {
    const fil = await addFromCatalog(entry);
    handleOverride(index, fil);
  }

  function openPicker(index: number) {
    if (overrideOpen === index) {
      setOverrideOpen(null);
      setPickerMode("library");
      setCatalogSearch("");
    } else {
      setOverrideOpen(index);
      setPickerMode("library");
      setCatalogSearch("");
      setMatchPanelOpen(false);
    }
  }

  function toggleRowSelection(index: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function findMatchingFilaments(searchQuery?: string) {
    if (!mapping || selectedRows.size === 0) return;
    setMatchLoading(true);
    setMatchPanelOpen(true);
    setOverrideOpen(null);

    const params = new URLSearchParams({ pageSize: "100" });
    if (searchQuery) params.set("q", searchQuery);

    const res = await fetch(`/api/catalog?${params}`);
    const data = await res.json();
    const allEntries: CatalogEntry[] = data.results;

    // For each selected row, sort the catalog by proximity and take top 8
    const results = [...selectedRows]
      .sort((a, b) => a - b)
      .map((idx) => {
        const sourceRgb = mapping.mappings[idx].sourceRgb;
        const src = hexToRgb(sourceRgb);
        const sorted = [...allEntries].sort((a, b) => {
          const da = colorDistance(...src, ...hexToRgb(a.hexColor));
          const db = colorDistance(...src, ...hexToRgb(b.hexColor));
          return da - db;
        });
        return {
          sourceIndex: idx,
          sourceRgb,
          matches: sorted.slice(0, 8),
        };
      });

    setMatchResults(results);
    setMatchLoading(false);
  }

  // Debounced search for match panel
  const matchSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!matchPanelOpen) return;
    if (matchSearchTimerRef.current) clearTimeout(matchSearchTimerRef.current);
    matchSearchTimerRef.current = setTimeout(() => {
      findMatchingFilaments(matchSearch || undefined);
    }, 300);
    return () => {
      if (matchSearchTimerRef.current) clearTimeout(matchSearchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchSearch]);

  async function handleMatchAssign(sourceIndex: number, entry: CatalogEntry) {
    const fil = await addFromCatalog(entry);
    handleOverride(sourceIndex, fil);
    // Remove from selected and update match results
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.delete(sourceIndex);
      return next;
    });
    setMatchResults((prev) => prev.filter((r) => r.sourceIndex !== sourceIndex));
    if (matchResults.length <= 1) {
      setMatchPanelOpen(false);
    }
  }

  const filamentMap = Object.fromEntries(filaments.map((f) => [f.id, f]));

  return (
    <div className="space-y-6">
      {/* Side-by-side: Original + Mapped Preview */}
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
        <div className="flex-1">
          <h3 className="text-sm font-medium mb-2">Mapped to Filaments</h3>
          {mapping ? (
            <canvas
              ref={canvasRef}
              className="rounded-lg border w-full"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <div className="rounded-lg border aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm">
              Run color analysis to see preview
            </div>
          )}
        </div>
        {ditherPreviewEnabled && (
          <div className="flex-1">
            <h3 className="text-sm font-medium mb-2">Dithered Preview</h3>
            {mapping ? (
              <canvas
                ref={ditherCanvasRef}
                className="rounded-lg border w-full"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="rounded-lg border aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm">
                Run color analysis first
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ditherPreview"
            checked={ditherPreviewEnabled}
            onChange={(e) => setDitherPreviewEnabled(e.target.checked)}
          />
          <label htmlFor="ditherPreview" className="text-sm">
            Show dithered preview
          </label>
        </div>
        {ditherPreviewEnabled && (
          <div className="flex items-center gap-2">
            <label htmlFor="previewBlockSize" className="text-sm">
              Block size:
            </label>
            <input
              id="previewBlockSize"
              type="range"
              min={1.5}
              max={10}
              step={0.5}
              value={previewBlockSize}
              onChange={(e) => setPreviewBlockSize(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">
              {previewBlockSize}mm
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
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

      {/* Color Assignments */}
      {mapping && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Color Assignments</h3>
              <p className="text-xs text-muted-foreground">
                Click a filament to change it, or select rows to find matching catalog filaments
              </p>
            </div>
            {selectedRows.size > 0 && (
              <Button
                size="sm"
                onClick={() => { setMatchSearch(""); findMatchingFilaments(); }}
              >
                Find Matches ({selectedRows.size})
              </Button>
            )}
          </div>

          {(mapping.mappings as Mapping[]).map((m, i) => {
            const fil = filamentMap[m.filamentId];
            const isOpen = overrideOpen === i;
            const isSelected = selectedRows.has(i);

            return (
              <div key={i} className="space-y-1">
                {/* Assignment row */}
                <div
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-foreground bg-accent"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Selection checkbox */}
                  <button
                    className={`h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-muted-foreground/40 hover:border-foreground"
                    }`}
                    onClick={() => toggleRowSelection(i)}
                    title={isSelected ? "Deselect" : "Select for matching"}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <div
                    className="h-10 w-10 rounded shrink-0 border border-border"
                    style={{ backgroundColor: m.sourceRgb }}
                    title={`Source: ${m.sourceRgb}`}
                  />
                  <span className="text-muted-foreground text-sm shrink-0">→</span>
                  <button
                    className="h-10 w-10 rounded shrink-0 border-2 border-border hover:border-foreground transition-colors cursor-pointer"
                    style={{ backgroundColor: m.targetRgb }}
                    title={`Filament: ${m.targetRgb} — click to change`}
                    onClick={() => openPicker(i)}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {fil ? `${fil.brand} ${fil.colorName}` : "Unknown"}
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        m.deltaE < 5
                          ? "text-green-600"
                          : m.deltaE < 10
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      ΔE {m.deltaE.toFixed(1)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto shrink-0 text-xs"
                    onClick={() => openPicker(i)}
                  >
                    {isOpen ? "Cancel" : "Change"}
                  </Button>
                </div>

                {/* Per-row picker panel */}
                {isOpen && (
                  <div className="ml-14 rounded-lg border bg-muted/50 overflow-hidden">
                    <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
                      <Button
                        variant={pickerMode === "library" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => { setPickerMode("library"); setCatalogSearch(""); }}
                      >
                        My Library ({filaments.length})
                      </Button>
                      <Button
                        variant={pickerMode === "catalog" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setPickerMode("catalog")}
                      >
                        Browse Catalog
                      </Button>
                      {pickerMode === "catalog" && (
                        <Input
                          placeholder="Search brand or color..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="h-7 text-xs flex-1 max-w-48"
                          autoFocus
                        />
                      )}
                    </div>

                    {pickerMode === "library" && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 max-h-64 overflow-y-auto">
                        {filaments.length === 0 ? (
                          <div className="col-span-full text-center py-4">
                            <p className="text-xs text-muted-foreground mb-2">No filaments in your library</p>
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => setPickerMode("catalog")}>
                              Browse catalog to add some
                            </Button>
                          </div>
                        ) : (
                          filaments.map((f) => (
                            <button
                              key={f.id}
                              className={`flex items-center gap-2 p-2 rounded-md text-left text-xs hover:bg-background transition-colors ${
                                f.id === m.filamentId ? "ring-2 ring-foreground bg-background" : ""
                              }`}
                              onClick={() => handleOverride(i, f)}
                            >
                              <div className="h-6 w-6 rounded shrink-0 border border-border" style={{ backgroundColor: f.hexColor }} />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{f.colorName}</div>
                                <div className="text-muted-foreground truncate">{f.brand}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {pickerMode === "catalog" && (
                      <div className="max-h-72 overflow-y-auto">
                        {catalogLoading ? (
                          <p className="text-xs text-muted-foreground p-4 text-center">Searching…</p>
                        ) : catalogResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-4 text-center">
                            {catalogSearch ? "No results" : "Type to search the catalog"}
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2">
                            {catalogResults.map((entry) => (
                              <button
                                key={entry.id}
                                className="flex items-center gap-2 p-2 rounded-md text-left text-xs hover:bg-background transition-colors"
                                onClick={() => handleAddFromCatalogAndAssign(i, entry)}
                              >
                                <div className="h-6 w-6 rounded shrink-0 border border-border" style={{ backgroundColor: entry.hexColor }} />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{entry.colorName}</div>
                                  <div className="text-muted-foreground truncate">{entry.brand} · {entry.material}</div>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  ΔE {computeDeltaEApprox(m.sourceRgb, entry.hexColor).toFixed(0)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground px-2 pb-2 pt-1 border-t">
                          Sorted by color proximity · Click to add to library and assign
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ============ MULTI-MATCH PANEL ============ */}
          {matchPanelOpen && (
            <div className="rounded-lg border bg-card p-4 space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Catalog Matches</h3>
                  <p className="text-xs text-muted-foreground">
                    Best matches from 2,198 filaments for your selected colors
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Filter by brand..."
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    className="h-8 text-xs w-40"
                  />
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setMatchPanelOpen(false); setSelectedRows(new Set()); }}>
                    Close
                  </Button>
                </div>
              </div>

              {matchLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Searching catalog…</p>
              ) : matchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No more colors to match</p>
              ) : (
                matchResults.map(({ sourceIndex, sourceRgb, matches }) => (
                  <div key={sourceIndex} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded border border-border shrink-0" style={{ backgroundColor: sourceRgb }} />
                      <span className="text-sm font-medium">Source {sourceRgb}</span>
                      <span className="text-xs text-muted-foreground">
                        — currently: {filamentMap[mapping!.mappings[sourceIndex].filamentId]?.colorName ?? "Unknown"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {matches.map((entry) => (
                        <button
                          key={entry.id}
                          className="flex items-center gap-2 p-2 rounded-md text-left text-xs border hover:bg-accent transition-colors"
                          onClick={() => handleMatchAssign(sourceIndex, entry)}
                        >
                          <div className="h-6 w-6 rounded shrink-0 border border-border" style={{ backgroundColor: entry.hexColor }} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{entry.colorName}</div>
                            <div className="text-muted-foreground truncate">{entry.brand}</div>
                          </div>
                          <span
                            className={`text-[10px] font-mono shrink-0 ${
                              computeDeltaEApprox(sourceRgb, entry.hexColor) < 5
                                ? "text-green-600"
                                : computeDeltaEApprox(sourceRgb, entry.hexColor) < 10
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            ΔE {computeDeltaEApprox(sourceRgb, entry.hexColor).toFixed(1)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <p className="text-[10px] text-muted-foreground pt-2 border-t">
                Click a filament to add it to your library and assign it · Row is removed after assignment
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
