import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";

const createdIds: string[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await db.filament.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("Filament CRUD", () => {
  it("creates a filament with correct fields", async () => {
    const filament = await db.filament.create({
      data: {
        brand: "Bambu Lab",
        name: "PLA Matte",
        colorName: "Bambu Green",
        hexColor: "#3a7d44",
        material: "PLA",
        translucent: false,
        owned: true,
      },
    });
    createdIds.push(filament.id);

    expect(filament.brand).toBe("Bambu Lab");
    expect(filament.hexColor).toBe("#3a7d44");
    expect(filament.material).toBe("PLA");
    expect(filament.owned).toBe(true);
    expect(filament.translucent).toBe(false);
  });

  it("filters filaments by owned=true", async () => {
    const owned = await db.filament.create({
      data: {
        brand: "Hatchbox",
        name: "PLA",
        colorName: "True Red",
        hexColor: "#cc0000",
        owned: true,
      },
    });
    createdIds.push(owned.id);

    const catalog = await db.filament.create({
      data: {
        brand: "eSUN",
        name: "ePLA-Matte",
        colorName: "Cold White",
        hexColor: "#f5f5f5",
        owned: false,
      },
    });
    createdIds.push(catalog.id);

    const ownedFilaments = await db.filament.findMany({
      where: { id: { in: createdIds }, owned: true },
      orderBy: [{ brand: "asc" }, { colorName: "asc" }],
    });

    expect(ownedFilaments).toHaveLength(1);
    expect(ownedFilaments[0].id).toBe(owned.id);
  });

  it("filters filaments by owned=false", async () => {
    const owned = await db.filament.create({
      data: {
        brand: "Polymaker",
        name: "PolyTerra PLA",
        colorName: "Army Green",
        hexColor: "#4b5320",
        owned: true,
      },
    });
    createdIds.push(owned.id);

    const catalog = await db.filament.create({
      data: {
        brand: "Overture",
        name: "PLA Pro",
        colorName: "Galaxy Black",
        hexColor: "#1a1a2e",
        owned: false,
      },
    });
    createdIds.push(catalog.id);

    const catalogFilaments = await db.filament.findMany({
      where: { id: { in: createdIds }, owned: false },
      orderBy: [{ brand: "asc" }, { colorName: "asc" }],
    });

    expect(catalogFilaments).toHaveLength(1);
    expect(catalogFilaments[0].id).toBe(catalog.id);
  });

  it("orders by brand asc, colorName asc", async () => {
    const f1 = await db.filament.create({
      data: {
        brand: "Zyltech",
        name: "PLA",
        colorName: "Blue",
        hexColor: "#0000ff",
      },
    });
    createdIds.push(f1.id);

    const f2 = await db.filament.create({
      data: {
        brand: "Amolen",
        name: "PLA",
        colorName: "Red",
        hexColor: "#ff0000",
      },
    });
    createdIds.push(f2.id);

    const sorted = await db.filament.findMany({
      where: { id: { in: createdIds } },
      orderBy: [{ brand: "asc" }, { colorName: "asc" }],
    });

    expect(sorted[0].brand).toBe("Amolen");
    expect(sorted[1].brand).toBe("Zyltech");
  });
});
