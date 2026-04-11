"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

interface CatalogEntry {
  id: number;
  brand: string;
  colorName: string;
  hexColor: string;
  material: string;
  materialParent: string;
  colorFamily: string;
  available: boolean;
  cardImg: string;
  labL: number;
  labA: number;
  labB: number;
}

interface CatalogFilters {
  brands: string[];
  materialParents: string[];
  colorFamilies: { code: string; label: string }[];
}

type Tab = "owned" | "catalog";

export default function FilamentsPage() {
  const [tab, setTab] = useState<Tab>("owned");

  // --- Owned filaments state ---
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(true);

  // --- Catalog state ---
  const [catalogResults, setCatalogResults] = useState<CatalogEntry[]>([]);
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters | null>(null);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogBrand, setCatalogBrand] = useState("");
  const [catalogMaterial, setCatalogMaterial] = useState("");
  const [catalogColor, setCatalogColor] = useState("");
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  async function loadOwned() {
    setLoadingOwned(true);
    const res = await fetch("/api/filaments?owned=true");
    const data = await res.json();
    setFilaments(data);
    setLoadingOwned(false);
  }

  const loadCatalog = useCallback(async (page: number) => {
    setLoadingCatalog(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "48" });
    if (catalogSearch) params.set("q", catalogSearch);
    if (catalogBrand) params.set("brand", catalogBrand);
    if (catalogMaterial) params.set("material", catalogMaterial);
    if (catalogColor) params.set("color", catalogColor);

    const res = await fetch(`/api/catalog?${params}`);
    const data = await res.json();
    setCatalogResults(data.results);
    setCatalogTotal(data.total);
    setCatalogPage(data.page);
    setCatalogTotalPages(data.totalPages);
    if (!catalogFilters) setCatalogFilters(data.filters);
    setLoadingCatalog(false);
  }, [catalogSearch, catalogBrand, catalogMaterial, catalogColor, catalogFilters]);

  useEffect(() => {
    loadOwned();
  }, []);

  useEffect(() => {
    if (tab === "catalog") {
      loadCatalog(1);
    }
  }, [tab, catalogSearch, catalogBrand, catalogMaterial, catalogColor, loadCatalog]);

  async function handleDelete(id: string) {
    await fetch(`/api/filaments/${id}`, { method: "DELETE" });
    loadOwned();
  }

  async function handleAddFromCatalog(entry: CatalogEntry) {
    await fetch("/api/filaments", {
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
    setAddedIds((prev) => new Set(prev).add(entry.id));
  }

  function handleSave() {
    setShowForm(false);
    loadOwned();
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Filament Library</h1>
        {tab === "owned" && (
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Filament"}
          </Button>
        )}
      </div>

      {showForm && tab === "owned" && (
        <div className="mb-6">
          <FilamentForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "owned" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("owned")}
        >
          My Filaments ({filaments.length})
        </Button>
        <Button
          variant={tab === "catalog" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("catalog")}
        >
          Browse Catalog (2,198)
        </Button>
      </div>

      {/* ============ OWNED TAB ============ */}
      {tab === "owned" && (
        <>
          {loadingOwned ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-3">No filaments in your library yet.</p>
              <Button variant="outline" onClick={() => setTab("catalog")}>
                Browse Catalog to add filaments
              </Button>
            </div>
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
                    <Badge>Owned</Badge>
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
        </>
      )}

      {/* ============ CATALOG TAB ============ */}
      {tab === "catalog" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Search filaments..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="w-56"
            />
            {catalogFilters && (
              <>
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={catalogBrand}
                  onChange={(e) => setCatalogBrand(e.target.value)}
                >
                  <option value="">All Brands ({catalogFilters.brands.length})</option>
                  {catalogFilters.brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={catalogMaterial}
                  onChange={(e) => setCatalogMaterial(e.target.value)}
                >
                  <option value="">All Materials</option>
                  {catalogFilters.materialParents.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={catalogColor}
                  onChange={(e) => setCatalogColor(e.target.value)}
                >
                  <option value="">All Colors</option>
                  {catalogFilters.colorFamilies.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground mb-4">
            {catalogTotal} filaments found
            {catalogTotalPages > 1 && ` · Page ${catalogPage} of ${catalogTotalPages}`}
          </p>

          {loadingCatalog ? (
            <p className="text-muted-foreground">Loading catalog…</p>
          ) : catalogResults.length === 0 ? (
            <p className="text-muted-foreground">No results match your filters.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {catalogResults.map((entry) => {
                  const isAdded = addedIds.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className="border rounded-lg p-3 bg-card flex flex-col gap-2 group"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded border flex-shrink-0"
                          style={{ backgroundColor: entry.hexColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{entry.colorName}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.brand}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.material}
                      </p>
                      <Button
                        size="sm"
                        variant={isAdded ? "outline" : "default"}
                        className="w-full text-xs mt-auto"
                        disabled={isAdded}
                        onClick={() => handleAddFromCatalog(entry)}
                      >
                        {isAdded ? "✓ Added" : "Add to Library"}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {catalogTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={catalogPage <= 1}
                    onClick={() => loadCatalog(catalogPage - 1)}
                  >
                    ← Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {catalogPage} of {catalogTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={catalogPage >= catalogTotalPages}
                    onClick={() => loadCatalog(catalogPage + 1)}
                  >
                    Next →
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
