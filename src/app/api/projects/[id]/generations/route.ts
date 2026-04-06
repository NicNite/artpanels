import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LocalFluxProvider } from "@/lib/providers/local-flux";
import { saveImage } from "@/lib/storage";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate project exists
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { prompt, negativePrompt, provider = "local-flux", modelParams = {}, count = 1, seed } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Determine image dimensions based on project size
  const maxDim = Math.max(project.widthMm, project.heightMm);
  const px = maxDim >= 500 ? 1024 : 512;

  // Create Generation record
  const generation = await db.generation.create({
    data: {
      projectId: id,
      prompt,
      negativePrompt,
      provider,
      modelParams,
    },
  });

  // Return SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        const generator = LocalFluxProvider.generate({
          prompt,
          negativePrompt,
          count,
          width: px,
          height: px,
          seed,
          params: modelParams,
        });

        for await (const evt of generator) {
          if (evt.type === "progress") {
            send("progress", { index: evt.index, step: evt.step, totalSteps: evt.totalSteps });
          } else if (evt.type === "image") {
            // Save image to disk
            const { filePath, thumbnailPath } = await saveImage(
              id,
              generation.id,
              evt.index,
              evt.data
            );

            // Create Image record in DB
            const image = await db.image.create({
              data: {
                generationId: generation.id,
                filePath,
                thumbnailPath,
                seed: evt.seed != null ? BigInt(evt.seed) : null,
              },
            });

            send("image", {
              id: image.id,
              path: filePath,
              seed: evt.seed,
              index: evt.index,
            });
          } else if (evt.type === "error") {
            send("error", { index: evt.index, message: evt.message });
          } else if (evt.type === "done") {
            send("done", { generationId: generation.id });
          }
        }
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
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
