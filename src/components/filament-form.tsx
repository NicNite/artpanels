"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FilamentFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export function FilamentForm({ onSave, onCancel }: FilamentFormProps) {
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [colorName, setColorName] = useState("");
  const [hexColor, setHexColor] = useState("#ffffff");
  const [material, setMaterial] = useState("PLA");
  const [translucent, setTranslucent] = useState(false);
  const [owned, setOwned] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, name, colorName, hexColor, material, translucent, owned }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create filament");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-6 bg-card">
      <h2 className="text-lg font-semibold mb-4">Add Filament</h2>

      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Bambu Lab"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="name">Product Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. PLA Matte"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="colorName">Color Name</Label>
          <Input
            id="colorName"
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
            placeholder="e.g. Bambu Green"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="hexColor">Hex Color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={hexColor}
              onChange={(e) => setHexColor(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded border p-1"
            />
            <Input
              id="hexColor"
              value={hexColor}
              onChange={(e) => setHexColor(e.target.value)}
              placeholder="#ffffff"
              pattern="^#[0-9a-fA-F]{6}$"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="PLA"
          />
        </div>

        <div className="flex items-center gap-6 pt-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={translucent}
              onChange={(e) => setTranslucent(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Translucent</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={owned}
              onChange={(e) => setOwned(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Owned</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Filament"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
