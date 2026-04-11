import { NextRequest, NextResponse } from "next/server";
import catalog from "@/data/filament-catalog.json";

type CatalogEntry = {
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
  tags: string[];
};

const data = catalog as CatalogEntry[];

// Extract unique brands and material types for filter dropdowns
const brands = [...new Set(data.map((d) => d.brand))].sort();
const materialParents = [...new Set(data.map((d) => d.materialParent))].sort();

const COLOR_FAMILY_LABELS: Record<string, string> = {
  BLK: "Black",
  BLU: "Blue",
  BRN: "Brown",
  GRN: "Green",
  GRY: "Grey",
  PNK: "Pink",
  PPL: "Purple",
  RED: "Red",
  RNG: "Orange",
  TRN: "Translucent",
  WHT: "White",
  YLW: "Yellow",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");
  const materialParent = searchParams.get("material");
  const colorFamily = searchParams.get("color");
  const search = searchParams.get("q")?.toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 48)));

  let filtered = data;

  if (brand) {
    filtered = filtered.filter((d) => d.brand === brand);
  }
  if (materialParent) {
    filtered = filtered.filter((d) => d.materialParent === materialParent);
  }
  if (colorFamily) {
    filtered = filtered.filter((d) => d.colorFamily === colorFamily);
  }
  if (search) {
    filtered = filtered.filter(
      (d) =>
        d.brand.toLowerCase().includes(search) ||
        d.colorName.toLowerCase().includes(search) ||
        d.material.toLowerCase().includes(search)
    );
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const results = filtered.slice(start, start + pageSize);

  return NextResponse.json({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    filters: {
      brands,
      materialParents,
      colorFamilies: Object.entries(COLOR_FAMILY_LABELS).map(([code, label]) => ({
        code,
        label,
      })),
    },
    results,
  });
}
