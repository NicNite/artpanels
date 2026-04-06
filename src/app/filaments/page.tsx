"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilamentForm } from "@/components/filament-form";

interface Filament {
  id: string;
  brand: string;
  name: string;
  colorName: string;
  hexColor: string;
  material: string;
  translucent: boolean;
  owned: boolean;
  notes: string | null;
}

type Filter = "all" | "owned" | "catalog";

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const query =
      filter === "owned"
        ? "?owned=true"
        : filter === "catalog"
          ? "?owned=false"
          : "";
    const res = await fetch(`/api/filaments${query}`);
    const data = await res.json();
    setFilaments(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleDelete(id: string) {
    await fetch(`/api/filaments/${id}`, { method: "DELETE" });
    load();
  }

  function handleSave() {
    setShowForm(false);
    load();
  }

  const tabs: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Owned", value: "owned" },
    { label: "Catalog", value: "catalog" },
  ];

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Filament Library</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Filament"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6">
          <FilamentForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filaments.length === 0 ? (
        <p className="text-muted-foreground">No filaments found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filaments.map((f) => (
            <div
              key={f.id}
              className="border rounded-lg p-4 bg-card flex flex-col gap-2"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded border flex-shrink-0"
                  style={{ backgroundColor: f.hexColor }}
                />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{f.colorName}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {f.brand} · {f.name} · {f.material}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {f.translucent && <Badge variant="secondary">Translucent</Badge>}
                {f.owned && <Badge>Owned</Badge>}
              </div>

              <div className="flex justify-end mt-auto pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(f.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
