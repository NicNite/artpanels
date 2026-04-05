# ArtPanels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app for designing multi-color translucent 3D-printed art panels — from AI image generation through color mapping to 3MF export.

**Architecture:** Next.js 15 App Router full-stack monolith with Prisma ORM and PostgreSQL. Image generation delegated to an external FLUX FastAPI server via a pluggable provider interface. Color processing and 3MF generation run in Node.js.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui, Three.js (react-three-fiber), pnpm, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-04-05-artpanels-design.md`

---

## File Structure

```
artpanels/
├── docker-compose.yml                    # PostgreSQL for local dev
├── .env.example                          # Environment variable template
├── prisma/
│   └── schema.prisma                     # Database schema
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with providers
│   │   ├── page.tsx                      # Dashboard — project list
│   │   ├── projects/
│   │   │   ├── new/
│   │   │   │   └── page.tsx             # Create project form
│   │   │   └── [id]/
│   │   │       ├── layout.tsx           # Project layout with nav
│   │   │       ├── page.tsx             # Project overview + candidate cards
│   │   │       ├── explore/
│   │   │       │   └── page.tsx         # Design explorer — prompt + gallery
│   │   │       └── candidates/
│   │   │           └── [cid]/
│   │   │               ├── colors/
│   │   │               │   └── page.tsx # Color mapper
│   │   │               ├── preview/
│   │   │               │   └── page.tsx # 3D preview
│   │   │               └── export/
│   │   │                   └── page.tsx # 3MF export + download
│   │   ├── filaments/
│   │   │   └── page.tsx                 # Filament library
│   │   └── api/
│   │       ├── projects/
│   │       │   ├── route.ts             # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts         # GET, PATCH, DELETE project
│   │       │       ├── generations/
│   │       │       │   └── route.ts     # POST generate images
│   │       │       ├── images/
│   │       │       │   └── [imageId]/
│   │       │       │       └── route.ts # PATCH star/unstar
│   │       │       └── candidates/
│   │       │           ├── route.ts     # GET list, POST promote
│   │       │           └── [cid]/
│   │       │               ├── route.ts # GET, PATCH, DELETE candidate
│   │       │               ├── color-mappings/
│   │       │               │   └── route.ts # POST quantize, GET list
│   │       │               └── exports/
│   │       │                   └── route.ts # POST generate 3MF, GET list
│   │       └── filaments/
│   │           ├── route.ts             # GET list, POST create
│   │           └── [id]/
│   │               └── route.ts         # GET, PATCH, DELETE filament
│   ├── lib/
│   │   ├── db.ts                        # Prisma client singleton
│   │   ├── providers/
│   │   │   ├── types.ts                 # ImageProvider interface + types
│   │   │   ├── registry.ts              # Provider registry
│   │   │   └── local-flux.ts            # LocalFluxProvider
│   │   ├── color/
│   │   │   ├── cielab.ts                # RGB↔CIELAB conversion
│   │   │   ├── kmeans.ts                # K-means clustering in CIELAB
│   │   │   ├── delta-e.ts               # CIEDE2000 Delta-E calculation
│   │   │   └── quantize.ts              # Orchestrator: quantize + match
│   │   ├── export/
│   │   │   ├── mesh.ts                  # Height map → triangle mesh
│   │   │   └── threemf.ts               # Mesh → 3MF ZIP package
│   │   └── storage.ts                   # File storage helpers (save/read images, exports)
│   └── components/
│       ├── ui/                          # shadcn/ui components (auto-generated)
│       ├── project-card.tsx             # Dashboard project card
│       ├── candidate-card.tsx           # Candidate status card
│       ├── image-grid.tsx               # Image gallery with star/promote
│       ├── prompt-bar.tsx               # Prompt input + generate button
│       ├── generation-progress.tsx      # SSE progress display
│       ├── color-mapper.tsx             # Color mapping UI
│       ├── color-swatch.tsx             # Filament color swatch with Delta-E
│       ├── panel-viewer.tsx             # Three.js 3D panel viewer
│       └── filament-form.tsx            # Add/edit filament form
├── public/
│   └── uploads/                         # Generated images + exports (gitignored)
├── __tests__/
│   ├── lib/
│   │   ├── color/
│   │   │   ├── cielab.test.ts
│   │   │   ├── kmeans.test.ts
│   │   │   ├── delta-e.test.ts
│   │   │   └── quantize.test.ts
│   │   ├── export/
│   │   │   ├── mesh.test.ts
│   │   │   └── threemf.test.ts
│   │   └── providers/
│   │       ├── local-flux.test.ts
│   │       └── registry.test.ts
│   └── api/
│       ├── projects.test.ts
│       ├── filaments.test.ts
│       └── candidates.test.ts
└── e2e/
    └── project-flow.spec.ts             # Playwright E2E: create project → explore
```

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `docker-compose.yml`
- Create: `.env.example`, `.env.local`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project with pnpm**

```bash
cd /home/nicho/Development/artpanels
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

Accept defaults. This creates the Next.js scaffold with App Router, TypeScript, Tailwind, and ESLint.

- [ ] **Step 2: Create Docker Compose for PostgreSQL**

Create `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: artpanels
      POSTGRES_PASSWORD: artpanels
      POSTGRES_DB: artpanels
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 3: Create .env files**

Create `.env.example`:

```
DATABASE_URL="postgresql://artpanels:artpanels@localhost:5432/artpanels"
FLUX_API_URL="http://localhost:8000"
UPLOAD_DIR="./public/uploads"
```

Copy to `.env.local`:

```bash
cp .env.example .env.local
```

- [ ] **Step 4: Add .env.local and uploads to .gitignore**

Append to `.gitignore`:

```
.env.local
public/uploads/
```

- [ ] **Step 5: Start PostgreSQL and verify**

```bash
docker compose up -d
docker compose exec db psql -U artpanels -c "SELECT 1"
```

Expected: Returns `1`.

- [ ] **Step 6: Install Prisma and initialize**

```bash
pnpm add prisma @prisma/client
pnpm prisma init
```

This creates `prisma/schema.prisma`. The `DATABASE_URL` in `.env` is auto-detected from `.env.local`.

- [ ] **Step 7: Verify dev server starts**

```bash
pnpm dev
```

Visit `http://localhost:3000`. Expected: default Next.js page loads.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Prisma and Docker Compose"
```

---

### Task 2: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write the Prisma schema**

Replace the contents of `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProjectStatus {
  exploring
  active
}

enum CandidateStatus {
  exploring_colors
  previewing
  exported
}

model Project {
  id              String          @id @default(uuid())
  name            String
  description     String          @default("")
  theme           String          @default("")
  widthMm         Int             @map("width_mm")
  heightMm        Int             @map("height_mm")
  thicknessMinMm  Float           @default(0.4) @map("thickness_min_mm")
  thicknessMaxMm  Float           @default(2.0) @map("thickness_max_mm")
  status          ProjectStatus   @default(exploring)
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  generations     Generation[]
  candidates      Candidate[]

  @@map("projects")
}

model Generation {
  id              String    @id @default(uuid())
  projectId       String    @map("project_id")
  prompt          String
  negativePrompt  String    @default("") @map("negative_prompt")
  provider        String    @default("local-flux")
  modelParams     Json      @default("{}") @map("model_params")
  createdAt       DateTime  @default(now()) @map("created_at")
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  images          Image[]

  @@map("generations")
}

model Image {
  id              String      @id @default(uuid())
  generationId    String      @map("generation_id")
  filePath        String      @map("file_path")
  thumbnailPath   String      @default("") @map("thumbnail_path")
  seed            BigInt      @default(0)
  starred         Boolean     @default(false)
  notes           String      @default("")
  createdAt       DateTime    @default(now()) @map("created_at")
  generation      Generation  @relation(fields: [generationId], references: [id], onDelete: Cascade)
  candidates      Candidate[]

  @@map("images")
}

model Candidate {
  id              String            @id @default(uuid())
  projectId       String            @map("project_id")
  imageId         String            @map("image_id")
  name            String
  notes           String            @default("")
  status          CandidateStatus   @default(exploring_colors)
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")
  project         Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  image           Image             @relation(fields: [imageId], references: [id])
  colorMappings   ColorMapping[]
  exports         Export[]

  @@map("candidates")
}

model ColorMapping {
  id              String          @id @default(uuid())
  candidateId     String          @map("candidate_id")
  algorithm       String          @default("kmeans")
  numColors       Int             @map("num_colors")
  mappings        Json            @default("[]")
  previewPath     String          @default("") @map("preview_path")
  isFinal         Boolean         @default(false) @map("is_final")
  createdAt       DateTime        @default(now()) @map("created_at")
  candidate       Candidate       @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  exports         Export[]

  @@map("color_mappings")
}

model Filament {
  id              String    @id @default(uuid())
  brand           String
  name            String
  colorName       String    @map("color_name")
  hexColor        String    @map("hex_color")
  material        String    @default("PLA")
  translucent     Boolean   @default(false)
  owned           Boolean   @default(true)
  notes           String    @default("")

  @@map("filaments")
}

model Export {
  id              String        @id @default(uuid())
  candidateId     String        @map("candidate_id")
  colorMappingId  String        @map("color_mapping_id")
  filePath        String        @map("file_path")
  format          String        @default("3mf")
  settings        Json          @default("{}")
  createdAt       DateTime      @default(now()) @map("created_at")
  candidate       Candidate     @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  colorMapping    ColorMapping  @relation(fields: [colorMappingId], references: [id])

  @@map("exports")
}
```

- [ ] **Step 2: Create Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Run migration**

```bash
pnpm prisma migrate dev --name init
```

Expected: Migration created and applied. `prisma/migrations/` directory created.

- [ ] **Step 4: Verify with Prisma Studio**

```bash
pnpm prisma studio
```

Expected: Opens browser showing all 7 tables (projects, generations, images, candidates, color_mappings, filaments, exports).

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with all entities and initial migration"
```

---

### Task 3: shadcn/ui Setup

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`
- Create: `components.json`, `src/components/ui/*`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables enabled.

- [ ] **Step 2: Add core components**

```bash
pnpm dlx shadcn@latest add button card input label select textarea dialog tabs badge separator dropdown-menu form toast
```

- [ ] **Step 3: Verify components render**

Replace `src/app/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">ArtPanels</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Design translucent art panels for your windows.</CardDescription>
        </CardHeader>
      </Card>
      <Button className="mt-4">Get Started</Button>
    </main>
  );
}
```

Run `pnpm dev`, visit `http://localhost:3000`. Expected: styled card and button render.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui with core components"
```

---

### Task 4: Project CRUD API + Dashboard

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`
- Create: `src/components/project-card.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/projects/new/page.tsx`
- Create: `__tests__/api/projects.test.ts`

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write API test for project CRUD**

Create `__tests__/api/projects.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

describe("Projects API", () => {
  beforeEach(async () => {
    await prisma.project.deleteMany();
  });

  it("creates a project", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Test Panel",
        description: "A test project",
        theme: "geometric",
        widthMm: 300,
        heightMm: 400,
      },
    });

    expect(project.name).toBe("Test Panel");
    expect(project.widthMm).toBe(300);
    expect(project.status).toBe("exploring");
  });

  it("lists projects ordered by creation date", async () => {
    await prisma.project.create({
      data: { name: "First", widthMm: 100, heightMm: 100 },
    });
    await prisma.project.create({
      data: { name: "Second", widthMm: 200, heightMm: 200 },
    });

    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });

    expect(projects).toHaveLength(2);
    expect(projects[0].name).toBe("Second");
  });

  it("updates a project", async () => {
    const project = await prisma.project.create({
      data: { name: "Original", widthMm: 100, heightMm: 100 },
    });

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { name: "Updated", status: "active" },
    });

    expect(updated.name).toBe("Updated");
    expect(updated.status).toBe("active");
  });

  it("deletes a project", async () => {
    const project = await prisma.project.create({
      data: { name: "ToDelete", widthMm: 100, heightMm: 100 },
    });

    await prisma.project.delete({ where: { id: project.id } });

    const found = await prisma.project.findUnique({ where: { id: project.id } });
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

```bash
pnpm test __tests__/api/projects.test.ts
```

Expected: 4 tests PASS (these test Prisma directly against the running DB).

- [ ] **Step 4: Create projects API routes**

Create `src/app/api/projects/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { candidates: { select: { id: true, status: true } } },
  });
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description ?? "",
      theme: body.theme ?? "",
      widthMm: body.widthMm,
      heightMm: body.heightMm,
      thicknessMinMm: body.thicknessMinMm ?? 0.4,
      thicknessMaxMm: body.thicknessMaxMm ?? 2.0,
    },
  });
  return NextResponse.json(project, { status: 201 });
}
```

Create `src/app/api/projects/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      candidates: { include: { image: true } },
      generations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const project = await prisma.project.update({
    where: { id },
    data: body,
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create project card component**

Create `src/components/project-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProjectCardProps = {
  id: string;
  name: string;
  theme: string;
  widthMm: number;
  heightMm: number;
  status: string;
  candidateCount: number;
};

export function ProjectCard({ id, name, theme, widthMm, heightMm, status, candidateCount }: ProjectCardProps) {
  return (
    <Link href={`/projects/${id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
          </div>
          <CardDescription>{theme || "No theme set"}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {widthMm} x {heightMm}mm &middot; {candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 6: Build the dashboard page**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";

export default async function Dashboard() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { candidates: { select: { id: true } } },
  });

  return (
    <main className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">ArtPanels</h1>
        <Link href="/projects/new">
          <Button>+ New Project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted-foreground">No projects yet. Create your first one!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              name={p.name}
              theme={p.theme}
              widthMm={p.widthMm}
              heightMm={p.heightMm}
              status={p.status}
              candidateCount={p.candidates.length}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Build the create project page**

Create `src/app/projects/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const TEMPLATES = [
  { label: "Small (300 x 400mm)", width: 300, height: 400 },
  { label: "Medium (500 x 800mm)", width: 500, height: 800 },
  { label: "Large (600 x 1000mm)", width: 600, height: 1000 },
  { label: "Custom", width: 0, height: 0 },
];

export default function NewProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [widthMm, setWidthMm] = useState(300);
  const [heightMm, setHeightMm] = useState(400);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, theme, widthMm, heightMm }),
    });
    const project = await res.json();
    router.push(`/projects/${project.id}/explore`);
  }

  return (
    <main className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">New Project</h1>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Cello Art Nouveau" />
            </div>
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. cello, flowing curves, Art Nouveau" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the panel you envision..." />
            </div>
            <div>
              <Label>Panel Size</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t.label}
                    type="button"
                    variant={widthMm === t.width && heightMm === t.height ? "default" : "outline"}
                    size="sm"
                    onClick={() => { if (t.width > 0) { setWidthMm(t.width); setHeightMm(t.height); } }}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-4 mt-2">
                <div>
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input id="width" type="number" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value))} min={10} />
                </div>
                <div>
                  <Label htmlFor="height">Height (mm)</Label>
                  <Input id="height" type="number" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value))} min={10} />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={submitting || !name}>
              {submitting ? "Creating..." : "Create Project"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Verify end-to-end**

Run `pnpm dev`. Visit `http://localhost:3000`:
1. Click "New Project" → fill form → submit
2. Should redirect to explore page (404 is fine — we haven't built it yet)
3. Go back to `/` — project card should appear

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add project CRUD API, dashboard, and create project page"
```

---

## Phase 2: Image Generation

### Task 5: Image Provider Interface + LocalFluxProvider

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/registry.ts`
- Create: `src/lib/providers/local-flux.ts`
- Create: `src/lib/storage.ts`
- Create: `__tests__/lib/providers/registry.test.ts`
- Create: `__tests__/lib/providers/local-flux.test.ts`

- [ ] **Step 1: Write provider types**

Create `src/lib/providers/types.ts`:

```typescript
export type GenerateRequest = {
  prompt: string;
  negativePrompt?: string;
  count: number;
  width: number;
  height: number;
  seed?: number;
  params?: Record<string, unknown>;
};

export type GenerateEvent =
  | { type: "progress"; index: number; step: number; totalSteps: number }
  | { type: "image"; index: number; data: Buffer; seed: number }
  | { type: "error"; index: number; message: string }
  | { type: "done" };

export interface ImageProvider {
  id: string;
  name: string;
  healthCheck(): Promise<boolean>;
  generate(request: GenerateRequest): AsyncGenerator<GenerateEvent>;
}
```

- [ ] **Step 2: Write registry test**

Create `__tests__/lib/providers/registry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "@/lib/providers/registry";
import type { ImageProvider, GenerateRequest, GenerateEvent } from "@/lib/providers/types";

class MockProvider implements ImageProvider {
  id = "mock";
  name = "Mock Provider";
  async healthCheck() { return true; }
  async *generate(_req: GenerateRequest): AsyncGenerator<GenerateEvent> {
    yield { type: "done" };
  }
}

describe("ProviderRegistry", () => {
  it("registers and retrieves a provider", () => {
    const registry = new ProviderRegistry();
    const mock = new MockProvider();
    registry.register(mock);
    expect(registry.get("mock")).toBe(mock);
  });

  it("returns undefined for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists all registered providers", () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider());
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ id: "mock", name: "Mock Provider" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test __tests__/lib/providers/registry.test.ts
```

Expected: FAIL — `ProviderRegistry` not found.

- [ ] **Step 4: Implement registry**

Create `src/lib/providers/registry.ts`:

```typescript
import type { ImageProvider } from "./types";

export class ProviderRegistry {
  private providers = new Map<string, ImageProvider>();

  register(provider: ImageProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): ImageProvider | undefined {
    return this.providers.get(id);
  }

  list(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test __tests__/lib/providers/registry.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Write storage helper**

Create `src/lib/storage.ts`:

```typescript
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./public/uploads";

export async function saveImage(
  projectId: string,
  generationId: string,
  index: number,
  data: Buffer,
  ext = "webp"
): Promise<{ filePath: string; thumbnailPath: string }> {
  const dir = path.join(UPLOAD_DIR, "projects", projectId, generationId);
  await mkdir(dir, { recursive: true });

  const filename = `${index}.${ext}`;
  const filePath = path.join(dir, filename);
  await writeFile(filePath, data);

  // Thumbnail is same as original for now — sharp resize can be added later
  // Return paths relative to public/ for serving
  const relativePath = path.relative("./public", filePath);
  return { filePath: `/${relativePath}`, thumbnailPath: `/${relativePath}` };
}

export async function saveExportFile(
  candidateId: string,
  data: Buffer,
  ext = "3mf"
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, "exports", candidateId);
  await mkdir(dir, { recursive: true });

  const filename = `panel-${Date.now()}.${ext}`;
  const filePath = path.join(dir, filename);
  await writeFile(filePath, data);

  return `/${path.relative("./public", filePath)}`;
}

export async function readImageFile(publicPath: string): Promise<Buffer> {
  const absPath = path.join("./public", publicPath);
  return readFile(absPath);
}
```

- [ ] **Step 7: Write LocalFluxProvider**

Create `src/lib/providers/local-flux.ts`:

```typescript
import type { ImageProvider, GenerateRequest, GenerateEvent } from "./types";

const FLUX_API_URL = process.env.FLUX_API_URL || "http://localhost:8000";

export class LocalFluxProvider implements ImageProvider {
  id = "local-flux";
  name = "Local FLUX.1 Schnell";

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${FLUX_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async *generate(request: GenerateRequest): AsyncGenerator<GenerateEvent> {
    for (let i = 0; i < request.count; i++) {
      try {
        const res = await fetch(`${FLUX_API_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_prompt: request.prompt,
            variations: [request.prompt],
            count: 1,
            size: request.width,
            steps: (request.params?.steps as number) ?? 4,
            seed: request.seed ? request.seed + i : undefined,
          }),
        });

        if (!res.ok) {
          yield { type: "error", index: i, message: `FLUX API error: ${res.status}` };
          continue;
        }

        // The choirapp server streams SSE events
        const reader = res.body?.getReader();
        if (!reader) {
          yield { type: "error", index: i, message: "No response body" };
          continue;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let imageData: Buffer | null = null;
        let imageSeed = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (event.type === "progress") {
                yield { type: "progress", index: i, step: event.step ?? 0, totalSteps: event.total_steps ?? 4 };
              } else if (event.type === "image" && event.image) {
                imageData = Buffer.from(event.image, "base64");
                imageSeed = event.seed ?? 0;
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }

        if (imageData) {
          yield { type: "image", index: i, data: imageData, seed: imageSeed };
        } else {
          yield { type: "error", index: i, message: "No image received from FLUX" };
        }
      } catch (err) {
        yield { type: "error", index: i, message: `Generation failed: ${err}` };
      }
    }

    yield { type: "done" };
  }
}
```

- [ ] **Step 8: Write LocalFluxProvider test (mock fetch)**

Create `__tests__/lib/providers/local-flux.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalFluxProvider } from "@/lib/providers/local-flux";

describe("LocalFluxProvider", () => {
  const provider = new LocalFluxProvider();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("has correct id and name", () => {
    expect(provider.id).toBe("local-flux");
    expect(provider.name).toBe("Local FLUX.1 Schnell");
  });

  it("healthCheck returns false when server is down", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Connection refused"));
    expect(await provider.healthCheck()).toBe(false);
  });

  it("healthCheck returns true when server responds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    expect(await provider.healthCheck()).toBe(true);
  });

  it("yields error event when API returns non-200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("error", { status: 500 }));

    const events = [];
    for await (const event of provider.generate({
      prompt: "test",
      count: 1,
      width: 512,
      height: 512,
    })) {
      events.push(event);
    }

    expect(events).toContainEqual(
      expect.objectContaining({ type: "error", index: 0 })
    );
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });
});
```

- [ ] **Step 9: Run tests**

```bash
pnpm test __tests__/lib/providers/
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/providers/ src/lib/storage.ts __tests__/lib/providers/
git commit -m "feat: add ImageProvider interface, LocalFluxProvider, and storage helpers"
```

---

### Task 6: Generation API Route + SSE Streaming

**Files:**
- Create: `src/app/api/projects/[id]/generations/route.ts`
- Create: `src/app/api/projects/[id]/images/[imageId]/route.ts`
- Create: `src/app/api/projects/[id]/candidates/route.ts`
- Create: `src/app/api/projects/[id]/candidates/[cid]/route.ts`

- [ ] **Step 1: Create generation API with SSE**

Create `src/app/api/projects/[id]/generations/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { LocalFluxProvider } from "@/lib/providers/local-flux";
import { saveImage } from "@/lib/storage";

const provider = new LocalFluxProvider();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await request.json();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });
  }

  // Create generation record
  const generation = await prisma.generation.create({
    data: {
      projectId,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt ?? "",
      provider: provider.id,
      modelParams: body.params ?? {},
    },
  });

  // Stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const event of provider.generate({
          prompt: body.prompt,
          negativePrompt: body.negativePrompt,
          count: body.count ?? 4,
          width: project.widthMm >= 500 ? 1024 : 512,
          height: project.heightMm >= 500 ? 1024 : 512,
          seed: body.seed,
          params: body.params,
        })) {
          if (event.type === "progress") {
            send({ type: "progress", index: event.index, step: event.step, totalSteps: event.totalSteps });
          } else if (event.type === "image") {
            const { filePath, thumbnailPath } = await saveImage(
              projectId, generation.id, event.index, event.data
            );
            const image = await prisma.image.create({
              data: {
                generationId: generation.id,
                filePath,
                thumbnailPath,
                seed: event.seed,
              },
            });
            send({ type: "image", index: event.index, image: { id: image.id, filePath, seed: Number(image.seed) } });
          } else if (event.type === "error") {
            send({ type: "error", index: event.index, message: event.message });
          } else if (event.type === "done") {
            send({ type: "done", generationId: generation.id });
          }
        }
      } catch (err) {
        send({ type: "error", index: -1, message: `Stream error: ${err}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create image star/unstar API**

Create `src/app/api/projects/[id]/images/[imageId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { imageId } = await params;
  const body = await request.json();
  const image = await prisma.image.update({
    where: { id: imageId },
    data: {
      starred: body.starred,
      notes: body.notes,
    },
  });
  return NextResponse.json(image);
}
```

- [ ] **Step 3: Create candidate API routes**

Create `src/app/api/projects/[id]/candidates/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const candidates = await prisma.candidate.findMany({
    where: { projectId },
    include: { image: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(candidates);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await request.json();

  const candidate = await prisma.candidate.create({
    data: {
      projectId,
      imageId: body.imageId,
      name: body.name,
      notes: body.notes ?? "",
    },
  });

  // Update project status to active
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "active" },
  });

  return NextResponse.json(candidate, { status: 201 });
}
```

Create `src/app/api/projects/[id]/candidates/[cid]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id: cid },
    include: {
      image: true,
      colorMappings: { orderBy: { createdAt: "desc" } },
      exports: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(candidate);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  const body = await request.json();
  const candidate = await prisma.candidate.update({
    where: { id: cid },
    data: body,
  });
  return NextResponse.json(candidate);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  await prisma.candidate.delete({ where: { id: cid } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add generation SSE API, image star, and candidate CRUD routes"
```

---

### Task 7: Design Explorer UI

**Files:**
- Create: `src/components/prompt-bar.tsx`
- Create: `src/components/generation-progress.tsx`
- Create: `src/components/image-grid.tsx`
- Create: `src/app/projects/[id]/layout.tsx`
- Create: `src/app/projects/[id]/page.tsx`
- Create: `src/app/projects/[id]/explore/page.tsx`

- [ ] **Step 1: Create prompt bar component**

Create `src/components/prompt-bar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PromptBarProps = {
  defaultPrompt?: string;
  onGenerate: (prompt: string, count: number) => void;
  isGenerating: boolean;
};

export function PromptBar({ defaultPrompt = "", onGenerate, isGenerating }: PromptBarProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [count, setCount] = useState(4);

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Describe your art panel design... e.g. 'A cello surrounded by flowing Art Nouveau vines and curves'"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
      />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="count" className="text-sm whitespace-nowrap">Generate</Label>
          <Input
            id="count"
            type="number"
            min={1}
            max={8}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-16"
          />
          <span className="text-sm text-muted-foreground">images</span>
        </div>
        <Button onClick={() => onGenerate(prompt, count)} disabled={isGenerating || !prompt.trim()}>
          {isGenerating ? "Generating..." : "Generate"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create generation progress component**

Create `src/components/generation-progress.tsx`:

```tsx
"use client";

type ProgressEvent = {
  index: number;
  step: number;
  totalSteps: number;
};

type GenerationProgressProps = {
  events: ProgressEvent[];
  totalImages: number;
  completedImages: number;
};

export function GenerationProgress({ events, totalImages, completedImages }: GenerationProgressProps) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium">
        Generating: {completedImages}/{totalImages} complete
      </p>
      <div className="flex gap-2">
        {Array.from({ length: totalImages }, (_, i) => {
          const progress = events.find((e) => e.index === i);
          const completed = completedImages > i;
          const pct = completed ? 100 : progress ? (progress.step / progress.totalSteps) * 100 : 0;
          return (
            <div key={i} className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create image grid component**

Create `src/components/image-grid.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type ImageItem = {
  id: string;
  filePath: string;
  seed: number;
  starred: boolean;
  notes: string;
};

type ImageGridProps = {
  images: ImageItem[];
  projectId: string;
  filter: "all" | "starred";
  onFilterChange: (filter: "all" | "starred") => void;
  onUpdate: () => void;
};

export function ImageGrid({ images, projectId, filter, onFilterChange, onUpdate }: ImageGridProps) {
  const [promoteDialogImage, setPromoteDialogImage] = useState<ImageItem | null>(null);
  const [candidateName, setCandidateName] = useState("");

  const filtered = filter === "starred" ? images.filter((img) => img.starred) : images;

  async function toggleStar(image: ImageItem) {
    await fetch(`/api/projects/${projectId}/images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !image.starred }),
    });
    onUpdate();
  }

  async function promote() {
    if (!promoteDialogImage || !candidateName.trim()) return;
    await fetch(`/api/projects/${projectId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: promoteDialogImage.id, name: candidateName }),
    });
    setPromoteDialogImage(null);
    setCandidateName("");
    onUpdate();
  }

  return (
    <>
      <div className="flex gap-2 mb-4">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => onFilterChange("all")}>
          All ({images.length})
        </Button>
        <Button variant={filter === "starred" ? "default" : "outline"} size="sm" onClick={() => onFilterChange("starred")}>
          Starred ({images.filter((i) => i.starred).length})
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((img) => (
          <div key={img.id} className="relative group rounded-lg overflow-hidden border">
            <Image
              src={img.filePath}
              alt={`Generated design`}
              width={512}
              height={512}
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="secondary" onClick={() => toggleStar(img)}>
                {img.starred ? "★" : "☆"}
              </Button>
              {img.starred && (
                <Button size="sm" variant="secondary" onClick={() => { setPromoteDialogImage(img); setCandidateName(""); }}>
                  Promote
                </Button>
              )}
            </div>
            {img.starred && (
              <div className="absolute top-2 left-2 text-yellow-400 text-lg">★</div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!promoteDialogImage} onOpenChange={(open) => !open && setPromoteDialogImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Candidate name, e.g. 'Art Nouveau v2'"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && promote()}
            />
          </div>
          <DialogFooter>
            <Button onClick={promote} disabled={!candidateName.trim()}>Promote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Create project layout with navigation**

Create `src/app/projects/[id]/layout.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-muted-foreground hover:text-foreground">&larr;</Link>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <span className="text-sm text-muted-foreground">
          {project.widthMm} x {project.heightMm}mm
        </span>
      </div>
      <nav className="flex gap-1 mb-6 border-b">
        <Link href={`/projects/${id}`} className="px-4 py-2 text-sm hover:bg-muted rounded-t-md">
          Overview
        </Link>
        <Link href={`/projects/${id}/explore`} className="px-4 py-2 text-sm hover:bg-muted rounded-t-md">
          Explore
        </Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Create project overview page with candidate cards**

Create `src/components/candidate-card.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CandidateCardProps = {
  projectId: string;
  id: string;
  name: string;
  status: string;
  imagePath: string;
};

export function CandidateCard({ projectId, id, name, status, imagePath }: CandidateCardProps) {
  const statusLabel: Record<string, string> = {
    exploring_colors: "Color Mapping",
    previewing: "Previewing",
    exported: "Exported",
  };

  return (
    <Link href={`/projects/${projectId}/candidates/${id}/colors`}>
      <Card className="hover:border-primary transition-colors cursor-pointer overflow-hidden">
        <div className="aspect-square relative">
          <Image src={imagePath} alt={name} fill className="object-cover" />
        </div>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{name}</CardTitle>
            <Badge variant="secondary">{statusLabel[status] ?? status}</Badge>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
```

Create `src/app/projects/[id]/page.tsx`:

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CandidateCard } from "@/components/candidate-card";

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { candidates: { include: { image: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();

  return (
    <div>
      <div className="mb-6">
        <p className="text-muted-foreground">{project.theme || "No theme"}</p>
        <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
      </div>

      <h2 className="text-xl font-semibold mb-4">
        Candidates ({project.candidates.length})
      </h2>

      {project.candidates.length === 0 ? (
        <p className="text-muted-foreground">No candidates yet. Go to Explore to generate designs and promote favorites.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {project.candidates.map((c) => (
            <CandidateCard
              key={c.id}
              projectId={id}
              id={c.id}
              name={c.name}
              status={c.status}
              imagePath={c.image.filePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create explore page**

Create `src/app/projects/[id]/explore/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, use } from "react";
import { PromptBar } from "@/components/prompt-bar";
import { GenerationProgress } from "@/components/generation-progress";
import { ImageGrid } from "@/components/image-grid";

type ImageItem = {
  id: string;
  filePath: string;
  seed: number;
  starred: boolean;
  notes: string;
};

type ProgressEvent = {
  index: number;
  step: number;
  totalSteps: number;
};

export default function ExplorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [generateCount, setGenerateCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "starred">("all");

  const loadImages = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    const project = await res.json();
    const allImages: ImageItem[] = [];
    for (const gen of project.generations ?? []) {
      for (const img of gen.images ?? []) {
        allImages.push({
          id: img.id,
          filePath: img.filePath,
          seed: Number(img.seed),
          starred: img.starred,
          notes: img.notes,
        });
      }
    }
    setImages(allImages);
  }, [projectId]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function handleGenerate(prompt: string, count: number) {
    setIsGenerating(true);
    setProgressEvents([]);
    setGenerateCount(count);
    setCompletedCount(0);

    const res = await fetch(`/api/projects/${projectId}/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, count }),
    });

    const reader = res.body?.getReader();
    if (!reader) { setIsGenerating(false); return; }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const chunk of lines) {
        if (!chunk.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(chunk.slice(6));
          if (event.type === "progress") {
            setProgressEvents((prev) => {
              const updated = prev.filter((e) => e.index !== event.index);
              return [...updated, { index: event.index, step: event.step, totalSteps: event.totalSteps }];
            });
          } else if (event.type === "image") {
            setCompletedCount((c) => c + 1);
          } else if (event.type === "done") {
            loadImages();
          }
        } catch {
          // skip
        }
      }
    }

    setIsGenerating(false);
  }

  return (
    <div className="space-y-6">
      <PromptBar onGenerate={handleGenerate} isGenerating={isGenerating} />
      {isGenerating && (
        <GenerationProgress events={progressEvents} totalImages={generateCount} completedImages={completedCount} />
      )}
      <ImageGrid
        images={images}
        projectId={projectId}
        filter={filter}
        onFilterChange={setFilter}
        onUpdate={loadImages}
      />
    </div>
  );
}
```

- [ ] **Step 7: Verify the explorer UI renders**

Run `pnpm dev`. Create a project, navigate to its Explore page. The prompt bar and empty grid should render. Generation will only work when the FLUX server is running — that's expected.

- [ ] **Step 8: Commit**

```bash
git add src/ __tests__/
git commit -m "feat: add design explorer with prompt bar, image grid, SSE progress, and candidate promotion"
```

---

## Phase 3: Filament Library

### Task 8: Filament CRUD API + UI

**Files:**
- Create: `src/app/api/filaments/route.ts`
- Create: `src/app/api/filaments/[id]/route.ts`
- Create: `src/components/filament-form.tsx`
- Create: `src/app/filaments/page.tsx`
- Create: `__tests__/api/filaments.test.ts`

- [ ] **Step 1: Write filament API test**

Create `__tests__/api/filaments.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

describe("Filaments", () => {
  beforeEach(async () => {
    await prisma.filament.deleteMany();
  });

  it("creates a filament", async () => {
    const filament = await prisma.filament.create({
      data: {
        brand: "Polymaker",
        name: "PolyTerra PLA",
        colorName: "Cotton White",
        hexColor: "#FFFFFF",
        material: "PLA",
        translucent: false,
        owned: true,
      },
    });
    expect(filament.brand).toBe("Polymaker");
    expect(filament.hexColor).toBe("#FFFFFF");
  });

  it("filters by owned status", async () => {
    await prisma.filament.createMany({
      data: [
        { brand: "A", name: "A", colorName: "Red", hexColor: "#FF0000", owned: true },
        { brand: "B", name: "B", colorName: "Blue", hexColor: "#0000FF", owned: false },
      ],
    });
    const owned = await prisma.filament.findMany({ where: { owned: true } });
    expect(owned).toHaveLength(1);
    expect(owned[0].colorName).toBe("Red");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
pnpm test __tests__/api/filaments.test.ts
```

Expected: PASS.

- [ ] **Step 3: Create filament API routes**

Create `src/app/api/filaments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const owned = request.nextUrl.searchParams.get("owned");
  const where = owned !== null ? { owned: owned === "true" } : {};
  const filaments = await prisma.filament.findMany({
    where,
    orderBy: [{ brand: "asc" }, { colorName: "asc" }],
  });
  return NextResponse.json(filaments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const filament = await prisma.filament.create({
    data: {
      brand: body.brand,
      name: body.name,
      colorName: body.colorName,
      hexColor: body.hexColor,
      material: body.material ?? "PLA",
      translucent: body.translucent ?? false,
      owned: body.owned ?? true,
      notes: body.notes ?? "",
    },
  });
  return NextResponse.json(filament, { status: 201 });
}
```

Create `src/app/api/filaments/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const filament = await prisma.filament.update({ where: { id }, data: body });
  return NextResponse.json(filament);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.filament.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create filament form component**

Create `src/components/filament-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type FilamentFormProps = {
  onSave: () => void;
  onCancel: () => void;
};

export function FilamentForm({ onSave, onCancel }: FilamentFormProps) {
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [colorName, setColorName] = useState("");
  const [hexColor, setHexColor] = useState("#FFFFFF");
  const [material, setMaterial] = useState("PLA");
  const [translucent, setTranslucent] = useState(false);
  const [owned, setOwned] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/filaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand, name, colorName, hexColor, material, translucent, owned }),
    });
    onSave();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} required placeholder="e.g. Polymaker" />
          </div>
          <div>
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. PolyTerra PLA" />
          </div>
          <div>
            <Label htmlFor="colorName">Color Name</Label>
            <Input id="colorName" value={colorName} onChange={(e) => setColorName(e.target.value)} required placeholder="e.g. Cotton White" />
          </div>
          <div>
            <Label htmlFor="hexColor">Color</Label>
            <div className="flex gap-2">
              <input type="color" value={hexColor} onChange={(e) => setHexColor(e.target.value)} className="h-10 w-12 rounded border cursor-pointer" />
              <Input id="hexColor" value={hexColor} onChange={(e) => setHexColor(e.target.value)} placeholder="#FFFFFF" />
            </div>
          </div>
          <div>
            <Label htmlFor="material">Material</Label>
            <Input id="material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="PLA" />
          </div>
          <div className="flex items-center gap-6 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={translucent} onChange={(e) => setTranslucent(e.target.checked)} />
              Translucent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
              Owned
            </label>
          </div>
          <div className="col-span-2 flex gap-2">
            <Button type="submit">Save Filament</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create filament library page**

Create `src/app/filaments/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilamentForm } from "@/components/filament-form";

type Filament = {
  id: string;
  brand: string;
  name: string;
  colorName: string;
  hexColor: string;
  material: string;
  translucent: boolean;
  owned: boolean;
};

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "owned" | "catalog">("all");

  const load = useCallback(async () => {
    const params = filter === "owned" ? "?owned=true" : filter === "catalog" ? "?owned=false" : "";
    const res = await fetch(`/api/filaments${params}`);
    setFilaments(await res.json());
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function deleteFilament(id: string) {
    await fetch(`/api/filaments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Filament Library</h1>
        <Button onClick={() => setShowForm(true)}>+ Add Filament</Button>
      </div>

      <div className="flex gap-2 mb-6">
        {(["all", "owned", "catalog"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {showForm && (
        <div className="mb-6">
          <FilamentForm onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filaments.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="w-10 h-10 rounded-md border shrink-0" style={{ backgroundColor: f.hexColor }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{f.colorName}</p>
              <p className="text-xs text-muted-foreground">{f.brand} &middot; {f.name} &middot; {f.material}</p>
            </div>
            <div className="flex items-center gap-2">
              {f.translucent && <Badge variant="outline" className="text-xs">Translucent</Badge>}
              {f.owned && <Badge variant="secondary" className="text-xs">Owned</Badge>}
              <Button variant="ghost" size="sm" onClick={() => deleteFilament(f.id)} className="text-destructive">
                &times;
              </Button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Add filament library link to root layout**

Modify `src/app/layout.tsx` — add a nav bar at the top:

In the `<body>` tag, wrap children with a nav:

```tsx
<body className={/* existing classes */}>
  <nav className="border-b">
    <div className="container mx-auto px-8 py-3 flex gap-6">
      <a href="/" className="font-semibold">ArtPanels</a>
      <a href="/filaments" className="text-sm text-muted-foreground hover:text-foreground">Filaments</a>
    </div>
  </nav>
  {children}
</body>
```

- [ ] **Step 7: Verify**

Run `pnpm dev`. Visit `/filaments`. Add a few filaments. Verify they appear in the list with colored swatches.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add filament library with CRUD API and management UI"
```

---

## Phase 4: Color Processing

### Task 9: CIELAB + Delta-E + K-means Libraries

**Files:**
- Create: `src/lib/color/cielab.ts`
- Create: `src/lib/color/delta-e.ts`
- Create: `src/lib/color/kmeans.ts`
- Create: `src/lib/color/quantize.ts`
- Create: `__tests__/lib/color/cielab.test.ts`
- Create: `__tests__/lib/color/delta-e.test.ts`
- Create: `__tests__/lib/color/kmeans.test.ts`
- Create: `__tests__/lib/color/quantize.test.ts`

- [ ] **Step 1: Write CIELAB conversion test**

Create `__tests__/lib/color/cielab.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { rgbToLab, labToRgb } from "@/lib/color/cielab";

describe("CIELAB conversions", () => {
  it("converts white RGB to LAB", () => {
    const lab = rgbToLab(255, 255, 255);
    expect(lab.L).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it("converts black RGB to LAB", () => {
    const lab = rgbToLab(0, 0, 0);
    expect(lab.L).toBeCloseTo(0, 0);
  });

  it("round-trips a color", () => {
    const original = { r: 128, g: 64, b: 200 };
    const lab = rgbToLab(original.r, original.g, original.b);
    const back = labToRgb(lab.L, lab.a, lab.b);
    expect(back.r).toBeCloseTo(original.r, 0);
    expect(back.g).toBeCloseTo(original.g, 0);
    expect(back.b).toBeCloseTo(original.b, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test __tests__/lib/color/cielab.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement CIELAB conversions**

Create `src/lib/color/cielab.ts`:

```typescript
// D65 illuminant reference
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

export type Lab = { L: number; a: number; b: number };

function srgbToLinear(c: number): number {
  c = c / 255;
  return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function linearToSrgb(c: number): number {
  const v = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  return Math.round(Math.max(0, Math.min(255, v * 255)));
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labFInv(t: number): number {
  return t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / REF_X * 100;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / REF_Y * 100;
  const z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / REF_Z * 100;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const x = labFInv(fx) * REF_X / 100;
  const y = labFInv(fy) * REF_Y / 100;
  const z = labFInv(fz) * REF_Z / 100;

  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const gl = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  return {
    r: linearToSrgb(rl),
    g: linearToSrgb(gl),
    b: linearToSrgb(bl),
  };
}
```

- [ ] **Step 4: Run CIELAB test**

```bash
pnpm test __tests__/lib/color/cielab.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write Delta-E test**

Create `__tests__/lib/color/delta-e.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deltaE00 } from "@/lib/color/delta-e";

describe("Delta-E CIEDE2000", () => {
  it("returns 0 for identical colors", () => {
    expect(deltaE00({ L: 50, a: 25, b: -10 }, { L: 50, a: 25, b: -10 })).toBeCloseTo(0, 4);
  });

  it("returns small value for similar colors", () => {
    const de = deltaE00({ L: 50, a: 25, b: -10 }, { L: 51, a: 26, b: -9 });
    expect(de).toBeLessThan(3);
    expect(de).toBeGreaterThan(0);
  });

  it("returns large value for very different colors", () => {
    const de = deltaE00({ L: 0, a: 0, b: 0 }, { L: 100, a: 0, b: 0 });
    expect(de).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm test __tests__/lib/color/delta-e.test.ts
```

Expected: FAIL.

- [ ] **Step 7: Implement CIEDE2000**

Create `src/lib/color/delta-e.ts`:

```typescript
import type { Lab } from "./cielab";

// CIEDE2000 implementation
// Reference: https://en.wikipedia.org/wiki/Color_difference#CIEDE2000
export function deltaE00(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const avgLp = (L1 + L2) / 2;
  const avgCp = (C1p + C2p) / 2;

  let avgHp: number;
  if (C1p * C2p === 0) {
    avgHp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    avgHp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * avgHp) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.20 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2);
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const RT =
    -2 *
    Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7)) *
    Math.sin((60 * Math.exp(-(((avgHp - 275) / 25) ** 2)) * Math.PI) / 180);

  return Math.sqrt(
    (dLp / SL) ** 2 +
    (dCp / SC) ** 2 +
    (dHp / SH) ** 2 +
    RT * (dCp / SC) * (dHp / SH)
  );
}
```

- [ ] **Step 8: Run Delta-E test**

```bash
pnpm test __tests__/lib/color/delta-e.test.ts
```

Expected: PASS.

- [ ] **Step 9: Write K-means test**

Create `__tests__/lib/color/kmeans.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { kmeansLab } from "@/lib/color/kmeans";
import type { Lab } from "@/lib/color/cielab";

describe("K-means in CIELAB", () => {
  it("clusters two distinct groups", () => {
    const points: Lab[] = [
      // Group 1: bright
      { L: 90, a: 0, b: 0 },
      { L: 92, a: 1, b: -1 },
      { L: 88, a: -1, b: 1 },
      // Group 2: dark
      { L: 10, a: 0, b: 0 },
      { L: 12, a: 1, b: -1 },
      { L: 8, a: -1, b: 1 },
    ];

    const result = kmeansLab(points, 2, 20);

    expect(result.centroids).toHaveLength(2);
    // One centroid should be near L=90, other near L=10
    const ls = result.centroids.map((c) => c.L).sort((a, b) => a - b);
    expect(ls[0]).toBeCloseTo(10, -1);
    expect(ls[1]).toBeCloseTo(90, -1);
  });

  it("assigns every point to a cluster", () => {
    const points: Lab[] = Array.from({ length: 20 }, (_, i) => ({
      L: i * 5,
      a: 0,
      b: 0,
    }));

    const result = kmeansLab(points, 4, 20);
    expect(result.assignments).toHaveLength(20);
    result.assignments.forEach((a) => {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(4);
    });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
pnpm test __tests__/lib/color/kmeans.test.ts
```

Expected: FAIL.

- [ ] **Step 11: Implement K-means**

Create `src/lib/color/kmeans.ts`:

```typescript
import type { Lab } from "./cielab";

function labDistance(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export type KmeansResult = {
  centroids: Lab[];
  assignments: number[];
};

export function kmeansLab(points: Lab[], k: number, maxIterations = 30): KmeansResult {
  // Initialize centroids using k-means++ style: spread evenly through sorted points
  const sorted = [...points].sort((a, b) => a.L - b.L);
  const step = Math.max(1, Math.floor(sorted.length / k));
  let centroids: Lab[] = Array.from({ length: k }, (_, i) => ({
    ...sorted[Math.min(i * step, sorted.length - 1)],
  }));

  let assignments = new Array<number>(points.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = points.map((p) => {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = labDistance(p, centroids[c]);
        if (d < minDist) {
          minDist = d;
          minIdx = c;
        }
      }
      return minIdx;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    // Recompute centroids
    centroids = centroids.map((_, c) => {
      const members = points.filter((_, i) => assignments[i] === c);
      if (members.length === 0) return centroids[c];
      return {
        L: members.reduce((s, p) => s + p.L, 0) / members.length,
        a: members.reduce((s, p) => s + p.a, 0) / members.length,
        b: members.reduce((s, p) => s + p.b, 0) / members.length,
      };
    });
  }

  return { centroids, assignments };
}
```

- [ ] **Step 12: Run K-means test**

```bash
pnpm test __tests__/lib/color/kmeans.test.ts
```

Expected: PASS.

- [ ] **Step 13: Write quantize orchestrator test**

Create `__tests__/lib/color/quantize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { quantizeAndMatch } from "@/lib/color/quantize";

describe("quantizeAndMatch", () => {
  it("reduces colors and matches to filaments", () => {
    // Simple 4-pixel "image" with 2 distinct colors
    const pixels = [
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 10, b: 5 },
      { r: 0, g: 0, b: 255 },
      { r: 5, g: 10, b: 250 },
    ];
    const filaments = [
      { id: "red-fil", hexColor: "#FF0000" },
      { id: "blue-fil", hexColor: "#0000FF" },
      { id: "green-fil", hexColor: "#00FF00" },
    ];

    const result = quantizeAndMatch(pixels, 2, filaments);

    expect(result.mappings).toHaveLength(2);
    // Each mapping should have matched a filament
    const filamentIds = result.mappings.map((m) => m.filamentId);
    expect(filamentIds).toContain("red-fil");
    expect(filamentIds).toContain("blue-fil");
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

```bash
pnpm test __tests__/lib/color/quantize.test.ts
```

Expected: FAIL.

- [ ] **Step 15: Implement quantize orchestrator**

Create `src/lib/color/quantize.ts`:

```typescript
import { rgbToLab, labToRgb, type Lab } from "./cielab";
import { kmeansLab } from "./kmeans";
import { deltaE00 } from "./delta-e";

type Pixel = { r: number; g: number; b: number };
type FilamentRef = { id: string; hexColor: string };

export type ColorMappingEntry = {
  sourceRgb: string;
  sourceLab: Lab;
  filamentId: string;
  targetRgb: string;
  deltaE: number;
};

export type QuantizeResult = {
  mappings: ColorMappingEntry[];
  assignments: number[];
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function quantizeAndMatch(
  pixels: Pixel[],
  numColors: number,
  filaments: FilamentRef[]
): QuantizeResult {
  // Convert pixels to LAB
  const labPixels = pixels.map((p) => rgbToLab(p.r, p.g, p.b));

  // K-means clustering
  const { centroids, assignments } = kmeansLab(labPixels, numColors);

  // Match each centroid to nearest filament
  const filamentLabs = filaments.map((f) => {
    const rgb = hexToRgb(f.hexColor);
    return { ...f, lab: rgbToLab(rgb.r, rgb.g, rgb.b) };
  });

  const mappings: ColorMappingEntry[] = centroids.map((centroid) => {
    let bestDe = Infinity;
    let bestFilament = filaments[0];

    for (const f of filamentLabs) {
      const de = deltaE00(centroid, f.lab);
      if (de < bestDe) {
        bestDe = de;
        bestFilament = f;
      }
    }

    const sourceRgb = labToRgb(centroid.L, centroid.a, centroid.b);
    const targetRgb = hexToRgb(bestFilament.hexColor);

    return {
      sourceRgb: rgbToHex(sourceRgb.r, sourceRgb.g, sourceRgb.b),
      sourceLab: centroid,
      filamentId: bestFilament.id,
      targetRgb: bestFilament.hexColor,
      deltaE: Math.round(bestDe * 10) / 10,
    };
  });

  return { mappings, assignments };
}
```

- [ ] **Step 16: Run all color tests**

```bash
pnpm test __tests__/lib/color/
```

Expected: All tests PASS.

- [ ] **Step 17: Commit**

```bash
git add src/lib/color/ __tests__/lib/color/
git commit -m "feat: add CIELAB, Delta-E CIEDE2000, K-means, and color quantization pipeline"
```

---

### Task 10: Color Mapping API + UI

**Files:**
- Create: `src/app/api/projects/[id]/candidates/[cid]/color-mappings/route.ts`
- Create: `src/components/color-mapper.tsx`
- Create: `src/components/color-swatch.tsx`
- Create: `src/app/projects/[id]/candidates/[cid]/colors/page.tsx`

- [ ] **Step 1: Create color mapping API**

Create `src/app/api/projects/[id]/candidates/[cid]/color-mappings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readImageFile } from "@/lib/storage";
import { quantizeAndMatch } from "@/lib/color/quantize";
import sharp from "sharp";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  const mappings = await prisma.colorMapping.findMany({
    where: { candidateId: cid },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(mappings);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  const body = await request.json();

  const candidate = await prisma.candidate.findUnique({
    where: { id: cid },
    include: { image: true },
  });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Read the image and extract pixel data
  const imageBuffer = await readImageFile(candidate.image.filePath);
  const { data, info } = await sharp(imageBuffer)
    .resize(256, 256, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += info.channels) {
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }

  // Get filaments
  const filaments = await prisma.filament.findMany({
    where: body.ownedOnly !== false ? { owned: true } : {},
  });

  if (filaments.length === 0) {
    return NextResponse.json({ error: "No filaments in library" }, { status: 400 });
  }

  const numColors = body.numColors ?? 4;
  const result = quantizeAndMatch(
    pixels,
    numColors,
    filaments.map((f) => ({ id: f.id, hexColor: f.hexColor }))
  );

  const colorMapping = await prisma.colorMapping.create({
    data: {
      candidateId: cid,
      algorithm: "kmeans",
      numColors,
      mappings: result.mappings.map((m) => ({
        sourceRgb: m.sourceRgb,
        filamentId: m.filamentId,
        targetRgb: m.targetRgb,
        deltaE: m.deltaE,
      })),
    },
  });

  return NextResponse.json(colorMapping, { status: 201 });
}
```

- [ ] **Step 2: Install sharp**

```bash
pnpm add sharp
```

- [ ] **Step 3: Create color swatch component**

Create `src/components/color-swatch.tsx`:

```tsx
type ColorSwatchProps = {
  sourceColor: string;
  targetColor: string;
  filamentName: string;
  deltaE: number;
  onOverride?: () => void;
};

export function ColorSwatch({ sourceColor, targetColor, filamentName, deltaE, onOverride }: ColorSwatchProps) {
  const quality = deltaE < 5 ? "text-green-500" : deltaE < 10 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className="w-8 h-8 rounded border" style={{ backgroundColor: sourceColor }} title={sourceColor} />
      <span className="text-muted-foreground">&rarr;</span>
      <div className="w-8 h-8 rounded border" style={{ backgroundColor: targetColor }} title={targetColor} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filamentName}</p>
        <p className={`text-xs ${quality}`}>ΔE: {deltaE}</p>
      </div>
      {onOverride && (
        <button onClick={onOverride} className="text-xs text-muted-foreground hover:text-foreground">
          Change
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create color mapper component**

Create `src/components/color-mapper.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ColorSwatch } from "@/components/color-swatch";

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

type ColorMapperProps = {
  projectId: string;
  candidateId: string;
  imagePath: string;
  filaments: { id: string; brand: string; colorName: string; hexColor: string }[];
};

export function ColorMapper({ projectId, candidateId, imagePath, filaments }: ColorMapperProps) {
  const [numColors, setNumColors] = useState(4);
  const [mapping, setMapping] = useState<ColorMappingRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLatest = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/color-mappings`);
    const data = await res.json();
    if (data.length > 0) setMapping(data[0]);
  }, [projectId, candidateId]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  async function quantize() {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/color-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numColors }),
    });
    const data = await res.json();
    setMapping(data);
    setLoading(false);
  }

  const filamentMap = Object.fromEntries(filaments.map((f) => [f.id, f]));

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        <div className="flex-1">
          <h3 className="text-sm font-medium mb-2">Original</h3>
          <Image src={imagePath} alt="Original" width={400} height={400} className="rounded-lg border w-full" />
        </div>
        {mapping && (
          <div className="flex-1">
            <h3 className="text-sm font-medium mb-2">Mapped to Filaments</h3>
            <div className="rounded-lg border aspect-square bg-muted flex items-center justify-center text-muted-foreground">
              Preview (coming with canvas rendering)
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Label htmlFor="numColors">Colors (CMS slots)</Label>
        <Input id="numColors" type="number" min={2} max={16} value={numColors} onChange={(e) => setNumColors(Number(e.target.value))} className="w-20" />
        <Button onClick={quantize} disabled={loading}>
          {loading ? "Analyzing..." : mapping ? "Re-analyze" : "Auto-match Colors"}
        </Button>
      </div>

      {mapping && (
        <div className="space-y-2">
          <h3 className="font-medium">Color Assignments</h3>
          {(mapping.mappings as Mapping[]).map((m, i) => (
            <ColorSwatch
              key={i}
              sourceColor={m.sourceRgb}
              targetColor={m.targetRgb}
              filamentName={filamentMap[m.filamentId]?.colorName ?? "Unknown"}
              deltaE={m.deltaE}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create colors page**

Create `src/app/projects/[id]/candidates/[cid]/colors/page.tsx`:

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ColorMapper } from "@/components/color-mapper";

export default async function ColorsPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id: cid },
    include: { image: true },
  });
  if (!candidate) notFound();

  const filaments = await prisma.filament.findMany({
    where: { owned: true },
    orderBy: [{ brand: "asc" }, { colorName: "asc" }],
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Color Mapping — {candidate.name}</h2>
      <ColorMapper
        projectId={id}
        candidateId={cid}
        imagePath={candidate.image.filePath}
        filaments={filaments.map((f) => ({
          id: f.id,
          brand: f.brand,
          colorName: f.colorName,
          hexColor: f.hexColor,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run `pnpm dev`. Navigate to a candidate's colors page. Add some filaments first if empty. Click "Auto-match Colors". Verify color swatches appear with Delta-E scores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add color mapping API, K-means quantization, and color mapper UI"
```

---

## Phase 5: 3D Preview & Export

### Task 11: Height Map to Mesh

**Files:**
- Create: `src/lib/export/mesh.ts`
- Create: `__tests__/lib/export/mesh.test.ts`

- [ ] **Step 1: Write mesh generation test**

Create `__tests__/lib/export/mesh.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateMesh, type MeshData } from "@/lib/export/mesh";

describe("generateMesh", () => {
  it("generates a single-pixel mesh with 12 triangles", () => {
    const mesh = generateMesh({
      pixels: [{ brightness: 0.5, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
      panelWidthMm: 10,
      panelHeightMm: 10,
      thicknessMinMm: 0.4,
      thicknessMaxMm: 2.0,
    });

    // 1 column = 6 faces = 12 triangles
    expect(mesh.triangles).toHaveLength(12);
    // 8 vertices for a box
    expect(mesh.vertices).toHaveLength(8);
  });

  it("generates correct dimensions for 2x2 grid", () => {
    const mesh = generateMesh({
      pixels: [
        { brightness: 0, materialIndex: 0 },
        { brightness: 1, materialIndex: 0 },
        { brightness: 0.5, materialIndex: 1 },
        { brightness: 0.5, materialIndex: 1 },
      ],
      gridWidth: 2,
      gridHeight: 2,
      panelWidthMm: 20,
      panelHeightMm: 20,
      thicknessMinMm: 0.4,
      thicknessMaxMm: 2.0,
    });

    // 4 columns × 12 triangles each
    expect(mesh.triangles).toHaveLength(48);
    // Each column has material index assigned
    expect(mesh.triangles[0].materialIndex).toBeDefined();
  });

  it("maps brightness 0 to max thickness and 1 to min thickness", () => {
    // For lithophanes: dark = thick = opaque, bright = thin = translucent
    const mesh = generateMesh({
      pixels: [{ brightness: 0, materialIndex: 0 }],
      gridWidth: 1,
      gridHeight: 1,
      panelWidthMm: 10,
      panelHeightMm: 10,
      thicknessMinMm: 0.4,
      thicknessMaxMm: 2.0,
    });

    const maxZ = Math.max(...mesh.vertices.map((v) => v.z));
    expect(maxZ).toBeCloseTo(2.0, 1); // dark pixel = max thickness
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test __tests__/lib/export/mesh.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement mesh generation**

Create `src/lib/export/mesh.ts`:

```typescript
export type Vertex = { x: number; y: number; z: number };
export type Triangle = { v1: number; v2: number; v3: number; materialIndex: number };
export type MeshData = { vertices: Vertex[]; triangles: Triangle[] };

type MeshInput = {
  pixels: { brightness: number; materialIndex: number }[];
  gridWidth: number;
  gridHeight: number;
  panelWidthMm: number;
  panelHeightMm: number;
  thicknessMinMm: number;
  thicknessMaxMm: number;
};

export function generateMesh(input: MeshInput): MeshData {
  const { pixels, gridWidth, gridHeight, panelWidthMm, panelHeightMm, thicknessMinMm, thicknessMaxMm } = input;
  const cellW = panelWidthMm / gridWidth;
  const cellH = panelHeightMm / gridHeight;

  const vertices: Vertex[] = [];
  const triangles: Triangle[] = [];

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const idx = row * gridWidth + col;
      const pixel = pixels[idx];

      // Lithophane: brightness 0 (dark) = max thickness, brightness 1 (bright) = min thickness
      const thickness = thicknessMaxMm - pixel.brightness * (thicknessMaxMm - thicknessMinMm);

      const x0 = col * cellW;
      const x1 = (col + 1) * cellW;
      const y0 = row * cellH;
      const y1 = (row + 1) * cellH;
      const z0 = 0;
      const z1 = thickness;

      const base = vertices.length;

      // 8 vertices of the box
      vertices.push(
        { x: x0, y: y0, z: z0 }, // 0: bottom-front-left
        { x: x1, y: y0, z: z0 }, // 1: bottom-front-right
        { x: x1, y: y1, z: z0 }, // 2: bottom-back-right
        { x: x0, y: y1, z: z0 }, // 3: bottom-back-left
        { x: x0, y: y0, z: z1 }, // 4: top-front-left
        { x: x1, y: y0, z: z1 }, // 5: top-front-right
        { x: x1, y: y1, z: z1 }, // 6: top-back-right
        { x: x0, y: y1, z: z1 }, // 7: top-back-left
      );

      const m = pixel.materialIndex;
      // 6 faces × 2 triangles each = 12 triangles
      // Bottom face
      triangles.push({ v1: base + 0, v2: base + 2, v3: base + 1, materialIndex: m });
      triangles.push({ v1: base + 0, v2: base + 3, v3: base + 2, materialIndex: m });
      // Top face
      triangles.push({ v1: base + 4, v2: base + 5, v3: base + 6, materialIndex: m });
      triangles.push({ v1: base + 4, v2: base + 6, v3: base + 7, materialIndex: m });
      // Front face
      triangles.push({ v1: base + 0, v2: base + 1, v3: base + 5, materialIndex: m });
      triangles.push({ v1: base + 0, v2: base + 5, v3: base + 4, materialIndex: m });
      // Back face
      triangles.push({ v1: base + 2, v2: base + 3, v3: base + 7, materialIndex: m });
      triangles.push({ v1: base + 2, v2: base + 7, v3: base + 6, materialIndex: m });
      // Left face
      triangles.push({ v1: base + 0, v2: base + 4, v3: base + 7, materialIndex: m });
      triangles.push({ v1: base + 0, v2: base + 7, v3: base + 3, materialIndex: m });
      // Right face
      triangles.push({ v1: base + 1, v2: base + 2, v3: base + 6, materialIndex: m });
      triangles.push({ v1: base + 1, v2: base + 6, v3: base + 5, materialIndex: m });
    }
  }

  return { vertices, triangles };
}
```

- [ ] **Step 4: Run mesh test**

```bash
pnpm test __tests__/lib/export/mesh.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/mesh.ts __tests__/lib/export/mesh.test.ts
git commit -m "feat: add height map to mesh generation for 3D panels"
```

---

### Task 12: 3MF Package Builder

**Files:**
- Create: `src/lib/export/threemf.ts`
- Create: `__tests__/lib/export/threemf.test.ts`

- [ ] **Step 1: Install archiver for ZIP**

```bash
pnpm add archiver
pnpm add -D @types/archiver
```

- [ ] **Step 2: Write 3MF test**

Create `__tests__/lib/export/threemf.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { build3mf } from "@/lib/export/threemf";
import type { MeshData } from "@/lib/export/mesh";
import JSZip from "jszip";

describe("build3mf", () => {
  it("produces a valid ZIP with required files", async () => {
    const mesh: MeshData = {
      vertices: [
        { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 }, { x: 0, y: 0, z: 1 },
      ],
      triangles: [
        { v1: 0, v2: 1, v3: 2, materialIndex: 0 },
        { v1: 0, v2: 2, v3: 3, materialIndex: 0 },
      ],
    };
    const materials = [{ name: "PLA White", hexColor: "#FFFFFF" }];

    const buffer = await build3mf(mesh, materials);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify ZIP structure
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("_rels/.rels")).not.toBeNull();
    expect(zip.file("3D/3dmodel.model")).not.toBeNull();

    // Verify model contains mesh data
    const model = await zip.file("3D/3dmodel.model")!.async("string");
    expect(model).toContain("<vertices>");
    expect(model).toContain("<triangles>");
    expect(model).toContain("<basematerials");
  });
});
```

- [ ] **Step 3: Install jszip for test verification**

```bash
pnpm add -D jszip
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm test __tests__/lib/export/threemf.test.ts
```

Expected: FAIL.

- [ ] **Step 5: Implement 3MF builder**

Create `src/lib/export/threemf.ts`:

```typescript
import archiver from "archiver";
import type { MeshData } from "./mesh";

type Material = { name: string; hexColor: string };

function hexToRgb(hex: string): string {
  // 3MF uses #RRGGBB format
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function buildModelXml(mesh: MeshData, materials: Material[]): string {
  const verticesXml = mesh.vertices
    .map((v) => `        <vertex x="${v.x}" y="${v.y}" z="${v.z}" />`)
    .join("\n");

  const trianglesXml = mesh.triangles
    .map((t) => `        <triangle v1="${t.v1}" v2="${t.v2}" v3="${t.v3}" pid="1" p1="${t.materialIndex}" />`)
    .join("\n");

  const materialsXml = materials
    .map((m) => `      <base name="${m.name}" displaycolor="${hexToRgb(m.hexColor)}" />`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
${materialsXml}
    </basematerials>
    <object id="2" type="model">
      <mesh>
        <vertices>
${verticesXml}
        </vertices>
        <triangles>
${trianglesXml}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="2" />
  </build>
</model>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

export async function build3mf(mesh: MeshData, materials: Material[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    archive.append(CONTENT_TYPES, { name: "[Content_Types].xml" });
    archive.append(RELS, { name: "_rels/.rels" });
    archive.append(buildModelXml(mesh, materials), { name: "3D/3dmodel.model" });

    archive.finalize();
  });
}
```

- [ ] **Step 6: Run 3MF test**

```bash
pnpm test __tests__/lib/export/threemf.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/export/threemf.ts __tests__/lib/export/threemf.test.ts
git commit -m "feat: add 3MF package builder with multi-material support"
```

---

### Task 13: 3D Preview with Three.js

**Files:**
- Create: `src/components/panel-viewer.tsx`
- Create: `src/app/projects/[id]/candidates/[cid]/preview/page.tsx`

- [ ] **Step 1: Install Three.js dependencies**

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

- [ ] **Step 2: Create panel viewer component**

Create `src/components/panel-viewer.tsx`:

```tsx
"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type PanelViewerProps = {
  imageUrl: string;
  widthMm: number;
  heightMm: number;
  thicknessMinMm: number;
  thicknessMaxMm: number;
  colors?: { sourceRgb: string; targetRgb: string }[];
};

function PanelMesh({
  widthMm,
  heightMm,
  thicknessMaxMm,
}: {
  widthMm: number;
  heightMm: number;
  thicknessMaxMm: number;
}) {
  const geometry = useMemo(() => {
    // Simple box placeholder — in production this would be the actual height-map mesh
    const geo = new THREE.BoxGeometry(widthMm, heightMm, thicknessMaxMm);
    return geo;
  }, [widthMm, heightMm, thicknessMaxMm]);

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color="#cccccc"
        transparent
        opacity={0.7}
        transmission={0.3}
        roughness={0.2}
        thickness={thicknessMaxMm}
      />
    </mesh>
  );
}

function BackLight() {
  return (
    <rectAreaLight
      width={500}
      height={500}
      intensity={2}
      color="#ffffff"
      position={[0, 0, -50]}
      rotation={[0, Math.PI, 0]}
    />
  );
}

export function PanelViewer({
  widthMm,
  heightMm,
  thicknessMinMm,
  thicknessMaxMm,
}: PanelViewerProps) {
  const maxDim = Math.max(widthMm, heightMm);

  return (
    <div className="w-full aspect-[4/3] rounded-lg border bg-black">
      <Canvas camera={{ position: [0, 0, maxDim * 1.5], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[100, 100, 100]} intensity={0.5} />
        <BackLight />
        <PanelMesh
          widthMm={widthMm}
          heightMm={heightMm}
          thicknessMaxMm={thicknessMaxMm}
        />
        <OrbitControls enableDamping />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 3: Create preview page**

Create `src/app/projects/[id]/candidates/[cid]/preview/page.tsx`:

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

const PanelViewer = dynamic(() => import("@/components/panel-viewer").then((m) => m.PanelViewer), {
  ssr: false,
  loading: () => <div className="w-full aspect-[4/3] rounded-lg border bg-black animate-pulse" />,
});

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id: cid },
    include: { image: true, project: true },
  });
  if (!candidate) notFound();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">3D Preview — {candidate.name}</h2>
      <PanelViewer
        imageUrl={candidate.image.filePath}
        widthMm={candidate.project.widthMm}
        heightMm={candidate.project.heightMm}
        thicknessMinMm={candidate.project.thicknessMinMm}
        thicknessMaxMm={candidate.project.thicknessMaxMm}
      />
      <p className="text-sm text-muted-foreground">
        Rotate: drag. Zoom: scroll. Pan: right-click drag.
        Backlit to simulate window translucency.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify the 3D viewer renders**

Run `pnpm dev`. Navigate to a candidate's preview page. A 3D box should render with orbit controls and backlighting. This is a placeholder geometry — the real height-map mesh will be integrated when the full pipeline is connected.

- [ ] **Step 5: Commit**

```bash
git add src/components/panel-viewer.tsx src/app/projects/\[id\]/candidates/\[cid\]/preview/
git commit -m "feat: add Three.js 3D panel preview with backlit translucency simulation"
```

---

### Task 14: Export API + Download Page

**Files:**
- Create: `src/app/api/projects/[id]/candidates/[cid]/exports/route.ts`
- Create: `src/app/projects/[id]/candidates/[cid]/export/page.tsx`

- [ ] **Step 1: Create export API**

Create `src/app/api/projects/[id]/candidates/[cid]/exports/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readImageFile, saveExportFile } from "@/lib/storage";
import { generateMesh } from "@/lib/export/mesh";
import { build3mf } from "@/lib/export/threemf";
import sharp from "sharp";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  const exports = await prisma.export.findMany({
    where: { candidateId: cid },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(exports);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { cid } = await params;
  const body = await request.json();

  const candidate = await prisma.candidate.findUnique({
    where: { id: cid },
    include: {
      image: true,
      project: true,
      colorMappings: { where: { isFinal: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  // Use the latest color mapping (final or most recent)
  let colorMapping = candidate.colorMappings[0];
  if (!colorMapping) {
    const latest = await prisma.colorMapping.findFirst({
      where: { candidateId: cid },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return NextResponse.json({ error: "No color mapping found. Run color matching first." }, { status: 400 });
    colorMapping = latest;
  }

  const resolution = body.resolution ?? 128;
  const mappings = colorMapping.mappings as { sourceRgb: string; filamentId: string; targetRgb: string }[];

  // Read and resize image
  const imageBuffer = await readImageFile(candidate.image.filePath);
  const { data, info } = await sharp(imageBuffer)
    .resize(resolution, resolution, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Get filament details for material names
  const filamentIds = [...new Set(mappings.map((m) => m.filamentId))];
  const filaments = await prisma.filament.findMany({ where: { id: { in: filamentIds } } });
  const filamentMap = Object.fromEntries(filaments.map((f) => [f.id, f]));

  // Build material list
  const materials = mappings.map((m) => {
    const f = filamentMap[m.filamentId];
    return { name: f ? `${f.brand} ${f.colorName}` : "Unknown", hexColor: m.targetRgb };
  });

  // Convert source RGB strings to LAB centroids for pixel assignment
  const mappingRgbs = mappings.map((m) => {
    const hex = m.sourceRgb.replace("#", "");
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  });

  // Assign each pixel to nearest mapping centroid and compute brightness
  const pixels = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Find nearest centroid by RGB distance
    let minDist = Infinity;
    let materialIndex = 0;
    for (let m = 0; m < mappingRgbs.length; m++) {
      const mr = mappingRgbs[m];
      const dist = (r - mr.r) ** 2 + (g - mr.g) ** 2 + (b - mr.b) ** 2;
      if (dist < minDist) {
        minDist = dist;
        materialIndex = m;
      }
    }

    pixels.push({ brightness, materialIndex });
  }

  const mesh = generateMesh({
    pixels,
    gridWidth: resolution,
    gridHeight: resolution,
    panelWidthMm: candidate.project.widthMm,
    panelHeightMm: candidate.project.heightMm,
    thicknessMinMm: candidate.project.thicknessMinMm,
    thicknessMaxMm: candidate.project.thicknessMaxMm,
  });

  const threemfBuffer = await build3mf(mesh, materials);
  const filePath = await saveExportFile(cid, threemfBuffer);

  const exportRecord = await prisma.export.create({
    data: {
      candidateId: cid,
      colorMappingId: colorMapping.id,
      filePath,
      format: "3mf",
      settings: { resolution },
    },
  });

  // Update candidate status
  await prisma.candidate.update({
    where: { id: cid },
    data: { status: "exported" },
  });

  return NextResponse.json(exportRecord, { status: 201 });
}
```

- [ ] **Step 2: Create export page**

Create `src/app/projects/[id]/candidates/[cid]/export/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type ExportRecord = {
  id: string;
  filePath: string;
  format: string;
  settings: { resolution: number };
  createdAt: string;
};

export default function ExportPage({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id: projectId, cid: candidateId } = use(params);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [resolution, setResolution] = useState(128);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/exports`);
    setExports(await res.json());
  }, [projectId, candidateId]);

  useEffect(() => { load(); }, [load]);

  async function generate3mf() {
    setGenerating(true);
    await fetch(`/api/projects/${projectId}/candidates/${candidateId}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    await load();
    setGenerating(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Export 3MF</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate New Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="resolution">Resolution (pixels per side)</Label>
            <Input
              id="resolution"
              type="number"
              min={32}
              max={512}
              step={32}
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Higher resolution = more detail but larger file. 128 is good for testing, 256-512 for final prints.
            A 256x256 grid produces ~786K triangles.
          </p>
          <Button onClick={generate3mf} disabled={generating}>
            {generating ? "Generating 3MF..." : "Generate 3MF"}
          </Button>
        </CardContent>
      </Card>

      {exports.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Previous Exports</h3>
          {exports.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{exp.format.toUpperCase()} — {exp.settings.resolution}px</p>
                <p className="text-xs text-muted-foreground">{new Date(exp.createdAt).toLocaleString()}</p>
              </div>
              <a href={exp.filePath} download>
                <Button variant="outline" size="sm">Download</Button>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run `pnpm dev`. Navigate to a candidate with a color mapping → Export page. Generate a 3MF at low resolution (64). Click download. Open the `.3mf` file in OrcaSlicer or Creality Print to verify it loads.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add 3MF export API and download page with configurable resolution"
```

---

## Phase 6: Polish & Navigation

### Task 15: Candidate Navigation Layout

**Files:**
- Modify: `src/app/projects/[id]/layout.tsx`
- Create: `src/app/projects/[id]/candidates/[cid]/layout.tsx` (if not created)

- [ ] **Step 1: Add candidate-level layout with tabs**

Create `src/app/projects/[id]/candidates/[cid]/layout.tsx` (if it doesn't exist yet):

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function CandidateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  const candidate = await prisma.candidate.findUnique({ where: { id: cid } });
  if (!candidate) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Link href={`/projects/${id}`} className="text-muted-foreground hover:text-foreground text-sm">
          &larr; All Candidates
        </Link>
        <h2 className="font-semibold">{candidate.name}</h2>
      </div>
      <nav className="flex gap-1 mb-6 border-b">
        <Link href={`/projects/${id}/candidates/${cid}/colors`} className="px-4 py-2 text-sm hover:bg-muted rounded-t-md">
          Colors
        </Link>
        <Link href={`/projects/${id}/candidates/${cid}/preview`} className="px-4 py-2 text-sm hover:bg-muted rounded-t-md">
          3D Preview
        </Link>
        <Link href={`/projects/${id}/candidates/${cid}/export`} className="px-4 py-2 text-sm hover:bg-muted rounded-t-md">
          Export
        </Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify full navigation flow**

Run `pnpm dev`:
1. Dashboard → Create Project → Explore (generate images if FLUX is running, or skip)
2. Project Overview → shows candidates
3. Candidate → Colors tab → 3D Preview tab → Export tab
4. Filament Library accessible from top nav

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add candidate navigation layout with tabs"
```

---

### Task 16: Final Integration Test + Push

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 2: Run type check**

```bash
pnpm tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Fix any build errors.

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Verify GitHub repo**

Visit https://github.com/NicNite/artpanels — all code should be up.
