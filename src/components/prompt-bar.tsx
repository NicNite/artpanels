"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface PromptBarProps {
  defaultPrompt?: string;
  onGenerate: (prompt: string, count: number) => void;
  isGenerating: boolean;
}

export function PromptBar({ defaultPrompt = "", onGenerate, isGenerating }: PromptBarProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [count, setCount] = useState(4);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim(), count);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 border rounded-lg bg-card">
      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the art panel design..."
          rows={3}
          disabled={isGenerating}
        />
      </div>
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-2 w-28">
          <Label htmlFor="count">Count</Label>
          <Input
            id="count"
            type="number"
            min={1}
            max={8}
            value={count}
            onChange={(e) => setCount(Math.min(8, Math.max(1, Number(e.target.value))))}
            disabled={isGenerating}
          />
        </div>
        <Button type="submit" disabled={isGenerating || !prompt.trim()} className="flex-1">
          {isGenerating ? "Generating..." : "Generate"}
        </Button>
      </div>
    </form>
  );
}
