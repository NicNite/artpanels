"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SIZE_TEMPLATES = [
  { label: "Small (300 × 400 mm)", widthMm: 300, heightMm: 400 },
  { label: "Medium (500 × 800 mm)", widthMm: 500, heightMm: 800 },
  { label: "Large (600 × 1000 mm)", widthMm: 600, heightMm: 1000 },
  { label: "Custom", widthMm: null, heightMm: null },
] as const;

type TemplateName = "Small (300 × 400 mm)" | "Medium (500 × 800 mm)" | "Large (600 × 1000 mm)" | "Custom";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>("Small (300 × 400 mm)");
  const [widthMm, setWidthMm] = useState<string>("300");
  const [heightMm, setHeightMm] = useState<string>("400");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTemplateChange(templateLabel: TemplateName) {
    setSelectedTemplate(templateLabel);
    const template = SIZE_TEMPLATES.find((t) => t.label === templateLabel);
    if (template && template.widthMm !== null) {
      setWidthMm(String(template.widthMm));
      setHeightMm(String(template.heightMm));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!widthMm || !heightMm) {
      setError("Panel dimensions are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          theme: theme.trim() || undefined,
          description: description.trim() || undefined,
          widthMm: Number(widthMm),
          heightMm: Number(heightMm),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create project");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}/explore`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSubmitting(false);
    }
  }

  const isCustom = selectedTemplate === "Custom";

  return (
    <main className="container mx-auto p-8 max-w-lg">
      <h1 className="text-3xl font-bold mb-8">New Project</h1>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Window Panel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Forest, geometric, abstract..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your vision..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Panel Size</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(v) => handleTemplateChange(v as TemplateName)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_TEMPLATES.map((t) => (
                    <SelectItem key={t.label} value={t.label}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input
                    id="width"
                    type="number"
                    min={1}
                    value={widthMm}
                    onChange={(e) => setWidthMm(e.target.value)}
                    placeholder="500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (mm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min={1}
                    value={heightMm}
                    onChange={(e) => setHeightMm(e.target.value)}
                    placeholder="800"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Creating..." : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/")}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
