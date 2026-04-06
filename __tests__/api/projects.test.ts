import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";

const createdIds: string[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await db.project.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("Project CRUD", () => {
  it("creates a project with correct fields", async () => {
    const project = await db.project.create({
      data: {
        name: "Test Panel",
        widthMm: 300,
        heightMm: 400,
      },
    });
    createdIds.push(project.id);

    expect(project.name).toBe("Test Panel");
    expect(project.widthMm).toBe(300);
    expect(project.heightMm).toBe(400);
    expect(project.status).toBe("exploring");
  });

  it("lists projects ordered by createdAt desc", async () => {
    const first = await db.project.create({
      data: { name: "First Project", widthMm: 300, heightMm: 400 },
    });
    createdIds.push(first.id);

    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 10));

    const second = await db.project.create({
      data: { name: "Second Project", widthMm: 500, heightMm: 800 },
    });
    createdIds.push(second.id);

    const projects = await db.project.findMany({
      where: { id: { in: createdIds } },
      orderBy: { createdAt: "desc" },
    });

    expect(projects[0].name).toBe("Second Project");
    expect(projects[1].name).toBe("First Project");
  });

  it("updates a project name and status", async () => {
    const project = await db.project.create({
      data: { name: "Original Name", widthMm: 300, heightMm: 400 },
    });
    createdIds.push(project.id);

    const updated = await db.project.update({
      where: { id: project.id },
      data: { name: "Updated Name", status: "active" },
    });

    expect(updated.name).toBe("Updated Name");
    expect(updated.status).toBe("active");
  });

  it("deletes a project", async () => {
    const project = await db.project.create({
      data: { name: "To Delete", widthMm: 300, heightMm: 400 },
    });

    await db.project.delete({ where: { id: project.id } });

    const found = await db.project.findUnique({ where: { id: project.id } });
    expect(found).toBeNull();
  });
});
